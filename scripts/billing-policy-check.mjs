import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

const sync=read("app/api/billing/sync/route.ts");
assert.match(sync,/timingSafeEqual/,"Billing sync secret comparison must remain timing-safe");
assert.match(sync,/providerEventId/,"Billing sync must require a durable provider event id");
assert.match(sync,/providerEventCreatedAt/,"Billing sync must require the verified provider event creation time");
assert.match(sync,/currentPeriodStart/,"Billing sync must require the exact provider billing period start");
assert.match(sync,/currentPeriodEnd/,"Billing sync must require the exact provider billing period end");
assert.match(sync,/MAX_EVENT_FUTURE_SKEW_MS\s*=\s*10\*60\*1000/,"Billing sync must reject dangerously future-dated events");
assert.match(sync,/cleanText\(body\.provider,64\)\.toLowerCase\(\)/,"Billing provider replay namespace must be normalized to lowercase");
assert.match(sync,/rpc\("hay_apply_billing_entitlement"/,"Billing sync must apply verified events through the atomic database RPC");
assert.doesNotMatch(sync,/\.from\("account_entitlements"\)[\s\S]*?\.upsert\(/,"Billing route must not directly upsert entitlement state outside the atomic event RPC");
assert.match(sync,/ok:true[\s\S]*?duplicate:result\.duplicate===true[\s\S]*?stale:result\.stale===true/,"Duplicate/stale verified events must be acknowledged without endless provider retries");

const checkout=read("app/api/billing/checkout/route.ts");
assert.match(checkout,/supabase\.auth\.getClaims\(\)/,"Checkout resolution must require an authenticated HAY account");
assert.match(checkout,/PLAN_URL_ENV/,"Checkout destinations must come from the server-side paid-plan allowlist");
assert.match(checkout,/url\.protocol !== "https:"/,"Hosted checkout destinations must be HTTPS");
assert.match(checkout,/client_reference_id/,"Checkout may carry owner correlation metadata");
assert.match(checkout,/metadata\[hay_plan\]/,"Checkout may carry plan correlation metadata");
assert.doesNotMatch(checkout,/account_entitlements/,"Checkout success resolution must never mutate entitlement state directly");

const migration=read("supabase/013_atomic_billing_events.sql");
assert.match(migration,/unique \(provider, event_id\)/i,"Verified billing provider events must be replay-protected by provider+event id");
assert.match(migration,/alter table public\.billing_events enable row level security;/i,"Billing event audit must have RLS enabled");
assert.match(migration,/revoke all on public\.billing_events from public, anon, authenticated;/i,"Billing event audit must be hidden from browser roles");
assert.match(migration,/grant select, insert on public\.billing_events to service_role;/i,"Only service-role billing infrastructure may write the event audit");
assert.match(migration,/security invoker/i,"Atomic billing RPC must remain SECURITY INVOKER");
assert.doesNotMatch(migration,/security definer/i,"Atomic billing migration must not add a SECURITY DEFINER public RPC");
assert.match(migration,/revoke all on function public\.hay_apply_billing_entitlement[\s\S]*?from public, anon, authenticated;[\s\S]*?grant execute on function public\.hay_apply_billing_entitlement[\s\S]*?to service_role;/i,"Atomic billing RPC must be executable only by service_role");
assert.match(migration,/where owner_id = p_owner_id[\s\S]*?for update;/i,"Billing events for one owner must serialize on the entitlement row");
assert.match(migration,/p_event_created_at < v_entitlement\.billing_event_created_at/i,"Older verified provider events must not overwrite newer entitlement state");
assert.match(migration,/false,'stale_event'/i,"Stale events must remain in the append-only audit as not applied");
assert.match(migration,/p_event_created_at > now\(\) \+ interval '10 minutes'/i,"The database must independently reject dangerously future-dated events");
assert.match(migration,/lower\(left\(btrim\(coalesce\(p_provider,''\)\),64\)\)/i,"Provider replay namespace normalization must also happen inside the database");

const setup=read("app/api/setup/status/route.ts");
assert.match(setup,/billingEventMigrationReady/,"Setup diagnostics must probe billing event migration readiness");
assert.match(setup,/commercialReady\s*=\s*supabase[\s\S]*?billingEventMigration/,"Commercial readiness must require migration 013");
assert.match(setup,/billing_event_migration_013_required/,"Missing migration 013 must be an explicit setup blocker");

const readme=read("README.md");
assert.match(readme,/013_atomic_billing_events\.sql/,"Deployment runbook must include migration 013");
assert.match(readme,/providerEventId/,"Billing runbook must require the verified provider event id");
assert.match(readme,/providerEventCreatedAt/,"Billing runbook must require verified event ordering data");
assert.match(readme,/browser success redirect[\s\S]*never proof of payment/i,"Runbook must keep browser checkout success separate from entitlement proof");

console.log(JSON.stringify({
  billingPolicy:"passed",
  timingSafeSyncSecret:true,
  atomicBillingEvents:true,
  replayProtected:true,
  staleEventProtected:true,
  futureEventProtected:true,
  browserEntitlementMutationBlocked:true,
  migration013Readiness:true,
},null,2));
