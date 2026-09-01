import { NextResponse } from "next/server";
import type { SocialPlatform } from "@/lib/marketing/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { dispatchPublish } from "@/lib/publish/client";

export const runtime = "nodejs";
const supported: SocialPlatform[] = ["instagram", "tiktok", "youtube", "facebook", "linkedin"];

function sanitizeProviderSettings(platform: SocialPlatform, value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (platform === "tiktok") {
    const privacy = typeof input.privacy_level === "string" ? input.privacy_level : "";
    const consentAt = typeof input.consent_at === "string" ? input.consent_at : "";
    const creatorInfoFetchedAt = typeof input.creator_info_fetched_at === "string" ? input.creator_info_fetched_at : "";
    if (!privacy || !consentAt || !creatorInfoFetchedAt || typeof input.disable_comment !== "boolean" || typeof input.disable_duet !== "boolean" || typeof input.disable_stitch !== "boolean") {
      return { error: "tiktok_publish_approval_required" as const };
    }
    return {
      value: {
        privacy_level: privacy,
        disable_comment: input.disable_comment,
        disable_duet: input.disable_duet,
        disable_stitch: input.disable_stitch,
        consent_at: consentAt,
        creator_info_fetched_at: creatorInfoFetchedAt,
        ...(typeof input.brand_content_toggle === "boolean" ? { brand_content_toggle: input.brand_content_toggle } : {}),
        ...(typeof input.brand_organic_toggle === "boolean" ? { brand_organic_toggle: input.brand_organic_toggle } : {}),
      },
    };
  }
  if (platform === "youtube") {
    const privacy = ["private", "unlisted", "public"].includes(String(input.privacyStatus)) ? String(input.privacyStatus) : "private";
    return { value: { privacyStatus: privacy, ...(typeof input.title === "string" ? { title: input.title.slice(0, 100) } : {}) } };
  }
  if (platform === "instagram") return { value: { share_to_feed: input.share_to_feed !== false } };
  return { value: {} };
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ configured: false, message: "Supabase is required for publishing jobs." });
    const body = await request.json();
    const platform = body.platform as SocialPlatform;
    const contentItemId = String(body.contentItemId ?? "");
    const connectionId = String(body.connectionId ?? "");
    if (!supported.includes(platform) || !contentItemId || !connectionId) return NextResponse.json({ error: "invalid_publish_request" }, { status: 400 });

    const settings = sanitizeProviderSettings(platform, body.providerSettings);
    if ("error" in settings) return NextResponse.json({ error: settings.error, needsApproval: true }, { status: 422 });

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
      provider_settings: settings.value,
    }).select("id,status,scheduled_for,created_at,provider_settings").single();
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
