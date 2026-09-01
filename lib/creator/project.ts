import { normalizeForSpeech } from "@/lib/hay/normalize";
import { buildDemoStoryboard } from "@/lib/hay/storyboard";
import type { ContentStyle, Dialect, Locale } from "@/lib/hay/types";
import { generateStoryboardWithOpenAI } from "@/lib/providers/openai";
import { isVeoConfigured } from "@/lib/providers/veo";
import { buildCreatorScenes } from "./assets";
import { buildCaptionCues } from "./captions";
import type { CreatorProject } from "./types";

export async function createCreatorProject(args: {
  prompt: string;
  language: Locale;
  dialect: Dialect;
  style: ContentStyle;
  duration: number;
}): Promise<CreatorProject> {
  const storyboard =
    (await generateStoryboardWithOpenAI({
      prompt: args.prompt,
      language: args.language,
      duration: args.duration,
      style: args.style,
    })) ?? buildDemoStoryboard(args.prompt, args.language, args.duration, args.style);

  const speech = normalizeForSpeech(storyboard.voiceover, args.language, args.dialect);
  const captions = buildCaptionCues(storyboard.voiceover, args.duration);
  const scenes = buildCreatorScenes(storyboard.scenes);
  const voiceConfigured = Boolean(process.env.ELEVENLABS_API_KEY && (process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID_MALE || process.env.ELEVENLABS_VOICE_ID_FEMALE));
  const imageConfigured = Boolean(process.env.OPENAI_API_KEY);

  return {
    id: crypto.randomUUID(),
    status: "renderable",
    createdAt: new Date().toISOString(),
    brief: args.prompt,
    language: args.language,
    dialect: args.dialect,
    style: args.style,
    format: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    duration: args.duration,
    storyboard,
    speech,
    captions,
    scenes,
    voice: {
      provider: voiceConfigured ? "elevenlabs" : "none",
      status: voiceConfigured ? "planned" : "unconfigured",
      text: speech.spokenText,
    },
    render: {
      renderer: "remotion-worker",
      manifestVersion: 1,
      status: "planned",
    },
    providers: {
      planner: storyboard.generatedBy,
      image: imageConfigured ? "openai" : "unconfigured",
      video: isVeoConfigured() ? "google-veo" : "unconfigured",
      voice: voiceConfigured ? "elevenlabs" : "unconfigured",
    },
  };
}
