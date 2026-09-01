import { NextResponse } from "next/server";
import { normalizeForSpeech } from "@/lib/hay/normalize";
import { createArmenianSpeech } from "@/lib/providers/elevenlabs";

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });

  const normalized = normalizeForSpeech(text, "hy", body.dialect === "western" ? "western" : "eastern");
  const speech = await createArmenianSpeech(normalized.spokenText);

  if (!speech) {
    return NextResponse.json({
      configured: false,
      normalized,
      message: "Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to enable Armenian speech generation.",
    });
  }

  return NextResponse.json({ configured: true, normalized, ...speech });
}
