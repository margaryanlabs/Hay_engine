import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

const modes = ["manual","approval","autoqueue"] as const;
type Mode = typeof modes[number];

function sanitizeDefaults(platform:string,value:unknown){
  const input=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  if(platform==="instagram")return {share_to_feed:input.share_to_feed!==false};
  if(platform==="youtube"){
    const privacy=["private","unlisted","public"].includes(String(input.privacyStatus))?String(input.privacyStatus):"private";
    return {privacyStatus:privacy};
  }
  // TikTok privacy/creator options and consent must be fresh at publish time and are never persisted as defaults.
  return {};
}

async function authBusiness(request:Request){
  if(!isSupabaseConfigured())return {response:NextResponse.json({configured:false,connections:[]})};
  const url=new URL(request.url);
  const businessId=url.searchParams.get("businessId")||"";
  if(!businessId)return {response:NextResponse.json({error:"business_required"},{status:400})};
  const supabase=await createClient();
  const {data:claimsData,error:claimsError}=await supabase.auth.getClaims();
  const userId=claimsData?.claims?.sub;
  if(claimsError||!userId)return {response:NextResponse.json({error:"unauthorized"},{status:401})};
  const {data:business}=await supabase.from("businesses").select("id").eq("id",businessId).eq("owner_id",userId).maybeSingle();
  if(!business)return {response:NextResponse.json({error:"business_not_found"},{status:404})};
  return {supabase,businessId};
}

export async function GET(request: Request) {
  const auth=await authBusiness(request);
  if("response" in auth)return auth.response;
  const {data,error}=await auth.supabase.from("social_connections")
    .select("id,platform,status,account_name,account_id,scopes,expires_at,connected_at,automation_mode,publish_defaults")
    .eq("business_id",auth.businessId);
  if(error)return NextResponse.json({error:"connections_read_failed",detail:error.message},{status:500});
  return NextResponse.json({configured:true,connections:data||[]});
}

export async function PATCH(request:Request){
  try{
    const auth=await authBusiness(request);
    if("response" in auth)return auth.response;
    const body=await request.json();
    const connectionId=String(body.connectionId||"");
    const mode=String(body.automationMode||"") as Mode;
    if(!connectionId||!modes.includes(mode))return NextResponse.json({error:"invalid_policy_request"},{status:400});

    const {data:connection}=await auth.supabase.from("social_connections")
      .select("id,platform,status")
      .eq("id",connectionId).eq("business_id",auth.businessId).maybeSingle();
    if(!connection)return NextResponse.json({error:"connection_not_found"},{status:404});

    const effectiveMode=connection.platform==="tiktok"&&mode==="autoqueue"?"approval":mode;
    const defaults=sanitizeDefaults(String(connection.platform),body.publishDefaults);
    const {data,error}=await auth.supabase.from("social_connections")
      .update({automation_mode:effectiveMode,publish_defaults:defaults})
      .eq("id",connectionId).eq("business_id",auth.businessId)
      .select("id,platform,status,account_name,account_id,scopes,expires_at,connected_at,automation_mode,publish_defaults").single();
    if(error)throw error;
    return NextResponse.json({configured:true,connection:data,tiktokAutoqueueDowngraded:connection.platform==="tiktok"&&mode==="autoqueue"});
  }catch(error){
    console.error("Connection policy update failed",error);
    return NextResponse.json({error:"connection_policy_update_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
