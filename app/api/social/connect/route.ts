import { NextResponse } from "next/server";
import { buildOAuthUrl, getConnectorReadiness } from "@/lib/marketing/connectors";
import type { SocialPlatform } from "@/lib/marketing/types";

const supported: SocialPlatform[] = ["instagram", "tiktok", "youtube", "facebook", "linkedin"];

export async function GET(request: Request) {
  const platform = new URL(request.url).searchParams.get("platform") as SocialPlatform | null;
  if (!platform || !supported.includes(platform)) {
    return NextResponse.json({ error: "unsupported_platform" }, { status: 400 });
  }

  const readiness = getConnectorReadiness(platform);
  const authorizationUrl = buildOAuthUrl(platform);
  return NextResponse.json({
    platform,
    configured: readiness.configured,
    missing: readiness.missing,
    permissions: readiness.permissions,
    publishing: readiness.publishing,
    appReviewRequired: readiness.appReviewRequired,
    notes: readiness.notes,
    authorizationUrl,
  });
}
