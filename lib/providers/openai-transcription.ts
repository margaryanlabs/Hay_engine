import "server-only";

export type TranscriptionResult = {
  provider: "openai";
  model: string;
  text: string;
};

export function isOpenAITranscriptionConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function transcribeWithOpenAI(args: {
  bytes: Uint8Array;
  filename: string;
  contentType?: string;
  language?: string;
}): Promise<TranscriptionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
  const form = new FormData();
  const buffer = args.bytes.buffer.slice(args.bytes.byteOffset,args.bytes.byteOffset+args.bytes.byteLength) as ArrayBuffer;
  form.append("file",new Blob([buffer],{type:args.contentType||"application/octet-stream"}),args.filename||"audio.webm");
  form.append("model",model);
  if (args.language) form.append("language",args.language);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions",{
    method:"POST",
    headers:{Authorization:`Bearer ${apiKey}`},
    body:form,
    signal:AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(()=>"");
    throw new Error(`openai_transcription_${response.status}:${detail.slice(0,500)}`);
  }
  const payload = await response.json() as {text?:string};
  const text = String(payload.text||"").trim();
  if (!text) throw new Error("openai_transcription_empty");
  return {provider:"openai",model,text};
}
