import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { checkOwnedProviderOperation } from "@/lib/commercial/provider-operations";
import { extractVeoVideoUri, getVeoOperation, isVeoConfigured, normalizeVeoOperationName, startVeoVideo } from "@/lib/providers/veo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
    if (!isVeoConfigured()) return NextResponse.json({ configured: false, message: "Add GEMINI_API_KEY to enable Veo 3.1 video generation." });

    const allowance=await checkUsageAllowance("ai_video_credits",1);
    if(!allowance.allowed){
      const status=allowance.reason==="unauthorized"?401:allowance.reason==="commercial_migration_required"?503:402;
      return NextResponse.json({error:allowance.reason,meter:"ai_video_credits",required:1,commercial:allowance.context},{status});
    }

    const requested = Number(body.durationSeconds) || 8;
    const durationSeconds = ([4, 6, 8].includes(requested) ? requested : 8) as 4 | 6 | 8;
    const resolution = (["720p", "1080p", "4k"].includes(body.resolution) ? body.resolution : "720p") as "720p" | "1080p" | "4k";
    const operation = await startVeoVideo({
      prompt: `${prompt}\nNo text, no letters, no captions, no logos unless explicitly described. HAY Engine adds exact Armenian typography separately.`,
      durationSeconds,
      aspectRatio: body.aspectRatio === "16:9" ? "16:9" : "9:16",
      resolution,
    });
    if (!operation?.name) return NextResponse.json({ error: "video_operation_missing" }, { status: 502 });

    let operationName: string;
    try {
      operationName = normalizeVeoOperationName(operation.name);
    } catch {
      return NextResponse.json({ error: "video_operation_invalid" }, { status: 502 });
    }

    const usage=await recordUsage({
      meter:"ai_video_credits",
      quantity:1,
      businessId:typeof body.businessId==="string"?body.businessId:null,
      source:"veo_video",
      idempotencyKey:typeof body.requestId==="string"&&body.requestId?`video:${body.requestId}`:undefined,
      metadata:{durationSeconds,resolution,aspectRatio:body.aspectRatio==="16:9"?"16:9":"9:16",operationName},
    });
    return NextResponse.json({ configured: true, operation: { ...operation, name: operationName }, commercialUsage:usage });
  } catch (error) {
    console.error("Veo start failed", error);
    return NextResponse.json({ error: "video_generation_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const rawOperationName = new URL(request.url).searchParams.get("operation");
    if (!rawOperationName) return NextResponse.json({ error: "operation_required" }, { status: 400 });
    if (!isVeoConfigured()) return NextResponse.json({ configured: false });

    let operationName: string;
    try {
      operationName = normalizeVeoOperationName(rawOperationName);
    } catch {
      return NextResponse.json({ error: "invalid_operation_name" }, { status: 400 });
    }

    const access = await checkOwnedProviderOperation({
      meter: "ai_video_credits",
      source: "veo_video",
      operationName,
    });
    if (!access.allowed) {
      const status = access.reason === "unauthorized" ? 401 : access.reason === "operation_not_owned" ? 404 : 503;
      return NextResponse.json({ error: access.reason }, { status });
    }

    const operation = await getVeoOperation(operationName);
    return NextResponse.json({
      configured: true,
      operation,
      done: Boolean(operation?.done),
      videoUri: operation ? extractVeoVideoUri(operation) : null,
    });
  } catch (error) {
    console.error("Veo polling failed", error);
    return NextResponse.json({ error: "video_poll_failed" }, { status: 500 });
  }
}
