import { NextResponse } from "next/server";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, resizeUsageReservation } from "@/lib/commercial/usage-reservations";
import { currentPronunciationOwner, normalizeWithPronunciationRegistry } from "@/lib/hay/pronunciation-store";
import { naturalizeArmenianText, type ArmenianSpeechStyle } from "@/lib/hay/conversational";
import { createArmenianSpeech } from "@/lib/providers/armenian-speech";
import { getVoiceCatalog, resolveVoice } from "@/lib/providers/voice-catalog";
import { captionsFromAlignment } from "@/lib/creator/alignment";

export const runtime="nodejs";
const MAX_VOICE_CHARS=8_000;

export async function GET(){
  return NextResponse.json({
    locale:"hy-AM",
    styles:["standard","natural","yerevan"],
    voices:getVoiceCatalog().map(({providerVoiceId,...voice})=>voice),
  });
}

function estimatedVoiceMinutes(text:string){
  const value=text.trim();
  const words=value.split(/\s+/).filter(Boolean).length;
  // Character-based floor prevents one giant no-space token from bypassing the
  // word estimate while still keeping normal Armenian speech close to 135 wpm.
  const minutes=Math.max(words/135,value.length/780);
  return Math.max(0.1,Math.round(minutes*1000)/1000);
}

function usageStatus(reason:string|undefined){
  if(reason==="unauthorized")return 401;
  if(reason==="request_in_progress"||reason==="duplicate_request")return 409;
  if(reason==="commercial_migration_required"||reason==="atomic_usage_admin_required"||reason==="atomic_usage_migration_required"||reason==="atomic_usage_resize_migration_required"||reason==="atomic_usage_reservation_failed"||reason==="reservation_resize_failed")return 503;
  return 402;
}

export async function POST(request: Request) {
  let reservation:Awaited<ReturnType<typeof reserveUsage>>|null=null;
  let providerCompleted=false;
  try{
    const body = await request.json();
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });
    if(text.length>MAX_VOICE_CHARS)return NextResponse.json({error:"text_too_large",maxCharacters:MAX_VOICE_CHARS},{status:413});

    const dialect=body.dialect === "western" ? "western" : "eastern";
    const style=(body.style==="standard"||body.style==="yerevan"?body.style:"natural") as ArmenianSpeechStyle;
    const businessId=typeof body.businessId==="string"?body.businessId:null;
    const requestId=typeof body.requestId==="string"?body.requestId.trim().slice(0,200):"";
    const voice=resolveVoice(body.voiceId?String(body.voiceId):undefined);

    // Do not spend OpenAI naturalization tokens or reserve quota if no TTS provider
    // is actually available. resolveVoice may return a catalog fallback for UI purposes,
    // so availability must be checked explicitly here.
    if(!voice?.available){
      return NextResponse.json({
        configured:false,
        voices:getVoiceCatalog().map(({providerVoiceId,...item})=>item),
        message:"Configure ElevenLabs custom Armenian voices or Azure Speech (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION).",
      });
    }

    const preflightMinutes=estimatedVoiceMinutes(text);
    reservation=await reserveUsage({
      meter:"voice_minutes",
      quantity:preflightMinutes,
      businessId,
      source:"armenian_voice",
      idempotencyKey:requestId?`voice:${requestId}`:undefined,
      metadata:{provider:voice.provider,voiceId:voice.id,dialect,style,inputCharacters:text.length},
    });
    if(!reservation.allowed){
      return NextResponse.json({error:reservation.reason,meter:"voice_minutes",required:preflightMinutes,commercial:reservation.context},{status:usageStatus(reservation.reason)});
    }

    // Voice output is not persisted for replay. A consumed duplicate therefore stops
    // before every paid provider call rather than synthesizing the same request again.
    if(reservation.duplicate){
      return NextResponse.json({error:"duplicate_voice_request",commercialUsage:{recorded:true,duplicate:true,eventId:reservation.eventId}},{status:409});
    }

    const naturalized=dialect==="eastern"
      ? await naturalizeArmenianText(text,style)
      : {text,generatedBy:"rules" as const,style:"standard" as const};
    const owner=await currentPronunciationOwner();
    const runtimeResult=await normalizeWithPronunciationRegistry({text:naturalized.text,locale:"hy",dialect,ownerId:owner?.ownerId,businessId});
    const normalized=runtimeResult.normalized;
    const minutes=estimatedVoiceMinutes(normalized.spokenText);

    // Naturalization and pronunciation expansion can change the final billable length.
    // Resize the same reservation under the account row lock before TTS so concurrent
    // requests cannot spend the newly required capacity between two JS-side checks.
    const resized=await resizeUsageReservation(reservation,minutes);
    if(!resized.resized){
      await releaseUsageReservation(reservation);
      return NextResponse.json({error:resized.reason,meter:"voice_minutes",required:minutes,commercial:reservation.context},{status:usageStatus(resized.reason)});
    }

    const speech=await createArmenianSpeech({text:normalized.spokenText,provider:voice.provider,providerVoiceId:voice.providerVoiceId});
    if(!speech){
      await releaseUsageReservation(reservation);
      return NextResponse.json({
        configured:false,
        naturalized,
        normalized,
        pronunciationRegistry:runtimeResult.registry,
        voices:getVoiceCatalog().map(({providerVoiceId,...item})=>item),
        message:"Configured Armenian voice provider returned no speech.",
      },{status:503});
    }
    providerCompleted=true;

    const usage=await commitUsageReservation(reservation,{
      provider:voice.provider,
      voiceId:voice.id,
      dialect,
      style,
      characters:normalized.spokenText.length,
      pronunciationRegistryVersion:runtimeResult.registry.version,
      minutes,
    });
    if(!usage.recorded){
      // A paid TTS call has already completed. Keep the reservation occupied instead of
      // releasing it into free capacity; expiry/reconciliation can recover it safely.
      return NextResponse.json({error:"voice_usage_commit_failed",commercialUsage:usage},{status:503});
    }

    return NextResponse.json({
      configured:true,
      naturalized,
      normalized,
      pronunciationRegistry:runtimeResult.registry,
      voice:{id:voice.id,label:voice.label,dialect:voice.dialect,provider:voice.provider,character:voice.character},
      captions:captionsFromAlignment(speech.alignment),
      commercialUsage:usage,
      ...speech,
    });
  }catch(error){
    if(reservation?.allowed&&!reservation.duplicate&&!providerCompleted){
      await releaseUsageReservation(reservation).catch(()=>undefined);
    }
    console.error("Armenian voice generation failed",error);
    return NextResponse.json({error:"voice_generation_failed"},{status:500});
  }
}
