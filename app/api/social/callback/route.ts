import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { exchangeOAuthCode } from "@/lib/marketing/oauth";
import { enrichOAuthCredential } from "@/lib/marketing/profile";
import { storeCredential } from "@/lib/marketing/credentials";
import type { SocialPlatform } from "@/lib/marketing/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state");
  const providerError = requestUrl.searchParams.get("error") || requestUrl.searchParams.get("error_description");
  const home = new URL("/", requestUrl.origin);

  if (providerError) {
    home.searchParams.set("oauth", "denied");
    home.searchParams.set("detail", providerError.slice(0, 120));
    return NextResponse.redirect(home);
  }
  if (!code || !returnedState || !isSupabaseConfigured()) return NextResponse.json({ error: "invalid_oauth_callback" }, { status: 400 });

  const cookieStore = await cookies();
  const rawState = cookieStore.get("hay_oauth_state")?.value;
  if (!rawState) return NextResponse.json({ error: "oauth_state_missing" }, { status: 400 });

  let state: { state: string; platform: SocialPlatform; businessId: string; issuedAt: number };
  try { state = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")); }
  catch { return NextResponse.json({ error: "oauth_state_invalid" }, { status: 400 }); }
  if (state.state !== returnedState || Date.now() - state.issuedAt > 10 * 60 * 1000) return NextResponse.json({ error: "oauth_state_mismatch" }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: business } = await supabase.from("businesses").select("id").eq("id", state.businessId).eq("owner_id", userId).maybeSingle();
  if (!business) return NextResponse.json({ error: "business_not_found" }, { status: 404 });

  try {
    const exchanged = await exchangeOAuthCode(state.platform, code);
    if (!exchanged.accessToken) throw new Error("empty_access_token");
    const credential = await enrichOAuthCredential(state.platform, exchanged);

    const { data: existing } = await supabase.from("social_connections").select("id").eq("business_id", state.businessId).eq("platform", state.platform).limit(1).maybeSingle();
    const connectionRow = {
      business_id: state.businessId,
      platform: state.platform,
      status: "connected",
      account_id: credential.accountId || null,
      account_name: credential.accountName || null,
      scopes: credential.scope ? credential.scope.split(/[ ,]+/).filter(Boolean) : [],
      expires_at: credential.expiresAt || null,
      connected_at: new Date().toISOString(),
    };
    const result = existing?.id
      ? await supabase.from("social_connections").update(connectionRow).eq("id", existing.id).select("id").single()
      : await supabase.from("social_connections").insert(connectionRow).select("id").single();
    if (result.error || !result.data?.id) throw result.error || new Error("connection_save_failed");

    await storeCredential(result.data.id, credential);
    const response = NextResponse.redirect(new URL(`/?connected=${encodeURIComponent(state.platform)}`, requestUrl.origin));
    response.cookies.set("hay_oauth_state", "", { httpOnly: true, sameSite: "lax", path: "/api/social/callback", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("OAuth callback failed", error);
    home.searchParams.set("oauth", "failed");
    home.searchParams.set("platform", state.platform);
    return NextResponse.redirect(home);
  }
}
