import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { BusinessProfile } from "@/lib/marketing/types";

export const runtime = "nodejs";

async function getAuth() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { supabase, userId: null };
  return { supabase, userId };
}

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ configured: false, businesses: [] });
  if (!auth.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await auth.supabase.from("businesses").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "businesses_read_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, businesses: data });
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ configured: false, message: "Supabase is not configured." });
  if (!auth.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const business = body.business as BusinessProfile | undefined;
  if (!business?.name || !business.category || !["hy", "en", "ru"].includes(business.primaryLanguage)) {
    return NextResponse.json({ error: "invalid_business_profile" }, { status: 400 });
  }
  const row = {
    id: body.id || undefined,
    owner_id: auth.userId,
    name: business.name,
    category: business.category,
    description: business.description || "",
    website: business.website || null,
    location: business.location || null,
    primary_language: business.primaryLanguage,
    goals: business.goals || [],
    audience: business.audience || null,
    offer: business.offer || null,
    tone: business.tone || null,
    updated_at: new Date().toISOString(),
  };
  const query = body.id
    ? auth.supabase.from("businesses").update(row).eq("id", body.id).select().single()
    : auth.supabase.from("businesses").insert(row).select().single();
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "business_save_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, business: data });
}
