import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { readCredential } from "@/lib/marketing/credentials";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ configured: false, message: "Supabase is required for TikTok publishing." });
    const connectionId = new URL(request.url).searchParams.get("connectionId") || "";
    if (!connectionId) return NextResponse.json({ error: "connection_id_required" }, { status: 400 });

    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: connection } = await supabase.from("social_connections")
      .select("id,business_id,platform,status,account_id,account_name")
      .eq("id", connectionId).eq("platform", "tiktok").maybeSingle();
    if (!connection || connection.status !== "connected") return NextResponse.json({ error: "tiktok_connection_not_ready" }, { status: 404 });
    const { data: business } = await supabase.from("businesses").select("id").eq("id", connection.business_id).eq("owner_id", userId).maybeSingle();
    if (!business) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const credential = await readCredential(connectionId);
    if (!credential?.accessToken) return NextResponse.json({ error: "tiktok_credential_missing", needsAuth: true }, { status: 409 });
    const response = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
      method: "POST",
      headers: { Authorization: `Bearer ${credential.accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const data = await response.json();
    if (!response.ok || data?.error?.code && data.error.code !== "ok") {
      return NextResponse.json({ error: "tiktok_creator_info_failed", detail: data?.error || data }, { status: response.status || 502 });
    }
    return NextResponse.json({
      configured: true,
      connection: { id: connection.id, accountId: connection.account_id, accountName: connection.account_name },
      creator: data.data,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("TikTok creator info failed", error);
    return NextResponse.json({ error: "tiktok_creator_info_failed" }, { status: 500 });
  }
}
