import { NextResponse } from "next/server";
import { checkLanguageProviderAccess } from "@/lib/hay/api-access";
import { translateHayText } from "@/lib/hay/translate";
import type { Locale } from "@/lib/hay/types";

export const runtime="nodejs";
const locales:Locale[]=["hy","en","ru"];

export async function POST(request:Request){
  try{
    const body=await request.json();
    const text=String(body.text??"").trim();
    if(!text)return NextResponse.json({error:"text_required"},{status:400});
    const target=String(body.target||"hy") as Locale;
    if(!locales.includes(target))return NextResponse.json({error:"unsupported_target_language"},{status:400});
    const sourceRaw=String(body.source||"auto");
    const source=(sourceRaw==="auto"?"auto":sourceRaw) as Locale|"auto";
    if(source!=="auto"&&!locales.includes(source))return NextResponse.json({error:"unsupported_source_language"},{status:400});

    if(source!==target){
      const access=await checkLanguageProviderAccess();
      if(!access.allowed)return NextResponse.json({error:access.reason},{status:access.reason==="unauthorized"?401:403});
    }
    const result=await translateHayText({text,source,target});
    if(!result.configured)return NextResponse.json({...result,error:"translation_provider_unconfigured"},{status:503});
    if(result.generatedBy==="rejected")return NextResponse.json({...result,error:"translation_preservation_failed"},{status:422});
    return NextResponse.json(result);
  }catch(error){
    console.error("HAY translation failed",error);
    return NextResponse.json({error:"translation_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
