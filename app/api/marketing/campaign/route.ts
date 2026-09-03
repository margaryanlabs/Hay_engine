import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { analyzeCompetitorEvidence, collectCompetitorEvidence, competitorContextForPlan } from "@/lib/marketing/competitor-intelligence";
import { applyCampaignWindowSchedule, buildCampaignBlueprint, campaignPlanningContext, normalizeCampaignBrief, remapCampaignBlueprint } from "@/lib/marketing/campaign";
import { contentMemoryForPlan, loadContentMemory } from "@/lib/marketing/content-memory";
import { buildMarketingPlan } from "@/lib/marketing/planner";
import { loadMarketingPerformance } from "@/lib/marketing/performance";
import { persistMarketingPlan } from "@/lib/marketing/persistence";
import type { BusinessProfile, CompetitorInput, MarketingPlan } from "@/lib/marketing/types";

export const runtime="nodejs";
const DAY=24*60*60*1000;
const YEREVAN_OFFSET="+04:00";

export async function POST(request:Request){
  try{
    const body=await request.json();
    const business=body.business as BusinessProfile|undefined;
    if(!business?.name||!business.category||!["hy","en","ru"].includes(business.primaryLanguage))return NextResponse.json({error:"invalid_business_profile"},{status:400});
    const brief=normalizeCampaignBrief(body.campaign);
    const start=Date.parse(brief.startDate);const end=Date.parse(brief.endDate);
    const durationDays=Math.floor((end-start)/DAY)+1;
    const campaignEnd=Date.parse(`${brief.endDate}T23:59:59${YEREVAN_OFFSET}`);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return NextResponse.json({error:"invalid_campaign_window"},{status:400});
    if(durationDays>90)return NextResponse.json({error:"campaign_window_too_long",maxDays:90},{status:400});
    if(campaignEnd<=Date.now())return NextResponse.json({error:"campaign_already_ended"},{status:400});
    if(campaignEnd<=Date.now()+90*60*1000)return NextResponse.json({error:"campaign_window_too_close",minimumLeadMinutes:90},{status:400});
    if(brief.eventDate&&(Date.parse(brief.eventDate)<start||Date.parse(brief.eventDate)>end))return NextResponse.json({error:"event_date_outside_campaign_window"},{status:400});

    const planningDays=Math.min(30,Math.max(7,durationDays));
    const allowance=await checkUsageAllowance("content_assets",planningDays);
    if(!allowance.allowed){
      const status=allowance.reason==="unauthorized"?401:allowance.reason==="commercial_migration_required"?503:402;
      return NextResponse.json({error:allowance.reason,meter:"content_assets",required:planningDays,commercial:allowance.context},{status});
    }

    const requestedBusinessId=typeof body.businessId==="string"?body.businessId:undefined;
    const competitors=(body.competitors??[]) as CompetitorInput[];
    const [performance,competitorEvidence,contentMemory]=await Promise.all([
      loadMarketingPerformance(requestedBusinessId,business.name),
      collectCompetitorEvidence(competitors),
      loadContentMemory(requestedBusinessId,business.name),
    ]);
    const competitorSignals=await analyzeCompetitorEvidence(business,competitorEvidence);
    const planningBusiness:BusinessProfile={
      ...business,
      description:`${business.description||""}${competitorContextForPlan(competitorEvidence,competitorSignals)}${contentMemoryForPlan(contentMemory)}${campaignPlanningContext(brief,business)}`.trim(),
    };
    const raw=await buildMarketingPlan(planningBusiness,competitors,planningDays,performance);
    const restored={...raw,business,competitors:competitorSignals.length?competitorSignals:raw.competitors};
    const windowed=applyCampaignWindowSchedule(restored,brief);
    const scheduled:MarketingPlan={...windowed,items:windowed.items.map(item=>({...item,status:"draft" as const}))};
    const campaign=buildCampaignBlueprint(brief,scheduled);
    const persisted=await persistMarketingPlan(scheduled,requestedBusinessId,{campaign});
    const durableCampaign=remapCampaignBlueprint(campaign,persisted.idMap);
    const usage=await recordUsage({
      meter:"content_assets",
      quantity:persisted.plan.items.length,
      businessId:persisted.businessId||requestedBusinessId||null,
      source:"marketing_campaign",
      idempotencyKey:typeof body.requestId==="string"&&body.requestId?`marketing-campaign:${body.requestId}`:undefined,
      metadata:{durationDays,planningDays,generatedBy:persisted.plan.generatedBy,planId:persisted.planId||persisted.plan.id,campaignId:durableCampaign.id},
    });

    return NextResponse.json({
      plan:persisted.plan,
      campaign:durableCampaign,
      performanceUsed:Boolean(performance),
      contentMemoryUsed:Boolean(contentMemory),
      competitorIntelligence:{evidence:competitorEvidence,signals:competitorSignals},
      persistence:{persisted:persisted.persisted,businessId:persisted.businessId,planId:persisted.planId,reason:persisted.reason},
      commercialUsage:usage,
    });
  }catch(error){
    console.error("Campaign Brain failed",error);
    return NextResponse.json({error:"campaign_generation_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
