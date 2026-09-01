import "server-only";

export type AzureSpeechResult = {
  audioBase64:string;
  alignment:null;
  contentType:string;
  provider:"azure";
  providerVoice:string;
};

function escapeXml(value:string){
  return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");
}

export function isAzureArmenianSpeechConfigured(){
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

export async function createAzureArmenianSpeech(text:string, voiceName="hy-AM-AnahitNeural"):Promise<AzureSpeechResult|null>{
  const key=process.env.AZURE_SPEECH_KEY;
  const region=process.env.AZURE_SPEECH_REGION;
  if(!key||!region) return null;
  const allowed=new Set(["hy-AM-AnahitNeural","hy-AM-HaykNeural"]);
  const voice=allowed.has(voiceName)?voiceName:"hy-AM-AnahitNeural";
  const response=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{
    method:"POST",
    headers:{
      "Ocp-Apim-Subscription-Key":key,
      "Content-Type":"application/ssml+xml",
      "X-Microsoft-OutputFormat":"audio-24khz-48kbitrate-mono-mp3",
      "User-Agent":"HAY-Engine",
    },
    body:`<speak version="1.0" xml:lang="hy-AM"><voice name="${voice}"><prosody rate="0%">${escapeXml(text)}</prosody></voice></speak>`,
    signal:AbortSignal.timeout(20_000),
  });
  if(!response.ok){
    const detail=await response.text();
    throw new Error(`Azure Speech ${response.status}: ${detail.slice(0,300)}`);
  }
  const bytes=Buffer.from(await response.arrayBuffer());
  return {audioBase64:bytes.toString("base64"),alignment:null,contentType:"audio/mpeg",provider:"azure",providerVoice:voice};
}
