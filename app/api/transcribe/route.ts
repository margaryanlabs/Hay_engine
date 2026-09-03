import { NextResponse } from "next/server";
import { checkLanguageProviderAccess } from "@/lib/hay/api-access";
import { correctArmenianTranscript } from "@/lib/hay/transcript";
import { isOpenAITranscriptionConfigured, transcribeWithOpenAI } from "@/lib/providers/openai-transcription";

export const runtime = "nodejs";

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
  try {
    const access = await checkLanguageProviderAccess();
    if (!access.allowed) return NextResponse.json({error:access.reason},{status:access.reason==="unauthorized"?401:403});
    if (!isOpenAITranscriptionConfigured()) {
      return NextResponse.json({configured:false,error:"transcription_provider_unconfigured",message:"Configure OPENAI_API_KEY to enable file transcription."},{status:503});
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({error:"audio_file_required"},{status:400});
    const maxBytes = Number(process.env.HAY_MAX_TRANSCRIBE_BYTES)||25*1024*1024;
    if (file.size<=0) return NextResponse.json({error:"audio_file_empty"},{status:400});
    if (file.size>maxBytes) return NextResponse.json({error:"audio_file_too_large",maxBytes},{status:413});

    const requestedLanguage = String(form.get("language")||"hy").trim().toLowerCase();
    const language = requestedLanguage==="hy-am"?"hy":requestedLanguage;
    const raw = await transcribeWithOpenAI({
      bytes:new Uint8Array(await file.arrayBuffer()),
      filename:file.name||"audio.webm",
      contentType:file.type||"application/octet-stream",
      language:language||undefined,
    });
    if (!raw) return NextResponse.json({configured:false,error:"transcription_provider_unconfigured"},{status:503});

    const shouldCorrect = language==="hy" && String(form.get("correct")??"true")!=="false";
    const correction = shouldCorrect ? await correctArmenianTranscript(raw.text) : null;
    return NextResponse.json({
      configured:true,
      locale:language==="hy"?"hy-AM":language,
      provider:raw.provider,
      model:raw.model,
      rawText:raw.text,
      text:correction?.text||raw.text,
      corrected:Boolean(correction&&correction.text!==raw.text),
      correction:correction?{generatedBy:correction.generatedBy,rejectedAiCorrection:"rejectedAiCorrection" in correction?Boolean(correction.rejectedAiCorrection):false}:null,
    });
  } catch (error) {
    console.error("HAY transcription failed",error);
    return NextResponse.json({error:"transcription_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
