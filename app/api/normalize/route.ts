import { NextResponse } from "next/server";
import { normalizeForSpeech } from "@/lib/hay/normalize";
import { currentPronunciationOwner, loadPersistentPronunciations } from "@/lib/hay/pronunciation-store";
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
  const layer=locale==="hy"?await loadPersistentPronunciations({ownerId:owner?.ownerId,businessId,dialect}):{configured:false,entries:[],overrides:{},version:"core",validBusiness:false};
  return NextResponse.json({registryVersion:layer.version,...normalizeForSpeech(text, locale, dialect,layer.overrides)});
}
