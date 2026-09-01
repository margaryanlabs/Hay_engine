import { NextResponse } from "next/server";
import { normalizeForSpeech } from "@/lib/hay/normalize";
import type { Dialect, Locale } from "@/lib/hay/types";

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  const locale = (body.locale ?? "hy") as Locale;
  const dialect = (body.dialect ?? "eastern") as Dialect;

  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });
  return NextResponse.json(normalizeForSpeech(text, locale, dialect));
}
