import { NextResponse } from "next/server";
import { authenticateDeveloperRequest, developerApiMaxTextChars, recordDeveloperApiUsage } from "@/lib/developer/api-keys";
import { HAY_PRONUNCIATION_VERSION } from "@/lib/hay/pronunciation-registry";
import { normalizeWithPronunciationRegistry } from "@/lib/hay/pronunciation-store";
import type { Dialect } from "@/lib/hay/types";

export const runtime="nodejs";

export async function POST(request:Request){
  const auth=await authenticateDeveloperRequest(request,"language:pronounce");
  if(!auth.allowed)return NextResponse.json({error:auth.reason},{status:auth.status});
  const body=await request.json();
  const text=String(body.text||"").trim();
  if(!text)return NextResponse.json({error:"text_required"},{status:400});
  const maxTextChars=developerApiMaxTextChars();
  if(text.length>maxTextChars)return NextResponse.json({error:"text_too_large",maxTextChars},{status:413});
  const dialect=(body.dialect==="western"?"western":"eastern") as Dialect;
  const businessId=typeof body.businessId==="string"?body.businessId:null;
  const result=await normalizeWithPronunciationRegistry({text,locale:"hy",dialect,ownerId:auth.context.ownerId,businessId});
  const version=result.registry.version!=="core"?`${HAY_PRONUNCIATION_VERSION}+${result.registry.version}`:HAY_PRONUNCIATION_VERSION;
  const usage=await recordDeveloperApiUsage(auth.context,{endpoint:"/api/v1/language/pronounce",operation:"pronounce",inputChars:text.length,metadata:{dialect,registryVersion:result.registry.version,businessApplied:result.registry.businessApplied}});
  if(!usage.recorded)return NextResponse.json({error:"developer_api_metering_failed"},{status:503});
  return NextResponse.json({apiVersion:"v1",version,...result.normalized,registry:result.registry});
}
