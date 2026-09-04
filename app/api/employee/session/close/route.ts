import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { classifyEmployeeCallOutcome,employeeOutcomeSummaryHy } from "@/lib/employee/outcome";
import { finishEmployeeCall } from "@/lib/employee/subscription";
import type { EmployeeActionType } from "@/lib/employee/types";
import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime="nodejs";

function secretMatches(request:Request){
  const expected=String(process.env.HAY_VOICE_WORKER_SECRET||"");
  const authorization=request.headers.get("authorization")||"";
  const supplied=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  if(!expected||!supplied||expected.length!==supplied.length)return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}

export async function POST(request:Request){
  if(!secretMatches(request))return NextResponse.json({error:"unauthorized"},{status:401});
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"supabase_admin_required"},{status:503});
  try{
    const body=await request.json();
    const employeeId=String(body.employeeId||process.env.HAY_DEFAULT_EMPLOYEE_ID||"");
    const externalSessionId=String(body.externalSessionId||"").trim().slice(0,240);
    const requestedState=body.state==="failed"?"failed":"completed";
    if(!employeeId||!externalSessionId)return NextResponse.json({error:"employee_and_external_session_required"},{status:400});
    const admin=createAdminClient();
    const lookup=await admin.from("ai_employee_sessions").select("id,owner_id,state,metadata,started_at").eq("employee_id",employeeId).eq("provider","elevenlabs-speech-engine").eq("external_session_id",externalSessionId).maybeSingle();
    if(lookup.error)return NextResponse.json({error:"employee_session_read_failed"},{status:500});
    if(!lookup.data)return NextResponse.json({closed:false,reason:"session_not_found"},{status:200});

    const actions=await admin.from("ai_employee_actions").select("action_type,status").eq("session_id",lookup.data.id).eq("employee_id",employeeId).eq("status","executed");
    if(actions.error)return NextResponse.json({error:"employee_session_actions_read_failed"},{status:500});
    const actionTypes=(actions.data||[]).map(row=>String(row.action_type)).filter(type=>["book_appointment","create_lead","create_callback","take_order","handoff_human"].includes(type)) as EmployeeActionType[];
    const wasHandoff=String(lookup.data.state)==="handoff"||actionTypes.includes("handoff_human");
    const outcome=wasHandoff?"human_handoff":classifyEmployeeCallOutcome({actionTypes,failed:requestedState==="failed"});
    const summary=employeeOutcomeSummaryHy(outcome);
    const finalState=wasHandoff?"handoff":requestedState;
    const existingMetadata=lookup.data.metadata&&typeof lookup.data.metadata==="object"?lookup.data.metadata as Record<string,unknown>:{};
    const usageId=existingMetadata.callUsageId?String(existingMetadata.callUsageId):null;
    const startedAt=new Date(String(lookup.data.started_at||""));
    const elapsed=Math.max(0,Math.floor((Date.now()-(Number.isFinite(startedAt.getTime())?startedAt.getTime():Date.now()))/1000));
    const suppliedDuration=Number(body.durationSeconds);
    const durationSeconds=Number.isFinite(suppliedDuration)&&suppliedDuration>=0?Math.floor(suppliedDuration):elapsed;
    const usageFinish=await finishEmployeeCall({ownerId:String(lookup.data.owner_id),usageId,durationSeconds,failed:requestedState==="failed",metadata:{outcome,actionCount:actionTypes.length,actionTypes}});
    if(usageId&&usageFinish&&"finished" in usageFinish&&usageFinish.finished===false){
      return NextResponse.json({error:"employee_call_usage_finalize_failed",detail:usageFinish},{status:503});
    }
    const metadata={...existingMetadata,actionCount:actionTypes.length,actionTypes,durationSeconds,callUsageFinalized:Boolean(usageId)};
    const updated=await admin.from("ai_employee_sessions").update({state:finalState,outcome,summary,ended_at:new Date().toISOString(),metadata}).eq("id",lookup.data.id).eq("employee_id",employeeId).select("id,state,outcome,summary,metadata,ended_at").single();
    if(updated.error)return NextResponse.json({error:"employee_session_close_failed"},{status:500});
    return NextResponse.json({closed:true,session:updated.data,usage:usageFinish},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("HAY Employee session close failed",error);
    return NextResponse.json({error:"employee_session_close_failed"},{status:500});
  }
}
