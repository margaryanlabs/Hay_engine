import { NextResponse } from "next/server";
import { getVoiceCatalog } from "@/lib/providers/voice-catalog";

export async function GET() {
  const voices = getVoiceCatalog().map(({ providerVoiceId: _secret, ...voice }) => voice);
  return NextResponse.json({ configured: Boolean(process.env.ELEVENLABS_API_KEY && voices.length), voices });
}
