import { NextResponse } from "next/server";
import { authenticateDeveloperRequest, recordDeveloperApiUsage } from "@/lib/developer/api-keys";
import { correctArmenianTranscript } from "@/lib/hay/transcript";
import { isOpenAITranscriptionConfigured, transcribeWithOpenAI } from "@/lib/providers/openai-transcription";

export const runtime="nodejs";

export async function POST(request:Request){
  try{
    const auth=await authenticateDeveloperRequest(request,"language:transcribe");
    if(!auth.allowed)return NextResponse.json({error:auth.reason},{status:auth.status});
    if(!isOpenAITranscriptionConfigured())return NextResponse.json({error:"transcription_provider_unconfigured"},{status:503});
    const form=await request.formData();
    const file=form.get("file");
    if(!(file instanceof File))return NextResponse.json({error:"audio_file_required"},{status:400});
    const maxBytes=Number(process.env.HAY_MAX_TRANSCRIBE_BYTES)||25*1024*1024;
    if(file.size<=0)return NextResponse.json({error:"audio_file_empty"},{status:400});
    if(file.size>maxBytes)return NextResponse.json({error:"audio_file_too_large",maxBytes},{status:413});
    const requestedLanguage=String(form.get("language")||"hy").trim().toLowerCase();
    const language=requestedLanguage==="hy-am"?"hy":requestedLanguage;
    const raw=await transcribeWithOpenAI({bytes:new Uint8Array(await file.arrayBuffer()),filename:file.name||"audio.webm",contentType:file.type||"application/octet-stream",language:language||undefined});
    if(!raw)return NextResponse.json({error:"transcription_provider_unconfigured"},{status:503});
    const shouldCorrect=language==="hy"&&String(form.get("correct")??"true")!=="false";
    const correction=shouldCorrect?await correctArmenianTranscript(raw.text):null;
    await recordDeveloperApiUsage(auth.context,{endpoint:"/api/v1/language/transcribe",operation:"transcribe",audioBytes:file.size,metadata:{language,model:raw.model,corrected:Boolean(correction)}});
    return NextResponse.json({apiVersion:"v1",locale:language==="hy"?"hy-AM":language,provider:raw.provider,model:raw.model,rawText:raw.text,text:correction?.text||raw.text,corrected:Boolean(correction&&correction.text!==raw.text),correction:correction?{generatedBy:correction.generatedBy,rejectedAiCorrection:"rejectedAiCorrection" in correction?Boolean(correction.rejectedAiCorrection):false}:null});
  }catch(error){
    console.error("HAY v1 transcription failed",error);
    return NextResponse.json({error:"transcription_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
