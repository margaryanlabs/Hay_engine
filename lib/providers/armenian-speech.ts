import "server-only";
import { createArmenianSpeech as createElevenSpeech } from "./elevenlabs";
import { createAzureArmenianSpeech, isAzureArmenianSpeechConfigured } from "./azure-speech";

export type ArmenianSpeechProvider = "elevenlabs" | "azure";

export type ArmenianSpeechRequest = {
  text:string;
  provider?:ArmenianSpeechProvider;
  providerVoiceId?:string;
};

export async function createArmenianSpeech(args:ArmenianSpeechRequest){
  const preferred=args.provider;

  if(preferred==="azure"){
    const azure=await createAzureArmenianSpeech(args.text,args.providerVoiceId);
    if(azure) return azure;
  }

  if(preferred!=="azure"){
    const eleven=await createElevenSpeech(args.text,args.providerVoiceId);
    if(eleven) return {...eleven,provider:"elevenlabs" as const,providerVoice:args.providerVoiceId||process.env.ELEVENLABS_VOICE_ID||"custom"};
  }

  if(isAzureArmenianSpeechConfigured()){
    const azure=await createAzureArmenianSpeech(args.text,args.providerVoiceId);
    if(azure) return azure;
  }

  return null;
}
