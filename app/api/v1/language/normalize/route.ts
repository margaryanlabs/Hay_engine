import { NextResponse } from "next/server";
import { authenticateDeveloperRequest, developerApiMaxTextChars, recordDeveloperApiUsage } from "@/lib/developer/api-keys";
import { normalizeWithPronunciationRegistry } from "@/lib/hay/pronunciation-store";
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
  const result=await normalizeWithPronunciationRegistry({text,locale,dialect,ownerId:auth.context.ownerId,businessId});
  const usage=await recordDeveloperApiUsage(auth.context,{endpoint:"/api/v1/language/normalize",operation:"normalize",inputChars:text.length,metadata:{locale,dialect,registryVersion:result.registry.version,businessApplied:result.registry.businessApplied}});
  if(!usage.recorded)return NextResponse.json({error:"developer_api_metering_failed"},{status:503});
  return NextResponse.json({version:"v1",registryVersion:result.registry.version,registry:result.registry,...result.normalized});
}
