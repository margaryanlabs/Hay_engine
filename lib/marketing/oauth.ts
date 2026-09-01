import "server-only";
import type { OAuthCredential } from "./credentials";
import type { SocialPlatform } from "./types";

function expiry(expiresIn?: number) {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined;
}

async function tokenRequest(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* provider may return form-encoded errors */ }
  if (!response.ok) throw new Error(`oauth_exchange_${response.status}:${text.slice(0, 350)}`);
  return data;
}

export async function exchangeOAuthCode(platform: SocialPlatform, code: string): Promise<OAuthCredential> {
  if (platform === "tiktok") {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
    });
    const data = await tokenRequest("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return {
      accessToken: String(data.access_token || ""),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      expiresAt: expiry(Number(data.expires_in) || undefined),
      scope: data.scope ? String(data.scope) : undefined,
      accountId: data.open_id ? String(data.open_id) : undefined,
      tokenType: data.token_type ? String(data.token_type) : undefined,
    };
  }

  if (platform === "youtube") {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    });
    const data = await tokenRequest("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return {
      accessToken: String(data.access_token || ""),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      expiresAt: expiry(Number(data.expires_in) || undefined),
      scope: data.scope ? String(data.scope) : undefined,
      tokenType: data.token_type ? String(data.token_type) : undefined,
    };
  }

  if (platform === "instagram" || platform === "facebook") {
    const tokenUrl = process.env.META_TOKEN_URL;
    if (!tokenUrl) throw new Error("meta_token_url_unconfigured");
    const mode = process.env.META_TOKEN_MODE || "facebook";
    let data: Record<string, unknown>;
    if (mode === "instagram") {
      const body = new URLSearchParams({
        client_id: process.env.META_CLIENT_ID!,
        client_secret: process.env.META_CLIENT_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: process.env.META_REDIRECT_URI!,
        code,
      });
      data = await tokenRequest(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    } else {
      const url = new URL(tokenUrl);
      url.searchParams.set("client_id", process.env.META_CLIENT_ID!);
      url.searchParams.set("client_secret", process.env.META_CLIENT_SECRET!);
      url.searchParams.set("redirect_uri", process.env.META_REDIRECT_URI!);
      url.searchParams.set("code", code);
      data = await tokenRequest(url.toString(), { method: "GET" });
    }
    return {
      accessToken: String(data.access_token || ""),
      expiresAt: expiry(Number(data.expires_in) || undefined),
      tokenType: data.token_type ? String(data.token_type) : undefined,
    };
  }

  throw new Error("oauth_exchange_not_implemented");
}
