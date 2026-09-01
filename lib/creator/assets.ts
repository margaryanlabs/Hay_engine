import type { StoryboardScene } from "@/lib/hay/types";
import type { CreatorScene, SceneAssetPlan } from "./types";

function chooseKind(scene: StoryboardScene, index: number): SceneAssetPlan["kind"] {
  const text = `${scene.visual} ${scene.screenText}`.toLowerCase();
  if (index === 0 || /typography|title|text|data|interface|ui|chart/.test(text)) return "motion";
  if (/brand|logo|reveal|cta/.test(text)) return "brand";
  if (/cinematic|city|restaurant|product|portrait|landscape|interior|food/.test(text)) return "generated-image";
  return "stock";
}

export function buildCreatorScenes(scenes: StoryboardScene[]): CreatorScene[] {
  return scenes.map((scene, index) => {
    const kind = chooseKind(scene, index);
    const typographyOverlay = Boolean(scene.screenText.trim());
    const prompt = [
      scene.visual,
      "vertical 9:16 composition",
      "premium cinematic commercial lighting",
      "clean composition with safe negative space for Armenian typography",
      "no text, no letters, no captions, no logos, no watermarks",
    ].join(", ");

    return {
      ...scene,
      asset: {
        kind,
        prompt,
        searchQuery: scene.visual,
        status: kind === "motion" || kind === "brand" ? "ready" : "planned",
        typographyOverlay,
      },
      transition: index === 0 ? "cut" : index % 3 === 0 ? "push" : "fade",
    };
  });
}
