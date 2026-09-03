import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync("app/api/marketing/content/create/route.ts","utf8");

assert.doesNotMatch(
  source,
  /checkUsageAllowance\("content_assets"|recordUsage\(\{[\s\S]*?source:"video_regeneration"/,
  "Force regeneration must not use the old non-atomic check-then-record path",
);

const forceBlock=source.indexOf("if(force){");
const reserve=source.indexOf('meter:"content_assets"',forceBlock);
const duplicate=source.indexOf("if(reservation.duplicate)",reserve);
const projectCreate=source.indexOf("await createCreatorProject(");
const imageProvider=source.indexOf("await generateSceneImage(");
const dispatch=source.indexOf("await dispatchRender(");
const regenerationCommit=source.indexOf("regenerationUsage=await commitUsageReservation(",dispatch);

assert.ok(forceBlock>=0&&reserve>forceBlock,"Force regeneration must reserve content quota inside the force branch");
assert.ok(reserve<projectCreate,"Content quota must be reserved before creator/provider work begins");
assert.ok(duplicate>reserve&&duplicate<projectCreate,"Idempotent force retries must return before any regeneration work begins");
assert.ok(imageProvider>projectCreate&&regenerationCommit>imageProvider,"Regeneration usage must commit only after asset generation work has run");
assert.ok(regenerationCommit>dispatch,"Regeneration usage must commit after durable render dispatch is prepared");

assert.match(source,/source:"video_regeneration"/,"Force reservation must keep the canonical video_regeneration source");
assert.match(source,/idempotencyKey:requestId\?`video-regeneration:\$\{requestId\}`:undefined/,"Force retries must use requestId before provider work when supplied");
assert.match(source,/pendingRegenerationReservation=reservation/,"A live force reservation must be tracked until commit or release");
assert.match(source,/async function releasePendingRegeneration\(\)[\s\S]*?releaseUsageReservation\(current\)/,"Early aborts must have one safe regeneration release helper");
assert.match(source,/regeneration_usage_commit_failed[\s\S]*?status:503/,"Completed regeneration must fail closed if usage commit cannot be persisted");
assert.match(source,/if\(pendingRegenerationReservation\)await releaseUsageReservation\(pendingRegenerationReservation\)/,"Unhandled pre-completion failures must release pending regeneration quota");

const earlyReleases=source.match(/await releasePendingRegeneration\(\)/g)?.length??0;
assert.ok(earlyReleases>=5,"Voice quota/provider abort paths must release the still-pending content regeneration reservation");

assert.match(
  source,
  /duplicate:true,[\s\S]*?project:existingProject\?\.manifest\|\|null,[\s\S]*?next:existingProject\?duplicateStatus:"already_processed"/,
  "A completed duplicate force request must reuse the latest durable project instead of regenerating it",
);

console.log(JSON.stringify({
  regenerationPolicy:"passed",
  atomicContentReservation:true,
  preProviderIdempotency:true,
  duplicateReusesDurableProject:true,
  earlyAbortRelease:true,
  postPipelineCommit:true,
  commitFailureFailClosed:true,
},null,2));
