import { NextResponse } from "next/server";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, type UsageReservation } from "@/lib/commercial/usage-reservations";
import { buildDemoStoryboard } from "@/lib/hay/storyboard";
import { generateStoryboardWithOpenAI } from "@/lib/providers/openai";
import type { ContentStyle, Locale } from "@/lib/hay/types";

function usageStatus(reason:string|undefined){
  if(reason==="unauthorized")return 401;
  if(reason==="request_in_progress"||reason==="duplicate_request")return 409;
  if(reason==="commercial_migration_required"||reason==="atomic_usage_admin_required"||reason==="atomic_usage_migration_required"||reason==="atomic_usage_reservation_failed")return 503;
  return 402;
}

export async function POST(request: Request) {
  let pendingReservation:UsageReservation|null=null;
  try{
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    const language = (body.language ?? "hy") as Locale;
    const style = (body.style ?? "advertising") as ContentStyle;
    const duration = Math.min(60, Math.max(6, Number(body.duration) || 15));

    if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });

    let reservation:UsageReservation|null=null;
    if(process.env.OPENAI_API_KEY){
      const requestId=typeof body.requestId==="string"?body.requestId.trim().slice(0,200):"";
      const next=await reserveUsage({
        meter:"content_assets",
        quantity:1,
        businessId:typeof body.businessId==="string"?body.businessId:null,
        source:"storyboard_direct",
        idempotencyKey:requestId?`storyboard:${requestId}`:undefined,
        metadata:{language,style,duration},
      });
      if(!next.allowed){
        return NextResponse.json({error:next.reason,meter:"content_assets",required:1,commercial:next.context},{status:usageStatus(next.reason)});
      }
      if(next.duplicate){
        return NextResponse.json({error:"duplicate_storyboard_request",commercialUsage:{recorded:true,duplicate:true,eventId:next.eventId,metadata:next.metadata}},{status:409});
      }
      reservation=next;pendingReservation=next;
    }

    const ai = await generateStoryboardWithOpenAI({ prompt, language, duration, style });
    const storyboard = ai ?? buildDemoStoryboard(prompt, language, duration, style);
    let usage:{recorded:boolean;reason?:string;duplicate?:boolean;eventId?:string|null;metadata?:Record<string,unknown>}={recorded:false,reason:"deterministic_fallback"};
    if(ai&&reservation){
      pendingReservation=null;
      usage=await commitUsageReservation(reservation,{language,style,duration,generatedBy:storyboard.generatedBy});
      if(!usage.recorded)return NextResponse.json({error:"storyboard_usage_commit_failed",commercialUsage:usage},{status:503});
    }else if(reservation){
      await releaseUsageReservation(reservation).catch(()=>undefined);pendingReservation=null;
    }
    return NextResponse.json({...storyboard,commercialUsage:usage});
  }catch(error){
    if(pendingReservation)await releaseUsageReservation(pendingReservation).catch(()=>undefined);
    console.error("Storyboard generation failed",error);
    return NextResponse.json({error:"storyboard_generation_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
