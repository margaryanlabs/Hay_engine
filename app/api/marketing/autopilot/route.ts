import { NextResponse } from "next/server";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, resizeUsageReservation, type UsageReservation } from "@/lib/commercial/usage-reservations";
import { createAutopilotRun, type AutopilotMode } from "@/lib/marketing/autopilot";
import { analyzeCompetitorEvidence, collectCompetitorEvidence, competitorContextForPlan } from "@/lib/marketing/competitor-intelligence";
import { contentMemoryForPlan, loadContentMemory } from "@/lib/marketing/content-memory";
import { loadMarketingPerformance } from "@/lib/marketing/performance";
import { persistMarketingPlan } from "@/lib/marketing/persistence";
import type { BusinessProfile, CompetitorInput, SocialConnection } from "@/lib/marketing/types";

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
    if (!business?.name || !business.category || !["hy", "en", "ru"].includes(business.primaryLanguage)) {
      return NextResponse.json({ error: "invalid_business_profile" }, { status: 400 });
    }
    const competitors = (body.competitors ?? []) as CompetitorInput[];
    const mode = (["copilot", "approval", "autopublish"].includes(body.mode) ? body.mode : "approval") as AutopilotMode;
    const horizonDays = Math.min(30, Math.max(7, Number(body.horizonDays) || 7));
    const minimumAssets = Math.max(7, horizonDays);
    const requestedBusinessId = typeof body.businessId === "string" ? body.businessId : undefined;
    const requestId=typeof body.requestId==="string"?body.requestId.trim().slice(0,200):"";

    const reservation=await reserveUsage({
      meter:"content_assets",
      quantity:minimumAssets,
      businessId:requestedBusinessId||null,
      source:"marketing_autopilot",
      idempotencyKey:requestId?`marketing-autopilot:${requestId}`:undefined,
      metadata:{horizonDays,mode,businessName:business.name},
    });
    if(!reservation.allowed){
      return NextResponse.json({error:reservation.reason,meter:"content_assets",required:minimumAssets,commercial:reservation.context},{status:usageStatus(reservation.reason)});
    }
    if(reservation.duplicate){
      return NextResponse.json({error:"duplicate_marketing_autopilot_request",commercialUsage:{recorded:true,duplicate:true,eventId:reservation.eventId,metadata:reservation.metadata}},{status:409});
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
    const runRaw = await createAutopilotRun({
      business: planningBusiness,
      competitors,
      connections: (body.connections ?? []) as SocialConnection[],
      mode,
      horizonDays,
      performance,
    });
    const run = { ...runRaw, plan: { ...runRaw.plan, business, competitors: competitorSignals.length ? competitorSignals : runRaw.plan.competitors } };
    const persisted = await persistMarketingPlan(run.plan, requestedBusinessId);
    const jobs = run.jobs.map(job => ({ ...job, contentItemId: persisted.idMap[job.contentItemId] || job.contentItemId }));

    const actualAssets=persisted.plan.items.length;
    if(actualAssets!==minimumAssets){
      const resized=await resizeUsageReservation(reservation,actualAssets);
      if(!resized.resized){
        // Generation and persistence already succeeded. Keep the original reservation
        // occupied rather than making completed provider work free when exact resize fails.
        pendingReservation=null;
        return NextResponse.json({error:resized.reason,meter:"content_assets",required:actualAssets,commercial:reservation.context},{status:usageStatus(resized.reason)});
      }
    }

    pendingReservation=null;
    const usage = await commitUsageReservation(reservation,{
      horizonDays,
      mode,
      generatedBy:persisted.plan.generatedBy,
      planId:persisted.planId||persisted.plan.id,
      actualAssets,
    });
    if(!usage.recorded){
      return NextResponse.json({error:"marketing_autopilot_usage_commit_failed",commercialUsage:usage},{status:503});
    }

    return NextResponse.json({
      ...run,
      plan: persisted.plan,
      jobs,
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
    console.error("Marketing autopilot failed", error);
    return NextResponse.json({ error: "autopilot_failed" }, { status: 500 });
  }
}
