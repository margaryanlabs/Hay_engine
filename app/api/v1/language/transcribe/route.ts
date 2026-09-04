import { NextResponse } from "next/server";
import { authenticateDeveloperRequest, recordDeveloperApiUsage } from "@/lib/developer/api-keys";
import { correctArmenianTranscript } from "@/lib/hay/transcript";
import { resolveTranscriptionProvider, transcribeWithConfiguredProvider, transcriptionProviderReadiness } from "@/lib/providers/transcription";

export const runtime="nodejs";
const GOOGLE_SYNC_MAX_BYTES=10*1024*1024;

export async function POST(request:Request){
  try{
    const auth=await authenticateDeveloperRequest(request,"language:transcribe");
    if(!auth.allowed)return NextResponse.json({error:auth.reason},{status:auth.status});
    const form=await request.formData();
    const file=form.get("file");
    if(!(file instanceof File))return NextResponse.json({error:"audio_file_required"},{status:400});
    const maxBytes=Number(process.env.HAY_MAX_TRANSCRIBE_BYTES)||25*1024*1024;
    if(file.size<=0)return NextResponse.json({error:"audio_file_empty"},{status:400});
    if(file.size>maxBytes)return NextResponse.json({error:"audio_file_too_large",maxBytes},{status:413});
    const requestedLanguage=String(form.get("language")||"hy").trim().toLowerCase();
    const language=requestedLanguage==="hy-am"?"hy":requestedLanguage;
    const selectedProvider=resolveTranscriptionProvider(form.get("provider"),language);
    if(!selectedProvider)return NextResponse.json({error:"transcription_provider_unconfigured",providers:transcriptionProviderReadiness()},{status:503});
    if(selectedProvider==="google-chirp3"&&file.size>GOOGLE_SYNC_MAX_BYTES){
      return NextResponse.json({error:"google_chirp3_sync_audio_too_large",maxBytes:GOOGLE_SYNC_MAX_BYTES,maxSeconds:60},{status:413});
    }
    const raw=await transcribeWithConfiguredProvider({bytes:new Uint8Array(await file.arrayBuffer()),filename:file.name||"audio.webm",contentType:file.type||"application/octet-stream",language:language||undefined,provider:selectedProvider});
    if(!raw)return NextResponse.json({error:"transcription_provider_unconfigured"},{status:503});
    const shouldCorrect=language==="hy"&&String(form.get("correct")??"true")!=="false";
    let correction:Awaited<ReturnType<typeof correctArmenianTranscript>>|null=null;
    if(shouldCorrect){
      try{correction=await correctArmenianTranscript(raw.text);}catch(error){console.warn("HAY v1 transcript correction skipped after provider success",error);}
    }
    await recordDeveloperApiUsage(auth.context,{endpoint:"/api/v1/language/transcribe",operation:"transcribe",audioBytes:file.size,metadata:{language,provider:raw.provider,model:raw.model,corrected:Boolean(correction)}});
    return NextResponse.json({apiVersion:"v1",locale:language==="hy"?"hy-AM":language,provider:raw.provider,model:raw.model,rawText:raw.text,text:correction?.text||raw.text,corrected:Boolean(correction&&correction.text!==raw.text),correction:correction?{generatedBy:correction.generatedBy,rejectedAiCorrection:"rejectedAiCorrection" in correction?Boolean(correction.rejectedAiCorrection):false}:null});
  }catch(error){
    console.error("HAY v1 transcription failed",error);
    return NextResponse.json({error:"transcription_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
