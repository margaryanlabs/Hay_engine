import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateUsageAllowance,
  type UsageMeter,
  type UsagePolicyContext,
} from "../lib/commercial/usage-policy";

function context(overrides: Partial<UsagePolicyContext> = {}): UsagePolicyContext {
  return {
    configured: true,
    authenticated: true,
    allowUnauthenticatedProviderAccess: false,
    enforcementEnabled: true,
    migrationReady: true,
    status: "active",
    limits: {
      contentAssets: 10,
      aiVideoCredits: 5,
      voiceMinutes: 30,
    },
    usage: {
      content_assets: 2,
      ai_video_credits: 1,
      voice_minutes: 3,
    },
    ...overrides,
  };
}

function decision(overrides: Partial<UsagePolicyContext>, meter: UsageMeter = "content_assets", quantity = 1) {
  return evaluateUsageAllowance(context(overrides), meter, quantity);
}

assert.deepEqual(
  decision({ configured: true, authenticated: false, enforcementEnabled: false }),
  { allowed: false, reason: "unauthorized" },
  "Persistent HAY must require authentication even when plan enforcement is disabled",
);

assert.deepEqual(
  decision({ configured: true, authenticated: true, enforcementEnabled: false }),
  { allowed: true },
  "Authenticated accounts may use provider-backed routes before plan enforcement is enabled",
);

assert.deepEqual(
  decision({ configured: false, authenticated: false, allowUnauthenticatedProviderAccess: false, enforcementEnabled: false }),
  { allowed: false, reason: "unauthorized" },
  "Deployed HAY without identity must fail provider-backed access closed by default",
);

assert.deepEqual(
  decision({ configured: false, authenticated: false, allowUnauthenticatedProviderAccess: true, enforcementEnabled: false }),
  { allowed: true },
  "Local development or an explicit operator demo override may run provider-backed routes without Supabase",
);

assert.deepEqual(
  decision({ migrationReady: false }),
  { allowed: false, reason: "commercial_migration_required" },
);

assert.deepEqual(
  decision({ status: "past_due" }),
  { allowed: false, reason: "subscription_inactive" },
);

assert.deepEqual(
  decision({ usage: { content_assets: 10, ai_video_credits: 1, voice_minutes: 3 } }),
  { allowed: false, reason: "plan_limit_reached" },
);

assert.deepEqual(
  decision({}, "voice_minutes", -50),
  { allowed: true },
  "Negative requested quantities must never reduce existing usage",
);

const meteredProviderRoutes = [
  "app/api/marketing/autopilot/route.ts",
  "app/api/marketing/campaign/route.ts",
];
for (const route of meteredProviderRoutes) {
  const source = readFileSync(route, "utf8");
  assert.match(source, /checkUsageAllowance\s*\(/, `${route} must gate provider-backed generation before calling AI providers`);
  assert.match(source, /recordUsage\s*\(/, `${route} must meter generated content after successful persistence`);
}

const entitlementSource = readFileSync("lib/commercial/entitlements.ts", "utf8");
assert.match(
  entitlementSource,
  /\.from\("businesses"\)[\s\S]*?\.eq\("id", input\.businessId\)[\s\S]*?\.eq\("owner_id", userId\)/,
  "recordUsage must verify requested business ownership before attaching business_id to usage",
);
assert.match(
  entitlementSource,
  /business_id:\s*usageBusinessId/,
  "usage_events inserts must use the sanitized owned business id rather than raw request input",
);
assert.match(
  entitlementSource,
  /HAY_ALLOW_UNAUTHENTICATED_PROVIDER_API/,
  "Unauthenticated provider access must be an explicit server-side operator override",
);

console.log(JSON.stringify({ securityPolicy: "passed", cases: 11, providerCostRoutes: meteredProviderRoutes, usageBusinessOwnership: true, productionProviderFailClosed: true }, null, 2));
