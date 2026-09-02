import "server-only";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type AutomationMode = "manual" | "approval" | "autoqueue";

export type PreparePublishResult = {
  prepared: boolean;
  status?: string;
  jobId?: string;
  mode?: AutomationMode;
  reason?: string;
};

function record(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}

function providerSettings(platform:string, defaults:unknown, hook:string){
  const input=record(defaults);
  if(platform==="instagram")return {share_to_feed:input.share_to_feed!==false};
  if(platform==="youtube"){
    const privacy=["private","unlisted","public"].includes(String(input.privacyStatus))?String(input.privacyStatus):"";
    return privacy?{privacyStatus:privacy,title:typeof input.title==="string"?input.title.slice(0,100):hook.slice(0,100)}:{};
  }
  return {};
}

export async function prepareApprovedPublishJob(args:{supabase:ServerClient;userId:string;contentItemId:string}):Promise<PreparePublishResult>{
  const {supabase,userId,contentItemId}=args;
  const {data:content,error:contentError}=await supabase.from("content_items")
    .select("id,business_id,platform,status,asset_url,scheduled_for,hook")
    .eq("id",contentItemId).maybeSingle();
  if(contentError)throw contentError;
  if(!content)return {prepared:false,reason:"content_not_found"};

  const {data:business}=await supabase.from("businesses").select("id").eq("id",content.business_id).eq("owner_id",userId).maybeSingle();
  if(!business)return {prepared:false,reason:"forbidden"};
  if(!["approved","scheduled"].includes(String(content.status)))return {prepared:false,reason:"content_not_approved"};
  if(!content.asset_url)return {prepared:false,reason:"asset_not_ready"};

  const {data:existing}=await supabase.from("publish_jobs")
    .select("id,status")
    .eq("content_item_id",contentItemId)
    .in("status",["queued","processing","needs_auth","needs_approval"])
    .order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(existing?.id)return {prepared:true,jobId:String(existing.id),status:String(existing.status),reason:"active_job_exists"};

  const {data:connection,error:connectionError}=await supabase.from("social_connections")
    .select("id,platform,status,credential_ref,automation_mode,publish_defaults")
    .eq("business_id",content.business_id)
    .eq("platform",content.platform)
    .eq("status","connected")
    .order("connected_at",{ascending:false}).limit(1).maybeSingle();
  if(connectionError)throw connectionError;
  if(!connection?.id||!connection.credential_ref)return {prepared:false,reason:"social_connection_not_ready"};

  const mode=(String(connection.automation_mode||"approval") as AutomationMode);
  if(mode==="manual")return {prepared:false,mode,reason:"manual_policy"};

  const settings=providerSettings(String(content.platform),connection.publish_defaults, String(content.hook||"HAY content"));
  let status:"queued"|"needs_approval"="needs_approval";
  let reason="human_publish_approval_required";

  if(mode==="autoqueue"){
    if(content.platform==="instagram"){
      status="queued";reason="autoqueue_policy";
    }else if(content.platform==="youtube"&&typeof settings.privacyStatus==="string"){
      status="queued";reason="autoqueue_policy";
    }else if(content.platform==="tiktok"){
      reason="tiktok_fresh_creator_info_and_explicit_consent_required";
    }else{
      reason="provider_defaults_or_publisher_required";
    }
  }

  const {data:job,error:insertError}=await supabase.from("publish_jobs").insert({
    business_id:content.business_id,
    content_item_id:contentItemId,
    connection_id:connection.id,
    platform:content.platform,
    status,
    scheduled_for:content.scheduled_for||null,
    provider_settings:settings,
    error:status==="needs_approval"?reason:null,
  }).select("id,status").single();

  if(insertError){
    if((insertError as {code?:string}).code==="23505"){
      const {data:race}=await supabase.from("publish_jobs").select("id,status").eq("content_item_id",contentItemId).in("status",["queued","processing","needs_auth","needs_approval"]).limit(1).maybeSingle();
      if(race?.id)return {prepared:true,jobId:String(race.id),status:String(race.status),mode,reason:"active_job_exists"};
    }
    throw insertError;
  }

  if(status==="queued"&&content.scheduled_for&&Date.parse(String(content.scheduled_for))>Date.now()){
    await supabase.from("content_items").update({status:"scheduled",updated_at:new Date().toISOString()}).eq("id",contentItemId);
  }
  return {prepared:true,jobId:String(job.id),status:String(job.status),mode,reason};
}
