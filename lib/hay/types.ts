export type Locale = "hy" | "en" | "ru";
export type Dialect = "eastern" | "western";
export type ContentStyle = "advertising" | "business" | "social" | "news" | "formal" | "casual";

export type NormalizationIssue = {
  kind: "brand" | "acronym" | "number" | "currency" | "code-switch";
  source: string;
  spoken: string;
};

export type NormalizationResult = {
  displayText: string;
  spokenText: string;
  locale: Locale;
  dialect: Dialect;
  issues: NormalizationIssue[];
};

export type StoryboardScene = {
  id: string;
  start: number;
  end: number;
  visual: string;
  screenText: string;
  voiceover: string;
};

export type Storyboard = {
  title: string;
  language: Locale;
  duration: number;
  hook: string;
  voiceover: string;
  cta: string;
  scenes: StoryboardScene[];
  generatedBy: "hay-demo" | "openai";
};
