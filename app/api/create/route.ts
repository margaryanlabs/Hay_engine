import { NextResponse } from "next/server";
import { createCreatorProject } from "@/lib/creator/project";
import type { ContentStyle, Dialect, Locale } from "@/lib/hay/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    const language = (body.language ?? "hy") as Locale;
    const dialect = (body.dialect ?? "eastern") as Dialect;
    const style = (body.style ?? "advertising") as ContentStyle;
    const duration = Math.min(60, Math.max(6, Number(body.duration) || 15));

    if (!prompt) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
    if (!["hy", "en", "ru"].includes(language)) return NextResponse.json({ error: "unsupported_language" }, { status: 400 });

    const project = await createCreatorProject({ prompt, language, dialect, style, duration });
    return NextResponse.json(project);
  } catch (error) {
    console.error("Creator project generation failed", error);
    return NextResponse.json({ error: "creator_generation_failed" }, { status: 500 });
  }
}
