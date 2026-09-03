import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizeForSpeech } from "./normalize";
import type { Dialect, Locale } from "./types";

export type PronunciationScope="system"|"account"|"business";
export type PronunciationCategory="brand"|"acronym"|"finance"|"technology"|"social"|"place"|"person"|"product"|"general";
export type PronunciationSource="hay-reviewed"|"account-custom"|"business-custom"|"licensed"|"consented-correction"|"imported";
export type PronunciationStatus="active"|"draft"|"rejected"|"archived";

export type StoredPronunciationEntry={
  id:string;
  scope:PronunciationScope;
  owner_id:string|null;
  business_id:string|null;
  written:string;
  written_key:string;
  spoken_hy_eastern:string;
  spoken_hy_western:string;
  category:PronunciationCategory;
  source_type:PronunciationSource;
  source_reference:string|null;
  license_code:string|null;
  consent_reference:string|null;
  status:PronunciationStatus;
  version:number;
  notes:string|null;
  reviewed_at:string|null;
  created_at:string;
  updated_at:string;
};

const SELECT_FIELDS="id,scope,owner_id,business_id,written,written_key,spoken_hy_eastern,spoken_hy_western,category,source_type,source_reference,license_code,consent_reference,status,version,notes,reviewed_at,created_at,updated_at";
const CATEGORIES:PronunciationCategory[]=["brand","acronym","finance","technology","social","place","person","product","general"];

function clean(value:unknown,max=240){return String(value||"").trim().replace(/\s+/g," ").slice(0,max);}
function writtenKey(value:string){return value.trim().toLocaleUpperCase("en-US");}
function category(value:unknown):PronunciationCategory{const item=String(value||"general") as PronunciationCategory;return CATEGORIES.includes(item)?item:"general";}
function rows(value:unknown):StoredPronunciationEntry[]{return Array.isArray(value)?value as StoredPronunciationEntry[]:[];}

export async function currentPronunciationOwner(){
  if(!isSupabaseConfigured())return null;
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  const ownerId=data?.claims?.sub?String(data.claims.sub):null;
  return error||!ownerId?null:{ownerId};
}

async function ownsBusiness(ownerId:string,businessId:string){
  if(!isSupabaseAdminConfigured())return false;
  const {data,error}=await createAdminClient().from("businesses").select("id").eq("id",businessId).eq("owner_id",ownerId).maybeSingle();
  return !error&&Boolean(data?.id);
}

export async function pronunciationRegistryReady(){
  if(!isSupabaseAdminConfigured())return false;
  try{
    const admin=createAdminClient();
    const [entries,audit]=await Promise.all([
      admin.from("pronunciation_entries").select("id",{head:true,count:"exact"}).limit(1),
      admin.from("pronunciation_entry_audit").select("id",{head:true,count:"exact"}).limit(1),
    ]);
    return !entries.error&&!audit.error;
  }catch{return false;}
}

export async function loadPersistentPronunciations(input:{ownerId?:string|null;businessId?:string|null;dialect?:Dialect}){
  const dialect=input.dialect||"eastern";
  const empty={configured:false,entries:[] as StoredPronunciationEntry[],overrides:{} as Record<string,string>,version:"core",validBusiness:false};
  if(!isSupabaseAdminConfigured())return empty;

  const admin=createAdminClient();
  const system=await admin.from("pronunciation_entries").select(SELECT_FIELDS).eq("scope","system").eq("status","active").eq("source_type","hay-reviewed");
  if(system.error)return empty;

  const layers:StoredPronunciationEntry[][]=[rows(system.data)];
  if(input.ownerId){
    const account=await admin.from("pronunciation_entries").select(SELECT_FIELDS).eq("scope","account").eq("owner_id",input.ownerId).eq("status","active");
    if(account.error)return empty;
    layers.push(rows(account.data));
  }

  const validBusiness=Boolean(input.ownerId&&input.businessId&&await ownsBusiness(input.ownerId,input.businessId));
  if(validBusiness){
    const business=await admin.from("pronunciation_entries").select(SELECT_FIELDS).eq("scope","business").eq("owner_id",input.ownerId!).eq("business_id",input.businessId!).eq("status","active");
    if(business.error)return empty;
    layers.push(rows(business.data));
  }

  const merged=new Map<string,StoredPronunciationEntry>();
  for(const layer of layers){
    for(const row of layer)merged.set(String(row.written_key||writtenKey(row.written)),row);
  }
  const entries=[...merged.values()];
  const overrides=Object.fromEntries(entries.map(row=>[row.written,dialect==="western"?row.spoken_hy_western:row.spoken_hy_eastern]));
  const fingerprint=entries.map(row=>`${row.id}:${row.version}:${row.scope}`).sort().join("|");
  const version=fingerprint?`hay-pron-db-${createHash("sha256").update(fingerprint).digest("hex").slice(0,12)}`:"core";
  return {configured:true,entries,overrides,version,validBusiness};
}

export async function normalizeWithPronunciationRegistry(input:{text:string;locale?:Locale;dialect?:Dialect;ownerId?:string|null;businessId?:string|null}){
  const locale=input.locale||"hy";
  const dialect=input.dialect||"eastern";
  const registry=locale==="hy"?await loadPersistentPronunciations({ownerId:input.ownerId,businessId:input.businessId,dialect}):{configured:false,entries:[] as StoredPronunciationEntry[],overrides:{} as Record<string,string>,version:"core",validBusiness:false};
  const normalized=normalizeForSpeech(input.text,locale,dialect,registry.overrides);
  return {
    normalized,
    registry:{version:registry.version,persistent:registry.configured,appliedEntries:registry.entries.length,businessApplied:registry.validBusiness},
  };
}

export async function listOwnerPronunciations(ownerId:string,businessId?:string|null){
  if(!isSupabaseAdminConfigured())return {configured:false,entries:[] as StoredPronunciationEntry[],reviewedCount:0,businessValid:false};
  const admin=createAdminClient();
  const reviewed=await admin.from("pronunciation_entries").select("id",{head:true,count:"exact"}).eq("scope","system").eq("status","active").eq("source_type","hay-reviewed");
  const account=await admin.from("pronunciation_entries").select(SELECT_FIELDS).eq("scope","account").eq("owner_id",ownerId).neq("status","archived").order("updated_at",{ascending:false});
  if(reviewed.error||account.error)return {configured:false,error:reviewed.error?.message||account.error?.message,entries:[] as StoredPronunciationEntry[],reviewedCount:0,businessValid:false};

  const entries=rows(account.data);
  let businessValid=false;
  if(businessId){
    businessValid=await ownsBusiness(ownerId,businessId);
    if(businessValid){
      const business=await admin.from("pronunciation_entries").select(SELECT_FIELDS).eq("scope","business").eq("owner_id",ownerId).eq("business_id",businessId).neq("status","archived").order("updated_at",{ascending:false});
      if(business.error)return {configured:false,error:business.error.message,entries:[] as StoredPronunciationEntry[],reviewedCount:Number(reviewed.count||0),businessValid};
      entries.push(...rows(business.data));
    }
  }
  return {configured:true,businessValid,reviewedCount:Number(reviewed.count||0),entries};
}

export async function upsertOwnerPronunciation(input:{ownerId:string;scope:"account"|"business";businessId?:string|null;written:string;spokenEastern:string;spokenWestern?:string;category?:unknown;notes?:unknown;sourceReference?:unknown;consentReference?:unknown}){
  if(!isSupabaseAdminConfigured())return {configured:false,error:"supabase_admin_unconfigured" as const};
  const written=clean(input.written,160),spokenEastern=clean(input.spokenEastern),spokenWestern=clean(input.spokenWestern)||spokenEastern;
  if(!written)return {configured:true,error:"written_required" as const};
  if(!spokenEastern)return {configured:true,error:"spoken_eastern_required" as const};
  const businessId=input.scope==="business"?clean(input.businessId,80):"";
  if(input.scope==="business"&&(!businessId||!(await ownsBusiness(input.ownerId,businessId))))return {configured:true,error:"business_not_found" as const};

  const admin=createAdminClient();
  let existing=admin.from("pronunciation_entries").select("id").eq("scope",input.scope).eq("owner_id",input.ownerId).eq("written_key",writtenKey(written));
  existing=input.scope==="business"?existing.eq("business_id",businessId):existing.is("business_id",null);
  const current=await existing.maybeSingle();
  if(current.error)return {configured:false,error:current.error.message};

  const payload={
    written,
    spoken_hy_eastern:spokenEastern,
    spoken_hy_western:spokenWestern,
    category:category(input.category),
    source_type:(input.scope==="business"?"business-custom":"account-custom") as PronunciationSource,
    source_reference:clean(input.sourceReference,500)||null,
    consent_reference:clean(input.consentReference,500)||null,
    status:"active" as PronunciationStatus,
    notes:clean(input.notes,1000)||null,
    created_by:input.ownerId,
  };
  if(current.data?.id){
    const {data,error}=await admin.from("pronunciation_entries").update(payload).eq("id",current.data.id).eq("owner_id",input.ownerId).select(SELECT_FIELDS).single();
    return error?{configured:false,error:error.message}:{configured:true,entry:data,updated:true};
  }
  const {data,error}=await admin.from("pronunciation_entries").insert({...payload,scope:input.scope,owner_id:input.ownerId,business_id:input.scope==="business"?businessId:null}).select(SELECT_FIELDS).single();
  return error?{configured:false,error:error.message}:{configured:true,entry:data,updated:false};
}

export async function archiveOwnerPronunciation(ownerId:string,id:string){
  if(!isSupabaseAdminConfigured())return {configured:false,error:"supabase_admin_unconfigured" as const};
  const {data,error}=await createAdminClient().from("pronunciation_entries").update({status:"archived"}).eq("id",id).eq("owner_id",ownerId).in("scope",["account","business"]).select("id,version,status").maybeSingle();
  if(error)return {configured:false,error:error.message};
  return {configured:true,archived:Boolean(data?.id),entry:data||null};
}
