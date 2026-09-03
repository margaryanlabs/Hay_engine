import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { generateSceneImage } from "@/lib/providers/openai-image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ configured: false, message: "Set OPENAI_API_KEY to generate scene visuals." });
  }

  const allowance=await checkUsageAllowance("content_assets",1);
  if(!allowance.allowed){
    const status=allowance.reason==="unauthorized"?401:allowance.reason==="commercial_migration_required"?503:402;
    return NextResponse.json({error:allowance.reason,meter:"content_assets",required:1,commercial:allowance.context},{status});
  }

  const image = await generateSceneImage(prompt);
  if (!image) return NextResponse.json({ error: "image_generation_failed" }, { status: 502 });
  const usage=await recordUsage({
    meter:"content_assets",
    quantity:1,
    businessId:typeof body.businessId==="string"?body.businessId:null,
    source:"image_direct",
    idempotencyKey:typeof body.requestId==="string"&&body.requestId?`image:${body.requestId}`:undefined,
    metadata:{model:process.env.OPENAI_IMAGE_MODEL||"default"},
  });
  return NextResponse.json({ configured: true, ...image, contentType: "image/png", commercialUsage:usage });
}
