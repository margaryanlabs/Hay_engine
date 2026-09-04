import "server-only";

import { googleChirp3TranscriptionReadiness, isGoogleChirp3TranscriptionConfigured, transcribeWithGoogleChirp3 } from "@/lib/providers/google-chirp3-transcription";
import { isOpenAITranscriptionConfigured, transcribeWithOpenAI } from "@/lib/providers/openai-transcription";

export type TranscriptionProviderId = "openai" | "google-chirp3";
export type TranscriptionProviderChoice = TranscriptionProviderId | "auto";

export function defaultTranscriptionProvider(): TranscriptionProviderChoice {
  const value = String(process.env.HAY_TRANSCRIPTION_PROVIDER || "openai").trim().toLowerCase();
  if (value === "google-chirp3" || value === "google" || value === "chirp3" || value === "chirp_3") return "google-chirp3";
  if (value === "auto") return "auto";
  return "openai";
}

export function transcriptionProviderReadiness() {
  return {
    default: defaultTranscriptionProvider(),
    openai: {
      configured: isOpenAITranscriptionConfigured(),
      model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe",
    },
    googleChirp3: googleChirp3TranscriptionReadiness(),
  };
}

export function isAnyTranscriptionProviderConfigured() {
  const selected = defaultTranscriptionProvider();
  if (selected === "openai") return isOpenAITranscriptionConfigured();
  if (selected === "google-chirp3") return isGoogleChirp3TranscriptionConfigured();
  return isOpenAITranscriptionConfigured() || isGoogleChirp3TranscriptionConfigured();
}

function normalizeRequestedProvider(value: unknown): TranscriptionProviderChoice | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "openai") return "openai";
  if (raw === "google-chirp3" || raw === "google" || raw === "chirp3" || raw === "chirp_3") return "google-chirp3";
  if (raw === "auto") return "auto";
  return null;
}

function chooseAuto(language?: string): TranscriptionProviderId | null {
  const normalized = String(language || "hy").trim().toLowerCase();
  if ((normalized === "hy" || normalized === "hy-am") && isGoogleChirp3TranscriptionConfigured()) return "google-chirp3";
  if (isOpenAITranscriptionConfigured()) return "openai";
  if (isGoogleChirp3TranscriptionConfigured()) return "google-chirp3";
  return null;
}

export function resolveTranscriptionProvider(requested?: unknown, language?: string): TranscriptionProviderId | null {
  const choice = normalizeRequestedProvider(requested) || defaultTranscriptionProvider();
  if (choice === "auto") return chooseAuto(language);
  if (choice === "openai") return isOpenAITranscriptionConfigured() ? "openai" : null;
  return isGoogleChirp3TranscriptionConfigured() ? "google-chirp3" : null;
}

export async function transcribeWithConfiguredProvider(args: {
  bytes: Uint8Array;
  filename: string;
  contentType?: string;
  language?: string;
  provider?: unknown;
}) {
  const provider = resolveTranscriptionProvider(args.provider, args.language);
  if (!provider) return null;
  if (provider === "google-chirp3") {
    return transcribeWithGoogleChirp3({ bytes: args.bytes, language: args.language });
  }
  return transcribeWithOpenAI({
    bytes: args.bytes,
    filename: args.filename,
    contentType: args.contentType,
    language: args.language,
  });
}
