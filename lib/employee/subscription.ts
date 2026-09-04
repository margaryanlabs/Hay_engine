import "server-only";

import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export function employeeSubscriptionEnforcementEnabled(){return process.env.HAY_EMPLOYEE_ENFORCE_SUBSCRIPTION==="true";}

export async function employeeSubscriptionMigrationReady(){
  if(!isSupabaseAdminConfigured())return false;
  try{
    const admin=createAdminClient();
    const [entitlements,usage,probe]=await Promise.all([
      admin.from("ai_employee_entitlements").select("owner_id",{head:true,count:"exact"}).limit(1),
      admin.from("ai_employee_call_usage").select("id",{head:true,count:"exact"}).limit(1),
      admin.rpc("hay_employee_admit_call",{p_owner_id:null,p_employee_id:null,p_session_id:null,p_provider:"migration_probe",p_external_session_id:"migration_probe"}),
    ]);
    return !entitlements.error&&!usage.error&&!probe.error;
  }catch{return false;}
}

async function ensureEmployeeTrialEntitlement(ownerId:string){
  if(!isSupabaseAdminConfigured())return {ok:false as const,reason:"employee_subscription_backend_required"};
  const admin=createAdminClient();
  const existing=await admin.from("ai_employee_entitlements").select("plan_id,status,employee_seats,included_minutes,concurrent_calls,max_call_minutes,current_period_start,current_period_end").eq("owner_id",ownerId).maybeSingle();
  if(existing.error)return {ok:false as const,reason:"employee_subscription_migration_required",detail:existing.error.message};
  if(existing.data)return {ok:true as const,entitlement:existing.data};
  const inserted=await admin.from("ai_employee_entitlements").insert({owner_id:ownerId,plan_id:"employee_trial",status:"trialing",employee_seats:1,included_minutes:30,concurrent_calls:1,max_call_minutes:8}).select("plan_id,status,employee_seats,included_minutes,concurrent_calls,max_call_minutes,current_period_start,current_period_end").single();
  if(inserted.error)return {ok:false as const,reason:"employee_subscription_trial_create_failed",detail:inserted.error.message};
  return {ok:true as const,entitlement:inserted.data};
}

export async function checkEmployeeSeatAllowance(ownerId:string,currentEmployees:number){
  if(!employeeSubscriptionEnforcementEnabled())return {allowed:true as const,enforced:false,limit:null};
  const ensured=await ensureEmployeeTrialEntitlement(ownerId);
  if(!ensured.ok)return {allowed:false as const,status:503,reason:ensured.reason,detail:"detail" in ensured?ensured.detail:undefined};
  const entitlement=ensured.entitlement;
  if(!["active","trialing"].includes(String(entitlement.status)))return {allowed:false as const,status:402,reason:"employee_subscription_inactive"};
  const limit=Math.max(0,Number(entitlement.employee_seats||0));
  if(currentEmployees>=limit)return {allowed:false as const,status:409,reason:"employee_seat_limit_reached",limit,current:currentEmployees};
  return {allowed:true as const,enforced:true,limit,current:currentEmployees};
}

export async function admitEmployeeCall(input:{ownerId:string;employeeId:string;sessionId:string;provider:string;externalSessionId:string}){
  if(!employeeSubscriptionEnforcementEnabled())return {allowed:true as const,enforced:false,reservedSeconds:Number(process.env.HAY_EMPLOYEE_DEMO_MAX_CALL_SECONDS)||600,usageId:null};
  if(!isSupabaseAdminConfigured())return {allowed:false as const,status:503,reason:"employee_subscription_backend_required"};
  const admin=createAdminClient();
  const result=await admin.rpc("hay_employee_admit_call",{
    p_owner_id:input.ownerId,
    p_employee_id:input.employeeId,
    p_session_id:input.sessionId,
    p_provider:input.provider,
    p_external_session_id:input.externalSessionId,
  });
  if(result.error)return {allowed:false as const,status:503,reason:"employee_subscription_migration_required",detail:result.error.message};
  const data=(result.data||{}) as Record<string,unknown>;
  if(data.allowed!==true)return {allowed:false as const,status:data.reason==="employee_concurrency_limit_reached"||data.reason==="employee_minutes_exhausted"?429:402,reason:String(data.reason||"employee_call_not_allowed"),detail:data};
  return {allowed:true as const,enforced:true,usageId:data.usageId?String(data.usageId):null,reservedSeconds:Number(data.reservedSeconds||60),duplicate:Boolean(data.duplicate)};
}

export async function finishEmployeeCall(input:{ownerId:string;usageId:string|null;durationSeconds:number;failed:boolean;metadata?:Record<string,unknown>}){
  if(!input.usageId||!employeeSubscriptionEnforcementEnabled())return {finished:true,enforced:false};
  if(!isSupabaseAdminConfigured())return {finished:false,reason:"employee_subscription_backend_required"};
  const admin=createAdminClient();
  const result=await admin.rpc("hay_employee_finish_call",{
    p_owner_id:input.ownerId,
    p_usage_id:input.usageId,
    p_duration_seconds:Math.max(0,Math.floor(input.durationSeconds)),
    p_failed:input.failed,
    p_metadata:input.metadata||{},
  });
  if(result.error)return {finished:false,reason:"employee_subscription_finish_failed",detail:result.error.message};
  return result.data as Record<string,unknown>;
}

export async function employeeSubscriptionSummary(ownerId:string){
  if(!isSupabaseAdminConfigured())return {configured:false};
  const admin=createAdminClient();
  const entitlement=await admin.from("ai_employee_entitlements").select("plan_id,status,employee_seats,included_minutes,concurrent_calls,max_call_minutes,current_period_start,current_period_end").eq("owner_id",ownerId).maybeSingle();
  if(entitlement.error)return {configured:false,migrationReady:false};
  if(!entitlement.data)return {configured:true,migrationReady:true,entitlement:null,usedMinutes:0,activeCalls:0};
  const [usage,active]=await Promise.all([
    admin.from("ai_employee_call_usage").select("billable_seconds,reserved_seconds,state").eq("owner_id",ownerId).gte("started_at",entitlement.data.current_period_start),
    admin.from("ai_employee_call_usage").select("id",{head:true,count:"exact"}).eq("owner_id",ownerId).eq("state","active"),
  ]);
  const seconds=(usage.data||[]).reduce((sum,row)=>sum+Number(row.state==="active"?row.reserved_seconds:row.billable_seconds||0),0);
  return {configured:true,migrationReady:true,entitlement:entitlement.data,usedMinutes:Math.ceil(seconds/60),activeCalls:active.count||0};
}
