import { NextResponse } from "next/server";
import { extractVeoVideoUri, getVeoOperation, isVeoConfigured, startVeoVideo } from "@/lib/providers/veo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
    if (!isVeoConfigured()) return NextResponse.json({ configured: false, message: "Add GEMINI_API_KEY to enable Veo 3.1 video generation." });

    const requested = Number(body.durationSeconds) || 8;
    const durationSeconds = ([4, 6, 8].includes(requested) ? requested : 8) as 4 | 6 | 8;
    const resolution = (["720p", "1080p", "4k"].includes(body.resolution) ? body.resolution : "720p") as "720p" | "1080p" | "4k";
    const operation = await startVeoVideo({
      prompt: `${prompt}\nNo text, no letters, no captions, no logos unless explicitly described. HAY Engine adds exact Armenian typography separately.`,
      durationSeconds,
      aspectRatio: body.aspectRatio === "16:9" ? "16:9" : "9:16",
      resolution,
    });
    return NextResponse.json({ configured: true, operation });
  } catch (error) {
    console.error("Veo start failed", error);
    return NextResponse.json({ error: "video_generation_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const operationName = new URL(request.url).searchParams.get("operation");
    if (!operationName) return NextResponse.json({ error: "operation_required" }, { status: 400 });
    if (!isVeoConfigured()) return NextResponse.json({ configured: false });
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
