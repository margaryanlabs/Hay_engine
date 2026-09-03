import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { comparableExperimentWindow, createExperimentRun, generateControlledHookVariant } from "@/lib/marketing/experiment-runner";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime="nodejs";

type JsonRecord=Record<string,unknown>;
type PlanRow={id:string;strategy:unknown;created_at?:string|null};
function record(value:unknown):JsonRecord{return value&&typeof value==="object"&&!Array.isArray(value)?value as JsonRecord:{};}
function text(value:unknown){return String(value||"").trim();}
function campaignMetric(kpi:string){if(kpi==="conversion")return "conversions";if(kpi==="trust")return "saves";if(kpi==="community")return "comments";if(kpi==="retention")return "conversions";return "reach";}
function phaseForContent(campaign:JsonRecord,contentId:string){const phases=Array.isArray(campaign.phases)?campaign.phases:[];for(const raw of phases){const phase=record(raw);const ids=Array.isArray(phase.contentItemIds)?phase.contentItemIds.map(text):[];if(ids.includes(contentId))return text(phase.name);}return "";}

export async function POST(request:Request){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,error:"supabase_required"},{status:503});
  try{
    const body=await request.json();
    const campaignId=text(body.campaignId);const sourceContentId=text(body.sourceContentId);
    if(!campaignId||!sourceContentId)return NextResponse.json({error:"campaign_and_source_required"},{status:400});

    const supabase=await createClient();
    const {data:claims,error:claimsError}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;
    if(claimsError||!userId)return NextResponse.json({error:"unauthorized"},{status:401});

    const {data:source,error:sourceError}=await supabase.from("content_items")
      .select("id,business_id,plan_id,platform,format,language,objective,hook,concept,caption,cta,hashtags,asset_brief,status,scheduled_for,published_at")
      .eq("id",sourceContentId).maybeSingle();
    if(sourceError)return NextResponse.json({error:"source_read_failed",detail:sourceError.message},{status:500});
    if(!source)return NextResponse.json({error:"source_not_found"},{status:404});
    const {data:business}=await supabase.from("businesses").select("id").eq("id",source.business_id).eq("owner_id",userId).maybeSingle();
    if(!business)return NextResponse.json({error:"forbidden"},{status:403});
    if(source.status!=="published")return NextResponse.json({error:"control_must_be_published"},{status:409});

    const {data:plans,error:plansError}=await supabase.from("marketing_plans").select("id,strategy,created_at").eq("business_id",source.business_id).order("created_at",{ascending:false}).limit(40);
    if(plansError)return NextResponse.json({error:"campaign_read_failed",detail:plansError.message},{status:500});
    let planRow:PlanRow|undefined;let strategy:JsonRecord={};let campaign:JsonRecord={};
    for(const row of (plans||[]) as PlanRow[]){const nextStrategy=record(row.strategy);const nextCampaign=record(nextStrategy.campaign);if(text(nextCampaign.id)===campaignId){planRow=row;strategy=nextStrategy;campaign=nextCampaign;break;}}
    if(!planRow)return NextResponse.json({error:"campaign_not_found"},{status:404});
    const phase=phaseForContent(campaign,sourceContentId);
    if(!phase)return NextResponse.json({error:"source_not_in_campaign"},{status:409});

    const existing=Array.isArray(strategy.experiments)?strategy.experiments.map(record):[];
    const duplicate=existing.find(item=>text(item.controlContentId)===sourceContentId&&text(item.variable)==="hook");
    if(duplicate)return NextResponse.json({error:"experiment_already_exists",experiment:duplicate},{status:409});

    const scheduledFor=comparableExperimentWindow(source.scheduled_for,text(campaign.endDate));
    if(!scheduledFor)return NextResponse.json({error:"no_comparable_window_left",detail:"Campaign needs enough remaining time for a comparable follow-up window."},{status:409});

    const allowance=await checkUsageAllowance("content_assets",1);
    if(!allowance.allowed){
      const status=allowance.reason==="unauthorized"?401:allowance.reason==="commercial_migration_required"?503:402;
      return NextResponse.json({error:allowance.reason,meter:"content_assets",required:1,commercial:allowance.context},{status});
    }

    const sourceForVariant={
      id:String(source.id),platform:String(source.platform),format:String(source.format),language:String(source.language),objective:String(source.objective||""),hook:String(source.hook||""),concept:String(source.concept||""),caption:String(source.caption||""),cta:String(source.cta||""),hashtags:Array.isArray(source.hashtags)?source.hashtags.filter((item):item is string=>typeof item==="string"):[],asset_brief:String(source.asset_brief||""),scheduled_for:source.scheduled_for,
    };
    const variantHook=await generateControlledHookVariant(sourceForVariant,campaign);
    const variantBrief=`${sourceForVariant.asset_brief}\nCONTROLLED EXPERIMENT: preserve the same offer, audience, composition intent, visual system, CTA and campaign phase. Change the opening hook only. Do not introduce new claims.`.trim();
    const {data:variant,error:insertError}=await supabase.from("content_items").insert({
      business_id:source.business_id,
      plan_id:planRow.id,
      platform:source.platform,
      format:source.format,
      language:source.language,
      objective:source.objective,
      hook:variantHook,
      concept:source.concept,
      caption:source.caption,
      cta:source.cta,
      hashtags:source.hashtags,
      asset_brief:variantBrief,
      asset_url:null,
      status:"draft",
      scheduled_for:scheduledFor,
    }).select("id").single();
    if(insertError||!variant?.id)return NextResponse.json({error:"variant_create_failed",detail:insertError?.message},{status:500});

    const primaryMetric=campaignMetric(text(campaign.primaryKpi));
    const experiment=createExperimentRun({campaignId,primaryMetric,source:sourceForVariant,variantContentId:String(variant.id),variantHook,scheduledFor});
    const phases=(Array.isArray(campaign.phases)?campaign.phases:[]).map(raw=>{const next=record(raw);if(text(next.name)!==phase)return next;const ids=Array.isArray(next.contentItemIds)?next.contentItemIds.map(text).filter(Boolean):[];return {...next,contentItemIds:[...new Set([...ids,String(variant.id)])]};});
    const nextCampaign={...campaign,phases};
    const nextStrategy={...strategy,campaign:nextCampaign,experiments:[...existing,experiment]};
    const {error:updateError}=await supabase.from("marketing_plans").update({strategy:nextStrategy}).eq("id",planRow.id).eq("business_id",source.business_id);
    if(updateError){await supabase.from("content_items").delete().eq("id",variant.id).eq("business_id",source.business_id);return NextResponse.json({error:"experiment_persist_failed",detail:updateError.message},{status:500});}

    const usage=await recordUsage({
      meter:"content_assets",
      quantity:1,
      businessId:String(source.business_id),
      source:"marketing_experiment",
      idempotencyKey:typeof body.requestId==="string"&&body.requestId?`experiment:${body.requestId}`:`experiment:${campaignId}:${sourceContentId}`,
      metadata:{campaignId,sourceContentId,variantContentId:String(variant.id),generatedBy:process.env.OPENAI_API_KEY?"openai_or_fallback":"local_fallback"},
    });

    return NextResponse.json({configured:true,experiment,variant:{id:String(variant.id),hook:variantHook,status:"draft",scheduledFor},commercialUsage:usage,message:"Controlled hook variant created and sent to Approval Inbox."});
  }catch(error){
    console.error("Experiment Runner failed",error);
    return NextResponse.json({error:"experiment_runner_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
