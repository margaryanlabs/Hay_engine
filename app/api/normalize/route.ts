import { NextResponse } from "next/server";
import { currentPronunciationOwner, normalizeWithPronunciationRegistry } from "@/lib/hay/pronunciation-store";
import type { Dialect, Locale } from "@/lib/hay/types";

export const runtime="nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  const locale = (["hy","en","ru"].includes(String(body.locale))?body.locale:"hy") as Locale;
  const dialect = (body.dialect === "western" ? "western" : "eastern") as Dialect;
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });

  const owner=await currentPronunciationOwner();
  const businessId=typeof body.businessId==="string"?body.businessId:null;
  const result=await normalizeWithPronunciationRegistry({text,locale,dialect,ownerId:owner?.ownerId,businessId});
  return NextResponse.json({registryVersion:result.registry.version,registry:result.registry,...result.normalized});
}
