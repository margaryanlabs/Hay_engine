import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ configured:false, message:"Supabase is required to save reviewed content." });
    const body = await request.json();
    const contentItemId = String(body.contentItemId || "");
    if (!contentItemId) return NextResponse.json({ error:"content_item_id_required" }, { status:400 });
    const supabase = await createClient();
    const { data:claims, error:claimsError } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (claimsError || !userId) return NextResponse.json({ error:"unauthorized" }, { status:401 });

    const { data:item } = await supabase.from("content_items").select("id,business_id").eq("id",contentItemId).maybeSingle();
    if (!item) return NextResponse.json({ error:"content_not_found" }, { status:404 });
    const { data:business } = await supabase.from("businesses").select("id").eq("id",item.business_id).eq("owner_id",userId).maybeSingle();
    if (!business) return NextResponse.json({ error:"forbidden" }, { status:403 });

    const patch: Record<string, unknown> = { updated_at:new Date().toISOString() };
    if (typeof body.caption === "string") patch.caption = body.caption.slice(0,5000);
    if (typeof body.cta === "string") patch.cta = body.cta.slice(0,1000);
    if (Array.isArray(body.hashtags)) patch.hashtags = body.hashtags.filter((x:unknown):x is string=>typeof x==="string").slice(0,30);
    if (body.status && ["draft","approved","scheduled"].includes(String(body.status))) patch.status = body.status;
    const { data, error } = await supabase.from("content_items").update(patch).eq("id",contentItemId).select("id,caption,cta,hashtags,status,asset_url,asset_urls,scheduled_for").single();
    if (error) throw error;
    return NextResponse.json({ configured:true, content:data });
  } catch (error) {
    console.error("Content review update failed",error);
    return NextResponse.json({ error:"content_update_failed", detail:error instanceof Error?error.message:String(error) }, { status:500 });
  }
}
