import { NextResponse } from "next/server";
import { getPronunciationEntries, HAY_PRONUNCIATION_VERSION } from "@/lib/hay/pronunciation-registry";
import { currentPronunciationOwner, normalizeWithPronunciationRegistry, pronunciationRegistryReady } from "@/lib/hay/pronunciation-store";
import type { Dialect } from "@/lib/hay/types";

export const runtime = "nodejs";

export async function GET() {
  const entries = getPronunciationEntries();
  return NextResponse.json({
    version: HAY_PRONUNCIATION_VERSION,
    locale: "hy-AM",
    entries,
    count: entries.length,
    persistentRegistryReady:await pronunciationRegistryReady(),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });
  const dialect: Dialect = body.dialect === "western" ? "western" : "eastern";
  const owner=await currentPronunciationOwner();
  const businessId=typeof body.businessId==="string"?body.businessId:null;
  const result=await normalizeWithPronunciationRegistry({text,locale:"hy",dialect,ownerId:owner?.ownerId,businessId});
  const version=result.registry.version!=="core"?`${HAY_PRONUNCIATION_VERSION}+${result.registry.version}`:HAY_PRONUNCIATION_VERSION;
  return NextResponse.json({
    version,
    ...result.normalized,
    registry:result.registry,
  });
}
