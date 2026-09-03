export type UsageMeter = "content_assets" | "ai_video_credits" | "voice_minutes";

export type UsagePolicyContext = {
  configured: boolean;
  authenticated: boolean;
  enforcementEnabled: boolean;
  migrationReady: boolean;
  status: string;
  limits: {
    contentAssets: number;
    aiVideoCredits: number;
    voiceMinutes: number;
  };
  usage: Record<UsageMeter, number>;
};

export type UsageAllowanceDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "unauthorized"
        | "commercial_migration_required"
        | "subscription_inactive"
        | "plan_limit_reached";
    };

function limitForMeter(context: UsagePolicyContext, meter: UsageMeter) {
  if (meter === "content_assets") return context.limits.contentAssets;
  if (meter === "ai_video_credits") return context.limits.aiVideoCredits;
  return context.limits.voiceMinutes;
}

export function evaluateUsageAllowance(
  context: UsagePolicyContext,
  meter: UsageMeter,
  quantity = 1,
): UsageAllowanceDecision {
  // Local/demo mode may run without Supabase. Once persistent identity is configured,
  // provider-backed endpoints always require an authenticated account regardless of
  // whether commercial plan enforcement has been switched on yet.
  if (!context.configured) return { allowed: true };
  if (!context.authenticated) return { allowed: false, reason: "unauthorized" };

  // HAY_ENFORCE_PLANS controls subscription/usage limits, not authentication.
  if (!context.enforcementEnabled) return { allowed: true };
  if (!context.migrationReady) return { allowed: false, reason: "commercial_migration_required" };
  if (!["active", "trialing"].includes(context.status)) {
    return { allowed: false, reason: "subscription_inactive" };
  }

  const requested = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const used = Number(context.usage[meter]) || 0;
  const limit = Math.max(0, Number(limitForMeter(context, meter)) || 0);
  if (used + requested > limit) return { allowed: false, reason: "plan_limit_reached" };
  return { allowed: true };
}
