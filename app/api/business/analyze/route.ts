import { NextResponse } from "next/server";
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

    let businessSnapshot = null;
    if (business.website) {
      try { businessSnapshot = await inspectPublicSite(business.website); } catch (error) { console.warn("Business site inspection skipped", error); }
    }

    const competitorSnapshots = [];
    for (const competitor of competitors.slice(0, 5)) {
      if (!competitor.url) continue;
      try {
        competitorSnapshots.push({ name: competitor.name, snapshot: await inspectPublicSite(competitor.url) });
      } catch (error) {
        competitorSnapshots.push({ name: competitor.name, error: "unavailable" });
      }
    }

    const enrichedBusiness: BusinessProfile = {
      ...business,
      description: [business.description, businessSnapshot?.description, businessSnapshot?.text?.slice(0, 1800)].filter(Boolean).join("\n"),
    };
    const plan = await buildMarketingPlan(enrichedBusiness, competitors, 7);

    return NextResponse.json({
      source: { business: businessSnapshot, competitors: competitorSnapshots },
      intelligence: { brand: plan.brand, competitors: plan.competitors, strategySummary: plan.strategySummary },
      generatedBy: plan.generatedBy,
    });
  } catch (error) {
    console.error("Business analysis failed", error);
    return NextResponse.json({ error: "business_analysis_failed" }, { status: 500 });
  }
}
