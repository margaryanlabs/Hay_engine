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
  "app/api/business/analyze/route.ts",
  "app/api/marketing/autopilot/route.ts",
  "app/api/marketing/campaign/route.ts",
  "app/api/marketing/experiment/route.ts",
];
for (const route of meteredProviderRoutes) {
  const source = readFileSync(route, "utf8");
  assert.match(source, /checkUsageAllowance\s*\(/, `${route} must gate provider-backed generation before calling AI providers`);
  assert.match(source, /recordUsage\s*\(/, `${route} must meter generated content after successful persistence`);
}

const meteredLanguageRoutes = [
  "app/api/translate/route.ts",
  "app/api/transcribe/route.ts",
];
for (const route of meteredLanguageRoutes) {
  const source = readFileSync(route, "utf8");
  assert.match(source, /checkLanguageProviderAccess\s*\(/, `${route} must preserve the language-specific auth/demo policy`);
  assert.match(source, /checkUsageAllowance\s*\(/, `${route} must enforce bounded authenticated Studio usage before provider calls`);
  assert.match(source, /recordUsage\s*\(/, `${route} must meter successful provider-backed language work`);
}

const translateRouteSource = readFileSync("app/api/translate/route.ts", "utf8");
assert.match(
  translateRouteSource,
  /MAX_TRANSLATE_CHARS\s*=\s*20_000/,
  "Studio translation must keep a hard per-request text size bound",
);

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

const videoRouteSource = readFileSync("app/api/video/route.ts", "utf8");
assert.match(
  videoRouteSource,
  /metadata:\s*\{[\s\S]*?operationName[\s\S]*?\}/,
  "Veo generation must persist the normalized operation name in the owner usage ledger",
);
const ownershipCall = videoRouteSource.indexOf("await checkOwnedProviderOperation(");
const providerPollCall = videoRouteSource.indexOf("await getVeoOperation(operationName)");
assert.ok(
  ownershipCall >= 0 && providerPollCall > ownershipCall,
  "Veo polling must prove operation ownership before calling the Google provider",
);

const providerOperationSource = readFileSync("lib/commercial/provider-operations.ts", "utf8");
assert.match(
  providerOperationSource,
  /\.from\("usage_events"\)[\s\S]*?\.eq\("owner_id", context\.userId\)[\s\S]*?\.eq\("source", input\.source\)[\s\S]*?\.contains\("metadata", \{ operationName: input\.operationName \}\)/,
  "Provider operation ownership must be resolved from the authenticated owner's durable usage ledger",
);

const voiceRouteSource = readFileSync("app/api/voice/route.ts", "utf8");
const voicePreflightCall = voiceRouteSource.indexOf("await checkUsageAllowance(\"voice_minutes\",preflightMinutes)");
const voiceNaturalizerCall = voiceRouteSource.indexOf("await naturalizeArmenianText(text,style)");
assert.ok(
  voicePreflightCall >= 0 && voiceNaturalizerCall > voicePreflightCall,
  "Voice allowance must be checked before the OpenAI-backed Armenian naturalizer can run",
);

const contentFactorySource = readFileSync("app/api/marketing/content/create/route.ts", "utf8");
const factoryHyPreflight = contentFactorySource.indexOf("await checkUsageAllowance(\"voice_minutes\",preflightMinutes)");
const factoryNaturalizer = contentFactorySource.indexOf("await naturalizeArmenianText(project.voice.text,style)");
assert.ok(
  factoryHyPreflight >= 0 && factoryNaturalizer > factoryHyPreflight,
  "Content Factory must check Armenian voice capacity before its OpenAI-backed naturalizer runs",
);
const elevenSpeechCall = contentFactorySource.indexOf("await createElevenSpeech(project.voice.text,voiceId)");
const elevenAllowanceCall = contentFactorySource.lastIndexOf("await checkUsageAllowance(\"voice_minutes\",minutes)", elevenSpeechCall);
const factoryVoiceUsageCall = contentFactorySource.indexOf("source:\"content_factory_voice\"", elevenSpeechCall);
assert.ok(
  elevenSpeechCall >= 0 && elevenAllowanceCall >= 0 && elevenAllowanceCall < elevenSpeechCall,
  "Content Factory must check voice capacity before non-Armenian ElevenLabs TTS",
);
assert.ok(
  factoryVoiceUsageCall > elevenSpeechCall,
  "Content Factory must meter non-Armenian ElevenLabs speech after a successful provider call",
);

console.log(JSON.stringify({
  securityPolicy: "passed",
  cases: 30,
  providerCostRoutes: meteredProviderRoutes,
  meteredLanguageRoutes,
  usageBusinessOwnership: true,
  productionProviderFailClosed: true,
  veoOperationOwnership: true,
  voicePreProviderGate: true,
  contentFactoryVoicePreProviderGate: true,
  contentFactoryAllVoiceMetered: true,
  translationSizeBound: true,
}, null, 2));
