import { NextResponse } from "next/server";
import { getCommercialContext } from "@/lib/commercial/entitlements";

export const runtime = "nodejs";

export async function GET() {
  const context = await getCommercialContext();
  if (context.configured && !context.authenticated) {
    return NextResponse.json({ error: "unauthorized", ...context }, { status: 401 });
  }
  return NextResponse.json(context, {
    headers: { "Cache-Control": "no-store" },
  });
}
