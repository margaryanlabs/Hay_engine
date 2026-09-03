import "server-only";

import { HAY_PLANS, type HayPlan } from "@/lib/pricing";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { evaluateUsageAllowance, type UsageMeter } from "@/lib/commercial/usage-policy";

export type { UsageMeter } from "@/lib/commercial/usage-policy";
export type CommercialPlanId = HayPlan["id"] | "agency";

const ZERO_USAGE: Record<UsageMeter, number> = {
  content_assets: 0,
  ai_video_credits: 0,
  voice_minutes: 0,
};

const AGENCY_LIMITS = {
  brands: 25,
  channels: 40,
  contentAssets: 1500,
  aiVideoCredits: 250,
  voiceMinutes: 2500,
};

function planLimits(planId: CommercialPlanId) {
  if (planId === "agency") return AGENCY_LIMITS;
  return HAY_PLANS.find((plan) => plan.id === planId)?.limits ?? HAY_PLANS[0].limits;
}

export function planEnforcementEnabled() {
  return process.env.HAY_ENFORCE_PLANS === "true";
}

export async function getCommercialContext() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      authenticated: false,
      enforcementEnabled: false,
      migrationReady: false,
      planId: "free" as CommercialPlanId,
      status: "demo",
      limits: planLimits("free"),
      usage: { ...ZERO_USAGE },
      remaining: {
        content_assets: planLimits("free").contentAssets,
        ai_video_credits: planLimits("free").aiVideoCredits,
        voice_minutes: planLimits("free").voiceMinutes,
      },
    };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;
  if (claimsError || !userId) {
    return {
      configured: true,
      authenticated: false,
      enforcementEnabled: planEnforcementEnabled(),
      migrationReady: true,
      planId: "free" as CommercialPlanId,
      status: "unauthenticated",
      limits: planLimits("free"),
      usage: { ...ZERO_USAGE },
      remaining: { ...ZERO_USAGE },
    };
  }

  let migrationReady = true;
  let entitlement: {
    plan_id?: string;
    status?: string;
    current_period_start?: string;
    current_period_end?: string;
    overrides?: Record<string, number> | null;
  } | null = null;

  const entitlementRead = await supabase
    .from("account_entitlements")
    .select("plan_id,status,current_period_start,current_period_end,overrides")
    .eq("owner_id", userId)
    .maybeSingle();

  if (entitlementRead.error) {
    migrationReady = false;
  } else {
    entitlement = entitlementRead.data;
  }

  if (migrationReady && !entitlement) {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    const inserted = await supabase.from("account_entitlements").insert({
      owner_id: userId,
      plan_id: "free",
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
    }).select("plan_id,status,current_period_start,current_period_end,overrides").single();
    if (inserted.error) migrationReady = false;
    else entitlement = inserted.data;
  }

  const rawPlan = entitlement?.plan_id;
  const planId = (["free", "creator", "growth", "business", "agency"].includes(String(rawPlan))
    ? rawPlan
    : "free") as CommercialPlanId;
  const baseLimits = planLimits(planId);
  const overrides = entitlement?.overrides && typeof entitlement.overrides === "object" ? entitlement.overrides : {};
  const limits = {
    brands: Number(overrides.brands ?? baseLimits.brands),
    channels: Number(overrides.channels ?? baseLimits.channels),
    contentAssets: Number(overrides.contentAssets ?? baseLimits.contentAssets),
    aiVideoCredits: Number(overrides.aiVideoCredits ?? baseLimits.aiVideoCredits),
    voiceMinutes: Number(overrides.voiceMinutes ?? baseLimits.voiceMinutes),
  };

  const usage = { ...ZERO_USAGE };
  if (migrationReady) {
    const since = entitlement?.current_period_start ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
    const usageRead = await supabase.from("usage_events").select("meter,quantity").eq("owner_id", userId).gte("created_at", since);
    if (usageRead.error) {
      migrationReady = false;
    } else {
      for (const row of usageRead.data ?? []) {
        const meter = row.meter as UsageMeter;
        if (meter in usage) usage[meter] += Number(row.quantity) || 0;
      }
    }
  }

  return {
    configured: true,
    authenticated: true,
    userId,
    enforcementEnabled: planEnforcementEnabled(),
    migrationReady,
    planId,
    status: entitlement?.status ?? "active",
    currentPeriodStart: entitlement?.current_period_start ?? null,
    currentPeriodEnd: entitlement?.current_period_end ?? null,
    limits,
    usage,
    remaining: {
      content_assets: Math.max(0, limits.contentAssets - usage.content_assets),
      ai_video_credits: Math.max(0, limits.aiVideoCredits - usage.ai_video_credits),
      voice_minutes: Math.max(0, limits.voiceMinutes - usage.voice_minutes),
    },
  };
}

export async function checkUsageAllowance(meter: UsageMeter, quantity = 1) {
  const context = await getCommercialContext();
  const decision = evaluateUsageAllowance(context, meter, quantity);
  return decision.allowed
    ? { allowed: true as const, context }
    : { allowed: false as const, reason: decision.reason, context };
}

export async function recordUsage(input: {
  meter: UsageMeter;
  quantity: number;
  businessId?: string | null;
  source: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isSupabaseConfigured() || input.quantity <= 0) return { recorded: false, reason: "not_applicable" };
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;
  if (!userId) return { recorded: false, reason: "unauthenticated" };

  let usageBusinessId: string | null = null;
  if (input.businessId) {
    const { data: ownedBusiness } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", input.businessId)
      .eq("owner_id", userId)
      .maybeSingle();
    usageBusinessId = ownedBusiness?.id ? String(ownedBusiness.id) : null;
  }

  const { error } = await supabase.from("usage_events").insert({
    owner_id: userId,
    business_id: usageBusinessId,
    meter: input.meter,
    quantity: input.quantity,
    source: input.source,
    idempotency_key: input.idempotencyKey || null,
    metadata: input.metadata || {},
  });
  if (error) {
    if (String(error.code) === "23505") return { recorded: true, duplicate: true };
    return { recorded: false, reason: error.message };
  }
  return { recorded: true, businessId: usageBusinessId };
}
