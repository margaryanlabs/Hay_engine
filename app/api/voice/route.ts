import { NextResponse } from "next/server";
import { normalizeForSpeech } from "@/lib/hay/normalize";
import { naturalizeArmenianText, type ArmenianSpeechStyle } from "@/lib/hay/conversational";
import { createArmenianSpeech } from "@/lib/providers/armenian-speech";
import { getVoiceCatalog, resolveVoice } from "@/lib/providers/voice-catalog";
import { captionsFromAlignment } from "@/lib/creator/alignment";

export const runtime="nodejs";

export async function GET(){
  return NextResponse.json({
    locale:"hy-AM",
    styles:["standard","natural","yerevan"],
    voices:getVoiceCatalog().map(({providerVoiceId,...voice})=>voice),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });

  const dialect=body.dialect === "western" ? "western" : "eastern";
  const style=(body.style==="standard"||body.style==="yerevan"?body.style:"natural") as ArmenianSpeechStyle;
  const naturalized=dialect==="eastern" ? await naturalizeArmenianText(text,style) : {text,generatedBy:"rules" as const,style:"standard" as const};
  const normalized = normalizeForSpeech(naturalized.text, "hy", dialect);
  const voice = resolveVoice(body.voiceId ? String(body.voiceId) : undefined);
  const speech = voice ? await createArmenianSpeech({text:normalized.spokenText,provider:voice.provider,providerVoiceId:voice.providerVoiceId}) : null;

  if (!speech) {
    return NextResponse.json({
      configured: false,
      naturalized,
      normalized,
      voices:getVoiceCatalog().map(({providerVoiceId,...item})=>item),
      message: "Configure ElevenLabs custom Armenian voices or Azure Speech (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION).",
    });
  }

  return NextResponse.json({
    configured: true,
    naturalized,
    normalized,
    voice: voice ? { id: voice.id, label: voice.label, dialect: voice.dialect, provider:voice.provider, character:voice.character } : null,
    captions: captionsFromAlignment(speech.alignment),
    ...speech,
  });
}
