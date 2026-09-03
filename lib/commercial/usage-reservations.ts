import "server-only";

import { checkUsageAllowance, recordUsage, type UsageMeter } from "@/lib/commercial/entitlements";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export type UsageReservationReason =
  | "unauthorized"
  | "commercial_migration_required"
  | "subscription_inactive"
  | "plan_limit_reached"
  | "request_in_progress"
  | "atomic_usage_admin_required"
  | "atomic_usage_migration_required"
  | "atomic_usage_reservation_failed";

type ReservationInput = {
  meter: UsageMeter;
  quantity: number;
  businessId?: string | null;
  source: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

type NonAtomicReservation = {
  allowed: true;
  atomic: false;
  duplicate: false;
  input: ReservationInput;
  context: Awaited<ReturnType<typeof checkUsageAllowance>>["context"];
};

type AtomicReservation = {
  allowed: true;
  atomic: true;
  duplicate: false;
  eventId: string;
  releaseToken: string;
  ownerId: string;
  input: ReservationInput;
  context: Awaited<ReturnType<typeof checkUsageAllowance>>["context"];
};

type AtomicDuplicate = {
  allowed: true;
  atomic: true;
  duplicate: true;
  eventId: string | null;
  metadata: Record<string, unknown>;
  input: ReservationInput;
  context: Awaited<ReturnType<typeof checkUsageAllowance>>["context"];
};

export type UsageReservation = NonAtomicReservation | AtomicReservation | AtomicDuplicate;

export type UsageReservationFailure = {
  allowed: false;
  reason: UsageReservationReason | string;
  context: Awaited<ReturnType<typeof checkUsageAllowance>>["context"];
  duplicate?: boolean;
  detail?: string;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function makeReleaseToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}${crypto.randomUUID()}`;
}

export async function reserveUsage(input: ReservationInput): Promise<UsageReservation | UsageReservationFailure> {
  const preflight = await checkUsageAllowance(input.meter, input.quantity);
  if (!preflight.allowed) return { allowed:false, reason:preflight.reason, context:preflight.context };

  // Before commercial plan enforcement is enabled, preserve the existing authenticated
  // ledger path. Once enforcement is enabled, quota-consuming provider work must use
  // migration 010 so the check and reservation happen atomically in Postgres.
  if (!preflight.context.enforcementEnabled) {
    return { allowed:true, atomic:false, duplicate:false, input, context:preflight.context };
  }
  if (!preflight.context.configured || !preflight.context.authenticated || !("userId" in preflight.context) || !preflight.context.userId) {
    return { allowed:false, reason:"unauthorized", context:preflight.context };
  }
  if (!isSupabaseAdminConfigured()) {
    return { allowed:false, reason:"atomic_usage_admin_required", context:preflight.context };
  }

  const releaseToken = makeReleaseToken();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("hay_reserve_usage", {
    p_owner_id: preflight.context.userId,
    p_meter: input.meter,
    p_quantity: input.quantity,
    p_business_id: input.businessId || null,
    p_source: input.source,
    p_idempotency_key: input.idempotencyKey || null,
    p_metadata: input.metadata || {},
    p_release_token: releaseToken,
  });
  if (error) {
    console.error("Atomic usage reservation RPC failed", error.message);
    return { allowed:false, reason:"atomic_usage_migration_required", context:preflight.context, detail:error.message };
  }

  const result = object(data);
  if (result.allowed !== true) {
    return {
      allowed:false,
      reason:text(result.reason) || "atomic_usage_reservation_failed",
      duplicate:result.duplicate === true,
      context:preflight.context,
    };
  }

  if (result.duplicate === true) {
    return {
      allowed:true,
      atomic:true,
      duplicate:true,
      eventId:text(result.eventId) || null,
      metadata:object(result.metadata),
      input,
      context:preflight.context,
    };
  }

  const eventId = text(result.eventId);
  if (!eventId) {
    return { allowed:false, reason:"atomic_usage_reservation_failed", context:preflight.context };
  }
  return {
    allowed:true,
    atomic:true,
    duplicate:false,
    eventId,
    releaseToken,
    ownerId:preflight.context.userId,
    input,
    context:preflight.context,
  };
}

export async function commitUsageReservation(
  reservation: UsageReservation,
  metadataPatch: Record<string, unknown> = {},
) {
  if (reservation.duplicate) {
    return { recorded:true, duplicate:true, eventId:reservation.eventId, metadata:reservation.metadata };
  }
  if (!reservation.atomic) {
    return recordUsage({
      ...reservation.input,
      metadata:{...(reservation.input.metadata || {}),...metadataPatch},
    });
  }

  const admin = createAdminClient();
  for (let attempt=0;attempt<2;attempt++) {
    const { data, error } = await admin.rpc("hay_commit_usage_reservation", {
      p_owner_id: reservation.ownerId,
      p_event_id: reservation.eventId,
      p_release_token: reservation.releaseToken,
      p_metadata_patch: metadataPatch,
    });
    if (!error) {
      const result=object(data);
      if (result.committed === true) {
        return { recorded:true, duplicate:result.duplicate === true, eventId:reservation.eventId, metadata:object(result.metadata) };
      }
      return { recorded:false, reason:text(result.reason) || "reservation_commit_failed", eventId:reservation.eventId };
    }
    if (attempt===1) {
      console.error("Atomic usage commit RPC failed", error.message);
      return { recorded:false, reason:error.message, eventId:reservation.eventId };
    }
  }
  return { recorded:false, reason:"reservation_commit_failed", eventId:reservation.eventId };
}

export async function releaseUsageReservation(reservation: UsageReservation) {
  if (reservation.duplicate || !reservation.atomic) return { released:false, reason:"not_applicable" };
  const admin=createAdminClient();
  const {data,error}=await admin.rpc("hay_release_usage_reservation",{
    p_owner_id:reservation.ownerId,
    p_event_id:reservation.eventId,
    p_release_token:reservation.releaseToken,
  });
  if(error){
    console.error("Atomic usage release RPC failed",error.message);
    return {released:false,reason:error.message};
  }
  const result=object(data);
  return {released:result.released===true,reason:text(result.reason)||undefined,eventId:reservation.eventId};
}
