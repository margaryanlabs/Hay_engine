import { NextResponse } from "next/server";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, type UsageReservation } from "@/lib/commercial/usage-reservations";
import { analyzeCompetitorEvidence, collectCompetitorEvidence, competitorContextForPlan } from "@/lib/marketing/competitor-intelligence";
import { inspectPublicSite } from "@/lib/marketing/site-inspect";
import { buildMarketingPlan } from "@/lib/marketing/planner";
import type { BusinessProfile, CompetitorInput } from "@/lib/marketing/types";

export const runtime = "nodejs";

function usageStatus(reason:string|undefined){
  if(reason==="unauthorized")return 401;
  if(reason==="request_in_progress"||reason==="duplicate_request")return 409;
  if(reason==="commercial_migration_required"||reason==="atomic_usage_admin_required"||reason==="atomic_usage_migration_required"||reason==="atomic_usage_reservation_failed")return 503;
  return 402;
}

export async function POST(request: Request) {
  let pendingReservation:UsageReservation|null=null;
  try {
    const body = await request.json();
    const business = body.business as BusinessProfile | undefined;
    const competitors = (body.competitors ?? []) as CompetitorInput[];
    if (!business?.name || !business.category) {
      return NextResponse.json({ error: "invalid_business_profile" }, { status: 400 });
    }

    const requestId=typeof body.requestId==="string"?body.requestId.trim().slice(0,200):"";
    const businessId=typeof body.businessId==="string"?body.businessId:null;
    // Until HAY exposes a separate intelligence/request meter, one provider-backed
    // business analysis consumes one content credit. Reserve it before any OpenAI-backed
    // competitor/planning work so concurrent requests cannot spend the same last credit.
    const reservation=await reserveUsage({
      meter:"content_assets",
      quantity:1,
      businessId,
      source:"business_analysis",
      idempotencyKey:requestId?`business-analysis:${requestId}`:undefined,
      metadata:{businessName:business.name,competitors:competitors.length},
    });
    if(!reservation.allowed){
      return NextResponse.json({error:reservation.reason,meter:"content_assets",required:1,commercial:reservation.context},{status:usageStatus(reservation.reason)});
    }
    if(reservation.duplicate){
      return NextResponse.json({error:"duplicate_business_analysis_request",commercialUsage:{recorded:true,duplicate:true,eventId:reservation.eventId,metadata:reservation.metadata}},{status:409});
    }
    pendingReservation=reservation;

    const [businessSnapshot, competitorEvidence] = await Promise.all([
      business.website ? inspectPublicSite(business.website).catch(error => { console.warn("Business site inspection skipped", error); return null; }) : Promise.resolve(null),
      collectCompetitorEvidence(competitors),
    ]);
    const competitorSignals = await analyzeCompetitorEvidence(business, competitorEvidence);

    const planningBusiness: BusinessProfile = {
      ...business,
      description: [
        business.description,
        businessSnapshot?.description,
        businessSnapshot?.text?.slice(0, 1800),
        competitorContextForPlan(competitorEvidence, competitorSignals),
      ].filter(Boolean).join("\n"),
    };
    const plan = await buildMarketingPlan(planningBusiness, competitors, 7);

    // Provider-backed analysis is complete. From this point onward never release the
    // reservation on accounting failure; fail closed rather than return unmetered work.
    pendingReservation=null;
    const usage=await commitUsageReservation(reservation,{
      generatedBy:plan.generatedBy,
      competitors:competitors.length,
      evidenceBacked:competitorEvidence.some(item=>item.available),
      providerConfigured:Boolean(process.env.OPENAI_API_KEY),
    });
    if(!usage.recorded){
      return NextResponse.json({error:"business_analysis_usage_commit_failed",commercialUsage:usage},{status:503});
    }

    return NextResponse.json({
      source: { business: businessSnapshot, competitors: competitorEvidence },
      intelligence: {
        brand: plan.brand,
        competitors: competitorSignals.length ? competitorSignals : plan.competitors,
        strategySummary: plan.strategySummary,
      },
      evidenceBacked: competitorEvidence.some(item => item.available),
      generatedBy: plan.generatedBy,
      commercialUsage:usage,
    });
  } catch (error) {
    if(pendingReservation)await releaseUsageReservation(pendingReservation).catch(()=>undefined);
    console.error("Business analysis failed", error);
    return NextResponse.json({ error: "business_analysis_failed" }, { status: 500 });
  }
}
