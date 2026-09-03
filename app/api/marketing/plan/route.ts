import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { analyzeCompetitorEvidence, collectCompetitorEvidence, competitorContextForPlan } from "@/lib/marketing/competitor-intelligence";
import { contentMemoryForPlan, loadContentMemory } from "@/lib/marketing/content-memory";
import { buildMarketingPlan } from "@/lib/marketing/planner";
import { loadMarketingPerformance } from "@/lib/marketing/performance";
import { persistMarketingPlan } from "@/lib/marketing/persistence";
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

    const minimumAssets = Math.max(7, horizonDays);
    const allowance = await checkUsageAllowance("content_assets", minimumAssets);
    if (!allowance.allowed) {
      const status = allowance.reason === "unauthorized" ? 401 : allowance.reason === "commercial_migration_required" ? 503 : 402;
      return NextResponse.json({ error: allowance.reason, meter: "content_assets", required: minimumAssets, commercial: allowance.context }, { status });
    }

    const requestedBusinessId = typeof body.businessId === "string" ? body.businessId : undefined;
    const [performance, competitorEvidence, contentMemory] = await Promise.all([
      loadMarketingPerformance(requestedBusinessId, business.name),
      collectCompetitorEvidence(competitors),
      loadContentMemory(requestedBusinessId, business.name),
    ]);
    const competitorSignals = await analyzeCompetitorEvidence(business, competitorEvidence);
    const planningBusiness: BusinessProfile = {
      ...business,
      description: `${business.description || ""}${competitorContextForPlan(competitorEvidence, competitorSignals)}${contentMemoryForPlan(contentMemory)}`.trim(),
    };
    const generatedRaw = await buildMarketingPlan(planningBusiness, competitors, horizonDays, performance);
    const generated = { ...generatedRaw, business, competitors: competitorSignals.length ? competitorSignals : generatedRaw.competitors };
    const persisted = await persistMarketingPlan(generated, requestedBusinessId);

    const usage = await recordUsage({
      meter: "content_assets",
      quantity: generated.items.length,
      businessId: persisted.businessId || requestedBusinessId || null,
      source: "marketing_plan",
      idempotencyKey: typeof body.requestId === "string" && body.requestId ? `marketing-plan:${body.requestId}` : undefined,
      metadata: { horizonDays, generatedBy: generated.generatedBy, planId: persisted.planId || generated.id },
    });

    return NextResponse.json({
      ...persisted.plan,
      performanceUsed: Boolean(performance),
      performance,
      contentMemoryUsed: Boolean(contentMemory),
      contentMemory: contentMemory ? {
        recentHooks: contentMemory.recentHooks.slice(0, 12),
        formatCounts: contentMemory.formatCounts,
        platformCounts: contentMemory.platformCounts,
        objectiveCounts: contentMemory.objectiveCounts,
        duplicateRisk: contentMemory.duplicateRisk,
      } : null,
      competitorIntelligence: { evidence: competitorEvidence, signals: competitorSignals },
      persistence: { persisted: persisted.persisted, businessId: persisted.businessId, planId: persisted.planId, reason: persisted.reason },
      commercialUsage: usage,
    });
  } catch (error) {
    console.error("Marketing plan API failed", error);
    return NextResponse.json({ error: "marketing_plan_failed" }, { status: 500 });
  }
}
