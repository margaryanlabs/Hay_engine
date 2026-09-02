import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildCampaignAnalytics } from "@/lib/marketing/campaign-analytics";
import { effectiveOutcome, loadAttributionSummary } from "@/lib/marketing/attribution";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime="nodejs";
const WORKSPACE_COOKIE="hay_business_id";
const YEREVAN_OFFSET="+04:00";

function record(value:unknown){return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function number(value:unknown){return Number(value)||0;}
function campaignIds(campaign:Record<string,unknown>){const phases=Array.isArray(campaign.phases)?campaign.phases:[];const ids:string[]=[];for(const raw of phases){const phase=record(raw);if(Array.isArray(phase.contentItemIds))for(const id of phase.contentItemIds){const value=String(id||"").trim();if(value)ids.push(value);}}return [...new Set(ids)];}
function liveStatus(campaign:Record<string,unknown>){const start=Date.parse(`${String(campaign.startDate||"")}T00:00:00${YEREVAN_OFFSET}`);const end=Date.parse(`${String(campaign.endDate||"")}T23:59:59${YEREVAN_OFFSET}`);const now=Date.now();if(Number.isFinite(start)&&now<start)return "upcoming";if(Number.isFinite(end)&&now>end)return "completed";return "active";}
function missingMetricsTable(error:{code?:string;message?:string}|null|undefined){return error?.code==="42P01"||String(error?.message||"").includes("content_metrics");}

export async function GET(request:Request){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,business:null,campaign:null,analytics:null,campaigns:[]});
  try{
    const supabase=await createClient();
    const {data:claims,error:claimsError}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;
    if(claimsError||!userId)return NextResponse.json({error:"unauthorized"},{status:401});
    const url=new URL(request.url);const requestedCampaignId=url.searchParams.get("campaignId");const explicitBusinessId=url.searchParams.get("businessId");
    const selected=explicitBusinessId||(await cookies()).get(WORKSPACE_COOKIE)?.value||null;
    let businessQuery=supabase.from("businesses").select("id,name").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);if(selected)businessQuery=businessQuery.eq("id",selected);
    let {data:businesses,error:businessError}=await businessQuery;
    if(!businesses?.[0]&&!explicitBusinessId&&selected){const fallback=await supabase.from("businesses").select("id,name").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);businesses=fallback.data;businessError=fallback.error;}
    if(businessError)return NextResponse.json({error:"business_read_failed",detail:businessError.message},{status:500});
    const business=businesses?.[0];if(!business)return NextResponse.json({configured:true,business:null,campaign:null,analytics:null,campaigns:[]});

    const {data:plans,error:planError}=await supabase.from("marketing_plans").select("id,strategy,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(40);
    if(planError)return NextResponse.json({error:"campaign_analytics_read_failed",detail:planError.message},{status:500});
    const found:Array<{planId:string;createdAt:string;campaign:Record<string,unknown>}>=[];const seen=new Set<string>();
    for(const plan of plans||[]){const strategy=record(plan.strategy);const raw=record(strategy.campaign);if(!Object.keys(raw).length)continue;const id=String(raw.id||`${raw.name||"campaign"}:${raw.startDate||plan.created_at}`);if(seen.has(id))continue;seen.add(id);const campaign={...raw,id,status:liveStatus(raw)};found.push({planId:String(plan.id),createdAt:String(plan.created_at||""),campaign});}
    const selectedCampaign=requestedCampaignId?found.find(item=>String(item.campaign.id)===requestedCampaignId):found.find(item=>String(item.campaign.status)==="active")||found.find(item=>String(item.campaign.status)==="completed")||found[0];
    const summaries=found.slice(0,12).map(item=>({id:String(item.campaign.id),name:String(item.campaign.name||"Campaign"),startDate:String(item.campaign.startDate||""),endDate:String(item.campaign.endDate||""),status:String(item.campaign.status||""),primaryKpi:String(item.campaign.primaryKpi||"reach"),planId:item.planId}));
    if(!selectedCampaign)return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},campaign:null,analytics:null,campaigns:summaries});
    const ids=campaignIds(selectedCampaign.campaign);
    if(!ids.length){const analytics=buildCampaignAnalytics({campaign:selectedCampaign.campaign,content:[],metrics:[]});return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},campaign:selectedCampaign.campaign,analytics,campaigns:summaries});}

    const [contentResult,metricsResult,attribution]=await Promise.all([
      supabase.from("content_items").select("id,platform,format,objective,hook,status,published_at").eq("business_id",business.id).in("id",ids),
      supabase.from("content_metrics").select("content_item_id,measured_at,views,reach,likes,comments,shares,saves,clicks,conversions,watch_time_seconds").eq("business_id",business.id).in("content_item_id",ids).order("measured_at",{ascending:false}).limit(500),
      loadAttributionSummary(supabase,String(business.id),ids),
    ]);
    if(contentResult.error)return NextResponse.json({error:"campaign_analytics_metrics_failed",detail:contentResult.error.message},{status:500});
    if(metricsResult.error&&!missingMetricsTable(metricsResult.error))return NextResponse.json({error:"campaign_analytics_metrics_failed",detail:metricsResult.error.message},{status:500});
    const primaryKpi=String(selectedCampaign.campaign.primaryKpi||"reach");const outcomeKpi=primaryKpi==="conversion"||primaryKpi==="retention";
    if(missingMetricsTable(metricsResult.error)&&(!attribution.available||!outcomeKpi))return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},campaign:selectedCampaign.campaign,analytics:null,campaigns:summaries,reason:"apply_supabase_002_publish_settings_and_metrics"});

    const latest=new Map<string,Record<string,unknown>>();
    for(const raw of (metricsResult.data||[]) as Array<Record<string,unknown>>){const id=String(raw.content_item_id||"");if(id&&!latest.has(id))latest.set(id,raw);}
    const metricIds=new Set((outcomeKpi?[...latest.keys(),...attribution.byContent.keys()]:[...latest.keys()]).filter(id=>ids.includes(id)));
    const mergedMetrics=[...metricIds].map(id=>{
      const row=latest.get(id)||{};const outcome=effectiveOutcome(number(row.clicks),number(row.conversions),attribution.byContent.get(id));
      return {...row,content_item_id:id,measured_at:String(row.measured_at||new Date().toISOString()),clicks:outcome.clicks,conversions:outcome.conversions};
    });
    const analytics=buildCampaignAnalytics({campaign:selectedCampaign.campaign,content:contentResult.data||[],metrics:mergedMetrics});
    return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},campaign:selectedCampaign.campaign,analytics,campaigns:summaries,firstPartyAttribution:{available:attribution.available,clicks:attribution.totals.clicks,conversions:attribution.totals.conversions}});
  }catch(error){console.error("Campaign analytics failed",error);return NextResponse.json({error:"campaign_analytics_failed",detail:error instanceof Error?error.message:String(error)},{status:500});}
}
