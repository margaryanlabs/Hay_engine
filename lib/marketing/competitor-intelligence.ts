import { inspectPublicSite } from "./site-inspect";
import type { CompetitorInput } from "./types";

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

export async function collectCompetitorEvidence(competitors: CompetitorInput[], limit = 4): Promise<CompetitorEvidence[]> {
  const selected = competitors.slice(0, Math.max(0, Math.min(limit, 5)));
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
