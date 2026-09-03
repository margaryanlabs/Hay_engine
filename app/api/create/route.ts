import { NextResponse } from "next/server";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, type UsageReservation } from "@/lib/commercial/usage-reservations";
import { createCreatorProject } from "@/lib/creator/project";
import { currentPronunciationOwner } from "@/lib/hay/pronunciation-store";
import type { ContentStyle, Dialect, Locale } from "@/lib/hay/types";

export const runtime = "nodejs";

function usageStatus(reason:string|undefined){
  if(reason==="unauthorized")return 401;
  if(reason==="request_in_progress"||reason==="duplicate_request")return 409;
  if(reason==="commercial_migration_required"||reason==="atomic_usage_admin_required"||reason==="atomic_usage_migration_required"||reason==="atomic_usage_reservation_failed")return 503;
  return 402;
}

export async function POST(request: Request) {
  let pendingReservation:UsageReservation|null=null;
  try {
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    const language = (body.language ?? "hy") as Locale;
    const dialect = (body.dialect ?? "eastern") as Dialect;
    const style = (body.style ?? "advertising") as ContentStyle;
    const duration = Math.min(60, Math.max(6, Number(body.duration) || 15));
    const businessId=typeof body.businessId==="string"?body.businessId:null;

    if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
    if (!["hy", "en", "ru"].includes(language)) return NextResponse.json({ error: "unsupported_language" }, { status: 400 });

    const requestId=typeof body.requestId==="string"?body.requestId.trim().slice(0,200):"";
    const reservation=await reserveUsage({
      meter:"content_assets",
      quantity:1,
      businessId,
      source:"creator_direct",
      idempotencyKey:requestId?`creator:${requestId}`:undefined,
      metadata:{language,dialect,style,duration},
    });
    if(!reservation.allowed){
      return NextResponse.json({error:reservation.reason,meter:"content_assets",required:1,commercial:reservation.context},{status:usageStatus(reservation.reason)});
    }
    if(reservation.duplicate){
      return NextResponse.json({error:"duplicate_creator_request",commercialUsage:{recorded:true,duplicate:true,eventId:reservation.eventId,metadata:reservation.metadata}},{status:409});
    }
    pendingReservation=reservation;

    const owner=await currentPronunciationOwner();
    const project = await createCreatorProject({ prompt, language, dialect, style, duration, ownerId:owner?.ownerId, businessId });

    pendingReservation=null;
    const usage=await commitUsageReservation(reservation,{
      projectId:project.id,language,dialect,style,duration,planner:project.providers.planner,stock:project.providers.stock,
    });
    if(!usage.recorded){
      return NextResponse.json({error:"creator_usage_commit_failed",commercialUsage:usage},{status:503});
    }
    return NextResponse.json({...project,commercialUsage:usage});
  } catch (error) {
    if(pendingReservation)await releaseUsageReservation(pendingReservation).catch(()=>undefined);
    console.error("Creator project generation failed", error);
    return NextResponse.json({ error: "creator_generation_failed" }, { status: 500 });
  }
}
