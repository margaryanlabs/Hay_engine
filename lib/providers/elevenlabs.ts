export type ElevenLabsAlignment = {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
};

export type ElevenLabsSpeechResult = {
  audioBase64: string;
  alignment: ElevenLabsAlignment | null;
  contentType: string;
};

export async function createArmenianSpeech(text: string): Promise<ElevenLabsSpeechResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return null;

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.25,
        speed: 0.98,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  return {
    audioBase64: data.audio_base64,
    alignment: data.alignment ?? data.normalized_alignment ?? null,
    contentType: "audio/mpeg",
  };
}
