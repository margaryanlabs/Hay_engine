import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime="nodejs";
const WORKSPACE_COOKIE="hay_business_id";
type JsonRecord=Record<string,unknown>;
function record(value:unknown):JsonRecord{return value&&typeof value==="object"&&!Array.isArray(value)?value as JsonRecord:{};}
function text(value:unknown){return String(value||"").trim();}
function num(value:unknown){return Number(value)||0;}
function missingMetrics(error:{code?:string;message?:string}|null|undefined){return error?.code==="42P01"||String(error?.message||"").includes("content_metrics");}
function metricValue(row:JsonRecord|undefined,metric:string){if(!row)return 0;return num(row[metric]);}

export async function GET(request:Request){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,business:null,runs:[]});
  try{
    const supabase=await createClient();
    const {data:claims,error:claimsError}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;
    if(claimsError||!userId)return NextResponse.json({error:"unauthorized"},{status:401});
    const url=new URL(request.url);const requestedCampaignId=url.searchParams.get("campaignId");const explicit=url.searchParams.get("businessId");const selected=explicit||(await cookies()).get(WORKSPACE_COOKIE)?.value||null;
    let businessQuery=supabase.from("businesses").select("id,name").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);if(selected)businessQuery=businessQuery.eq("id",selected);
    let {data:businesses,error:businessError}=await businessQuery;
    if(!businesses?.[0]&&!explicit&&selected){const fallback=await supabase.from("businesses").select("id,name").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);businesses=fallback.data;businessError=fallback.error;}
    if(businessError)return NextResponse.json({error:"business_read_failed",detail:businessError.message},{status:500});
    const business=businesses?.[0];if(!business)return NextResponse.json({configured:true,business:null,runs:[]});

    const {data:plans,error:plansError}=await supabase.from("marketing_plans").select("id,strategy,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(40);
    if(plansError)return NextResponse.json({error:"experiment_read_failed",detail:plansError.message},{status:500});
    const runs:Array<JsonRecord>=[];
    for(const plan of plans||[]){
      const strategy=record(plan.strategy);const campaign=record(strategy.campaign);const campaignId=text(campaign.id);if(requestedCampaignId&&campaignId!==requestedCampaignId)continue;
      const experiments=Array.isArray(strategy.experiments)?strategy.experiments.map(record):[];
      for(const run of experiments){runs.push({...run,campaignId:text(run.campaignId)||campaignId,campaignName:text(campaign.name)||"Campaign",planId:String(plan.id),planCreatedAt:String(plan.created_at||"")});if(runs.length>=20)break;}
      if(runs.length>=20)break;
    }
    if(!runs.length)return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},runs:[]});

    const ids=[...new Set(runs.flatMap(run=>[text(run.controlContentId),text(run.variantContentId)]).filter(Boolean))];
    const [contentResult,metricsResult]=await Promise.all([
      supabase.from("content_items").select("id,status,published_at,hook,platform,format").eq("business_id",business.id).in("id",ids),
      supabase.from("content_metrics").select("content_item_id,measured_at,views,reach,likes,comments,shares,saves,clicks,conversions,watch_time_seconds").eq("business_id",business.id).in("content_item_id",ids).order("measured_at",{ascending:false}).limit(500),
    ]);
    if(missingMetrics(metricsResult.error))return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},runs:[],reason:"apply_supabase_002_publish_settings_and_metrics"});
    if(contentResult.error||metricsResult.error)return NextResponse.json({error:"experiment_metrics_failed",detail:contentResult.error?.message||metricsResult.error?.message},{status:500});
    const contentById=new Map((contentResult.data||[]).map(row=>[String(row.id),row]));const latest=new Map<string,JsonRecord>();
    for(const raw of metricsResult.data||[]){const row=record(raw);const id=text(row.content_item_id);if(id&&!latest.has(id))latest.set(id,row);}

    const resolved=runs.map(run=>{
      const controlId=text(run.controlContentId);const variantId=text(run.variantContentId);const metric=text(run.primaryMetric)||"reach";const controlMetric=latest.get(controlId);const variantMetric=latest.get(variantId);const controlValue=metricValue(controlMetric,metric);const variantValue=metricValue(variantMetric,metric);const both=Boolean(controlMetric&&variantMetric);const winner=!both?null:variantValue>controlValue?"variant":controlValue>variantValue?"control":"tie";
      const variantContent=contentById.get(variantId);const controlContent=contentById.get(controlId);
      return {...run,status:both?"measured":variantContent?.status==="published"?"running":"draft",control:{id:controlId,value:controlValue,measuredAt:text(controlMetric?.measured_at),status:controlContent?.status||null,hook:controlContent?.hook||text(run.controlHook)},variant:{id:variantId,value:variantValue,measuredAt:text(variantMetric?.measured_at),status:variantContent?.status||null,hook:variantContent?.hook||text(run.variantHook)},winner,lift:both&&controlValue>0?(variantValue-controlValue)/controlValue:null};
    });
    return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},runs:resolved});
  }catch(error){console.error("Experiment results failed",error);return NextResponse.json({error:"experiment_results_failed",detail:error instanceof Error?error.message:String(error)},{status:500});}
}
