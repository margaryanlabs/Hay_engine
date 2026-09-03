import { NextResponse } from "next/server";
import { authenticateDeveloperRequest, developerApiMaxTextChars, recordDeveloperApiUsage } from "@/lib/developer/api-keys";
import { pronounceArmenian } from "@/lib/hay/pronunciation-registry";
import { loadPersistentPronunciations } from "@/lib/hay/pronunciation-store";
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
  const layer=await loadPersistentPronunciations({ownerId:auth.context.ownerId,businessId,dialect});
  const result=pronounceArmenian(text,dialect,layer.overrides,layer.version);
  await recordDeveloperApiUsage(auth.context,{endpoint:"/api/v1/language/pronounce",operation:"pronounce",inputChars:text.length,metadata:{dialect,registryVersion:layer.version,businessApplied:Boolean(layer.validBusiness)}});
  return NextResponse.json({apiVersion:"v1",...result,registry:{persistent:layer.configured,appliedEntries:layer.entries.length,businessApplied:Boolean(layer.validBusiness)}});
}
