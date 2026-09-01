import { NextResponse } from "next/server";
import { buildMarketingPlan } from "@/lib/marketing/planner";
import { loadMarketingPerformance } from "@/lib/marketing/performance";
import type { BusinessProfile, CompetitorInput } from "@/lib/marketing/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const business = body.business as BusinessProfile | undefined;
    const competitors = (body.competitors ?? []) as CompetitorInput[];
    const horizonDays = Math.min(30, Math.max(7, Number(body.horizonDays) || 7));

    if (!business?.name || !business.category || !["hy", "en", "ru"].includes(business.primaryLanguage)) {
      return NextResponse.json({ error: "invalid_business_profile" }, { status: 400 });
    }

    const performance = await loadMarketingPerformance(typeof body.businessId === "string" ? body.businessId : undefined);
    const plan = await buildMarketingPlan(business, competitors, horizonDays, performance);
    return NextResponse.json({ ...plan, performanceUsed: Boolean(performance), performance });
  } catch (error) {
    console.error("Marketing plan API failed", error);
    return NextResponse.json({ error: "marketing_plan_failed" }, { status: 500 });
  }
}
