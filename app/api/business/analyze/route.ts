import { NextResponse } from "next/server";
import { checkUsageAllowance } from "@/lib/commercial/entitlements";
import { analyzeCompetitorEvidence, collectCompetitorEvidence, competitorContextForPlan } from "@/lib/marketing/competitor-intelligence";
import { inspectPublicSite } from "@/lib/marketing/site-inspect";
import { buildMarketingPlan } from "@/lib/marketing/planner";
import type { BusinessProfile, CompetitorInput } from "@/lib/marketing/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const business = body.business as BusinessProfile | undefined;
    const competitors = (body.competitors ?? []) as CompetitorInput[];
    if (!business?.name || !business.category) {
      return NextResponse.json({ error: "invalid_business_profile" }, { status: 400 });
    }

    // Analysis itself is included in HAY plans, but once commercial enforcement is on
    // it must come from an authenticated active account with usable plan capacity.
    const allowance=await checkUsageAllowance("content_assets",1);
    if(!allowance.allowed){
      const status=allowance.reason==="unauthorized"?401:allowance.reason==="commercial_migration_required"?503:402;
      return NextResponse.json({error:allowance.reason,commercial:allowance.context},{status});
    }

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

    return NextResponse.json({
      source: { business: businessSnapshot, competitors: competitorEvidence },
      intelligence: {
        brand: plan.brand,
        competitors: competitorSignals.length ? competitorSignals : plan.competitors,
        strategySummary: plan.strategySummary,
      },
      evidenceBacked: competitorEvidence.some(item => item.available),
      generatedBy: plan.generatedBy,
    });
  } catch (error) {
    console.error("Business analysis failed", error);
    return NextResponse.json({ error: "business_analysis_failed" }, { status: 500 });
  }
}
