import { NextResponse } from "next/server";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, type UsageReservation } from "@/lib/commercial/usage-reservations";
import { checkLanguageProviderAccess } from "@/lib/hay/api-access";
import { translateHayText } from "@/lib/hay/translate";
import type { Locale } from "@/lib/hay/types";

export const runtime="nodejs";
const locales:Locale[]=["hy","en","ru"];
const MAX_TRANSLATE_CHARS=20_000;

function usageStatus(reason:string|undefined){
  if(reason==="unauthorized")return 401;
  if(reason==="request_in_progress"||reason==="duplicate_request")return 409;
  if(reason==="commercial_migration_required"||reason==="atomic_usage_admin_required"||reason==="atomic_usage_migration_required"||reason==="atomic_usage_reservation_failed")return 503;
  return 402;
}

export async function POST(request:Request){
  let pendingReservation:UsageReservation|null=null;
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

    let reservation:UsageReservation|null=null;
    if(source!==target){
      const access=await checkLanguageProviderAccess();
      if(!access.allowed)return NextResponse.json({error:access.reason},{status:access.reason==="unauthorized"?401:403});
      if(process.env.OPENAI_API_KEY){
        const requestId=typeof body.requestId==="string"?body.requestId.trim().slice(0,200):"";
        const next=await reserveUsage({
          meter:"content_assets",
          quantity:1,
          businessId:typeof body.businessId==="string"?body.businessId:null,
          source:"language_translate",
          idempotencyKey:requestId?`translate:${requestId}`:undefined,
          metadata:{source,target,characters:text.length},
        });
        if(!next.allowed){
          return NextResponse.json({error:next.reason,meter:"content_assets",required:1,commercial:next.context},{status:usageStatus(next.reason)});
        }
        if(next.duplicate){
          return NextResponse.json({error:"duplicate_translation_request",commercialUsage:{recorded:true,duplicate:true,eventId:next.eventId,metadata:next.metadata}},{status:409});
        }
        reservation=next;pendingReservation=next;
      }
    }

    const result=await translateHayText({text,source,target});
    if(!result.configured){
      if(reservation)await releaseUsageReservation(reservation).catch(()=>undefined);
      pendingReservation=null;
      return NextResponse.json({...result,error:"translation_provider_unconfigured"},{status:503});
    }

    let usage:{recorded:boolean;reason?:string;duplicate?:boolean;eventId?:string|null;metadata?:Record<string,unknown>}={recorded:false,reason:"identity_translation"};
    if(reservation&&result.generatedBy!=="identity"){
      pendingReservation=null;
      usage=await commitUsageReservation(reservation,{source,target,characters:text.length,generatedBy:result.generatedBy});
      if(!usage.recorded)return NextResponse.json({error:"translation_usage_commit_failed",commercialUsage:usage},{status:503});
    }else if(reservation){
      await releaseUsageReservation(reservation).catch(()=>undefined);pendingReservation=null;
    }

    if(result.generatedBy==="rejected")return NextResponse.json({...result,commercialUsage:usage,error:"translation_preservation_failed"},{status:422});
    return NextResponse.json({...result,commercialUsage:usage});
  }catch(error){
    if(pendingReservation)await releaseUsageReservation(pendingReservation).catch(()=>undefined);
    console.error("HAY translation failed",error);
    return NextResponse.json({error:"translation_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
