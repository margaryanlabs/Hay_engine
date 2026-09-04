import { createHash,timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { captureEmployeeAction,parseEmployeeActionType,sanitizeEmployeeActionPayload,rejectEmployeeAction } from "@/lib/employee/action-service";
import { actionCapturedReply,confirmationPrompt,parseCallerConfirmation } from "@/lib/employee/confirmation";
import { employeeProfileFromRow } from "@/lib/employee/store";
import { runEmployeeTurn } from "@/lib/employee/runtime";
import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { EmployeeConversationTurn,EmployeeTurnResult } from "@/lib/employee/types";

export const runtime="nodejs";

function secretMatches(request:Request){
  const expected=String(process.env.HAY_VOICE_WORKER_SECRET||"");
  const authorization=request.headers.get("authorization")||"";
  const supplied=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  if(!expected||!supplied||expected.length!==supplied.length)return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}
function parseHistory(value:unknown):EmployeeConversationTurn[]{
  if(!Array.isArray(value))return [];
  return value.slice(-16).flatMap(item=>{
    if(!item||typeof item!=="object")return [];
    const row=item as Record<string,unknown>;
    const role=row.role==="agent"||row.role==="employee"?"employee":row.role==="user"||row.role==="caller"?"caller":null;
    const text=String(row.content||row.text||"").trim().slice(0,2500);
    return role&&text?[{role,text}]:[];
  });
}
function deterministicTurn(reply:string,intent:string,overrides:Partial<EmployeeTurnResult>={}):EmployeeTurnResult{
  return {reply,intent,confidence:1,collected:{},missing:[],action:null,shouldHandoff:false,handoffReason:null,generatedBy:"rules",...overrides};
}
function actionKey(sessionId:string,type:string,summary:string,payload:unknown){
  const digest=createHash("sha256").update(JSON.stringify({type,summary,payload})).digest("hex").slice(0,32);
  return `call:${sessionId}:${digest}`.slice(0,200);
}

export async function POST(request:Request){
  if(!secretMatches(request))return NextResponse.json({error:"unauthorized"},{status:401});
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"supabase_admin_required"},{status:503});
  try{
    const body=await request.json();
    const employeeId=String(body.employeeId||process.env.HAY_DEFAULT_EMPLOYEE_ID||"");
    const message=String(body.message||"").trim().slice(0,4000);
    const externalSessionId=String(body.externalSessionId||"").trim().slice(0,240);
    if(!employeeId)return NextResponse.json({error:"employee_id_required"},{status:400});
    if(!message)return NextResponse.json({error:"message_required"},{status:400});
    if(!externalSessionId)return NextResponse.json({error:"external_session_id_required"},{status:400});
    const admin=createAdminClient();
    const {data:employeeRow,error:employeeError}=await admin.from("ai_employees").select("*").eq("id",employeeId).maybeSingle();
    if(employeeError)return NextResponse.json({error:"employee_read_failed"},{status:500});
    if(!employeeRow)return NextResponse.json({error:"employee_not_found"},{status:404});
    const employee=employeeProfileFromRow(employeeRow as Record<string,unknown>);
    if(employee.status!=="active"&&process.env.HAY_ALLOW_DRAFT_EMPLOYEE_REALTIME!=="true")return NextResponse.json({error:"employee_not_active"},{status:409});
    if(!employee.businessId)return NextResponse.json({error:"employee_business_required"},{status:409});
    const {data:business,error:businessError}=await admin.from("businesses").select("id,name,category,description,location,offer,audience,tone").eq("id",employee.businessId).eq("owner_id",employee.ownerId).maybeSingle();
    if(businessError)return NextResponse.json({error:"employee_business_read_failed"},{status:500});
    if(!business)return NextResponse.json({error:"employee_business_not_found"},{status:404});

    const provider="elevenlabs-speech-engine";
    let sessionResult=await admin.from("ai_employee_sessions").select("id,state").eq("provider",provider).eq("external_session_id",externalSessionId).maybeSingle();
    if(sessionResult.error)return NextResponse.json({error:"employee_session_read_failed"},{status:500});
    if(!sessionResult.data){
      const inserted=await admin.from("ai_employee_sessions").insert({owner_id:employee.ownerId,business_id:employee.businessId,employee_id:employee.id,channel:"phone",provider,external_session_id:externalSessionId,state:"active",consent_to_record:false,raw_transcript_retained:false,metadata:{transport:"speech-engine"}}).select("id,state").single();
      if(inserted.error){
        if(String(inserted.error.code)==="23505")sessionResult=await admin.from("ai_employee_sessions").select("id,state").eq("provider",provider).eq("external_session_id",externalSessionId).single();
        else return NextResponse.json({error:"employee_session_create_failed",detail:inserted.error.message},{status:500});
      }else sessionResult={...sessionResult,data:inserted.data,error:null};
    }
    const sessionId=String(sessionResult.data?.id||"");
    if(!sessionId)return NextResponse.json({error:"employee_session_required"},{status:500});

    const pending=await admin.from("ai_employee_actions").select("id,action_type,summary,payload,dedupe_key").eq("employee_id",employee.id).eq("session_id",sessionId).eq("status","proposed").order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(pending.error)return NextResponse.json({error:"employee_pending_action_read_failed"},{status:500});
    if(pending.data){
      const confirmation=parseCallerConfirmation(message);
      const pendingType=parseEmployeeActionType(pending.data.action_type);
      if(!pendingType)return NextResponse.json({error:"employee_pending_action_invalid"},{status:500});
      if(confirmation==="yes"){
        const result=await captureEmployeeAction({employee,type:pendingType,payload:sanitizeEmployeeActionPayload(pending.data.payload),summary:String(pending.data.summary||pendingType),idempotencyKey:String(pending.data.dedupe_key||""),callerConfirmed:true,sessionId});
        if(result.status>=400)return NextResponse.json(result.body,{status:result.status});
        const handoff=pendingType==="handoff_human";
        const turn=deterministicTurn(actionCapturedReply(pendingType),"confirm_action",{shouldHandoff:handoff,handoffReason:handoff?"confirmed_human_handoff":null});
        return NextResponse.json({turn,actionResult:result.body,session:{id:sessionId,externalSessionId},employee:{id:employee.id,name:employee.displayName},business:{id:business.id,name:business.name}},{headers:{"Cache-Control":"no-store"}});
      }
      if(confirmation==="no"){
        await rejectEmployeeAction(String(pending.data.id),String(employee.ownerId));
        const turn=deterministicTurn("Լավ, չեմ գրանցում։ Ասեք՝ ինչն եք ուզում փոխել կամ ինչով կարող եմ օգնել։","reject_action");
        return NextResponse.json({turn,session:{id:sessionId,externalSessionId},employee:{id:employee.id,name:employee.displayName},business:{id:business.id,name:business.name}},{headers:{"Cache-Control":"no-store"}});
      }
      const turn=deterministicTurn(confirmationPrompt(String(pending.data.summary||"")),"await_action_confirmation");
      return NextResponse.json({turn,pendingAction:{type:pendingType,summaryHy:pending.data.summary},session:{id:sessionId,externalSessionId},employee:{id:employee.id,name:employee.displayName},business:{id:business.id,name:business.name}},{headers:{"Cache-Control":"no-store"}});
    }

    let turn=await runEmployeeTurn({profile:employee,business:{id:String(business.id),name:String(business.name),category:String(business.category),description:String(business.description||""),location:business.location?String(business.location):null,offer:business.offer?String(business.offer):null,audience:business.audience?String(business.audience):null,tone:business.tone?String(business.tone):null},message,history:parseHistory(body.history),signal:request.signal});
    let actionResult:unknown=null;
    if(turn.action){
      const key=actionKey(sessionId,turn.action.type,turn.action.summaryHy,turn.action.payload);
      const captured=await captureEmployeeAction({employee,type:turn.action.type,payload:sanitizeEmployeeActionPayload(turn.action.payload),summary:turn.action.summaryHy,idempotencyKey:key,callerConfirmed:!turn.action.requiresConfirmation,sessionId});
      actionResult=captured.body;
      if(captured.status>=400)return NextResponse.json(captured.body,{status:captured.status});
      if(captured.status===202){
        turn={...turn,reply:confirmationPrompt(turn.action.summaryHy),intent:"await_action_confirmation",confidence:Math.max(turn.confidence,.9)};
      }
    }
    return NextResponse.json({turn,actionResult,session:{id:sessionId,externalSessionId},employee:{id:employee.id,name:employee.displayName},business:{id:business.id,name:business.name}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    if(request.signal.aborted)return new Response(null,{status:499});
    console.error("HAY Employee realtime turn failed",error);
    return NextResponse.json({error:"employee_realtime_turn_failed"},{status:500});
  }
}
