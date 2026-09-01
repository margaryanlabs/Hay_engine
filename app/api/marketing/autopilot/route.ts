import { NextResponse } from "next/server";
import { createAutopilotRun, type AutopilotMode } from "@/lib/marketing/autopilot";
import { analyzeCompetitorEvidence, collectCompetitorEvidence, competitorContextForPlan } from "@/lib/marketing/competitor-intelligence";
import { loadMarketingPerformance } from "@/lib/marketing/performance";
import { persistMarketingPlan } from "@/lib/marketing/persistence";
import type { BusinessProfile, CompetitorInput, SocialConnection } from "@/lib/marketing/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const business = body.business as BusinessProfile | undefined;
    if (!business?.name || !business.category || !["hy", "en", "ru"].includes(business.primaryLanguage)) {
      return NextResponse.json({ error: "invalid_business_profile" }, { status: 400 });
    }
    const competitors = (body.competitors ?? []) as CompetitorInput[];
    const mode = (["copilot", "approval", "autopublish"].includes(body.mode) ? body.mode : "approval") as AutopilotMode;
    const requestedBusinessId = typeof body.businessId === "string" ? body.businessId : undefined;
    const [performance, competitorEvidence] = await Promise.all([
      loadMarketingPerformance(requestedBusinessId, business.name),
      collectCompetitorEvidence(competitors),
    ]);
    const competitorSignals = await analyzeCompetitorEvidence(business, competitorEvidence);
    const planningBusiness: BusinessProfile = {
      ...business,
      description: `${business.description || ""}${competitorContextForPlan(competitorEvidence, competitorSignals)}`.trim(),
    };
    const runRaw = await createAutopilotRun({
      business: planningBusiness,
      competitors,
      connections: (body.connections ?? []) as SocialConnection[],
      mode,
      horizonDays: Math.min(30, Math.max(7, Number(body.horizonDays) || 7)),
      performance,
    });
    const run = { ...runRaw, plan: { ...runRaw.plan, business, competitors: competitorSignals.length ? competitorSignals : runRaw.plan.competitors } };
    const persisted = await persistMarketingPlan(run.plan, requestedBusinessId);
    const jobs = run.jobs.map(job => ({ ...job, contentItemId: persisted.idMap[job.contentItemId] || job.contentItemId }));
    return NextResponse.json({
      ...run,
      plan: persisted.plan,
      jobs,
      performanceUsed: Boolean(performance),
      performance,
      competitorIntelligence: { evidence: competitorEvidence, signals: competitorSignals },
      persistence: { persisted: persisted.persisted, businessId: persisted.businessId, planId: persisted.planId, reason: persisted.reason },
    });
  } catch (error) {
    console.error("Marketing autopilot failed", error);
    return NextResponse.json({ error: "autopilot_failed" }, { status: 500 });
  }
}
