import { NextResponse } from "next/server";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, type UsageReservation } from "@/lib/commercial/usage-reservations";
import { generateSceneImage } from "@/lib/providers/openai-image";

export const runtime = "nodejs";

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
    if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ configured: false, message: "Set OPENAI_API_KEY to generate scene visuals." });
    }

    const requestId=typeof body.requestId==="string"?body.requestId.trim().slice(0,200):"";
    const reservation=await reserveUsage({
      meter:"content_assets",
      quantity:1,
      businessId:typeof body.businessId==="string"?body.businessId:null,
      source:"image_direct",
      idempotencyKey:requestId?`image:${requestId}`:undefined,
      metadata:{model:process.env.OPENAI_IMAGE_MODEL||"default"},
    });
    if(!reservation.allowed){
      return NextResponse.json({error:reservation.reason,meter:"content_assets",required:1,commercial:reservation.context},{status:usageStatus(reservation.reason)});
    }
    if(reservation.duplicate){
      return NextResponse.json({error:"duplicate_image_request",commercialUsage:{recorded:true,duplicate:true,eventId:reservation.eventId,metadata:reservation.metadata}},{status:409});
    }
    pendingReservation=reservation;

    const image = await generateSceneImage(prompt);
    if (!image) {
      await releaseUsageReservation(reservation).catch(()=>undefined);pendingReservation=null;
      return NextResponse.json({ error: "image_generation_failed" }, { status: 502 });
    }

    pendingReservation=null;
    const usage=await commitUsageReservation(reservation,{model:process.env.OPENAI_IMAGE_MODEL||"default"});
    if(!usage.recorded){
      return NextResponse.json({error:"image_usage_commit_failed",commercialUsage:usage},{status:503});
    }
    return NextResponse.json({ configured: true, ...image, contentType: "image/png", commercialUsage:usage });
  }catch(error){
    if(pendingReservation)await releaseUsageReservation(pendingReservation).catch(()=>undefined);
    console.error("Direct image generation failed",error);
    return NextResponse.json({error:"image_generation_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
