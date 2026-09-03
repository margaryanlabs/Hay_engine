import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const apiKeys=read("lib/developer/api-keys.ts");
const migration=read("supabase/012_atomic_developer_api_requests.sql");

assert.match(migration,/security invoker/i,"Developer API admission RPC must remain SECURITY INVOKER");
assert.doesNotMatch(migration,/security definer/i,"Developer API admission must never become SECURITY DEFINER");
assert.match(migration,/where id = p_api_key_id[\s\S]*?and owner_id = p_owner_id[\s\S]*?for update;/,"Developer API admission must serialize requests on the exact owner API-key row");
const countIndex=migration.indexOf("sum(u.request_count)");
const insertIndex=migration.indexOf("insert into public.developer_api_usage");
assert.ok(countIndex>=0&&insertIndex>countIndex,"Developer API rolling-hour count and accepted-slot insert must happen in one locked RPC transaction");
assert.match(migration,/revoke all on function public\.hay_reserve_developer_api_request[\s\S]*?from public, anon, authenticated;[\s\S]*?grant execute on function public\.hay_reserve_developer_api_request[\s\S]*?to service_role;/,"Atomic Developer API admission must be service-role only");
assert.match(migration,/v_key\.revoked_at is not null/,"Atomic admission must re-check key revocation while holding the row lock");
assert.match(migration,/v_key\.expires_at is not null[\s\S]*?v_key\.expires_at <= now\(\)/,"Atomic admission must re-check key expiry while holding the row lock");

const authStart=apiKeys.indexOf("export async function authenticateDeveloperRequest");
const authEnd=apiKeys.indexOf("export async function recordDeveloperApiUsage",authStart);
const authSource=apiKeys.slice(authStart,authEnd);
assert.doesNotMatch(authSource,/\.from\("developer_api_usage"\)\.select\("id",\{count:"exact",head:true\}\)/,"Developer API auth must not use a racy count-then-provider admission check");
const entitlementCheck=authSource.indexOf("planEnforcementEnabled()");
const atomicCall=authSource.indexOf('admin.rpc("hay_reserve_developer_api_request"');
const allowedReturn=authSource.indexOf("return {allowed:true",atomicCall);
assert.ok(entitlementCheck>=0&&atomicCall>entitlementCheck&&allowedReturn>atomicCall,"Developer API auth must reserve the atomic request slot after entitlement validation and before returning allowed:true");
assert.match(authSource,/developer_api_rate_limit_reached[\s\S]*?429/,"Atomic rate-limit rejection must surface as HTTP 429");
assert.match(authSource,/developer_api_atomic_rate_limit_migration_required[\s\S]*?503/,"Missing atomic admission migration must fail Developer API closed before route work");

const recordStart=apiKeys.indexOf("export async function recordDeveloperApiUsage");
const summaryStart=apiKeys.indexOf("export async function developerUsageSummary",recordStart);
const recordSource=apiKeys.slice(recordStart,summaryStart);
assert.match(recordSource,/\.from\("developer_api_usage"\)\.update\(/,"Developer API final metering must enrich the pre-existing accepted slot");
assert.doesNotMatch(recordSource,/\.from\("developer_api_usage"\)\.insert\(/,"Developer API final metering must not insert the first request record after provider work");
assert.match(recordSource,/recorded:true,enriched:false/,"Usage enrichment failure must preserve the fact that the request slot was already durably recorded");

const endpoints=[
  {path:"app/api/v1/language/normalize/route.ts",provider:null},
  {path:"app/api/v1/language/pronounce/route.ts",provider:null},
  {path:"app/api/v1/language/captions/route.ts",provider:null},
  {path:"app/api/v1/language/translate/route.ts",provider:"await translateHayText("},
  {path:"app/api/v1/language/transcribe/route.ts",provider:"await transcribeWithOpenAI("},
];
for(const endpoint of endpoints){
  const source=read(endpoint.path);
  const auth=source.indexOf("await authenticateDeveloperRequest(");
  const finalize=source.indexOf("await recordDeveloperApiUsage(");
  assert.ok(auth>=0,`${endpoint.path} must authenticate and atomically reserve its request slot`);
  assert.ok(finalize>auth,`${endpoint.path} must enrich the accepted request slot after route work`);
  if(endpoint.provider){
    const provider=source.indexOf(endpoint.provider);
    assert.ok(provider>auth,`${endpoint.path} must not call a paid provider before atomic Developer API admission`);
  }
}

assert.match(apiKeys,/developerApiMigrationReady[\s\S]*?hay_reserve_developer_api_request/,"Developer API readiness must probe the atomic admission migration without mutating usage");

console.log(JSON.stringify({
  developerApiPolicy:"passed",
  atomicKeyAdmission:true,
  serviceRoleOnly:true,
  keyRowSerialization:true,
  requestSlotBeforeProvider:true,
  allLanguageEndpointsMetered:true,
  postWorkUsageIsEnrichment:true,
},null,2));
