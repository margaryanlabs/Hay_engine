import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ configured: false, connections: [] });
  const businessId = new URL(request.url).searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "business_required" }, { status: 400 });
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: business } = await supabase.from("businesses").select("id").eq("id", businessId).eq("owner_id", userId).maybeSingle();
  if (!business) return NextResponse.json({ error: "business_not_found" }, { status: 404 });
  const { data, error } = await supabase.from("social_connections").select("id,platform,status,account_name,account_id,scopes,expires_at,connected_at").eq("business_id", businessId);
  if (error) return NextResponse.json({ error: "connections_read_failed" }, { status: 500 });
  return NextResponse.json({ configured: true, connections: data || [] });
}
