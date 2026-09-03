import { NextResponse } from "next/server";
import { authenticateDeveloperRequest, developerApiMaxTextChars, recordDeveloperApiUsage } from "@/lib/developer/api-keys";
import { translateHayText } from "@/lib/hay/translate";
import type { Locale } from "@/lib/hay/types";

export const runtime="nodejs";
const locales:Locale[]=["hy","en","ru"];

export async function POST(request:Request){
  const auth=await authenticateDeveloperRequest(request,"language:translate");
  if(!auth.allowed)return NextResponse.json({error:auth.reason},{status:auth.status});
  const body=await request.json();
  const text=String(body.text||"").trim();
  if(!text)return NextResponse.json({error:"text_required"},{status:400});
  const maxTextChars=developerApiMaxTextChars();
  if(text.length>maxTextChars)return NextResponse.json({error:"text_too_large",maxTextChars},{status:413});
  const target=String(body.target||"hy") as Locale;
  if(!locales.includes(target))return NextResponse.json({error:"unsupported_target_language"},{status:400});
  const sourceRaw=String(body.source||"auto");
  const source=(sourceRaw==="auto"?"auto":sourceRaw) as Locale|"auto";
  if(source!=="auto"&&!locales.includes(source))return NextResponse.json({error:"unsupported_source_language"},{status:400});
  const result=await translateHayText({text,source,target});
  if(!result.configured)return NextResponse.json({...result,error:"translation_provider_unconfigured"},{status:503});
  if(result.generatedBy==="rejected")return NextResponse.json({...result,error:"translation_preservation_failed"},{status:422});
  const usage=await recordDeveloperApiUsage(auth.context,{endpoint:"/api/v1/language/translate",operation:"translate",inputChars:text.length,metadata:{source,target}});
  if(!usage.recorded)return NextResponse.json({error:"developer_api_metering_failed"},{status:503});
  return NextResponse.json({apiVersion:"v1",...result});
}
