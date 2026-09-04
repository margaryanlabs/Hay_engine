import "server-only";
import { createClient,isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient,isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { DEFAULT_EMPLOYEE_ACTION_POLICY,DEFAULT_EMPLOYEE_CAPABILITIES,type EmployeeActionPolicy,type EmployeeCapabilities,type EmployeeProfile,type EmployeeRole,type EmployeeSpeechStyle } from "./types";

export async function employeeMigrationReady(){
  if(!isSupabaseAdminConfigured())return false;
  try{
    const result=await createAdminClient().from("ai_employees").select("id",{head:true,count:"exact"}).limit(1);
    return !result.error;
  }catch{return false;}
}

export async function authenticatedEmployeeOwner(){
  if(!isSupabaseConfigured())return null;
  try{
    const supabase=await createClient();
    const {data,error}=await supabase.auth.getClaims();
    const ownerId=String(data?.claims?.sub||"");
    return error||!ownerId?null:{ownerId,supabase};
  }catch{return null;}
}

function role(value:unknown):EmployeeRole{return ["receptionist","dispatcher","sales","orders"].includes(String(value))?String(value) as EmployeeRole:"receptionist";}
function style(value:unknown):EmployeeSpeechStyle{return ["standard","natural","yerevan"].includes(String(value))?String(value) as EmployeeSpeechStyle:"natural";}
function locale(value:unknown):EmployeeProfile["locale"]{return ["hy-AM","en","ru"].includes(String(value))?String(value) as EmployeeProfile["locale"]:"hy-AM";}
function capabilities(value:unknown):EmployeeCapabilities{
  const input=value&&typeof value==="object"?value as Record<string,unknown>:{};
  return {appointments:input.appointments!==false,leads:input.leads!==false,callbacks:input.callbacks!==false,orders:Boolean(input.orders),humanHandoff:input.humanHandoff!==false};
}
function actionPolicy(value:unknown):EmployeeActionPolicy{
  const input=value&&typeof value==="object"?value as Record<string,unknown>:{};
  const allowed=["book_appointment","create_lead","create_callback","take_order","handoff_human"];
  const list=(candidate:unknown)=>Array.isArray(candidate)?candidate.map(String).filter(item=>allowed.includes(item)).slice(0,5) as EmployeeActionPolicy["autoExecute"]:[];
  return {requireCallerConfirmation:input.requireCallerConfirmation!==false,autoExecute:list(input.autoExecute),neverExecute:list(input.neverExecute)};
}
function rules(value:unknown){return Array.isArray(value)?value.filter(item=>typeof item==="string").slice(0,30).map(item=>String(item).trim().slice(0,500)).filter(Boolean):[];}

export function employeeProfileFromRow(row:Record<string,unknown>):EmployeeProfile{
  return {id:String(row.id||""),ownerId:String(row.owner_id||""),businessId:row.business_id?String(row.business_id):null,displayName:String(row.display_name||"HAY"),role:role(row.role),locale:locale(row.locale),speechStyle:style(row.speech_style),greeting:String(row.greeting||"Բարև ձեզ։ Ինչո՞վ կարող եմ օգնել։"),voiceId:row.voice_id?String(row.voice_id):null,status:["draft","active","paused"].includes(String(row.status))?String(row.status) as EmployeeProfile["status"]:"draft",capabilities:capabilities(row.capabilities),actionPolicy:actionPolicy(row.action_policy),businessRules:rules(row.business_rules)};
}

export async function listEmployees(ownerId:string){
  const supabase=await createClient();
  const {data,error}=await supabase.from("ai_employees").select("*").eq("owner_id",ownerId).order("created_at",{ascending:false});
  if(error)throw new Error(`employee_list_failed:${error.message}`);
  return (data||[]).map(row=>employeeProfileFromRow(row as Record<string,unknown>));
}

export async function getEmployee(ownerId:string,id:string){
  const supabase=await createClient();
  const {data,error}=await supabase.from("ai_employees").select("*").eq("id",id).eq("owner_id",ownerId).maybeSingle();
  if(error)throw new Error(`employee_read_failed:${error.message}`);
  return data?employeeProfileFromRow(data as Record<string,unknown>):null;
}

export async function createEmployee(ownerId:string,input:Record<string,unknown>){
  const supabase=await createClient();
  const profile={display_name:String(input.displayName||"Անի").trim().slice(0,80)||"Անի",role:role(input.role),locale:locale(input.locale),speech_style:style(input.speechStyle),greeting:String(input.greeting||"Բարև ձեզ։ Ինչո՞վ կարող եմ օգնել։").trim().slice(0,500),voice_id:input.voiceId?String(input.voiceId).slice(0,255):null,status:"draft",capabilities:capabilities(input.capabilities||DEFAULT_EMPLOYEE_CAPABILITIES),action_policy:actionPolicy(input.actionPolicy||DEFAULT_EMPLOYEE_ACTION_POLICY),business_rules:rules(input.businessRules),business_id:input.businessId?String(input.businessId):null,owner_id:ownerId};
  const {data,error}=await supabase.from("ai_employees").insert(profile).select("*").single();
  if(error)throw new Error(`employee_create_failed:${error.message}`);
  return employeeProfileFromRow(data as Record<string,unknown>);
}

export async function loadEmployeeBusiness(ownerId:string,businessId:string|null|undefined){
  if(!businessId)return null;
  const supabase=await createClient();
  const {data,error}=await supabase.from("businesses").select("id,name,category,description,location,offer,audience,tone").eq("id",businessId).eq("owner_id",ownerId).maybeSingle();
  if(error)throw new Error(`employee_business_read_failed:${error.message}`);
  return data;
}