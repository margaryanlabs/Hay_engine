import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { currentPronunciationOwner, normalizeWithPronunciationRegistry } from "@/lib/hay/pronunciation-store";
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

function estimatedVoiceMinutes(text:string){
  const words=text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(0.1,Math.round((words/135)*1000)/1000);
}

function allowanceStatus(reason:string|undefined){
  return reason==="unauthorized"?401:reason==="commercial_migration_required"?503:402;
}

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });

  // Gate before conversational naturalization because naturalizeArmenianText may itself
  // invoke OpenAI. This prevents unauthenticated, inactive or exhausted accounts from
  // spending provider tokens before the route reaches the TTS allowance check.
  const preflightMinutes=estimatedVoiceMinutes(text);
  const preflight=await checkUsageAllowance("voice_minutes",preflightMinutes);
  if(!preflight.allowed){
    return NextResponse.json({error:preflight.reason,meter:"voice_minutes",required:preflightMinutes,commercial:preflight.context},{status:allowanceStatus(preflight.reason)});
  }

  const dialect=body.dialect === "western" ? "western" : "eastern";
  const style=(body.style==="standard"||body.style==="yerevan"?body.style:"natural") as ArmenianSpeechStyle;
  const naturalized=dialect==="eastern" ? await naturalizeArmenianText(text,style) : {text,generatedBy:"rules" as const,style:"standard" as const};
  const owner=await currentPronunciationOwner();
  const businessId=typeof body.businessId==="string"?body.businessId:null;
  const runtimeResult=await normalizeWithPronunciationRegistry({text:naturalized.text,locale:"hy",dialect,ownerId:owner?.ownerId,businessId});
  const normalized=runtimeResult.normalized;
  const voice = resolveVoice(body.voiceId ? String(body.voiceId) : undefined);
  const minutes=estimatedVoiceMinutes(normalized.spokenText);

  if(minutes>preflightMinutes){
    const allowance=await checkUsageAllowance("voice_minutes",minutes);
    if(!allowance.allowed){
      return NextResponse.json({error:allowance.reason,meter:"voice_minutes",required:minutes,commercial:allowance.context},{status:allowanceStatus(allowance.reason)});
    }
  }

  const speech = voice ? await createArmenianSpeech({text:normalized.spokenText,provider:voice.provider,providerVoiceId:voice.providerVoiceId}) : null;

  if (!speech) {
    return NextResponse.json({
      configured: false,
      naturalized,
      normalized,
      pronunciationRegistry:runtimeResult.registry,
      voices:getVoiceCatalog().map(({providerVoiceId,...item})=>item),
      message: "Configure ElevenLabs custom Armenian voices or Azure Speech (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION).",
    });
  }

  const usage=await recordUsage({
    meter:"voice_minutes",
    quantity:minutes,
    businessId,
    source:"armenian_voice",
    idempotencyKey:typeof body.requestId==="string"&&body.requestId?`voice:${body.requestId}`:undefined,
    metadata:{provider:voice?.provider||speech.provider,voiceId:voice?.id||null,dialect,style,characters:normalized.spokenText.length,pronunciationRegistryVersion:runtimeResult.registry.version},
  });

  return NextResponse.json({
    configured: true,
    naturalized,
    normalized,
    pronunciationRegistry:runtimeResult.registry,
    voice: voice ? { id: voice.id, label: voice.label, dialect: voice.dialect, provider:voice.provider, character:voice.character } : null,
    captions: captionsFromAlignment(speech.alignment),
    commercialUsage:usage,
    ...speech,
  });
}
