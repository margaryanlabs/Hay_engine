import { NextResponse } from "next/server";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, resizeUsageReservation, type UsageReservation } from "@/lib/commercial/usage-reservations";
import { analyzeCompetitorEvidence, collectCompetitorEvidence, competitorContextForPlan } from "@/lib/marketing/competitor-intelligence";
import { contentMemoryForPlan, loadContentMemory } from "@/lib/marketing/content-memory";
import { buildMarketingPlan } from "@/lib/marketing/planner";
import { loadMarketingPerformance } from "@/lib/marketing/performance";
import { persistMarketingPlan } from "@/lib/marketing/persistence";
import type { BusinessProfile, CompetitorInput } from "@/lib/marketing/types";

export const runtime = "nodejs";

function usageStatus(reason:string|undefined){
  if(reason==="unauthorized")return 401;
  if(reason==="request_in_progress"||reason==="duplicate_request")return 409;
  if(reason==="commercial_migration_required"||reason==="atomic_usage_admin_required"||reason==="atomic_usage_migration_required"||reason==="atomic_usage_reservation_failed"||reason==="atomic_usage_resize_migration_required"||reason==="reservation_resize_failed")return 503;
  return 402;
}

export async function POST(request: Request) {
  let pendingReservation:UsageReservation|null=null;
  try {
    const body = await request.json();
    const business = body.business as BusinessProfile | undefined;
    const competitors = (body.competitors ?? []) as CompetitorInput[];
    const horizonDays = Math.min(30, Math.max(7, Number(body.horizonDays) || 7));

    if (!business?.name || !business.category || !["hy", "en", "ru"].includes(business.primaryLanguage)) {
      return NextResponse.json({ error: "invalid_business_profile" }, { status: 400 });
    }

    const minimumAssets = Math.max(7, horizonDays);
    const requestedBusinessId = typeof body.businessId === "string" ? body.businessId : undefined;
    const requestId=typeof body.requestId==="string"?body.requestId.trim().slice(0,200):"";
    const reservation=await reserveUsage({
      meter:"content_assets",
      quantity:minimumAssets,
      businessId:requestedBusinessId||null,
      source:"marketing_plan",
      idempotencyKey:requestId?`marketing-plan:${requestId}`:undefined,
      metadata:{horizonDays,businessName:business.name},
    });
    if(!reservation.allowed){
      return NextResponse.json({error:reservation.reason,meter:"content_assets",required:minimumAssets,commercial:reservation.context},{status:usageStatus(reservation.reason)});
    }
    if(reservation.duplicate){
      return NextResponse.json({error:"duplicate_marketing_plan_request",commercialUsage:{recorded:true,duplicate:true,eventId:reservation.eventId,metadata:reservation.metadata}},{status:409});
    }
    pendingReservation=reservation;

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

    const actualAssets=persisted.plan.items.length;
    if(actualAssets!==minimumAssets){
      const resized=await resizeUsageReservation(reservation,actualAssets);
      if(!resized.resized){
        // Planning and persistence already completed. Keep the original reservation
        // occupied instead of releasing paid provider work when exact reconciliation fails.
        pendingReservation=null;
        return NextResponse.json({error:resized.reason,meter:"content_assets",required:actualAssets,commercial:reservation.context},{status:usageStatus(resized.reason)});
      }
    }

    pendingReservation=null;
    const usage = await commitUsageReservation(reservation,{
      horizonDays,
      actualAssets,
      generatedBy:generated.generatedBy,
      planId:persisted.planId||generated.id,
    });
    if(!usage.recorded){
      return NextResponse.json({error:"marketing_plan_usage_commit_failed",commercialUsage:usage},{status:503});
    }

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
    if(pendingReservation)await releaseUsageReservation(pendingReservation).catch(()=>undefined);
    console.error("Marketing plan API failed", error);
    return NextResponse.json({ error: "marketing_plan_failed" }, { status: 500 });
  }
}
