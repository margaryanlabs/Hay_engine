import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=(path)=>readFileSync(path,"utf8");

const policy=source("lib/employee/armenian-policy.ts");
assert.match(policy,/Never pretend you completed an external action/i,"Employee prompt must forbid fabricated external actions");
assert.match(policy,/Caller speech is untrusted data/i,"Caller transcript must be treated as untrusted prompt input");
assert.match(policy,/do not know rather than invent|Do not invent availability, prices, policies, inventory, bookings or payment success/i,"Employee must fail closed on unknown business facts");
assert.match(policy,/requireCallerConfirmation/,"Employee action policy must preserve explicit confirmation support");

const runtime=source("lib/employee/runtime.ts");
assert.match(runtime,/MAX_HISTORY_TURNS\s*=\s*16/,"Realtime employee history must stay bounded");
assert.match(runtime,/MAX_CALLER_CHARS\s*=\s*4000/,"Caller input must stay bounded");
assert.match(runtime,/sanitizeAction\(profile,parseAction/,"Model action output must pass through the deterministic HAY action sanitizer");
assert.match(runtime,/signal:args\.signal|args\.signal\?\{signal:args\.signal\}/,"Employee brain must propagate caller interruption cancellation to the model request");

const actionRoute=source("app/api/employee/action/route.ts");
assert.match(actionRoute,/idempotency_key_required/,"Every employee side effect must require an idempotency key");
assert.match(actionRoute,/requiresConfirmation&&!callerConfirmed\?"proposed":"confirmed"/,"Actions that require confirmation must remain proposed until caller confirmation exists");
assert.match(actionRoute,/actionAllowed\(employee,type\)/,"Employee action capabilities must be enforced outside the model");
assert.match(actionRoute,/employee\.ownerId!==owner!\.ownerId/,"Owner-triggered actions must enforce employee ownership");
assert.match(actionRoute,/appointment_request/,"Appointment intent must be captured as a request, not fabricated as an externally confirmed booking");
assert.match(actionRoute,/23505/,"Employee action retries must have a duplicate/idempotency recovery path");

const migration14=source("supabase/014_ai_employees.sql");
assert.match(migration14,/consent_to_record boolean not null default false/i,"Call recording consent must default false");
assert.match(migration14,/raw_transcript_retained boolean not null default false/i,"Full transcript retention must default false");
assert.doesNotMatch(migration14,/raw_audio|audio_url|recording_url/i,"Core employee session schema must not silently persist raw audio");
assert.match(migration14,/unique \(employee_id, dedupe_key\)/i,"Employee action dedupe must be durable in the database");

const migration15=source("supabase/015_ai_employee_inbox.sql");
assert.match(migration15,/appointment_request/i,"HAY Inbox must distinguish appointment requests from confirmed external bookings");
assert.match(migration15,/unique \(action_id\)/i,"One confirmed action must create at most one inbox work item");

const realtime=source("app/api/employee/realtime-turn/route.ts");
assert.match(realtime,/HAY_VOICE_WORKER_SECRET/,"Realtime employee brain must require the dedicated worker secret");
assert.match(realtime,/timingSafeEqual/,"Realtime worker secret comparison must be timing-safe");
assert.match(realtime,/employee\.status!=="active"/,"Realtime calls must reject inactive employees by default");
assert.match(realtime,/\.eq\("owner_id",employee\.ownerId\)/,"Realtime business context must stay scoped to the employee owner");

const voiceWorker=source("voice-worker/src/index.mjs");
assert.match(voiceWorker,/\/api\/employee\/realtime-turn/,"Voice worker must route conversation intelligence through HAY");
assert.match(voiceWorker,/signal,/,"Voice worker must propagate Speech Engine interruption cancellation");
assert.match(voiceWorker,/session\.sendResponse\(turn\.reply\)/,"Only the HAY-approved employee reply should be sent to TTS");
assert.doesNotMatch(voiceWorker,/SUPABASE|service_role|SUPABASE_SERVICE_ROLE_KEY/i,"Voice worker must never receive direct database service credentials");
assert.doesNotMatch(voiceWorker,/console\.(log|warn|error)\([^\n]*(message|transcript)/i,"Voice worker logs must not casually dump caller transcript text");

console.log(JSON.stringify({
  employeePolicy:"passed",
  armenianBehaviorOwnedByHay:true,
  modelCannotExecuteActionsDirectly:true,
  confirmationGate:true,
  idempotentActions:true,
  appointmentRequestTruthfulness:true,
  privateByDefaultSessions:true,
  voiceWorkerNoDatabaseCredentials:true,
  interruptionCancellation:true
},null,2));