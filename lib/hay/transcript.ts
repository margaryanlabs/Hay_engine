import OpenAI from "openai";
import { cleanLanguageText, extractProtectedTokens, preservesProtectedTokens } from "./protected-values";

export async function correctArmenianTranscript(text: string) {
  const fallback = cleanLanguageText(text);
  if (!fallback) return { text:"", generatedBy:"rules" as const, protectedTokens:[] as string[] };
  const tokens = extractProtectedTokens(fallback);
  if (!process.env.OPENAI_API_KEY) return { text:fallback, generatedBy:"rules" as const, protectedTokens:tokens };

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_TRANSCRIPT_CORRECTION_MODEL || process.env.OPENAI_MARKETING_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna",
      reasoning: { effort:"low" },
      input: `You are HAY Armenian Transcript Corrector. Clean a raw speech-to-text transcript into accurate contemporary Eastern Armenian.\n\nHard rules:\n- Preserve the speaker's meaning. Never add claims or information.\n- Preserve every number, price, percentage, date, ticker, URL, Latin-script brand/product/person token and meaningful Armenian/Russian/English code-switch exactly.\n- Correct obvious ASR punctuation, spacing, casing and Armenian grammatical endings only when the intended form is clear.\n- Do not translate natural code-switching into Armenian.\n- Do not turn spoken Armenian into formal bureaucratic Armenian.\n- Do not invent slang.\n- Return only the corrected transcript.\n\nRAW TRANSCRIPT:\n${fallback}`,
    });
    const candidate = cleanLanguageText(response.output_text || "");
    if (!candidate || !preservesProtectedTokens(fallback,candidate)) {
      return { text:fallback, generatedBy:"rules" as const, protectedTokens:tokens, rejectedAiCorrection:true };
    }
    return { text:candidate, generatedBy:"openai" as const, protectedTokens:tokens };
  } catch (error) {
    console.error("Armenian transcript correction failed",error);
    return { text:fallback, generatedBy:"rules" as const, protectedTokens:tokens };
  }
}
