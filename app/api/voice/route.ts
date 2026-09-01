import { NextResponse } from "next/server";
import { normalizeForSpeech } from "@/lib/hay/normalize";
import { createArmenianSpeech } from "@/lib/providers/elevenlabs";
import { resolveVoice } from "@/lib/providers/voice-catalog";
import { captionsFromAlignment } from "@/lib/creator/alignment";

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });

  const normalized = normalizeForSpeech(text, "hy", body.dialect === "western" ? "western" : "eastern");
  const voice = resolveVoice(body.voiceId ? String(body.voiceId) : undefined);
  const speech = await createArmenianSpeech(normalized.spokenText, voice?.providerVoiceId);

  if (!speech) {
    return NextResponse.json({
      configured: false,
      normalized,
      voices: [],
      message: "Add ELEVENLABS_API_KEY and at least one Armenian voice ID to enable speech generation.",
    });
  }

  return NextResponse.json({
    configured: true,
    normalized,
    voice: voice ? { id: voice.id, label: voice.label, dialect: voice.dialect } : null,
    captions: captionsFromAlignment(speech.alignment),
    ...speech,
  });
}
