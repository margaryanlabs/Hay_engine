import OpenAI from "openai";
import type { ContentStyle, Locale, Storyboard } from "@/lib/hay/types";

function extractJson(raw: string) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function generateStoryboardWithOpenAI(args: {
  prompt: string;
  language: Locale;
  duration: number;
  style: ContentStyle;
}): Promise<Storyboard | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const languageName = args.language === "hy" ? "Armenian" : args.language === "ru" ? "Russian" : "English";

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      input: `You are the creative planning layer inside HAY Engine, an Armenian-first creator platform.\n\nCreate a ${args.duration}-second ${args.style} vertical Reel storyboard in ${languageName}. Armenian must be idiomatic Eastern Armenian by default, not literal translation. Preserve brand names such as HAY Engine where appropriate.\n\nUser brief: ${args.prompt}\n\nReturn ONLY valid JSON with this exact shape:\n{"title":"...","hook":"...","voiceover":"...","cta":"...","scenes":[{"id":"s1","start":0,"end":3,"visual":"...","screenText":"...","voiceover":"..."}]}\nUse 4-6 scenes. Scene timings must cover the full duration.`,
    });

    const parsed = extractJson(response.output_text) as Omit<Storyboard, "language" | "duration" | "generatedBy">;
    return {
      ...parsed,
      language: args.language,
      duration: args.duration,
      generatedBy: "openai",
    };
  } catch (error) {
    console.error("OpenAI storyboard generation failed", error);
    return null;
  }
}
