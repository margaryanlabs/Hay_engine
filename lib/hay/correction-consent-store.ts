import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { correctionReusePolicy, HAY_CORRECTION_CONSENT_VERSION } from "./correction-policy";

function asBool(value:unknown,fallback:boolean){return typeof value==="boolean"?value:fallback;}
function hash(payload:unknown){return createHash("sha256").update(JSON.stringify(payload)).digest("hex");}

export async function updateLanguageCorrectionConsent(ownerId:string,id:string,input:{productImprovement?:unknown;benchmark?:unknown;modelTraining?:unknown}){
  if(!isSupabaseAdminConfigured())return {configured:false,error:"supabase_admin_unconfigured" as const};
  const admin=createAdminClient();
  const current=await admin.from("language_corrections").select("id,owner_id,business_id,correction_type,locale,source_text,system_text,corrected_text,context,status,reviewed_by,reviewed_at,review_notes,promoted_pronunciation_id,consent_product_improvement,consent_benchmark,consent_model_training,consent_withdrawn_at").eq("id",id).eq("owner_id",ownerId).maybeSingle();
  if(current.error)return {configured:false,error:current.error.message};
  if(!current.data)return {configured:true,error:"correction_not_found" as const};
  if(current.data.status==="withdrawn"||current.data.consent_withdrawn_at)return {configured:true,error:"correction_withdrawn" as const};

  const productImprovement=asBool(input.productImprovement,Boolean(current.data.consent_product_improvement));
  const benchmark=asBool(input.benchmark,Boolean(current.data.consent_benchmark));
  const modelTraining=asBool(input.modelTraining,Boolean(current.data.consent_model_training));
  const policy=correctionReusePolicy({productImprovement,benchmark,modelTraining,withdrawn:false});
  const now=new Date().toISOString();
  const resetReview=!productImprovement&&["accepted","reviewing"].includes(String(current.data.status));
  const promotedId=current.data.promoted_pronunciation_id?String(current.data.promoted_pronunciation_id):"";

  const updatePayload:Record<string,unknown>={
    consent_product_improvement:productImprovement,
    consent_benchmark:benchmark,
    consent_model_training:modelTraining,
    consent_version:HAY_CORRECTION_CONSENT_VERSION,
    consent_recorded_at:now,
  };
  if(resetReview){
    updatePayload.status="submitted";
    updatePayload.reviewed_by=null;
    updatePayload.reviewed_at=null;
    updatePayload.review_notes=null;
    updatePayload.promoted_pronunciation_id=null;
  }
  const updated=await admin.from("language_corrections").update(updatePayload).eq("id",id).eq("owner_id",ownerId).is("consent_withdrawn_at",null).select("id,status").maybeSingle();
  if(updated.error)return {configured:false,error:updated.error.message};
  if(!updated.data)return {configured:true,error:"consent_update_conflict" as const};

  if(!productImprovement){
    await admin.from("dataset_records").update({status:"withdrawn"}).eq("origin_correction_id",id).in("status",["candidate","approved"]);
    if(promotedId)await admin.from("pronunciation_entries").update({status:"archived"}).eq("id",promotedId).eq("scope","system").eq("consent_reference",`correction:${id}`);
  }else if(current.data.status==="accepted"){
    const datasetPayload={
      sourceText:current.data.source_text,
      systemText:current.data.system_text,
      correctedText:current.data.corrected_text,
      context:current.data.context||{},
      consent:{productImprovement,benchmark,modelTraining,version:HAY_CORRECTION_CONSENT_VERSION},
    };
    const datasetUpdate=await admin.from("dataset_records").update({payload:datasetPayload,content_hash:hash(datasetPayload)}).eq("origin_correction_id",id).eq("status","approved");
    if(datasetUpdate.error)return {configured:false,error:datasetUpdate.error.message};
  }

  return {configured:true,updated:true,policy};
}
