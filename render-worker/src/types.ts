export type CaptionCue = { id: string; start: number; end: number; text: string };

export type RenderScene = {
  id: string;
  start: number;
  end: number;
  visual: string;
  screenText: string;
  voiceover: string;
  asset: {
    kind: string;
    prompt: string;
    searchQuery: string;
    status: string;
    typographyOverlay: boolean;
  };
};

export type RenderProject = {
  id: string;
  language: "hy" | "en" | "ru";
  duration: number;
  format: "9:16";
  width: number;
  height: number;
  fps: number;
  storyboard: { hook: string; cta: string };
  captions: CaptionCue[];
  scenes: RenderScene[];
};

export type RenderInput = {
  project: RenderProject;
  sceneImages?: Record<string, string>;
  audioSrc?: string;
};
