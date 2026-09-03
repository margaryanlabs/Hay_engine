import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { planEnforcementEnabled } from "@/lib/commercial/entitlements";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const HAY_API_KEY_PREFIX="hay_live_";
export const HAY_DEVELOPER_SCOPES=["language","language:normalize","language:pronounce","language:captions","language:translate","language:transcribe"] as const;
export type HayDeveloperScope=(typeof HAY_DEVELOPER_SCOPES)[number];

function hashKey(value:string){return createHash("sha256").update(value,"utf8").digest("hex");}
function cleanName(value:string){return value.trim().replace(/\s+/g," ").slice(0,80);}
function cleanScopes(value:unknown):HayDeveloperScope[]{
  const requested=Array.isArray(value)?value.map(String):["language"];
  const result=[...new Set(requested.filter((item):item is HayDeveloperScope=>HAY_DEVELOPER_SCOPES.includes(item as HayDeveloperScope)))];
  return result.length?result:["language"];
}
function scopeAllows(scopes:string[],required:HayDeveloperScope){return scopes.includes("language")||scopes.includes(required);}
export function developerApiEnabled(){return process.env.HAY_DEVELOPER_API_ENABLED==="true";}
export function developerApiHourlyLimit(){
  const value=Number(process.env.HAY_DEVELOPER_API_HOURLY_REQUEST_LIMIT||0);
  return Number.isFinite(value)&&value>0?Math.floor(value):0;
}

export async function developerApiMigrationReady(){
  if(!isSupabaseAdminConfigured())return false;
  try{
    const admin=createAdminClient();
    const [keys,usage]=await Promise.all([
      admin.from("developer_api_keys").select("id",{head:true,count:"exact"}).limit(1),
      admin.from("developer_api_usage").select("id",{head:true,count:"exact"}).limit(1),
    ]);
    return !keys.error&&!usage.error;
  }catch{return false;}
}

export async function authenticatedOwner(){
  if(!isSupabaseConfigured())return null;
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  const ownerId=data?.claims?.sub?String(data.claims.sub):null;
  if(error||!ownerId)return null;
  return {ownerId,supabase};
}

export async function listDeveloperKeys(ownerId:string){
  if(!isSupabaseAdminConfigured())return {configured:false,keys:[] as unknown[]};
  const {data,error}=await createAdminClient().from("developer_api_keys")
    .select("id,name,key_prefix,scopes,last_used_at,expires_at,revoked_at,created_at")
    .eq("owner_id",ownerId).order("created_at",{ascending:false});
  if(error)return {configured:false,error:error.message,keys:[] as unknown[]};
  return {configured:true,keys:data||[]};
}

export async function createDeveloperKey(input:{ownerId:string;name:string;scopes?:unknown;expiresAt?:string|null}){
  if(!isSupabaseAdminConfigured())return {configured:false,error:"supabase_admin_unconfigured" as const};
  const name=cleanName(input.name);
  if(!name)return {configured:true,error:"name_required" as const};
  const scopes=cleanScopes(input.scopes);
  const raw=`${HAY_API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const keyHash=hashKey(raw);
  const keyPrefix=`${raw.slice(0,HAY_API_KEY_PREFIX.length+8)}…`;
  let expiresAt:string|null=null;
  if(input.expiresAt){
    const parsed=new Date(input.expiresAt);
    if(!Number.isNaN(parsed.getTime())&&parsed.getTime()>Date.now())expiresAt=parsed.toISOString();
  }
  const admin=createAdminClient();
  const active=await admin.from("developer_api_keys").select("id",{count:"exact",head:true}).eq("owner_id",input.ownerId).is("revoked_at",null);
  if(!active.error&&Number(active.count||0)>=10)return {configured:true,error:"active_key_limit_reached" as const};
  const {data,error}=await admin.from("developer_api_keys").insert({owner_id:input.ownerId,name,key_prefix:keyPrefix,key_hash:keyHash,scopes,expires_at:expiresAt}).select("id,name,key_prefix,scopes,expires_at,created_at").single();
  if(error)return {configured:false,error:error.message};
  return {configured:true,key:raw,record:data};
}

export async function revokeDeveloperKey(ownerId:string,keyId:string){
  if(!isSupabaseAdminConfigured())return {configured:false,error:"supabase_admin_unconfigured" as const};
  const {data,error}=await createAdminClient().from("developer_api_keys").update({revoked_at:new Date().toISOString()}).eq("id",keyId).eq("owner_id",ownerId).is("revoked_at",null).select("id").maybeSingle();
  if(error)return {configured:false,error:error.message};
  return {configured:true,revoked:Boolean(data?.id)};
}

function requestKey(request:Request){
  const explicit=request.headers.get("x-hay-api-key")?.trim();
  if(explicit)return explicit;
  const authorization=request.headers.get("authorization")||"";
  const match=authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim()||"";
}

export type DeveloperApiContext={keyId:string;ownerId:string;scopes:string[];planId:string;status:string};

export async function authenticateDeveloperRequest(request:Request,requiredScope:HayDeveloperScope):Promise<{allowed:true;context:DeveloperApiContext}|{allowed:false;reason:string;status:number}>{
  if(!developerApiEnabled())return {allowed:false,reason:"developer_api_disabled",status:503};
  if(!isSupabaseAdminConfigured())return {allowed:false,reason:"developer_api_unconfigured",status:503};
  const hourlyLimit=developerApiHourlyLimit();
  if(hourlyLimit<=0)return {allowed:false,reason:"developer_api_rate_limit_unconfigured",status:503};
  const raw=requestKey(request);
  if(!raw||!raw.startsWith(HAY_API_KEY_PREFIX))return {allowed:false,reason:"invalid_api_key",status:401};
  const admin=createAdminClient();
  const {data:key,error}=await admin.from("developer_api_keys").select("id,owner_id,scopes,expires_at,revoked_at").eq("key_hash",hashKey(raw)).maybeSingle();
  if(error)return {allowed:false,reason:"developer_api_migration_required",status:503};
  if(!key||key.revoked_at)return {allowed:false,reason:"invalid_api_key",status:401};
  if(key.expires_at&&new Date(String(key.expires_at)).getTime()<=Date.now())return {allowed:false,reason:"api_key_expired",status:401};
  const scopes=Array.isArray(key.scopes)?key.scopes.map(String):[];
  if(!scopeAllows(scopes,requiredScope))return {allowed:false,reason:"insufficient_scope",status:403};

  const since=new Date(Date.now()-60*60*1000).toISOString();
  const rate=await admin.from("developer_api_usage").select("id",{count:"exact",head:true}).eq("api_key_id",key.id).gte("created_at",since);
  if(rate.error)return {allowed:false,reason:"developer_api_metering_unavailable",status:503};
  if(Number(rate.count||0)>=hourlyLimit)return {allowed:false,reason:"developer_api_rate_limit_reached",status:429};

  const {data:entitlement,error:entitlementError}=await admin.from("account_entitlements").select("plan_id,status").eq("owner_id",key.owner_id).maybeSingle();
  if(entitlementError)return {allowed:false,reason:"commercial_entitlement_unavailable",status:503};
  const planId=String(entitlement?.plan_id||"free");
  const status=String(entitlement?.status||"active");
  if(planEnforcementEnabled()&&!["active","trialing"].includes(status))return {allowed:false,reason:"subscription_inactive",status:402};
  await admin.from("developer_api_keys").update({last_used_at:new Date().toISOString()}).eq("id",key.id);
  return {allowed:true,context:{keyId:String(key.id),ownerId:String(key.owner_id),scopes,planId,status}};
}

export async function recordDeveloperApiUsage(context:DeveloperApiContext,input:{endpoint:string;operation:string;inputChars?:number;audioBytes?:number;metadata?:Record<string,unknown>}){
  if(!isSupabaseAdminConfigured())throw new Error("developer_api_metering_unconfigured");
  const {error}=await createAdminClient().from("developer_api_usage").insert({
    owner_id:context.ownerId,
    api_key_id:context.keyId,
    endpoint:input.endpoint,
    operation:input.operation,
    request_count:1,
    input_chars:Math.max(0,Math.round(Number(input.inputChars)||0)),
    audio_bytes:Math.max(0,Math.round(Number(input.audioBytes)||0)),
    metadata:input.metadata||{},
  });
  if(error)throw new Error(`developer_api_usage_record_failed:${error.code||"unknown"}`);
  return {recorded:true};
}

export async function developerUsageSummary(ownerId:string){
  if(!isSupabaseAdminConfigured())return {configured:false};
  const now=new Date();const since=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();
  const admin=createAdminClient();
  const {data,error}=await admin.from("developer_api_usage").select("request_count,input_chars,audio_bytes,endpoint").eq("owner_id",ownerId).gte("created_at",since);
  if(error)return {configured:false,error:error.message};
  const byEndpoint:Record<string,number>={};let requests=0,inputChars=0,audioBytes=0;
  for(const row of data||[]){requests+=Number(row.request_count)||0;inputChars+=Number(row.input_chars)||0;audioBytes+=Number(row.audio_bytes)||0;const endpoint=String(row.endpoint||"unknown");byEndpoint[endpoint]=(byEndpoint[endpoint]||0)+(Number(row.request_count)||0);}
  return {configured:true,periodStart:since,requests,inputChars,audioBytes,byEndpoint};
}
