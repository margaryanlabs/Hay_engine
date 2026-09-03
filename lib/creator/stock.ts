import "server-only";

import type { Locale } from "@/lib/hay/types";
import { isPexelsConfigured, searchPexelsStock } from "@/lib/providers/pexels";
import type { CreatorScene } from "./types";

const MAX_STOCK_SEARCHES_PER_PROJECT = 3;

export async function resolveCreatorStockMedia(scenes: CreatorScene[], locale: Locale) {
  if (!isPexelsConfigured()) return scenes;
  let searches = 0;
  const resolved: CreatorScene[] = [];

  for (const scene of scenes) {
    if (scene.asset.kind !== "stock" || searches >= MAX_STOCK_SEARCHES_PER_PROJECT) {
      resolved.push(scene);
      continue;
    }

    searches += 1;
    const stock = await searchPexelsStock({
      query: scene.asset.searchQuery,
      locale,
      minDuration: Math.max(1, scene.end - scene.start),
    });
    resolved.push(stock ? {
      ...scene,
      asset: { ...scene.asset, stock, status: "ready" },
    } : scene);
  }

  return resolved;
}
