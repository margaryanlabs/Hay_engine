import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

const directRoutes=[
  {path:"app/api/image/route.ts",provider:"await generateSceneImage(",duplicate:"if(reservation.duplicate)",commitError:"image_usage_commit_failed"},
  {path:"app/api/create/route.ts",provider:"await createCreatorProject(",duplicate:"if(reservation.duplicate)",commitError:"creator_usage_commit_failed"},
];

for(const route of directRoutes){
  const source=read(route.path);
  assert.doesNotMatch(source,/checkUsageAllowance\s*\(/,`${route.path} must not use non-atomic allowance checks`);
  assert.doesNotMatch(source,/recordUsage\s*\(/,`${route.path} must not record usage only after provider work`);
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
assert.doesNotMatch(storyboard,/checkUsageAllowance\s*\(/,"Storyboard must not regress to non-atomic allowance checks");
assert.doesNotMatch(storyboard,/recordUsage\s*\(/,"Storyboard must not regress to record-at-end accounting");
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
assert.doesNotMatch(staticRoute,/checkUsageAllowance\s*\(/,"Static regeneration must not use non-atomic allowance checks");
assert.doesNotMatch(staticRoute,/recordUsage\s*\(/,"Static regeneration must not record force usage after the entire pipeline");
const staticForce=staticRoute.indexOf("if(force)");
const staticReserve=staticRoute.indexOf("await reserveUsage(",staticForce);
const staticDuplicate=staticRoute.indexOf("if(next.duplicate)",staticReserve);
const staticProvider=staticRoute.indexOf("const base=await imageBytes(",staticReserve);
const staticCommit=staticRoute.indexOf("await commitUsageReservation(",staticProvider);
const staticSharp=staticRoute.indexOf("await sharp(base)",staticCommit);
assert.ok(staticForce>=0&&staticReserve>staticForce&&staticProvider>staticReserve,"Forced static regeneration must reserve quota before OpenAI image generation");
assert.ok(staticDuplicate>staticReserve&&staticDuplicate<staticProvider,"Static regeneration duplicates must stop before OpenAI image generation");
assert.ok(staticCommit>staticProvider&&staticSharp>staticCommit,"Forced static regeneration must commit provider cost before local compositing/storage can fail");
assert.match(staticRoute,/image_provider_unconfigured_or_failed[\s\S]*?releaseUsageReservation\(reservation\)/,"Static regeneration must release quota when no provider image exists");
assert.match(staticRoute,/static_regeneration_usage_commit_failed[\s\S]*?status:503/,"Static regeneration must fail closed after paid image generation when usage commit fails");
assert.match(staticRoute,/reason:"included_in_plan"/,"Initial static asset generation must remain included in the plan allocation");

console.log(JSON.stringify({
  directProviderPolicy:"passed",
  atomicRoutes:["image","creator","storyboard","static_force"],
  preProviderIdempotency:true,
  providerCostFailClosed:true,
  staticProviderCommitBeforeStorage:true,
  initialStaticIncludedInPlan:true,
},null,2));
