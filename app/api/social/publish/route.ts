import { NextResponse } from "next/server";
import { getConnectorReadiness } from "@/lib/marketing/connectors";
import type { PublishingJob, SocialPlatform } from "@/lib/marketing/types";

const supported: SocialPlatform[] = ["instagram", "tiktok", "youtube", "facebook", "linkedin"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const platform = body.platform as SocialPlatform;
    const contentItemId = String(body.contentItemId ?? "");
    const connectionId = String(body.connectionId ?? "");

    if (!supported.includes(platform) || !contentItemId) {
      return NextResponse.json({ error: "invalid_publish_request" }, { status: 400 });
    }

    const connector = getConnectorReadiness(platform);
    const status: PublishingJob["status"] = !connectionId || !connector.configured ? "needs_auth" : "queued";
    const job: PublishingJob = {
      id: crypto.randomUUID(),
      contentItemId,
      platform,
      status,
      scheduledFor: body.scheduledFor ? String(body.scheduledFor) : undefined,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      job,
      next: status === "queued" ? "persist_job_and_dispatch_worker" : "connect_platform_first",
      note: "This endpoint intentionally creates a publishing job. Provider tokens belong in server-side credential storage and are never accepted from browser JSON.",
    });
  } catch (error) {
    console.error("Publish queue failed", error);
    return NextResponse.json({ error: "publish_queue_failed" }, { status: 500 });
  }
}
