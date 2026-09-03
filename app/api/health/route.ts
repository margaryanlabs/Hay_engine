import { NextResponse } from "next/server";
import packageJson from "@/package.json";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "HAY Engine",
      version: packageJson.version,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      status: "online",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
