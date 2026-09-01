import OpenAI from "openai";
import { inspectPublicSite } from "./site-inspect";
import type { BusinessProfile, CompetitorInput, CompetitorSignal } from "./types";

export type CompetitorEvidence = {
  name: string;
  url?: string;
  handle?: string;
  platform?: string;
  available: boolean;
  title?: string;
  description?: string;
  textExcerpt?: string;
  error?: string;
};

function normalizeCompetitorInput(competitor: CompetitorInput) {
  const rawName = competitor.name.trim();
  const [labelPart, urlPart] = rawName.split("|").map(part => part.trim());
  const directUrl = /^https?:\/\//i.test(rawName) ? rawName : undefined;
  const embeddedUrl = urlPart && /^https?:\/\//i.test(urlPart) ? urlPart : undefined;
  const url = competitor.url || embeddedUrl || directUrl;
  let name = embeddedUrl ? labelPart : rawName;
  if (directUrl) {
    try { name = new URL(directUrl).hostname.replace(/^www\./, ""); } catch { name = rawName; }
  }
  return { ...competitor, name: name || rawName, url };
}

export async function collectCompetitorEvidence(competitors: CompetitorInput[], limit = 4): Promise<CompetitorEvidence[]> {
  const selected = competitors.slice(0, Math.max(0, Math.min(limit, 5))).map(normalizeCompetitorInput);
  return Promise.all(selected.map(async competitor => {
    const base: CompetitorEvidence = {
      name: competitor.name,
      url: competitor.url,
      handle: competitor.handle,
      platform: competitor.platform,
      available: false,
    };
    if (!competitor.url) return { ...base, error: "url_missing" };
    try {
      const snapshot = await inspectPublicSite(competitor.url);
      return {
        ...base,
        available: true,
        url: snapshot.url,
        title: snapshot.title,
        description: snapshot.description,
        textExcerpt: snapshot.text.slice(0, 2800),
      };
    } catch (error) {
      console.warn(`Competitor inspection skipped: ${competitor.name}`, error);
      return { ...base, error: "site_unavailable" };
    }
  }));
}

export function evidenceForPrompt(evidence: CompetitorEvidence[]) {
  return evidence.map(item => ({
    name: item.name,
    url: item.url,
    handle: item.handle,
    platform: item.platform,
    available: item.available,
    title: item.title,
    description: item.description,
    textExcerpt: item.textExcerpt,
  }));
}

function fallbackSignal(business: BusinessProfile, item: CompetitorEvidence): CompetitorSignal {
  const clue = item.description || item.title || item.textExcerpt?.slice(0, 180) || item.name;
  if (business.primaryLanguage === "hy") return {
    name: item.name,
    strength: item.available ? `Հստակ ներկայություն․ ${clue}` : "Հանրային կայքի տվյալները հասանելի չեն։",
    gap: "Ստուգել՝ արդյոք բրենդը բավարար չափով ցույց է տալիս իրական ապացույց, մարդկանց, տարբերակիչ առաջարկ և տեղական կոնտեքստ։",
    opportunity: `${business.name}-ը կարող է վերցնել ավելի հստակ դիրքավորում, ավելի բնական հայերեն և proof-led կոնտենտ, քան ${item.name}-ը։`,
  };
  if (business.primaryLanguage === "ru") return {
    name: item.name,
    strength: item.available ? `Публичное позиционирование: ${clue}` : "Публичные данные сайта недоступны.",
    gap: "Проверить, насколько конкурент показывает реальные доказательства, людей, уникальный оффер и локальный контекст.",
    opportunity: `${business.name} может занять более чёткую позицию и строить более доказательный контент, чем ${item.name}.`,
  };
  return {
    name: item.name,
    strength: item.available ? `Public positioning signal: ${clue}` : "Public website evidence is unavailable.",
    gap: "Test whether the competitor underuses proof, people, differentiated offers and local context.",
    opportunity: `${business.name} can own a sharper, more proof-led point of view than ${item.name}.`,
  };
}

function parseSignals(raw: string, fallback: CompetitorSignal[]) {
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as { competitors?: unknown };
    if (!Array.isArray(parsed.competitors)) return fallback;
    return parsed.competitors.slice(0, fallback.length).map((value, index) => {
      const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const base = fallback[index];
      const pick = (key: string, backup: string) => typeof row[key] === "string" && String(row[key]).trim() ? String(row[key]).trim() : backup;
      return { name: pick("name", base.name), strength: pick("strength", base.strength), gap: pick("gap", base.gap), opportunity: pick("opportunity", base.opportunity) };
    });
  } catch {
    return fallback;
  }
}

export async function analyzeCompetitorEvidence(business: BusinessProfile, evidence: CompetitorEvidence[]): Promise<CompetitorSignal[]> {
  const fallback = evidence.map(item => fallbackSignal(business, item));
  if (!evidence.length || !process.env.OPENAI_API_KEY) return fallback;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const language = business.primaryLanguage === "hy" ? "idiomatic Eastern Armenian" : business.primaryLanguage === "ru" ? "Russian" : "English";
    const response = await client.responses.create({
      model: process.env.OPENAI_MARKETING_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna",
      reasoning: { effort: "low" },
      input: `You are the competitor intelligence layer inside HAY Marketing OS.\n\nCompare the supplied PUBLIC website evidence against the user's business. Do not invent traffic, revenue, follower counts, market share or facts absent from evidence. Distinguish observable evidence from strategic inference. Focus on positioning, offer clarity, proof/trust, content angles, audience language and differentiation. Answer in ${language}.\n\nBUSINESS:\n${JSON.stringify(business)}\n\nPUBLIC COMPETITOR EVIDENCE:\n${JSON.stringify(evidenceForPrompt(evidence))}\n\nReturn ONLY JSON:\n{"competitors":[{"name":"","strength":"","gap":"","opportunity":""}]}\nOne entry per supplied competitor. Keep each field concise and actionable.`,
    });
    return parseSignals(response.output_text, fallback);
  } catch (error) {
    console.error("Competitor intelligence generation failed", error);
    return fallback;
  }
}

export function competitorContextForPlan(evidence: CompetitorEvidence[], signals: CompetitorSignal[]) {
  if (!evidence.length) return "";
  return `\n\nHAY COMPETITOR INTELLIGENCE (derived from public evidence; do not invent missing metrics):\n${JSON.stringify({ evidence: evidenceForPrompt(evidence), signals })}`;
}
