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
  /commitUsageReservation\(reservation,\{operationName,[\s\S]*?\}\)/,
  "Veo generation must commit its normalized operation name into the owner usage ledger",
);
const ownershipCall = videoRouteSource.indexOf("await checkOwnedProviderOperation(");
const providerPollCall = videoRouteSource.indexOf("await getVeoOperation(operationName)");
assert.ok(
  ownershipCall >= 0 && providerPollCall > ownershipCall,
  "Veo polling must prove operation ownership before calling the Google provider",
);
const veoReserveCall=videoRouteSource.indexOf("reservation=await reserveUsage(");
const veoDuplicateBranch=videoRouteSource.indexOf("if(reservation.duplicate)");
const veoStartCall=videoRouteSource.indexOf("await startVeoVideo(");
const veoCommitCall=videoRouteSource.indexOf("await commitUsageReservation(");
assert.ok(
  veoReserveCall>=0&&veoStartCall>veoReserveCall,
  "Veo quota must be reserved before any paid Google generation call",
);
assert.ok(
  veoDuplicateBranch>veoReserveCall&&veoDuplicateBranch<veoStartCall,
  "Veo idempotency duplicates must return before the paid provider is called",
);
assert.ok(
  veoCommitCall>veoStartCall,
  "A successful Veo provider start must commit the reserved credit with provider metadata",
);
assert.match(
  videoRouteSource,
  /video_usage_commit_failed[\s\S]*?status:503/,
  "Veo must fail closed when an already-started provider job cannot commit commercial usage",
);

const providerOperationSource = readFileSync("lib/commercial/provider-operations.ts", "utf8");
assert.match(
  providerOperationSource,
  /\.from\("usage_events"\)[\s\S]*?\.eq\("owner_id", context\.userId\)[\s\S]*?\.eq\("source", input\.source\)[\s\S]*?\.contains\("metadata", \{ operationName: input\.operationName \}\)/,
  "Provider operation ownership must be resolved from the authenticated owner's durable usage ledger",
);

const reservationSource=readFileSync("lib/commercial/usage-reservations.ts","utf8");
assert.match(
  reservationSource,
  /if \(!context\.enforcementEnabled\)[\s\S]*?if \(!preflight\.allowed\)[\s\S]*?atomic:false/,
  "Legacy non-atomic usage may only remain while commercial enforcement is disabled",
);
assert.match(
  reservationSource,
  /createAdminClient\(\)[\s\S]*?\.rpc\("hay_reserve_usage"/,
  "Enforced quota reservations must execute through the server-only Supabase admin client",
);
assert.match(
  reservationSource,
  /resizeUsageReservation[\s\S]*?\.rpc\("hay_resize_usage_reservation"/,
  "Exact billable quantities must be resized through the server-only atomic RPC",
);

const atomicMigration=readFileSync("supabase/010_atomic_usage_reservations.sql","utf8");
assert.match(atomicMigration,/security invoker/g,"Atomic quota RPCs must remain SECURITY INVOKER");
assert.doesNotMatch(atomicMigration,/security definer/i,"Atomic quota migration must not introduce SECURITY DEFINER RPCs in public");
assert.match(
  atomicMigration,
  /revoke all on function public\.hay_reserve_usage[\s\S]*?from public, anon, authenticated;[\s\S]*?grant execute on function public\.hay_reserve_usage[\s\S]*?to service_role;/,
  "Atomic reservation RPC must be inaccessible to browser roles and executable only by service_role",
);
assert.match(
  atomicMigration,
  /where owner_id = p_owner_id[\s\S]*?for update;/,
  "Atomic reservation must serialize concurrent account spending with an entitlement row lock",
);
assert.match(
  atomicMigration,
  /state = 'consumed'[\s\S]*?state = 'reserved' and reservation_expires_at > now\(\)/,
  "Active reservations must count immediately toward the same quota as consumed usage",
);
assert.match(
  atomicMigration,
  /reservation_token_hash[\s\S]*?extensions\.digest\(p_release_token, 'sha256'\)/,
  "Reservation release capability must be stored only as a SHA-256 hash",
);

const resizeMigration=readFileSync("supabase/011_atomic_usage_resize.sql","utf8");
assert.match(resizeMigration,/security invoker/i,"Reservation resize RPC must remain SECURITY INVOKER");
assert.doesNotMatch(resizeMigration,/security definer/i,"Reservation resize must not introduce a SECURITY DEFINER public RPC");
assert.match(
  resizeMigration,
  /revoke all on function public\.hay_resize_usage_reservation[\s\S]*?from public, anon, authenticated;[\s\S]*?grant execute on function public\.hay_resize_usage_reservation[\s\S]*?to service_role;/,
  "Reservation resize RPC must be service-role only",
);
assert.match(
  resizeMigration,
  /where owner_id = p_owner_id[\s\S]*?for update;/,
  "Reservation resize must hold the same entitlement row lock while recomputing capacity",
);
assert.match(
  resizeMigration,
  /id <> v_event\.id[\s\S]*?state = 'consumed'[\s\S]*?state = 'reserved'/,
  "Reservation resize must exclude its own prior quantity while counting all other consumed and active reserved usage",
);

const voiceRouteSource = readFileSync("app/api/voice/route.ts", "utf8");
assert.match(voiceRouteSource,/MAX_VOICE_CHARS\s*=\s*8_000/,"Direct Voice API must keep a hard text-size bound");
assert.match(voiceRouteSource,/value\.length\/780/,"Voice minute estimation must include a character floor against no-space token abuse");
const voiceProviderCheck=voiceRouteSource.indexOf("if(!voice?.available)");
const voiceReserveCall=voiceRouteSource.indexOf("reservation=await reserveUsage(");
const voiceDuplicateBranch=voiceRouteSource.indexOf("if(reservation.duplicate)");
const voiceNaturalizerCall=voiceRouteSource.indexOf("await naturalizeArmenianText(text,style)");
const voiceResizeCall=voiceRouteSource.indexOf("await resizeUsageReservation(reservation,minutes)");
const voiceTtsCall=voiceRouteSource.indexOf("await createArmenianSpeech(");
const voiceCommitCall=voiceRouteSource.indexOf("await commitUsageReservation(");
assert.ok(
  voiceProviderCheck>=0&&voiceProviderCheck<voiceReserveCall,
  "Direct Voice API must reject an unavailable TTS provider before reserving quota or spending OpenAI naturalization tokens",
);
assert.ok(
  voiceReserveCall>=0&&voiceReserveCall<voiceNaturalizerCall,
  "Direct Voice API must reserve voice quota before the OpenAI-backed Armenian naturalizer can run",
);
assert.ok(
  voiceDuplicateBranch>voiceReserveCall&&voiceDuplicateBranch<voiceNaturalizerCall,
  "Direct Voice idempotency duplicates must return before OpenAI naturalization or TTS",
);
assert.ok(
  voiceResizeCall>voiceNaturalizerCall&&voiceResizeCall<voiceTtsCall,
  "Direct Voice must atomically resize the reservation to final normalized minutes before TTS",
);
assert.ok(
  voiceTtsCall>=0&&voiceCommitCall>voiceTtsCall,
  "Direct Voice must commit its exact reserved usage only after a successful TTS provider call",
);
assert.match(
  voiceRouteSource,
  /voice_usage_commit_failed[\s\S]*?status:503/,
  "Direct Voice must fail closed without releasing capacity after paid TTS succeeds but usage commit fails",
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
  cases: 49,
  providerCostRoutes: meteredProviderRoutes,
  meteredLanguageRoutes,
  usageBusinessOwnership: true,
  productionProviderFailClosed: true,
  veoOperationOwnership: true,
  veoAtomicPreProviderReservation: true,
  veoPreProviderIdempotency: true,
  atomicUsageServiceRoleOnly: true,
  atomicUsageSerialized: true,
  atomicUsageResizeServiceRoleOnly: true,
  voiceAtomicPreProviderReservation: true,
  voiceAtomicResizeBeforeTts: true,
  voicePreProviderIdempotency: true,
  voiceRequestSizeBound: true,
  contentFactoryVoicePreProviderGate: true,
  contentFactoryAllVoiceMetered: true,
  translationSizeBound: true,
}, null, 2));
