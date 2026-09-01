import { NextResponse } from "next/server";
import type { SocialPlatform } from "@/lib/marketing/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { dispatchPublish } from "@/lib/publish/client";

export const runtime = "nodejs";
const supported: SocialPlatform[] = ["instagram", "tiktok", "youtube", "facebook", "linkedin"];

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ configured: false, message: "Supabase is required for publishing jobs." });
    const body = await request.json();
    const platform = body.platform as SocialPlatform;
    const contentItemId = String(body.contentItemId ?? "");
    const connectionId = String(body.connectionId ?? "");
    if (!supported.includes(platform) || !contentItemId || !connectionId) return NextResponse.json({ error: "invalid_publish_request" }, { status: 400 });

    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: content } = await supabase.from("content_items").select("id,business_id,platform,status,asset_url,scheduled_for").eq("id", contentItemId).maybeSingle();
    if (!content) return NextResponse.json({ error: "content_not_found" }, { status: 404 });
    const { data: business } = await supabase.from("businesses").select("id").eq("id", content.business_id).eq("owner_id", userId).maybeSingle();
    if (!business) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const { data: connection } = await supabase.from("social_connections").select("id,business_id,platform,status,credential_ref").eq("id", connectionId).eq("business_id", content.business_id).maybeSingle();
    if (!connection || connection.platform !== platform || connection.status !== "connected" || !connection.credential_ref) {
      return NextResponse.json({ error: "social_connection_not_ready", needsAuth: true }, { status: 409 });
    }
    if (content.platform !== platform) return NextResponse.json({ error: "content_platform_mismatch" }, { status: 409 });
    if (!content.asset_url) return NextResponse.json({ error: "content_asset_missing" }, { status: 409 });

    const scheduledFor = body.scheduledFor ? new Date(String(body.scheduledFor)).toISOString() : content.scheduled_for;
    const shouldDispatchNow = !scheduledFor || new Date(scheduledFor).getTime() <= Date.now() + 60_000;
    const { data: job, error: insertError } = await supabase.from("publish_jobs").insert({
      business_id: content.business_id,
      content_item_id: contentItemId,
      connection_id: connectionId,
      platform,
      status: "queued",
      scheduled_for: scheduledFor || null,
    }).select("id,status,scheduled_for,created_at").single();
    if (insertError || !job) throw insertError || new Error("publish_job_insert_failed");

    await supabase.from("content_items").update({ status: scheduledFor && !shouldDispatchNow ? "scheduled" : "approved", scheduled_for: scheduledFor || null, updated_at: new Date().toISOString() }).eq("id", contentItemId);
    if (!shouldDispatchNow) return NextResponse.json({ configured: true, job, dispatched: false, next: "scheduler" });

    const dispatch = await dispatchPublish({ jobId: job.id, connectionId, contentItemId });
    if (!dispatch.configured) return NextResponse.json({ configured: true, job, dispatched: false, worker: dispatch, next: "configure_publish_worker" });
    return NextResponse.json({ configured: true, job, dispatched: true, worker: dispatch });
  } catch (error) {
    console.error("Publish queue failed", error);
    return NextResponse.json({ error: "publish_queue_failed" }, { status: 500 });
  }
}
