import type { SocialPlatform } from "./types";

export type ConnectorDefinition = {
  platform: SocialPlatform;
  label: string;
  publishing: "direct" | "draft" | "manual";
  permissions: string[];
  env: string[];
  appReviewRequired: boolean;
  notes: string;
};

export const connectorCatalog: Record<SocialPlatform, ConnectorDefinition> = {
  instagram: {
    platform: "instagram",
    label: "Instagram",
    publishing: "direct",
    permissions: ["profile", "media insights", "content publishing"],
    env: ["META_CLIENT_ID", "META_CLIENT_SECRET", "META_REDIRECT_URI", "META_OAUTH_URL", "META_TOKEN_URL"],
    appReviewRequired: true,
    notes: "Professional/business publishing is enabled through an approved Meta app. Keep access tokens server-side.",
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    publishing: "direct",
    permissions: ["user.info.basic", "video.list", "video.publish", "video.upload"],
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
    appReviewRequired: true,
    notes: "Direct Post requires video.publish approval; unaudited clients are limited by TikTok policy.",
  },
  youtube: {
    platform: "youtube",
    label: "YouTube",
    publishing: "direct",
    permissions: ["youtube.upload", "youtube.readonly"],
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    appReviewRequired: true,
    notes: "Uploads use OAuth 2.0 on behalf of the channel owner.",
  },
  facebook: {
    platform: "facebook",
    label: "Facebook",
    publishing: "direct",
    permissions: ["page identity", "page insights", "page content publishing"],
    env: ["META_CLIENT_ID", "META_CLIENT_SECRET", "META_REDIRECT_URI", "META_OAUTH_URL", "META_TOKEN_URL"],
    appReviewRequired: true,
    notes: "Uses the same Meta app family as Instagram. Permissions depend on the approved app configuration.",
  },
  linkedin: {
    platform: "linkedin",
    label: "LinkedIn",
    publishing: "manual",
    permissions: ["organization identity", "content publishing"],
    env: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_REDIRECT_URI"],
    appReviewRequired: true,
    notes: "Adapter contract is present; organization publishing requires the relevant LinkedIn product access.",
  },
};

export function getConnectorReadiness(platform: SocialPlatform) {
  const connector = connectorCatalog[platform];
  const missing = connector.env.filter((key) => !process.env[key]);
  return { ...connector, configured: missing.length === 0, missing };
}

export function buildOAuthUrl(platform: SocialPlatform, state: string) {
  const readiness = getConnectorReadiness(platform);
  if (!readiness.configured) return null;

  if (platform === "tiktok") {
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
    url.searchParams.set("redirect_uri", process.env.TIKTOK_REDIRECT_URI!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "user.info.basic,video.list,video.publish,video.upload");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (platform === "youtube") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (platform === "instagram" || platform === "facebook") {
    const base = process.env.META_OAUTH_URL;
    if (!base) return null;
    const url = new URL(base);
    url.searchParams.set("client_id", process.env.META_CLIENT_ID!);
    url.searchParams.set("redirect_uri", process.env.META_REDIRECT_URI!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
  }

  return null;
}
