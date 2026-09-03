import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { buildDemoStoryboard } from "@/lib/hay/storyboard";
import { generateStoryboardWithOpenAI } from "@/lib/providers/openai";
import type { ContentStyle, Locale } from "@/lib/hay/types";

export async function POST(request: Request) {
  const body = await request.json();
  const prompt = String(body.prompt ?? "").trim();
  const language = (body.language ?? "hy") as Locale;
  const style = (body.style ?? "advertising") as ContentStyle;
  const duration = Math.min(60, Math.max(6, Number(body.duration) || 15));

  if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });

  if(process.env.OPENAI_API_KEY){
    const allowance=await checkUsageAllowance("content_assets",1);
    if(!allowance.allowed){
      const status=allowance.reason==="unauthorized"?401:allowance.reason==="commercial_migration_required"?503:402;
      return NextResponse.json({error:allowance.reason,meter:"content_assets",required:1,commercial:allowance.context},{status});
    }
  }

  const ai = await generateStoryboardWithOpenAI({ prompt, language, duration, style });
  const storyboard = ai ?? buildDemoStoryboard(prompt, language, duration, style);
  const usage=ai?await recordUsage({
    meter:"content_assets",
    quantity:1,
    businessId:typeof body.businessId==="string"?body.businessId:null,
    source:"storyboard_direct",
    idempotencyKey:typeof body.requestId==="string"&&body.requestId?`storyboard:${body.requestId}`:undefined,
    metadata:{language,style,duration},
  }):{recorded:false,reason:"deterministic_fallback"};
  return NextResponse.json({...storyboard,commercialUsage:usage});
}
