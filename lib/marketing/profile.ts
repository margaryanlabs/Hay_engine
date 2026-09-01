import "server-only";
import type { OAuthCredential } from "./credentials";
import type { SocialPlatform } from "./types";

export type EnrichedSocialCredential = OAuthCredential & {
  accountName?: string;
};

async function getJson(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* provider returned non-json */ }
  if (!response.ok) throw new Error(`social_profile_${response.status}:${text.slice(0, 300)}`);
  return data;
}

function graphUrl(path: string) {
  const version = process.env.META_GRAPH_VERSION || "v25.0";
  return `https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`;
}

export async function enrichOAuthCredential(platform: SocialPlatform, credential: OAuthCredential): Promise<EnrichedSocialCredential> {
  try {
    if (platform === "tiktok") {
      const data = await getJson(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name",
        credential.accessToken,
      );
      const user = (data.data as { user?: Record<string, unknown> } | undefined)?.user;
      if (!user) return credential;
      return {
        ...credential,
        accountId: String(user.open_id || credential.accountId || "") || undefined,
        accountName: user.display_name ? String(user.display_name) : undefined,
        providerData: { ...(credential.providerData || {}), user },
      };
    }

    if (platform === "youtube") {
      const data = await getJson(
        "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true&maxResults=1",
        credential.accessToken,
      );
      const channel = Array.isArray(data.items) ? data.items[0] as Record<string, unknown> | undefined : undefined;
      const snippet = channel?.snippet as Record<string, unknown> | undefined;
      return {
        ...credential,
        accountId: channel?.id ? String(channel.id) : credential.accountId,
        accountName: snippet?.title ? String(snippet.title) : undefined,
        providerData: channel ? { ...(credential.providerData || {}), channel } : credential.providerData,
      };
    }

    if (platform === "instagram" || platform === "facebook") {
      const mode = process.env.META_TOKEN_MODE || "facebook";
      if (mode === "instagram") {
        const explicit = process.env.META_PROFILE_URL;
        const profileUrl = explicit || "https://graph.instagram.com/me?fields=user_id,username";
        const data = await getJson(profileUrl, credential.accessToken);
        return {
          ...credential,
          accountId: String(data.user_id || data.id || credential.accountId || "") || undefined,
          accountName: data.username ? String(data.username) : undefined,
          providerData: { ...(credential.providerData || {}), profile: data },
        };
      }

      // Facebook Login path: resolve managed Page + linked Instagram professional account.
      const data = await getJson(
        graphUrl("me/accounts?fields=id,name,access_token,instagram_business_account{id,username}"),
        credential.accessToken,
      );
      const pages = Array.isArray(data.data) ? data.data as Array<Record<string, unknown>> : [];
      const page = pages.find((item) => item.instagram_business_account) || pages[0];
      const ig = page?.instagram_business_account as Record<string, unknown> | undefined;
      const pageToken = page?.access_token ? String(page.access_token) : undefined;

      if (platform === "instagram" && ig) {
        return {
          ...credential,
          accessToken: pageToken || credential.accessToken,
          accountId: ig.id ? String(ig.id) : credential.accountId,
          accountName: ig.username ? String(ig.username) : undefined,
          providerData: { ...(credential.providerData || {}), page, instagram: ig },
        };
      }

      return {
        ...credential,
        accessToken: pageToken || credential.accessToken,
        accountId: page?.id ? String(page.id) : credential.accountId,
        accountName: page?.name ? String(page.name) : undefined,
        providerData: page ? { ...(credential.providerData || {}), page } : credential.providerData,
      };
    }
  } catch (error) {
    // Identity enrichment is useful but should not invalidate an otherwise valid OAuth grant.
    console.error("Social identity enrichment failed", platform, error);
  }
  return credential;
}
