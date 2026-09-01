import type { ContentStyle, Dialect, Locale, NormalizationResult, Storyboard } from "@/lib/hay/types";

export type AssetKind = "generated-image" | "generated-video" | "stock" | "motion" | "brand";
export type AssetStatus = "planned" | "ready" | "failed";

export type CaptionCue = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type SceneAssetPlan = {
  kind: AssetKind;
  prompt: string;
  searchQuery: string;
  status: AssetStatus;
  typographyOverlay: boolean;
};

export type CreatorScene = {
  id: string;
  start: number;
  end: number;
  visual: string;
  screenText: string;
  voiceover: string;
  asset: SceneAssetPlan;
  transition: "cut" | "fade" | "push" | "zoom";
};

export type CreatorProject = {
  id: string;
  status: "planned" | "renderable" | "rendered" | "failed";
  createdAt: string;
  brief: string;
  language: Locale;
  dialect: Dialect;
  style: ContentStyle;
  format: "9:16";
  width: 1080;
  height: 1920;
  fps: 30;
  duration: number;
  storyboard: Storyboard;
  speech: NormalizationResult;
  captions: CaptionCue[];
  scenes: CreatorScene[];
  voice: {
    provider: "elevenlabs" | "none";
    status: "planned" | "ready" | "unconfigured";
    text: string;
  };
  render: {
    renderer: "remotion-worker";
    manifestVersion: 1;
    status: "planned" | "ready" | "rendered";
  };
  providers: {
    planner: "openai" | "hay-demo";
    image: "openai" | "unconfigured";
    video: "adapter-ready";
    voice: "elevenlabs" | "unconfigured";
  };
};
