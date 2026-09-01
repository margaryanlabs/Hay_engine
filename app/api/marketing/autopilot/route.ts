import { NextResponse } from "next/server";
import { createAutopilotRun, type AutopilotMode } from "@/lib/marketing/autopilot";
import { loadMarketingPerformance } from "@/lib/marketing/performance";
import type { BusinessProfile, CompetitorInput, SocialConnection } from "@/lib/marketing/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const business = body.business as BusinessProfile | undefined;
    if (!business?.name || !business.category || !["hy", "en", "ru"].includes(business.primaryLanguage)) {
      return NextResponse.json({ error: "invalid_business_profile" }, { status: 400 });
    }
    const mode = (["copilot", "approval", "autopublish"].includes(body.mode) ? body.mode : "approval") as AutopilotMode;
    const performance = await loadMarketingPerformance(typeof body.businessId === "string" ? body.businessId : undefined, business.name);
    const run = await createAutopilotRun({
      business,
      competitors: (body.competitors ?? []) as CompetitorInput[],
      connections: (body.connections ?? []) as SocialConnection[],
      mode,
      horizonDays: Math.min(30, Math.max(7, Number(body.horizonDays) || 7)),
      performance,
    });
    return NextResponse.json({ ...run, performanceUsed: Boolean(performance), performance });
  } catch (error) {
    console.error("Marketing autopilot failed", error);
    return NextResponse.json({ error: "autopilot_failed" }, { status: 500 });
  }
}
