import { NextResponse } from "next/server";
import { isVeoConfigured } from "@/lib/providers/veo";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getConnectorReadiness } from "@/lib/marketing/connectors";
import { isPublishWorkerConfigured } from "@/lib/publish/client";

export const runtime = "nodejs";

export async function GET() {
  const supabase = isSupabaseConfigured();
  const admin = isSupabaseAdminConfigured();
  const providers = {
    strategy: Boolean(process.env.OPENAI_API_KEY),
    image: Boolean(process.env.OPENAI_API_KEY),
    voice: Boolean(process.env.ELEVENLABS_API_KEY && (process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID_MALE || process.env.ELEVENLABS_VOICE_ID_FEMALE)),
    video: isVeoConfigured(),
  };
  const workers = {
    render: Boolean(process.env.RENDER_WORKER_URL && process.env.RENDER_WORKER_SECRET),
    publish: isPublishWorkerConfigured(),
  };
  const social = Object.fromEntries((["instagram", "tiktok", "youtube", "facebook"] as const).map(platform => {
    const readiness = getConnectorReadiness(platform);
    return [platform, { configured: readiness.configured, missing: readiness.missing, appReviewRequired: readiness.appReviewRequired }];
  }));
  const coreReady = providers.strategy && supabase && admin;
  const marketingReady = coreReady && workers.publish;

  return NextResponse.json({
    service: "HAY Engine",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    mode: supabase ? "persistent" : "demo",
    coreReady,
    marketingReady,
    persistence: { supabase, admin },
    providers,
    workers,
    social,
    blockers: [
      ...(!supabase ? ["dedicated_supabase_required"] : []),
      ...(!providers.strategy ? ["openai_key_required_for_ai_strategy"] : []),
      ...(!workers.publish ? ["publish_worker_required_for_automatic_posting"] : []),
    ],
  });
}
