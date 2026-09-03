import { PRONUNCIATION_DICTIONARY } from "./dictionary";
import { normalizeForSpeech } from "./normalize";
import type { Dialect } from "./types";

export const HAY_PRONUNCIATION_VERSION = "hay-pron-2026.09.03-v1";

export type PronunciationEntry = {
  written: string;
  spokenHyEastern: string;
  spokenHyWestern: string;
  category: "brand" | "acronym" | "finance" | "technology" | "social" | "general";
  source: "curated-core";
  status: "active";
};

function categoryFor(written: string): PronunciationEntry["category"] {
  if (["BTC", "BITCOIN", "ETH", "ETHEREUM", "USDT", "USD", "AMD"].includes(written)) return "finance";
  if (["INSTAGRAM", "TIKTOK", "YOUTUBE", "LINKEDIN", "TELEGRAM", "WHATSAPP"].includes(written)) return "social";
  if (["AI", "API", "URL", "SEO", "SAAS", "CRM", "QR", "SMS", "OTP", "PDF"].includes(written)) return "acronym";
  if (["OPENAI", "CHATGPT", "GEMINI", "CLAUDE", "GOOGLE", "SUPABASE", "VERCEL"].includes(written)) return "technology";
  return written.length <= 4 ? "acronym" : "brand";
}

export function getPronunciationEntries(): PronunciationEntry[] {
  return Object.entries(PRONUNCIATION_DICTIONARY)
    .map(([written, spoken]) => ({
      written,
      spokenHyEastern: spoken,
      spokenHyWestern: spoken,
      category: categoryFor(written),
      source: "curated-core" as const,
      status: "active" as const,
    }))
    .sort((a, b) => a.written.localeCompare(b.written, "en"));
}

export function pronounceArmenian(text: string, dialect: Dialect = "eastern") {
  const normalized = normalizeForSpeech(text, "hy", dialect);
  return {
    version: HAY_PRONUNCIATION_VERSION,
    locale: "hy-AM",
    dialect,
    displayText: normalized.displayText,
    spokenText: normalized.spokenText,
    issues: normalized.issues,
  };
}
