import { NextResponse } from "next/server";
import { authenticateDeveloperRequest, developerApiMaxTextChars, recordDeveloperApiUsage } from "@/lib/developer/api-keys";
import { normalizeForSpeech } from "@/lib/hay/normalize";
import { loadPersistentPronunciations } from "@/lib/hay/pronunciation-store";
import type { Dialect, Locale } from "@/lib/hay/types";

export const runtime="nodejs";

export async function POST(request:Request){
  const auth=await authenticateDeveloperRequest(request,"language:normalize");
  if(!auth.allowed)return NextResponse.json({error:auth.reason},{status:auth.status});
  const body=await request.json();
  const text=String(body.text||"").trim();
  if(!text)return NextResponse.json({error:"text_required"},{status:400});
  const maxTextChars=developerApiMaxTextChars();
  if(text.length>maxTextChars)return NextResponse.json({error:"text_too_large",maxTextChars},{status:413});
  const locale=(["hy","en","ru"].includes(String(body.locale))?body.locale:"hy") as Locale;
  const dialect=(body.dialect==="western"?"western":"eastern") as Dialect;
  const businessId=typeof body.businessId==="string"?body.businessId:null;
  const layer=locale==="hy"?await loadPersistentPronunciations({ownerId:auth.context.ownerId,businessId,dialect}):{configured:false,entries:[],overrides:{},version:"core",validBusiness:false};
  const result=normalizeForSpeech(text,locale,dialect,layer.overrides);
  await recordDeveloperApiUsage(auth.context,{endpoint:"/api/v1/language/normalize",operation:"normalize",inputChars:text.length,metadata:{locale,dialect,registryVersion:layer.version,businessApplied:Boolean(layer.validBusiness)}});
  return NextResponse.json({version:"v1",registryVersion:layer.version,...result});
}
