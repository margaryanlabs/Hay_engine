import { NextResponse } from "next/server";
import packageJson from "@/package.json";
import { isVeoConfigured } from "@/lib/providers/veo";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getConnectorReadiness } from "@/lib/marketing/connectors";

export const runtime = "nodejs";

export async function GET() {
  const providers = {
    planner: Boolean(process.env.OPENAI_API_KEY),
    image: Boolean(process.env.OPENAI_API_KEY),
    voice: Boolean(process.env.ELEVENLABS_API_KEY && (process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID_MALE || process.env.ELEVENLABS_VOICE_ID_FEMALE)),
    video: isVeoConfigured(),
    renderWorker: Boolean(process.env.RENDER_WORKER_URL && process.env.RENDER_WORKER_SECRET),
  };
  const persistence = { supabase: isSupabaseConfigured(), admin: isSupabaseAdminConfigured() };
  const social = Object.fromEntries((["instagram","tiktok","youtube","facebook"] as const).map(platform => {
    const ready = getConnectorReadiness(platform);
    return [platform, { configured: ready.configured, publishing: ready.publishing, missing: ready.missing }];
  }));

  return NextResponse.json({
    ok: true,
    service: "HAY Engine",
    version: packageJson.version,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    armenianPriority: true,
    locales: ["hy", "en", "ru"],
    providers,
    persistence,
    social,
    mode: providers.planner || providers.voice || providers.video ? "provider-enabled" : "demo",
  });
}
