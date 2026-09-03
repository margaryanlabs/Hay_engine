import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { canPromoteCorrection, correctionReusePolicy, HAY_CORRECTION_CONSENT_VERSION } from "./correction-policy";

export type CorrectionType="pronunciation"|"transcript"|"translation"|"copy"|"code-switch"|"name-brand-place"|"other";
export type CorrectionStatus="submitted"|"reviewing"|"accepted"|"rejected"|"withdrawn";

type CorrectionRow={
  id:string;owner_id:string;business_id:string|null;correction_type:CorrectionType;locale:string;source_text:string;system_text:string|null;corrected_text:string;
  context:Record<string,unknown>;source_endpoint:string|null;source_request_id:string|null;
  consent_product_improvement:boolean;consent_benchmark:boolean;consent_model_training:boolean;consent_version:string;consent_recorded_at:string;consent_withdrawn_at:string|null;
  status:CorrectionStatus;reviewed_by:string|null;reviewed_at:string|null;review_notes:string|null;promoted_pronunciation_id:string|null;created_at:string;updated_at:string;
};

const SELECT_FIELDS="id,owner_id,business_id,correction_type,locale,source_text,system_text,corrected_text,context,source_endpoint,source_request_id,consent_product_improvement,consent_benchmark,consent_model_training,consent_version,consent_recorded_at,consent_withdrawn_at,status,reviewed_by,reviewed_at,review_notes,promoted_pronunciation_id,created_at,updated_at";
const TYPES:CorrectionType[]=["pronunciation","transcript","translation","copy","code-switch","name-brand-place","other"];

function clean(value:unknown,max:number){return String(value||"").trim().slice(0,max);}
function correctionType(value:unknown):CorrectionType{const item=String(value||"other") as CorrectionType;return TYPES.includes(item)?item:"other";}
function rows(value:unknown):CorrectionRow[]{return Array.isArray(value)?value as CorrectionRow[]:[];}
function bool(value:unknown){return value===true;}
function contentHash(payload:unknown){return createHash("sha256").update(JSON.stringify(payload)).digest("hex");}
function reviewerEmails(){return new Set(String(process.env.HAY_LANGUAGE_REVIEWER_EMAILS||"").split(",").map(item=>item.trim().toLowerCase()).filter(Boolean));}

export async function currentCorrectionActor(){
  if(!isSupabaseConfigured())return null;
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  const ownerId=data?.claims?.sub?String(data.claims.sub):null;
  const email=data?.claims?.email?String(data.claims.email).trim().toLowerCase():"";
  if(error||!ownerId)return null;
  return {ownerId,email,isReviewer:Boolean(email&&reviewerEmails().has(email))};
}

async function ownsBusiness(ownerId:string,businessId:string){
  if(!isSupabaseAdminConfigured())return false;
  const {data,error}=await createAdminClient().from("businesses").select("id").eq("id",businessId).eq("owner_id",ownerId).maybeSingle();
  return !error&&Boolean(data?.id);
}

export async function correctionFlywheelReady(){
  if(!isSupabaseAdminConfigured())return false;
  try{
    const admin=createAdminClient();
    const [corrections,audit,datasets]=await Promise.all([
      admin.from("language_corrections").select("id",{head:true,count:"exact"}).limit(1),
      admin.from("language_correction_audit").select("id",{head:true,count:"exact"}).limit(1),
      admin.from("dataset_records").select("id",{head:true,count:"exact"}).limit(1),
    ]);
    return !corrections.error&&!audit.error&&!datasets.error;
  }catch{return false;}
}

export async function submitLanguageCorrection(input:{
  ownerId:string;businessId?:string|null;correctionType?:unknown;locale?:unknown;sourceText:unknown;systemText?:unknown;correctedText:unknown;
  context?:unknown;sourceEndpoint?:unknown;sourceRequestId?:unknown;consentProductImprovement?:unknown;consentBenchmark?:unknown;consentModelTraining?:unknown;
}){
  if(!isSupabaseAdminConfigured())return {configured:false,error:"supabase_admin_unconfigured" as const};
  const sourceText=clean(input.sourceText,20000),correctedText=clean(input.correctedText,20000),systemText=clean(input.systemText,20000)||null;
  if(!sourceText)return {configured:true,error:"source_text_required" as const};
  if(!correctedText)return {configured:true,error:"corrected_text_required" as const};
  const businessId=clean(input.businessId,80)||null;
  if(businessId&&!(await ownsBusiness(input.ownerId,businessId)))return {configured:true,error:"business_not_found" as const};
  const context=input.context&&typeof input.context==="object"&&!Array.isArray(input.context)?input.context:{};
  const payload={
    owner_id:input.ownerId,business_id:businessId,correction_type:correctionType(input.correctionType),locale:clean(input.locale,24)||"hy-AM",
    source_text:sourceText,system_text:systemText,corrected_text:correctedText,context,
    source_endpoint:clean(input.sourceEndpoint,240)||null,source_request_id:clean(input.sourceRequestId,240)||null,
    consent_product_improvement:bool(input.consentProductImprovement),consent_benchmark:bool(input.consentBenchmark),consent_model_training:bool(input.consentModelTraining),
    consent_version:HAY_CORRECTION_CONSENT_VERSION,status:"submitted" as CorrectionStatus,
  };
  const {data,error}=await createAdminClient().from("language_corrections").insert(payload).select(SELECT_FIELDS).single();
  return error?{configured:false,error:error.message}:{configured:true,correction:data,policy:correctionReusePolicy({productImprovement:payload.consent_product_improvement,benchmark:payload.consent_benchmark,modelTraining:payload.consent_model_training,withdrawn:false})};
}

export async function listOwnerCorrections(ownerId:string){
  if(!isSupabaseAdminConfigured())return {configured:false,corrections:[] as CorrectionRow[]};
  const {data,error}=await createAdminClient().from("language_corrections").select(SELECT_FIELDS).eq("owner_id",ownerId).order("created_at",{ascending:false}).limit(100);
  return error?{configured:false,error:error.message,corrections:[] as CorrectionRow[]}:{configured:true,corrections:rows(data)};
}

export async function withdrawLanguageCorrection(ownerId:string,id:string){
  if(!isSupabaseAdminConfigured())return {configured:false,error:"supabase_admin_unconfigured" as const};
  const admin=createAdminClient();
  const current=await admin.from("language_corrections").select(SELECT_FIELDS).eq("id",id).eq("owner_id",ownerId).maybeSingle();
  if(current.error)return {configured:false,error:current.error.message};
  if(!current.data)return {configured:true,error:"correction_not_found" as const};
  if(current.data.status==="withdrawn")return {configured:true,withdrawn:true};
  const now=new Date().toISOString();
  const updated=await admin.from("language_corrections").update({status:"withdrawn",consent_withdrawn_at:now}).eq("id",id).eq("owner_id",ownerId).select("id").single();
  if(updated.error)return {configured:false,error:updated.error.message};
  await admin.from("dataset_records").update({status:"withdrawn"}).eq("origin_correction_id",id).in("status",["candidate","approved"]);
  const promotedId=current.data.promoted_pronunciation_id?String(current.data.promoted_pronunciation_id):"";
  if(promotedId){
    await admin.from("pronunciation_entries").update({status:"archived"}).eq("id",promotedId).eq("scope","system").eq("consent_reference",`correction:${id}`);
  }
  return {configured:true,withdrawn:true};
}

export async function listReviewQueue(reviewerId:string){
  if(!isSupabaseAdminConfigured())return {configured:false,corrections:[] as CorrectionRow[]};
  if(!reviewerId)return {configured:true,error:"reviewer_required" as const,corrections:[] as CorrectionRow[]};
  const {data,error}=await createAdminClient().from("language_corrections").select(SELECT_FIELDS)
    .eq("consent_product_improvement",true).is("consent_withdrawn_at",null).in("status",["submitted","reviewing"]).order("created_at",{ascending:true}).limit(200);
  return error?{configured:false,error:error.message,corrections:[] as CorrectionRow[]}:{configured:true,corrections:rows(data)};
}

async function promotePronunciation(admin:ReturnType<typeof createAdminClient>,correction:CorrectionRow,reviewerId:string){
  if(correction.correction_type!=="pronunciation")return {promoted:false as const};
  const written=clean(correction.source_text,160),eastern=clean(correction.corrected_text,240);
  if(!written||!eastern)return {promoted:false as const,error:"invalid_pronunciation_correction" as const};
  const context=correction.context||{};
  const western=clean(context.spokenWestern,240)||eastern;
  const categories=["brand","acronym","finance","technology","social","place","person","product","general"];
  const category=categories.includes(String(context.category||""))?String(context.category):"general";
  const correctionReference=`correction:${correction.id}`;
  const existing=await admin.from("pronunciation_entries").select("id,source_type,source_reference,consent_reference,status").eq("scope","system").eq("written_key",written.toLocaleUpperCase("en-US")).maybeSingle();
  if(existing.error)return {promoted:false as const,error:existing.error.message};
  const payload={written,spoken_hy_eastern:eastern,spoken_hy_western:western,category,source_type:"hay-reviewed",source_reference:correctionReference,consent_reference:correctionReference,status:"active",reviewed_by:reviewerId,reviewed_at:new Date().toISOString(),notes:`Promoted from consented correction ${correction.id}`,created_by:reviewerId};
  if(existing.data?.id){
    if(String(existing.data.consent_reference||"")!==correctionReference){
      return {promoted:false as const,error:"pronunciation_review_conflict" as const};
    }
    const result=await admin.from("pronunciation_entries").update(payload).eq("id",existing.data.id).eq("consent_reference",correctionReference).select("id").single();
    return result.error?{promoted:false as const,error:result.error.message}:{promoted:true as const,id:String(result.data.id)};
  }
  const result=await admin.from("pronunciation_entries").insert({...payload,scope:"system",owner_id:null,business_id:null}).select("id").single();
  return result.error?{promoted:false as const,error:result.error.message}:{promoted:true as const,id:String(result.data.id)};
}

export async function reviewLanguageCorrection(input:{reviewerId:string;id:string;decision:"accept"|"reject";notes?:unknown;promotePronunciation?:boolean}){
  if(!isSupabaseAdminConfigured())return {configured:false,error:"supabase_admin_unconfigured" as const};
  const admin=createAdminClient();
  const current=await admin.from("language_corrections").select(SELECT_FIELDS).eq("id",input.id).maybeSingle();
  if(current.error)return {configured:false,error:current.error.message};
  if(!current.data)return {configured:true,error:"correction_not_found" as const};
  let correction=current.data as CorrectionRow;
  if(correction.status==="withdrawn"||correction.consent_withdrawn_at)return {configured:true,error:"correction_withdrawn" as const};
  if(!["submitted","reviewing"].includes(correction.status))return {configured:true,error:"correction_already_reviewed" as const};
  if(correction.status==="reviewing"&&correction.reviewed_by&&correction.reviewed_by!==input.reviewerId)return {configured:true,error:"review_in_progress" as const};

  if(correction.status==="submitted"){
    const claim=await admin.from("language_corrections").update({status:"reviewing",reviewed_by:input.reviewerId}).eq("id",input.id).eq("status","submitted").is("consent_withdrawn_at",null).select(SELECT_FIELDS).maybeSingle();
    if(claim.error)return {configured:false,error:claim.error.message};
    if(!claim.data)return {configured:true,error:"review_conflict" as const};
    correction=claim.data as CorrectionRow;
  }

  const consent={productImprovement:Boolean(correction.consent_product_improvement),benchmark:Boolean(correction.consent_benchmark),modelTraining:Boolean(correction.consent_model_training),withdrawn:false};
  if(input.decision==="accept"&&!canPromoteCorrection(consent))return {configured:true,error:"product_improvement_consent_required" as const};
  const now=new Date().toISOString();
  if(input.decision==="reject"){
    const {data,error}=await admin.from("language_corrections").update({status:"rejected",reviewed_by:input.reviewerId,reviewed_at:now,review_notes:clean(input.notes,2000)||null}).eq("id",input.id).eq("status","reviewing").eq("reviewed_by",input.reviewerId).is("consent_withdrawn_at",null).select("id").maybeSingle();
    return error?{configured:false,error:error.message}:data?.id?{configured:true,accepted:false}:{configured:true,error:"review_conflict" as const};
  }

  const datasetPayload={sourceText:correction.source_text,systemText:correction.system_text,correctedText:correction.corrected_text,context:correction.context,consent:{productImprovement:correction.consent_product_improvement,benchmark:correction.consent_benchmark,modelTraining:correction.consent_model_training,version:correction.consent_version}};
  const datasetKey=`hay-${correction.correction_type}-hy`;
  const dataset=await admin.from("dataset_records").upsert({
    dataset_key:datasetKey,record_type:correction.correction_type,locale:correction.locale,content_hash:contentHash(datasetPayload),payload:datasetPayload,
    source_type:"consented-user-correction",source_reference:`correction:${correction.id}`,consent_reference:`correction:${correction.id}`,owner_id:correction.owner_id,business_id:correction.business_id,origin_correction_id:correction.id,
    status:"approved",approved_by:input.reviewerId,approved_at:now,
  },{onConflict:"origin_correction_id"}).select("id").single();
  if(dataset.error)return {configured:false,error:dataset.error.message};

  const accepted=await admin.from("language_corrections").update({status:"accepted",reviewed_by:input.reviewerId,reviewed_at:now,review_notes:clean(input.notes,2000)||null}).eq("id",input.id).eq("status","reviewing").eq("reviewed_by",input.reviewerId).is("consent_withdrawn_at",null).select(SELECT_FIELDS).maybeSingle();
  if(accepted.error)return {configured:false,error:accepted.error.message};
  if(!accepted.data){
    await admin.from("dataset_records").update({status:"withdrawn"}).eq("origin_correction_id",input.id);
    return {configured:true,error:"review_conflict" as const};
  }
  correction=accepted.data as CorrectionRow;

  let pronunciation:{promoted:false}|{promoted:true;id:string}|{promoted:false;error:string}={promoted:false};
  if(input.promotePronunciation&&correction.correction_type==="pronunciation"){
    const fresh=await admin.from("language_corrections").select(SELECT_FIELDS).eq("id",input.id).eq("status","accepted").is("consent_withdrawn_at",null).maybeSingle();
    if(fresh.error)return {configured:false,error:fresh.error.message};
    if(!fresh.data)return {configured:true,accepted:true,datasetRecordId:String(dataset.data.id),pronunciation:{promoted:false},policy:correctionReusePolicy({...consent,withdrawn:true})};
    pronunciation=await promotePronunciation(admin,fresh.data as CorrectionRow,input.reviewerId);
    if("error" in pronunciation&&pronunciation.error)return {configured:false,error:pronunciation.error};
    if(pronunciation.promoted){
      const linked=await admin.from("language_corrections").update({promoted_pronunciation_id:pronunciation.id}).eq("id",input.id).eq("status","accepted").is("consent_withdrawn_at",null).select("id").maybeSingle();
      if(linked.error)return {configured:false,error:linked.error.message};
      if(!linked.data){
        await admin.from("pronunciation_entries").update({status:"archived"}).eq("id",pronunciation.id).eq("scope","system").eq("consent_reference",`correction:${input.id}`);
        pronunciation={promoted:false};
      }
    }
  }

  return {configured:true,accepted:true,datasetRecordId:String(dataset.data.id),pronunciation,policy:correctionReusePolicy(consent)};
}