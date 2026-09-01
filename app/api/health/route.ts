import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const providers = {
    planner: Boolean(process.env.OPENAI_API_KEY),
    image: Boolean(process.env.OPENAI_API_KEY),
    voice: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
    video: false,
  };

  return NextResponse.json({
    ok: true,
    service: "HAY Engine",
    version: "0.2.0",
    armenianPriority: true,
    locales: ["hy", "en", "ru"],
    providers,
    mode: providers.planner || providers.voice ? "provider-enabled" : "demo",
  });
}
