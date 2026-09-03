import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { createCreatorProject } from "@/lib/creator/project";
import { currentPronunciationOwner } from "@/lib/hay/pronunciation-store";
import type { ContentStyle, Dialect, Locale } from "@/lib/hay/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    const language = (body.language ?? "hy") as Locale;
    const dialect = (body.dialect ?? "eastern") as Dialect;
    const style = (body.style ?? "advertising") as ContentStyle;
    const duration = Math.min(60, Math.max(6, Number(body.duration) || 15));
    const businessId=typeof body.businessId==="string"?body.businessId:null;

    if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
    if (!["hy", "en", "ru"].includes(language)) return NextResponse.json({ error: "unsupported_language" }, { status: 400 });

    const allowance=await checkUsageAllowance("content_assets",1);
    if(!allowance.allowed){
      const status=allowance.reason==="unauthorized"?401:allowance.reason==="commercial_migration_required"?503:402;
      return NextResponse.json({error:allowance.reason,meter:"content_assets",required:1,commercial:allowance.context},{status});
    }

    const owner=await currentPronunciationOwner();
    const project = await createCreatorProject({ prompt, language, dialect, style, duration, ownerId:owner?.ownerId, businessId });
    const usage=await recordUsage({
      meter:"content_assets",
      quantity:1,
      businessId,
      source:"creator_direct",
      idempotencyKey:typeof body.requestId==="string"&&body.requestId?`creator:${body.requestId}`:undefined,
      metadata:{projectId:project.id,language,dialect,style,duration},
    });
    return NextResponse.json({...project,commercialUsage:usage});
  } catch (error) {
    console.error("Creator project generation failed", error);
    return NextResponse.json({ error: "creator_generation_failed" }, { status: 500 });
  }
}
