export type HayVoice = {
  id: string;
  label: string;
  gender: "male" | "female" | "neutral";
  dialect: "eastern" | "western" | "general";
  providerVoiceId: string;
};

export function getVoiceCatalog(): HayVoice[] {
  const candidates: Array<[string, string, HayVoice["gender"], HayVoice["dialect"], string | undefined]> = [
    ["primary", "HAY Signature", "neutral", "general", process.env.ELEVENLABS_VOICE_ID],
    ["male", "HAY Deep", "male", "eastern", process.env.ELEVENLABS_VOICE_ID_MALE],
    ["female", "HAY Clear", "female", "eastern", process.env.ELEVENLABS_VOICE_ID_FEMALE],
    ["western", "HAY Western", "neutral", "western", process.env.ELEVENLABS_VOICE_ID_WESTERN],
  ];
  return candidates.filter((item): item is [string, string, HayVoice["gender"], HayVoice["dialect"], string] => Boolean(item[4])).map(([id, label, gender, dialect, providerVoiceId]) => ({ id, label, gender, dialect, providerVoiceId }));
}

export function resolveVoice(id?: string) {
  const voices = getVoiceCatalog();
  return voices.find((voice) => voice.id === id) ?? voices[0] ?? null;
}
