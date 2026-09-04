import { NextResponse } from "next/server";
import { authenticatedEmployeeOwner,employeeMigrationReady,listEmployees } from "@/lib/employee/store";

export const runtime="nodejs";

export async function GET(){
  const owner=await authenticatedEmployeeOwner();
  if(!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  const migration=await employeeMigrationReady();
  let employees=0;let activeEmployees=0;
  if(migration){
    try{const rows=await listEmployees(owner.ownerId);employees=rows.length;activeEmployees=rows.filter(item=>item.status==="active").length;}catch{/* blocker is reported below */}
  }
  const brain=Boolean(process.env.OPENAI_API_KEY);
  const workerSecret=Boolean(process.env.HAY_VOICE_WORKER_SECRET);
  const speechEngine=Boolean(process.env.ELEVENLABS_API_KEY&&process.env.ELEVENLABS_SPEECH_ENGINE_ID);
  const pilotEmployee=Boolean(process.env.HAY_DEFAULT_EMPLOYEE_ID)||activeEmployees>0;
  const browserPreviewReady=migration&&brain&&employees>0;
  const realtimePilotConfigured=browserPreviewReady&&workerSecret&&speechEngine&&pilotEmployee;
  return NextResponse.json({
    migration,
    requiredMigration:"014_ai_employees.sql",
    employees,
    activeEmployees,
    brain:{configured:brain,provider:"openai",replaceable:true},
    realtime:{speechEngineConfigured:speechEngine,workerSecretConfigured:workerSecret,pilotEmployeeConfigured:pilotEmployee,transport:"elevenlabs-speech-engine",replaceable:true},
    privacy:{rawAudioRetentionDefault:false,rawTranscriptRetentionDefault:false,actionAudit:true},
    browserPreviewReady,
    realtimePilotConfigured,
    blockers:[...(!migration?["ai_employee_migration_014_required"]:[]),...(!brain?["employee_brain_provider_required"]:[]),...(migration&&employees===0?["create_ai_employee_required"]:[]),...(!workerSecret?["voice_worker_secret_required"]:[]),...(!speechEngine?["elevenlabs_speech_engine_required_for_first_pilot"]:[]),...(!pilotEmployee?["active_or_default_employee_required"]:[])],
  },{headers:{"Cache-Control":"no-store"}});
}