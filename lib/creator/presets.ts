import type { ContentStyle } from "@/lib/hay/types";

export type CreatorPresetId = "ad" | "restaurant" | "real-estate" | "product" | "news" | "finance" | "blogger";

export type CreatorPreset = {
  id: CreatorPresetId;
  label: { hy: string; en: string; ru: string };
  style: ContentStyle;
  duration: 10 | 15 | 30;
  instruction: string;
  visualLanguage: string;
};

export const creatorPresets: CreatorPreset[] = [
  { id: "ad", label: { hy: "Գովազդ", en: "Ad", ru: "Реклама" }, style: "advertising", duration: 15, instruction: "Create a high-retention vertical ad with one clear promise, proof and CTA.", visualLanguage: "premium editorial, product-first, restrained motion, exact typography overlay" },
  { id: "restaurant", label: { hy: "Ռեստորան", en: "Restaurant", ru: "Ресторан" }, style: "advertising", duration: 15, instruction: "Sell atmosphere, food detail and a reason to visit; avoid generic stock hospitality language.", visualLanguage: "warm tactile food cinematography, local materials, human hospitality, Armenia-specific detail" },
  { id: "real-estate", label: { hy: "Անշարժ գույք", en: "Real estate", ru: "Недвижимость" }, style: "business", duration: 15, instruction: "Present place, value, location and investor/lifestyle angle with credible claims only.", visualLanguage: "architectural editorial, slow camera, maps/data as deterministic overlays" },
  { id: "product", label: { hy: "Ապրանք", en: "Product", ru: "Продукт" }, style: "advertising", duration: 15, instruction: "Make the product the hero and build a visual reason to want it.", visualLanguage: "studio object cinematography, macro detail, clean negative space" },
  { id: "news", label: { hy: "Նորություններ", en: "News", ru: "Новости" }, style: "news", duration: 30, instruction: "Explain one development fast, separate fact from interpretation and make sources visually legible.", visualLanguage: "editorial newsroom, clean data cards, documentary media" },
  { id: "finance", label: { hy: "Ֆինանսներ", en: "Finance", ru: "Финансы" }, style: "business", duration: 15, instruction: "Lead with a decision-relevant fact, show data context and avoid guaranteed-return language.", visualLanguage: "institutional dark data aesthetic, charts, restrained signal graphics" },
  { id: "blogger", label: { hy: "Բլոգեր", en: "Creator", ru: "Блогер" }, style: "social", duration: 15, instruction: "Build a repeatable faceless or personality-led social format with a sharp hook and recognizable series structure.", visualLanguage: "fast editorial collage, kinetic typography, platform-native pacing" },
];

export function getCreatorPreset(id?: string) {
  return creatorPresets.find((preset) => preset.id === id) ?? creatorPresets[0];
}
