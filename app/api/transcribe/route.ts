import { NextResponse } from "next/server";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, type UsageReservation } from "@/lib/commercial/usage-reservations";
import { checkLanguageProviderAccess } from "@/lib/hay/api-access";
import { correctArmenianTranscript } from "@/lib/hay/transcript";
import { isOpenAITranscriptionConfigured, transcribeWithOpenAI } from "@/lib/providers/openai-transcription";

export const runtime = "nodejs";

function usageStatus(reason:string|undefined){
  if(reason==="unauthorized")return 401;
  if(reason==="request_in_progress"||reason==="duplicate_request")return 409;
  if(reason==="commercial_migration_required"||reason==="atomic_usage_admin_required"||reason==="atomic_usage_migration_required"||reason==="atomic_usage_reservation_failed")return 503;
  return 402;
}

export async function GET() {
  return NextResponse.json({
    locale:"hy-AM",
    providers:{
      openai:{configured:isOpenAITranscriptionConfigured(),model:process.env.OPENAI_TRANSCRIBE_MODEL||"gpt-4o-transcribe"},
      googleChirp3:{configured:false,adapter:"benchmark-planned",locale:"hy-AM"},
    },
    correction:"hay-armenian-transcript-v1",
  });
}

export async function POST(request: Request) {
  let pendingReservation:UsageReservation|null=null;
  try {
    const access = await checkLanguageProviderAccess();
    if (!access.allowed) return NextResponse.json({error:access.reason},{status:access.reason==="unauthorized"?401:403});
    if (!isOpenAITranscriptionConfigured()) {
      return NextResponse.json({configured:false,error:"transcription_provider_unconfigured",message:"Configure OPENAI_API_KEY to enable file transcription."},{status:503});
    }

    // Validate the upload before occupying quota. Provider work starts only after the
    // reservation succeeds, so concurrent large transcription requests cannot spend the
    // same remaining content credit.
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({error:"audio_file_required"},{status:400});
    const maxBytes = Number(process.env.HAY_MAX_TRANSCRIBE_BYTES)||25*1024*1024;
    if (file.size<=0) return NextResponse.json({error:"audio_file_empty"},{status:400});
    if (file.size>maxBytes) return NextResponse.json({error:"audio_file_too_large",maxBytes},{status:413});

    const requestedLanguage = String(form.get("language")||"hy").trim().toLowerCase();
    const language = requestedLanguage==="hy-am"?"hy":requestedLanguage;
    const businessId=typeof form.get("businessId")==="string"?String(form.get("businessId")):null;
    const rawRequestId=typeof form.get("requestId")==="string"?String(form.get("requestId")).trim().slice(0,200):"";
    const reservation=await reserveUsage({
      meter:"content_assets",
      quantity:1,
      businessId,
      source:"language_transcribe",
      idempotencyKey:rawRequestId?`transcribe:${rawRequestId}`:undefined,
      metadata:{audioBytes:file.size,language,filename:file.name||"audio.webm"},
    });
    if(!reservation.allowed){
      return NextResponse.json({error:reservation.reason,meter:"content_assets",required:1,commercial:reservation.context},{status:usageStatus(reservation.reason)});
    }
    if(reservation.duplicate){
      return NextResponse.json({error:"duplicate_transcription_request",commercialUsage:{recorded:true,duplicate:true,eventId:reservation.eventId,metadata:reservation.metadata}},{status:409});
    }
    pendingReservation=reservation;

    const raw = await transcribeWithOpenAI({
      bytes:new Uint8Array(await file.arrayBuffer()),
      filename:file.name||"audio.webm",
      contentType:file.type||"application/octet-stream",
      language:language||undefined,
    });
    if (!raw) {
      await releaseUsageReservation(reservation).catch(()=>undefined);pendingReservation=null;
      return NextResponse.json({configured:false,error:"transcription_provider_unconfigured"},{status:503});
    }

    const shouldCorrect = language==="hy" && String(form.get("correct")??"true")!=="false";
    let correction:Awaited<ReturnType<typeof correctArmenianTranscript>>|null=null;
    if(shouldCorrect){
      try{
        correction=await correctArmenianTranscript(raw.text);
      }catch(error){
        // Transcription provider work already succeeded. Preserve the useful raw output
        // instead of converting a correction-layer failure into a lost paid request.
        console.warn("Armenian transcript correction skipped after successful transcription",error);
      }
    }

    pendingReservation=null;
    const usage=await commitUsageReservation(reservation,{
      provider:raw.provider,
      model:raw.model,
      audioBytes:file.size,
      language,
      corrected:Boolean(correction&&correction.text!==raw.text),
      correctionGeneratedBy:correction?.generatedBy||null,
    });
    if(!usage.recorded){
      return NextResponse.json({error:"transcription_usage_commit_failed",commercialUsage:usage},{status:503});
    }

    return NextResponse.json({
      configured:true,
      locale:language==="hy"?"hy-AM":language,
      provider:raw.provider,
      model:raw.model,
      rawText:raw.text,
      text:correction?.text||raw.text,
      corrected:Boolean(correction&&correction.text!==raw.text),
      correction:correction?{generatedBy:correction.generatedBy,rejectedAiCorrection:"rejectedAiCorrection" in correction?Boolean(correction.rejectedAiCorrection):false}:null,
      commercialUsage:usage,
    });
  } catch (error) {
    if(pendingReservation)await releaseUsageReservation(pendingReservation).catch(()=>undefined);
    console.error("HAY transcription failed",error);
    return NextResponse.json({error:"transcription_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
