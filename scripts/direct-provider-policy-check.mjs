import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read=(path)=>readFileSync(path,"utf8");

function filesUnder(root){
  const result=[];
  for(const entry of readdirSync(root,{withFileTypes:true})){
    const path=join(root,entry.name);
    if(entry.isDirectory())result.push(...filesUnder(path));
    else if(entry.isFile()&&/\.(?:ts|tsx|js|mjs)$/.test(entry.name))result.push(path);
  }
  return result;
}

// Route code must never make its own non-atomic quota decision or append usage only
// after provider work. The only allowed compatibility path lives inside the centralized
// usage-reservations layer while commercial enforcement is explicitly disabled.
const apiFiles=filesUnder("app/api");
const legacyAccounting=[];
for(const path of apiFiles){
  const source=read(path);
  if(/checkUsageAllowance\s*\(/.test(source)||/recordUsage\s*\(/.test(source))legacyAccounting.push(path);
}
assert.deepEqual(legacyAccounting,[],`app/api must use centralized usage reservations; legacy accounting found in: ${legacyAccounting.join(", ")}`);

const directRoutes=[
  {path:"app/api/image/route.ts",provider:"await generateSceneImage(",duplicate:"if(reservation.duplicate)",commitError:"image_usage_commit_failed"},
  {path:"app/api/create/route.ts",provider:"await createCreatorProject(",duplicate:"if(reservation.duplicate)",commitError:"creator_usage_commit_failed"},
];

for(const route of directRoutes){
  const source=read(route.path);
  const reserve=source.indexOf("await reserveUsage(");
  const duplicate=source.indexOf(route.duplicate,reserve);
  const provider=source.indexOf(route.provider);
  const commit=source.indexOf("await commitUsageReservation(",provider);
  assert.ok(reserve>=0&&provider>reserve,`${route.path} must reserve quota before provider work`);
  assert.ok(duplicate>reserve&&duplicate<provider,`${route.path} must reject idempotency duplicates before provider work`);
  assert.ok(commit>provider,`${route.path} must commit only after provider output exists`);
  assert.match(source,/pendingReservation[\s\S]*?releaseUsageReservation\(pendingReservation\)/,`${route.path} must release only still-pending reservations on early failure`);
  assert.match(source,new RegExp(`${route.commitError}[\\s\\S]*?status:503`),`${route.path} must fail closed after provider spend if accounting commit fails`);
}

const storyboard=read("app/api/storyboard/route.ts");
const storyboardReserve=storyboard.indexOf("await reserveUsage(");
const storyboardDuplicate=storyboard.indexOf("if(next.duplicate)",storyboardReserve);
const storyboardProvider=storyboard.indexOf("await generateStoryboardWithOpenAI(");
const storyboardCommit=storyboard.indexOf("await commitUsageReservation(",storyboardProvider);
assert.ok(storyboardReserve>=0&&storyboardProvider>storyboardReserve,"Storyboard must reserve quota before OpenAI planning");
assert.ok(storyboardDuplicate>storyboardReserve&&storyboardDuplicate<storyboardProvider,"Storyboard duplicates must stop before OpenAI planning");
assert.ok(storyboardCommit>storyboardProvider,"Storyboard must commit only when AI output exists");
assert.match(storyboard,/else if\(reservation\)[\s\S]*?releaseUsageReservation\(reservation\)/,"Storyboard deterministic fallback must release an unused provider reservation");
assert.match(storyboard,/storyboard_usage_commit_failed[\s\S]*?status:503/,"Storyboard must fail closed when AI output exists but usage commit fails");

const staticRoute=read("app/api/marketing/content/static/route.ts");
const staticForce=staticRoute.indexOf("if(force)");
const staticReserve=staticRoute.indexOf("await reserveUsage(",staticForce);
const staticDuplicate=staticRoute.indexOf("if(next.duplicate)",staticReserve);
const staticProvider=staticRoute.indexOf("const base=await imageBytes(",staticReserve);
const staticNoBase=staticRoute.indexOf("if(!base)",staticProvider);
const staticRelease=staticRoute.indexOf("await releaseUsageReservation(reservation)",staticNoBase);
const staticNoBaseReturn=staticRoute.indexOf("image_provider_unconfigured_or_failed",staticNoBase);
const staticCommit=staticRoute.indexOf("await commitUsageReservation(",staticProvider);
const staticSharp=staticRoute.indexOf("await sharp(base)",staticCommit);
assert.ok(staticForce>=0&&staticReserve>staticForce&&staticProvider>staticReserve,"Forced static regeneration must reserve quota before OpenAI image generation");
assert.ok(staticDuplicate>staticReserve&&staticDuplicate<staticProvider,"Static regeneration duplicates must stop before OpenAI image generation");
assert.ok(staticNoBase>staticProvider&&staticRelease>staticNoBase&&staticNoBaseReturn>staticRelease,"Static regeneration must release quota before returning when no provider image exists");
assert.ok(staticCommit>staticProvider&&staticSharp>staticCommit,"Forced static regeneration must commit provider cost before local compositing/storage can fail");
assert.match(staticRoute,/static_regeneration_usage_commit_failed[\s\S]*?status:503/,"Static regeneration must fail closed after paid image generation when usage commit fails");
assert.match(staticRoute,/reason:"included_in_plan"/,"Initial static asset generation must remain included in the plan allocation");

const marketingPlan=read("app/api/marketing/plan/route.ts");
const planReserve=marketingPlan.indexOf("await reserveUsage(");
const planDuplicate=marketingPlan.indexOf("if(reservation.duplicate)",planReserve);
const planProvider=marketingPlan.indexOf("await buildMarketingPlan(");
const planPersist=marketingPlan.indexOf("await persistMarketingPlan(",planProvider);
const planResize=marketingPlan.indexOf("await resizeUsageReservation(",planPersist);
const planCommit=marketingPlan.indexOf("await commitUsageReservation(",planPersist);
assert.ok(planReserve>=0&&planProvider>planReserve,"Marketing plan must reserve quota before AI planning");
assert.ok(planDuplicate>planReserve&&planDuplicate<planProvider,"Marketing plan retries must stop before AI planning");
assert.ok(planPersist>planProvider,"Marketing plan provider output must be persisted before final usage reconciliation");
assert.ok(planResize>planPersist&&planCommit>planPersist,"Marketing plan must support exact persisted-asset reconciliation before usage commit");
assert.match(marketingPlan,/marketing_plan_usage_commit_failed[\s\S]*?status:503/,"Marketing plan must fail closed if completed work cannot commit usage");
assert.match(marketingPlan,/pendingReservation[\s\S]*?releaseUsageReservation\(pendingReservation\)/,"Marketing plan must release only still-pending quota on aborted work");

const reservationLayer=read("lib/commercial/usage-reservations.ts");
assert.match(reservationLayer,/atomicUsageMigrationsReady[\s\S]*?select\("id,state,reservation_expires_at"[\s\S]*?rpc\("hay_reserve_usage"[\s\S]*?rpc\("hay_resize_usage_reservation"/,"Atomic Studio readiness must probe the reservation ledger plus 010/011 RPC capabilities");
const setupStatus=read("app/api/setup/status/route.ts");
assert.match(setupStatus,/commercialReady\s*=\s*supabase\s*&&\s*admin\s*&&\s*commercialMigration\s*&&\s*atomicUsageMigration/,"Commercial readiness must require atomic Studio migrations");
assert.match(setupStatus,/atomic_usage_migrations_010_011_required/,"Setup diagnostics must expose missing 010/011 as an explicit blocker");
assert.match(setupStatus,/developer_api_migration_012_required/,"Setup diagnostics must expose missing Developer API migration 012 as an explicit blocker");

const readme=read("README.md");
for(const migration of ["010_atomic_usage_reservations.sql","011_atomic_usage_resize.sql","012_atomic_developer_api_requests.sql"]){
  assert.match(readme,new RegExp(migration.replaceAll(".","\\.")),`README deployment order must include ${migration}`);
}
assert.match(readme,/Do not set `HAY_ENFORCE_PLANS=true` until migrations `007`, `010` and `011` are applied/,"Plan enforcement runbook must require atomic Studio migrations");
assert.match(readme,/Do not set `HAY_DEVELOPER_API_ENABLED=true` until migrations `007` and `012` are applied/,"Developer API runbook must require atomic request-admission migration");

console.log(JSON.stringify({
  directProviderPolicy:"passed",
  scannedApiFiles:apiFiles.length,
  legacyRouteAccountingBanned:true,
  atomicRoutes:["image","creator","storyboard","static_force","marketing_plan"],
  preProviderIdempotency:true,
  providerCostFailClosed:true,
  staticProviderCommitBeforeStorage:true,
  staticNoOutputRelease:true,
  marketingPlanExactResize:true,
  atomicMigrationReadinessProtected:true,
  migrationRunbookProtected:true,
  initialStaticIncludedInPlan:true,
},null,2));
