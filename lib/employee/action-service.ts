import "server-only";
import { actionAllowed } from "./armenian-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmployeeActionType,EmployeeProfile } from "./types";

export function parseEmployeeActionType(value:unknown):EmployeeActionType|null{
  const type=String(value||"");
  return ["book_appointment","create_lead","create_callback","take_order","handoff_human"].includes(type)?type as EmployeeActionType:null;
}

export function sanitizeEmployeeActionPayload(value:unknown){
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

export type CaptureEmployeeActionInput={
  employee:EmployeeProfile;
  type:EmployeeActionType;
  payload:Record<string,string|number|boolean|null>;
  summary:string;
  idempotencyKey:string;
  callerConfirmed:boolean;
  sessionId?:string|null;
};

export async function captureEmployeeAction(input:CaptureEmployeeActionInput){
  const {employee,type}=input;
  if(!employee.id||!employee.ownerId)return {status:500,body:{error:"employee_identity_required"}} as const;
  if(!employee.businessId)return {status:409,body:{error:"employee_business_required"}} as const;
  if(!actionAllowed(employee,type))return {status:403,body:{error:"employee_action_not_allowed"}} as const;
  const idempotencyKey=String(input.idempotencyKey||"").trim().slice(0,200);
  if(!idempotencyKey)return {status:400,body:{error:"idempotency_key_required"}} as const;
  const payload=sanitizeEmployeeActionPayload(input.payload);
  const summary=String(input.summary||type).trim().slice(0,500);
  const requiresConfirmation=employee.actionPolicy.requireCallerConfirmation&&!employee.actionPolicy.autoExecute.includes(type);
  const admin=createAdminClient();

  let actionRow:null|Record<string,unknown>=null;
  const existing=await admin.from("ai_employee_actions")
    .select("id,status,action_type,summary,payload,result,dedupe_key,session_id")
    .eq("employee_id",employee.id).eq("dedupe_key",idempotencyKey).maybeSingle();
  if(existing.error)return {status:500,body:{error:"employee_action_read_failed",detail:existing.error.message}} as const;
  if(existing.data){
    actionRow=existing.data as Record<string,unknown>;
    if(String(actionRow.action_type)!==type)return {status:409,body:{error:"employee_action_idempotency_conflict"}} as const;
    const status=String(actionRow.status||"");
    if(status==="executed")return {status:200,body:{duplicate:true,executed:true,action:actionRow}} as const;
    if(status==="rejected"||status==="failed")return {status:409,body:{duplicate:true,executed:false,action:actionRow,error:`employee_action_${status}`}} as const;
    if(status==="proposed"&&!input.callerConfirmed)return {status:202,body:{duplicate:true,executed:false,confirmationRequired:true,action:actionRow}} as const;
  }else{
    const initialStatus=requiresConfirmation&&!input.callerConfirmed?"proposed":"confirmed";
    const inserted=await admin.from("ai_employee_actions").insert({
      owner_id:employee.ownerId,
      employee_id:employee.id,
      session_id:input.sessionId||null,
      action_type:type,
      status:initialStatus,
      summary,
      payload,
      dedupe_key:idempotencyKey,
    }).select("id,status,action_type,summary,payload,result,dedupe_key,session_id").single();
    if(inserted.error){
      if(String(inserted.error.code)==="23505")return captureEmployeeAction(input);
      return {status:500,body:{error:"employee_action_insert_failed",detail:inserted.error.message}} as const;
    }
    actionRow=inserted.data as Record<string,unknown>;
    if(initialStatus==="proposed")return {status:202,body:{executed:false,confirmationRequired:true,action:actionRow}} as const;
  }

  if(requiresConfirmation&&!input.callerConfirmed)return {status:202,body:{executed:false,confirmationRequired:true,action:actionRow}} as const;
  if(String(actionRow!.status)==="proposed"){
    const promoted=await admin.from("ai_employee_actions").update({status:"confirmed",updated_at:new Date().toISOString()}).eq("id",String(actionRow!.id)).eq("status","proposed").select("id,status,action_type,summary,payload,result,dedupe_key,session_id").maybeSingle();
    if(promoted.error)return {status:500,body:{error:"employee_action_confirmation_failed",detail:promoted.error.message}} as const;
    if(promoted.data)actionRow=promoted.data as Record<string,unknown>;
    else{
      const raced=await admin.from("ai_employee_actions").select("id,status,action_type,summary,payload,result,dedupe_key,session_id").eq("id",String(actionRow!.id)).single();
      if(raced.error)return {status:500,body:{error:"employee_action_confirmation_race_failed"}} as const;
      actionRow=raced.data as Record<string,unknown>;
      if(String(actionRow.status)==="executed")return {status:200,body:{duplicate:true,executed:true,action:actionRow}} as const;
    }
  }

  const kind=inboxKind(type);
  let inbox:null|Record<string,unknown>=null;
  if(kind){
    const customerName=typeof payload.customerName==="string"?payload.customerName.slice(0,180):typeof payload.name==="string"?payload.name.slice(0,180):null;
    const phone=typeof payload.phone==="string"?payload.phone.slice(0,80):null;
    const inboxInsert=await admin.from("ai_employee_inbox").insert({
      owner_id:employee.ownerId,
      business_id:employee.businessId,
      employee_id:employee.id,
      session_id:input.sessionId||null,
      action_id:String(actionRow!.id),
      kind,
      status:"open",
      customer_name:customerName,
      phone,
      scheduled_for:scheduledFor(payload),
      title:summary||`${kind} from HAY Employee`,
      payload,
    }).select("id,kind,status,title,scheduled_for,created_at").single();
    if(inboxInsert.error){
      if(String(inboxInsert.error.code)==="23505"){
        const existingInbox=await admin.from("ai_employee_inbox").select("id,kind,status,title,scheduled_for,created_at").eq("action_id",String(actionRow!.id)).maybeSingle();
        if(existingInbox.error)return {status:500,body:{error:"employee_inbox_read_failed"}} as const;
        inbox=existingInbox.data as Record<string,unknown>|null;
      }else{
        await admin.from("ai_employee_actions").update({status:"failed",result:{error:"inbox_insert_failed"},updated_at:new Date().toISOString()}).eq("id",String(actionRow!.id));
        return {status:500,body:{error:"employee_inbox_insert_failed",detail:inboxInsert.error.message}} as const;
      }
    }else inbox=inboxInsert.data as Record<string,unknown>;
  }

  const result={captured:Boolean(kind),inboxId:inbox?.id||null,handoff:type==="handoff_human"};
  const updated=await admin.from("ai_employee_actions").update({status:"executed",result,updated_at:new Date().toISOString()}).eq("id",String(actionRow!.id)).in("status",["confirmed","executed"]).select("id,status,action_type,summary,payload,result,dedupe_key,session_id").single();
  if(updated.error)return {status:500,body:{error:"employee_action_commit_failed",detail:updated.error.message}} as const;
  return {status:200,body:{executed:true,confirmationRequired:requiresConfirmation,action:updated.data,inbox}} as const;
}

export async function rejectEmployeeAction(actionId:string,ownerId:string){
  const admin=createAdminClient();
  const result=await admin.from("ai_employee_actions").update({status:"rejected",updated_at:new Date().toISOString()}).eq("id",actionId).eq("owner_id",ownerId).eq("status","proposed").select("id,status").maybeSingle();
  if(result.error)throw new Error(`employee_action_reject_failed:${result.error.message}`);
  return Boolean(result.data);
}
