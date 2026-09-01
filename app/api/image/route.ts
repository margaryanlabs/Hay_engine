import { NextResponse } from "next/server";
import { generateSceneImage } from "@/lib/providers/openai-image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ configured: false, message: "Set OPENAI_API_KEY to generate scene visuals." });
  }

  const image = await generateSceneImage(prompt);
  if (!image) return NextResponse.json({ error: "image_generation_failed" }, { status: 502 });
  return NextResponse.json({ configured: true, ...image, contentType: "image/png" });
}
