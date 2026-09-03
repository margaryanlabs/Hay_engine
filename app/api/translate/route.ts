import { NextResponse } from "next/server";
import { checkUsageAllowance, recordUsage } from "@/lib/commercial/entitlements";
import { checkLanguageProviderAccess } from "@/lib/hay/api-access";
import { translateHayText } from "@/lib/hay/translate";
import type { Locale } from "@/lib/hay/types";

export const runtime="nodejs";
const locales:Locale[]=["hy","en","ru"];
const MAX_TRANSLATE_CHARS=20_000;

function allowanceStatus(reason:string|undefined){
  return reason==="unauthorized"?401:reason==="commercial_migration_required"?503:402;
}

export async function POST(request:Request){
  try{
    const body=await request.json();
    const text=String(body.text??"").trim();
    if(!text)return NextResponse.json({error:"text_required"},{status:400});
    if(text.length>MAX_TRANSLATE_CHARS)return NextResponse.json({error:"text_too_large",maxChars:MAX_TRANSLATE_CHARS},{status:413});
    const target=String(body.target||"hy") as Locale;
    if(!locales.includes(target))return NextResponse.json({error:"unsupported_target_language"},{status:400});
    const sourceRaw=String(body.source||"auto");
    const source=(sourceRaw==="auto"?"auto":sourceRaw) as Locale|"auto";
    if(source!=="auto"&&!locales.includes(source))return NextResponse.json({error:"unsupported_source_language"},{status:400});

    if(source!==target){
      const access=await checkLanguageProviderAccess();
      if(!access.allowed)return NextResponse.json({error:access.reason},{status:access.reason==="unauthorized"?401:403});
      if(process.env.OPENAI_API_KEY&&access.context.configured&&access.context.authenticated){
        const allowance=await checkUsageAllowance("content_assets",1);
        if(!allowance.allowed){
          return NextResponse.json({error:allowance.reason,meter:"content_assets",required:1,commercial:allowance.context},{status:allowanceStatus(allowance.reason)});
        }
      }
    }

    const result=await translateHayText({text,source,target});
    if(!result.configured)return NextResponse.json({...result,error:"translation_provider_unconfigured"},{status:503});

    const usage=source!==target&&result.generatedBy!=="identity"
      ? await recordUsage({
          meter:"content_assets",
          quantity:1,
          businessId:typeof body.businessId==="string"?body.businessId:null,
          source:"language_translate",
          idempotencyKey:typeof body.requestId==="string"&&body.requestId?`translate:${body.requestId}`:undefined,
          metadata:{source,target,characters:text.length,generatedBy:result.generatedBy},
        })
      : {recorded:false,reason:"identity_translation"};

    if(result.generatedBy==="rejected")return NextResponse.json({...result,commercialUsage:usage,error:"translation_preservation_failed"},{status:422});
    return NextResponse.json({...result,commercialUsage:usage});
  }catch(error){
    console.error("HAY translation failed",error);
    return NextResponse.json({error:"translation_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
