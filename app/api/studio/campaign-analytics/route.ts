import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildCampaignAnalytics } from "@/lib/marketing/campaign-analytics";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime="nodejs";
const WORKSPACE_COOKIE="hay_business_id";

function record(value:unknown){return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function campaignIds(campaign:Record<string,unknown>){
  const phases=Array.isArray(campaign.phases)?campaign.phases:[];const ids:string[]=[];
  for(const raw of phases){const phase=record(raw);if(Array.isArray(phase.contentItemIds))for(const id of phase.contentItemIds){const value=String(id||"").trim();if(value)ids.push(value);}}
  return [...new Set(ids)];
}

export async function GET(request:Request){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,business:null,campaign:null,analytics:null,campaigns:[]});
  try{
    const supabase=await createClient();
    const {data:claims,error:claimsError}=await supabase.auth.getClaims();
    const userId=claims?.claims?.sub;
    if(claimsError||!userId)return NextResponse.json({error:"unauthorized"},{status:401});
    const url=new URL(request.url);const requestedCampaignId=url.searchParams.get("campaignId");
    const explicitBusinessId=url.searchParams.get("businessId");
    const selected=explicitBusinessId||(await cookies()).get(WORKSPACE_COOKIE)?.value||null;
    let businessQuery=supabase.from("businesses").select("id,name").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);
    if(selected)businessQuery=businessQuery.eq("id",selected);
    let {data:businesses,error:businessError}=await businessQuery;
    if(!businesses?.[0]&&!explicitBusinessId&&selected){const fallback=await supabase.from("businesses").select("id,name").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);businesses=fallback.data;businessError=fallback.error;}
    if(businessError)return NextResponse.json({error:"business_read_failed",detail:businessError.message},{status:500});
    const business=businesses?.[0];if(!business)return NextResponse.json({configured:true,business:null,campaign:null,analytics:null,campaigns:[]});

    const {data:plans,error:planError}=await supabase.from("marketing_plans").select("id,strategy,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(40);
    if(planError)return NextResponse.json({error:"campaign_analytics_read_failed",detail:planError.message},{status:500});
    const found:Array<{planId:string;createdAt:string;campaign:Record<string,unknown>}>=[];const seen=new Set<string>();
    for(const plan of plans||[]){const strategy=record(plan.strategy);const campaign=record(strategy.campaign);if(!Object.keys(campaign).length)continue;const id=String(campaign.id||`${campaign.name||"campaign"}:${campaign.startDate||plan.created_at}`);if(seen.has(id))continue;seen.add(id);found.push({planId:String(plan.id),createdAt:String(plan.created_at||""),campaign:{...campaign,id}});}
    const selectedCampaign=requestedCampaignId?found.find(item=>String(item.campaign.id)===requestedCampaignId):found.find(item=>String(item.campaign.status)==="active")||found[0];
    const summaries=found.slice(0,12).map(item=>({id:String(item.campaign.id),name:String(item.campaign.name||"Campaign"),startDate:String(item.campaign.startDate||""),endDate:String(item.campaign.endDate||""),primaryKpi:String(item.campaign.primaryKpi||"reach"),planId:item.planId}));
    if(!selectedCampaign)return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},campaign:null,analytics:null,campaigns:summaries});
    const ids=campaignIds(selectedCampaign.campaign);
    if(!ids.length){const analytics=buildCampaignAnalytics({campaign:selectedCampaign.campaign,content:[],metrics:[]});return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},campaign:selectedCampaign.campaign,analytics,campaigns:summaries});}

    const [contentResult,metricsResult]=await Promise.all([
      supabase.from("content_items").select("id,platform,format,objective,hook,status,published_at").eq("business_id",business.id).in("id",ids),
      supabase.from("content_metrics").select("content_item_id,measured_at,views,reach,likes,comments,shares,saves,clicks,conversions,watch_time_seconds").eq("business_id",business.id).in("content_item_id",ids).order("measured_at",{ascending:false}).limit(500),
    ]);
    if(contentResult.error||metricsResult.error)return NextResponse.json({error:"campaign_analytics_metrics_failed",detail:contentResult.error?.message||metricsResult.error?.message},{status:500});
    const analytics=buildCampaignAnalytics({campaign:selectedCampaign.campaign,content:contentResult.data||[],metrics:metricsResult.data||[]});
    return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},campaign:selectedCampaign.campaign,analytics,campaigns:summaries});
  }catch(error){
    console.error("Campaign analytics failed",error);
    return NextResponse.json({error:"campaign_analytics_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
