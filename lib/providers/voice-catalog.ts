import { isAzureArmenianSpeechConfigured } from "./azure-speech";

export type HayVoice = {
  id:string;
  label:string;
  gender:"male"|"female"|"neutral";
  dialect:"eastern"|"western"|"general";
  provider:"elevenlabs"|"azure";
  providerVoiceId:string;
  available:boolean;
  character:string;
};

export function getVoiceCatalog():HayVoice[]{
  const elevenConfigured=Boolean(process.env.ELEVENLABS_API_KEY);
  const azureConfigured=isAzureArmenianSpeechConfigured();
  return [
    {id:"signature",label:"HAY Signature",gender:"neutral",dialect:"general",provider:"elevenlabs",providerVoiceId:process.env.ELEVENLABS_VOICE_ID||"",available:elevenConfigured&&Boolean(process.env.ELEVENLABS_VOICE_ID),character:"balanced brand voice"},
    {id:"deep",label:"HAY Deep",gender:"male",dialect:"eastern",provider:"elevenlabs",providerVoiceId:process.env.ELEVENLABS_VOICE_ID_MALE||"",available:elevenConfigured&&Boolean(process.env.ELEVENLABS_VOICE_ID_MALE),character:"confident, editorial, premium"},
    {id:"clear",label:"HAY Clear",gender:"female",dialect:"eastern",provider:"elevenlabs",providerVoiceId:process.env.ELEVENLABS_VOICE_ID_FEMALE||"",available:elevenConfigured&&Boolean(process.env.ELEVENLABS_VOICE_ID_FEMALE),character:"clear, warm, commercial"},
    {id:"western",label:"HAY Western",gender:"neutral",dialect:"western",provider:"elevenlabs",providerVoiceId:process.env.ELEVENLABS_VOICE_ID_WESTERN||"",available:elevenConfigured&&Boolean(process.env.ELEVENLABS_VOICE_ID_WESTERN),character:"Western Armenian brand voice"},
    {id:"anahit",label:"Anahit",gender:"female",dialect:"eastern",provider:"azure",providerVoiceId:"hy-AM-AnahitNeural",available:azureConfigured,character:"clean Armenian neural female"},
    {id:"hayk",label:"Hayk",gender:"male",dialect:"eastern",provider:"azure",providerVoiceId:"hy-AM-HaykNeural",available:azureConfigured,character:"clean Armenian neural male"},
  ];
}

export function resolveVoice(id?:string){
  const voices=getVoiceCatalog();
  if(id){
    const requested=voices.find(v=>v.id===id);
    if(requested?.available) return requested;
  }
  return voices.find(v=>v.available)??voices.find(v=>v.id==="anahit")??null;
}
