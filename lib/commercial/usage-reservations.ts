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

type CommercialContext = Awaited<ReturnType<typeof checkUsageAllowance>>["context"];

type NonAtomicReservation = {
  allowed: true;
  atomic: false;
  duplicate: false;
  input: ReservationInput;
  context: CommercialContext;
};

type AtomicReservation = {
  allowed: true;
  atomic: true;
  duplicate: false;
  eventId: string;
  releaseToken: string;
  ownerId: string;
  input: ReservationInput;
  context: CommercialContext;
};

type AtomicDuplicate = {
  allowed: true;
  atomic: true;
  duplicate: true;
  eventId: string | null;
  metadata: Record<string, unknown>;
  input: ReservationInput;
  context: CommercialContext;
};

export type UsageReservation = NonAtomicReservation | AtomicReservation | AtomicDuplicate;

export type UsageReservationFailure = {
  allowed: false;
  reason: UsageReservationReason | string;
  context: CommercialContext;
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

export async function atomicUsageMigrationsReady(){
  if(!isSupabaseAdminConfigured())return false;
  try{
    const admin=createAdminClient();
    const [ledger,reserve,resize]=await Promise.all([
      admin.from("usage_events").select("id,state,reservation_expires_at",{head:true,count:"exact"}).limit(1),
      // Mutation-free capability probes. Null owner IDs return owner_required when the
      // RPCs exist; a missing 010/011 migration returns a PostgREST RPC error instead.
      admin.rpc("hay_reserve_usage",{
        p_owner_id:null,
        p_meter:"content_assets",
        p_quantity:1,
        p_business_id:null,
        p_source:"migration_probe",
        p_idempotency_key:null,
        p_metadata:{},
        p_release_token:"migration-probe-release-token-0000000000000000",
      }),
      admin.rpc("hay_resize_usage_reservation",{
        p_owner_id:null,
        p_event_id:null,
        p_release_token:"migration-probe-release-token-0000000000000000",
        p_quantity:1,
      }),
    ]);
    return !ledger.error&&!reserve.error&&!resize.error;
  }catch{return false;}
}

export async function reserveUsage(input: ReservationInput): Promise<UsageReservation | UsageReservationFailure> {
  const preflight = await checkUsageAllowance(input.meter, input.quantity);
  const context = preflight.context;

  // Before commercial enforcement is enabled, preserve the existing ledger behavior.
  // Once enforcement is enabled, the database reservation RPC becomes authoritative:
  // a non-atomic JS allowance result must never decide quota because concurrent calls can
  // observe the same remaining balance. We still use the preflight context for identity,
  // migration readiness and fail-closed configuration checks.
  if (!context.enforcementEnabled) {
    if (!preflight.allowed) return { allowed:false, reason:preflight.reason, context };
    return { allowed:true, atomic:false, duplicate:false, input, context };
  }

  if (!context.configured || !context.authenticated || !("userId" in context) || !context.userId) {
    return { allowed:false, reason:"unauthorized", context };
  }
  if (!context.migrationReady) {
    return { allowed:false, reason:"commercial_migration_required", context };
  }
  if (!isSupabaseAdminConfigured()) {
    return { allowed:false, reason:"atomic_usage_admin_required", context };
  }

  const releaseToken = makeReleaseToken();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("hay_reserve_usage", {
    p_owner_id: context.userId,
    p_meter: input.meter,
    p_quantity: Math.max(0, Number(input.quantity) || 0),
    p_business_id: input.businessId || null,
    p_source: input.source,
    p_idempotency_key: input.idempotencyKey || null,
    p_metadata: input.metadata || {},
    p_release_token: releaseToken,
  });
  if (error) {
    console.error("Atomic usage reservation RPC failed", error.message);
    return { allowed:false, reason:"atomic_usage_migration_required", context, detail:error.message };
  }

  const result = object(data);
  if (result.allowed !== true) {
    return {
      allowed:false,
      reason:text(result.reason) || "atomic_usage_reservation_failed",
      duplicate:result.duplicate === true,
      context,
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
      context,
    };
  }

  const eventId = text(result.eventId);
  if (!eventId) {
    return { allowed:false, reason:"atomic_usage_reservation_failed", context };
  }
  return {
    allowed:true,
    atomic:true,
    duplicate:false,
    eventId,
    releaseToken,
    ownerId:context.userId,
    input,
    context,
  };
}

export async function resizeUsageReservation(reservation: UsageReservation, quantity: number) {
  const nextQuantity=Math.max(0,Number(quantity)||0);
  if(nextQuantity<=0)return {resized:false,reason:"invalid_quantity"};
  if(reservation.duplicate)return {resized:false,reason:"duplicate_request"};

  if(!reservation.atomic){
    const allowance=await checkUsageAllowance(reservation.input.meter,nextQuantity);
    if(!allowance.allowed)return {resized:false,reason:allowance.reason,context:allowance.context};
    reservation.input.quantity=nextQuantity;
    return {resized:true,atomic:false,quantity:nextQuantity};
  }

  const admin=createAdminClient();
  const {data,error}=await admin.rpc("hay_resize_usage_reservation",{
    p_owner_id:reservation.ownerId,
    p_event_id:reservation.eventId,
    p_release_token:reservation.releaseToken,
    p_quantity:nextQuantity,
  });
  if(error){
    console.error("Atomic usage resize RPC failed",error.message);
    return {resized:false,reason:"atomic_usage_resize_migration_required",detail:error.message};
  }
  const result=object(data);
  if(result.resized!==true)return {resized:false,reason:text(result.reason)||"reservation_resize_failed"};
  reservation.input.quantity=nextQuantity;
  return {resized:true,atomic:true,quantity:nextQuantity,eventId:reservation.eventId};
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
