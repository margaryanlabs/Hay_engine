import { NextResponse } from "next/server";
import { authenticatedEmployeeOwner,employeeMigrationReady,listEmployees } from "@/lib/employee/store";
import { employeeSubscriptionEnforcementEnabled,employeeSubscriptionMigrationReady,employeeSubscriptionSummary } from "@/lib/employee/subscription";
import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime="nodejs";

async function inboxMigrationReady(){
  if(!isSupabaseAdminConfigured())return false;
  try{const result=await createAdminClient().from("ai_employee_inbox").select("id",{head:true,count:"exact"}).limit(1);return !result.error;}catch{return false;}
}

export async function GET(){
  const owner=await authenticatedEmployeeOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  const [migration,inboxMigration,subscriptionMigration]=await Promise.all([employeeMigrationReady(),inboxMigrationReady(),employeeSubscriptionMigrationReady()]);
  let employees=0;let activeEmployees=0;
  if(migration){
    try{const rows=await listEmployees(owner.ownerId);employees=rows.length;activeEmployees=rows.filter(item=>item.status==="active").length;}catch{/* blocker is reported below */}
  }
  const brain=Boolean(process.env.OPENAI_API_KEY);
  const workerSecret=Boolean(process.env.HAY_VOICE_WORKER_SECRET);
  const speechEngine=Boolean(process.env.ELEVENLABS_API_KEY&&process.env.ELEVENLABS_SPEECH_ENGINE_ID);
  const workerTarget=Boolean(process.env.HAY_APP_URL);
  const pilotEmployee=Boolean(process.env.HAY_DEFAULT_EMPLOYEE_ID)||activeEmployees>0;
  const subscriptionEnforced=employeeSubscriptionEnforcementEnabled();
  const subscription=subscriptionMigration?await employeeSubscriptionSummary(owner.ownerId):{configured:false};
  const browserPreviewReady=migration&&inboxMigration&&brain&&employees>0;
  const realtimePilotConfigured=browserPreviewReady&&workerSecret&&speechEngine&&workerTarget&&pilotEmployee&&(!subscriptionEnforced||subscriptionMigration);
  return NextResponse.json({
    migrations:{employees:migration,inbox:inboxMigration,subscription:subscriptionMigration},
    requiredMigrations:["014_ai_employees.sql","015_ai_employee_inbox.sql","016_ai_employee_subscriptions.sql"],
    employees,
    activeEmployees,
    brain:{configured:brain,provider:"openai",replaceable:true},
    realtime:{speechEngineConfigured:speechEngine,workerSecretConfigured:workerSecret,workerTargetConfigured:workerTarget,pilotEmployeeConfigured:pilotEmployee,transport:"elevenlabs-speech-engine",replaceable:true},
    subscription:{enforced:subscriptionEnforced,ready:subscriptionMigration,summary:subscription},
    privacy:{rawAudioRetentionDefault:false,rawTranscriptRetentionDefault:false,actionAudit:true,outcomeOnlyByDefault:true},
    browserPreviewReady,
    realtimePilotConfigured,
    blockers:[...(!migration?["ai_employee_migration_014_required"]:[]),...(!inboxMigration?["ai_employee_inbox_migration_015_required"]:[]),...(subscriptionEnforced&&!subscriptionMigration?["ai_employee_subscription_migration_016_required"]:[]),...(!brain?["employee_brain_provider_required"]:[]),...(migration&&employees===0?["create_ai_employee_required"]:[]),...(!workerSecret?["voice_worker_secret_required"]:[]),...(!speechEngine?["elevenlabs_speech_engine_required_for_first_pilot"]:[]),...(!workerTarget?["voice_worker_hay_app_url_required"]:[]),...(!pilotEmployee?["active_or_default_employee_required"]:[])],
  },{headers:{"Cache-Control":"no-store"}});
}
