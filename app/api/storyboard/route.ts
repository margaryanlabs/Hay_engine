import { NextResponse } from "next/server";
import { buildDemoStoryboard } from "@/lib/hay/storyboard";
import { generateStoryboardWithOpenAI } from "@/lib/providers/openai";
import type { ContentStyle, Locale } from "@/lib/hay/types";

export async function POST(request: Request) {
  const body = await request.json();
  const prompt = String(body.prompt ?? "").trim();
  const language = (body.language ?? "hy") as Locale;
  const style = (body.style ?? "advertising") as ContentStyle;
  const duration = Math.min(60, Math.max(6, Number(body.duration) || 15));

  if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });

  const ai = await generateStoryboardWithOpenAI({ prompt, language, duration, style });
  const storyboard = ai ?? buildDemoStoryboard(prompt, language, duration, style);
  return NextResponse.json(storyboard);
}
