import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { actionAllowed } from "@/lib/employee/armenian-policy";
import { authenticatedEmployeeOwner,employeeProfileFromRow } from "@/lib/employee/store";
import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { EmployeeActionDraft,EmployeeActionType } from "@/lib/employee/types";

export const runtime="nodejs";

function workerAuthorized(request:Request){
  const expected=String(process.env.HAY_VOICE_WORKER_SECRET||"");
  const header=request.headers.get("authorization")||"";
  const supplied=header.startsWith("Bearer ")?header.slice(7):"";
  if(!expected||!supplied||expected.length!==supplied.length)return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}
function actionType(value:unknown):EmployeeActionType|null{
  const type=String(value||"");
  return ["book_appointment","create_lead","create_callback","take_order","handoff_human"].includes(type)?type as EmployeeActionType:null;
}
function safePayload(value:unknown){
  const input=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const result:Record<string,string|number|boolean|null>={};
  for(const [key,item] of Object.entries(input).slice(0,30)){
    if(typeof item==="string")result[key.slice(0,80)]=item.slice(0,700);
    else if(typeof item==="number"||typeof item==="boolean"||item===null)result[key.slice(0,80)]=item;
  }
  return result;
}
function inboxKind(type:EmployeeActionType){return type==="book_appointment"?"appointment_request":type==="create_lead"?"lead":type==="create_callback"?"callback":type==="take_order"?"order":null;}
function scheduledFor(payload:Record<string,string|number|boolean|null>){
  const raw=payload.scheduledFor||payload.dateTime||payload.datetime||null;
  if(typeof raw!=="string")return null;
  const date=new Date(raw);return Number.isFinite(date.getTime())?date.toISOString():null;
}

export async function POST(request:Request){
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"supabase_admin_required"},{status:503});
  const trustedWorker=workerAuthorized(request);
  const owner=trustedWorker?null:await authenticatedEmployeeOwner();
  if(!trustedWorker&&!owner)return NextResponse.json({error:"unauthorized"},{status:401});
  try{
    const body=await request.json();
    const employeeId=String(body.employeeId||"");
    const type=actionType(body.action?.type||body.type);
    const idempotencyKey=String(body.idempotencyKey||"").trim().slice(0,200);
    if(!employeeId)return NextResponse.json({error:"employee_id_required"},{status:400});
    if(!type)return NextResponse.json({error:"invalid_action_type"},{status:400});
    if(!idempotencyKey)return NextResponse.json({error:"idempotency_key_required"},{status:400});
    const admin=createAdminClient();
    const {data:employeeRow,error:employeeError}=await admin.from("ai_employees").select("*").eq("id",employeeId).maybeSingle();
    if(employeeError)return NextResponse.json({error:"employee_read_failed"},{status:500});
    if(!employeeRow)return NextResponse.json({error:"employee_not_found"},{status:404});
    const employee=employeeProfileFromRow(employeeRow as Record<string,unknown>);
    if(!trustedWorker&&employee.ownerId!==owner!.ownerId)return NextResponse.json({error:"forbidden"},{status:403});
    if(trustedWorker&&employee.status!=="active"&&process.env.HAY_ALLOW_DRAFT_EMPLOYEE_REALTIME!=="true")return NextResponse.json({error:"employee_not_active"},{status:409});
    if(!employee.businessId)return NextResponse.json({error:"employee_business_required"},{status:409});
    if(!actionAllowed(employee,type))return NextResponse.json({error:"employee_action_not_allowed"},{status:403});

    const payload=safePayload(body.action?.payload||body.payload);
    const summary=String(body.action?.summaryHy||body.summary||type).trim().slice(0,500);
    const requiresConfirmation=employee.actionPolicy.requireCallerConfirmation&&!employee.actionPolicy.autoExecute.includes(type);
    const callerConfirmed=body.callerConfirmed===true;
    const initialStatus=requiresConfirmation&&!callerConfirmed?"proposed":"confirmed";
    const sessionId=body.sessionId?String(body.sessionId):null;

    const inserted=await admin.from("ai_employee_actions").insert({owner_id:employee.ownerId,business_id:undefined,employee_id:employee.id,session_id:sessionId,action_type:type,status:initialStatus,summary,payload,dedupe_key:idempotencyKey}).select("id,status,action_type,summary,payload,result,dedupe_key").single();
    if(inserted.error){
      if(String(inserted.error.code)==="23505"){
        const duplicate=await admin.from("ai_employee_actions").select("id,status,action_type,summary,payload,result,dedupe_key").eq("employee_id",employee.id).eq("dedupe_key",idempotencyKey).maybeSingle();
        return NextResponse.json({duplicate:true,action:duplicate.data},{status:200});
      }
      return NextResponse.json({error:"employee_action_insert_failed",detail:inserted.error.message},{status:500});
    }
    if(initialStatus==="proposed")return NextResponse.json({executed:false,confirmationRequired:true,action:inserted.data},{status:202});

    const kind=inboxKind(type);
    let inbox=null;
    if(kind){
      const customerName=typeof payload.customerName==="string"?payload.customerName.slice(0,180):typeof payload.name==="string"?payload.name.slice(0,180):null;
      const phone=typeof payload.phone==="string"?payload.phone.slice(0,80):null;
      const title=summary||`${kind} from HAY Employee`;
      const inboxResult=await admin.from("ai_employee_inbox").insert({owner_id:employee.ownerId,business_id:employee.businessId,employee_id:employee.id,session_id:sessionId,action_id:inserted.data.id,kind,status:"open",customer_name:customerName,phone,scheduled_for:scheduledFor(payload),title,payload}).select("id,kind,status,title,scheduled_for,created_at").single();
      if(inboxResult.error){
        await admin.from("ai_employee_actions").update({status:"failed",result:{error:"inbox_insert_failed"},updated_at:new Date().toISOString()}).eq("id",inserted.data.id);
        return NextResponse.json({error:"employee_inbox_insert_failed",detail:inboxResult.error.message},{status:500});
      }
      inbox=inboxResult.data;
    }

    const result={captured:Boolean(kind),inboxId:inbox?.id||null,handoff:type==="handoff_human"};
    const updated=await admin.from("ai_employee_actions").update({status:"executed",result,updated_at:new Date().toISOString()}).eq("id",inserted.data.id).select("id,status,action_type,summary,payload,result,dedupe_key").single();
    if(updated.error)return NextResponse.json({error:"employee_action_commit_failed"},{status:500});
    return NextResponse.json({executed:true,confirmationRequired:requiresConfirmation,action:updated.data,inbox});
  }catch(error){
    console.error("HAY Employee action gate failed",error);
    return NextResponse.json({error:"employee_action_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}