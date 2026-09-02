import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { BusinessProfile } from "@/lib/marketing/types";

export const runtime = "nodejs";
const WORKSPACE_COOKIE="hay_business_id";

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

  const businesses=data||[];
  const selectedId=(await cookies()).get(WORKSPACE_COOKIE)?.value||"";
  const selectedIndex=selectedId?businesses.findIndex(item=>String(item.id)===selectedId):-1;
  const ordered=selectedIndex>0?[businesses[selectedIndex],...businesses.slice(0,selectedIndex),...businesses.slice(selectedIndex+1)]:businesses;
  return NextResponse.json({ configured: true, businesses: ordered, selectedBusinessId: selectedIndex>=0?selectedId:null });
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
    ? auth.supabase.from("businesses").update(row).eq("id", body.id).eq("owner_id",auth.userId).select().single()
    : auth.supabase.from("businesses").insert(row).select().single();
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "business_save_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, business: data });
}
