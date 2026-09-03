import { NextResponse } from "next/server";
import { checkOwnedProviderOperation } from "@/lib/commercial/provider-operations";
import { commitUsageReservation, releaseUsageReservation, reserveUsage } from "@/lib/commercial/usage-reservations";
import { extractVeoVideoUri, getVeoOperation, isVeoConfigured, normalizeVeoOperationName, startVeoVideo } from "@/lib/providers/veo";

export const runtime = "nodejs";

function reservationFailureStatus(reason:string){
  if(reason==="unauthorized")return 401;
  if(reason==="request_in_progress")return 409;
  if(reason==="commercial_migration_required"||reason==="atomic_usage_admin_required"||reason==="atomic_usage_migration_required"||reason==="atomic_usage_reservation_failed")return 503;
  return 402;
}

export async function POST(request: Request) {
  let reservation: Awaited<ReturnType<typeof reserveUsage>> | null = null;
  try {
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
    if (!isVeoConfigured()) return NextResponse.json({ configured: false, message: "Add GEMINI_API_KEY to enable Veo 3.1 video generation." });

    const requested = Number(body.durationSeconds) || 8;
    const durationSeconds = ([4, 6, 8].includes(requested) ? requested : 8) as 4 | 6 | 8;
    const resolution = (["720p", "1080p", "4k"].includes(body.resolution) ? body.resolution : "720p") as "720p" | "1080p" | "4k";
    const aspectRatio = body.aspectRatio === "16:9" ? "16:9" : "9:16";
    const requestId = typeof body.requestId === "string" ? body.requestId.trim().slice(0,200) : "";

    reservation=await reserveUsage({
      meter:"ai_video_credits",
      quantity:1,
      businessId:typeof body.businessId==="string"?body.businessId:null,
      source:"veo_video",
      idempotencyKey:requestId?`video:${requestId}`:undefined,
      metadata:{durationSeconds,resolution,aspectRatio},
    });
    if(!reservation.allowed){
      return NextResponse.json({error:reservation.reason,meter:"ai_video_credits",required:1,commercial:reservation.context},{status:reservationFailureStatus(reservation.reason)});
    }

    // A consumed idempotent request must never call Veo again. The operation name
    // committed with the first request is enough for the client to resume polling.
    if(reservation.duplicate){
      const existingName=typeof reservation.metadata.operationName==="string"?reservation.metadata.operationName:"";
      if(!existingName)return NextResponse.json({error:"duplicate_video_operation_missing"},{status:409});
      return NextResponse.json({
        configured:true,
        reused:true,
        operation:{name:existingName},
        commercialUsage:{recorded:true,duplicate:true,eventId:reservation.eventId},
      });
    }

    const operation = await startVeoVideo({
      prompt: `${prompt}\nNo text, no letters, no captions, no logos unless explicitly described. HAY Engine adds exact Armenian typography separately.`,
      durationSeconds,
      aspectRatio,
      resolution,
    });
    if (!operation?.name) {
      await releaseUsageReservation(reservation);
      return NextResponse.json({ error: "video_operation_missing" }, { status: 502 });
    }

    let operationName: string;
    try {
      operationName = normalizeVeoOperationName(operation.name);
    } catch {
      await releaseUsageReservation(reservation);
      return NextResponse.json({ error: "video_operation_invalid" }, { status: 502 });
    }

    const usage=await commitUsageReservation(reservation,{operationName,durationSeconds,resolution,aspectRatio});
    if(!usage.recorded){
      // Do not release after a successful provider start: retaining the reservation
      // is safer than turning an already-created Veo job into unmetered usage.
      return NextResponse.json({error:"video_usage_commit_failed",operation:{...operation,name:operationName},commercialUsage:usage},{status:503});
    }

    return NextResponse.json({ configured: true, operation: { ...operation, name: operationName }, commercialUsage:usage });
  } catch (error) {
    if(reservation?.allowed&&!reservation.duplicate)await releaseUsageReservation(reservation).catch(()=>undefined);
    console.error("Veo start failed", error);
    return NextResponse.json({ error: "video_generation_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const rawOperationName = new URL(request.url).searchParams.get("operation");
    if (!rawOperationName) return NextResponse.json({ error: "operation_required" }, { status: 400 });
    if (!isVeoConfigured()) return NextResponse.json({ configured: false });

    let operationName: string;
    try {
      operationName = normalizeVeoOperationName(rawOperationName);
    } catch {
      return NextResponse.json({ error: "invalid_operation_name" }, { status: 400 });
    }

    const access = await checkOwnedProviderOperation({
      meter: "ai_video_credits",
      source: "veo_video",
      operationName,
    });
    if (!access.allowed) {
      const status = access.reason === "unauthorized" ? 401 : access.reason === "operation_not_owned" ? 404 : 503;
      return NextResponse.json({ error: access.reason }, { status });
    }

    const operation = await getVeoOperation(operationName);
    return NextResponse.json({
      configured: true,
      operation,
      done: Boolean(operation?.done),
      videoUri: operation ? extractVeoVideoUri(operation) : null,
    });
  } catch (error) {
    console.error("Veo polling failed", error);
    return NextResponse.json({ error: "video_poll_failed" }, { status: 500 });
  }
}
