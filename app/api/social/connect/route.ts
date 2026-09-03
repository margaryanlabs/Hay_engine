import { NextResponse } from "next/server";
import { getCommercialContext } from "@/lib/commercial/entitlements";
import { buildOAuthUrl, getConnectorReadiness } from "@/lib/marketing/connectors";
import type { SocialPlatform } from "@/lib/marketing/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
const supported: SocialPlatform[] = ["instagram", "tiktok", "youtube", "facebook", "linkedin"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") as SocialPlatform | null;
  const businessId = url.searchParams.get("businessId");
  if (!platform || !supported.includes(platform)) return NextResponse.json({ error: "unsupported_platform" }, { status: 400 });

  const readiness = getConnectorReadiness(platform);
  const base = {
    platform,
    configured: readiness.configured,
    missing: readiness.missing,
    permissions: readiness.permissions,
    publishing: readiness.publishing,
    appReviewRequired: readiness.appReviewRequired,
    notes: readiness.notes,
  };
  if (!readiness.configured || !businessId) return NextResponse.json({ ...base, authorizationUrl: null, needsBusiness: !businessId });
  if (!isSupabaseConfigured()) return NextResponse.json({ ...base, authorizationUrl: null, needsAuth: true });

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: business } = await supabase.from("businesses").select("id").eq("id", businessId).eq("owner_id", userId).maybeSingle();
  if (!business) return NextResponse.json({ error: "business_not_found" }, { status: 404 });

  const commercial=await getCommercialContext();
  if(commercial.enforcementEnabled){
    if(!commercial.migrationReady)return NextResponse.json({error:"commercial_migration_required",commercial},{status:503});
    if(!["active","trialing"].includes(commercial.status))return NextResponse.json({error:"subscription_inactive",commercial},{status:402});

    const {data:existing}=await supabase.from("social_connections").select("id,status").eq("business_id",businessId).eq("platform",platform).neq("status","disconnected").limit(1).maybeSingle();
    if(!existing){
      const {data:ownedBusinesses,error:businessError}=await supabase.from("businesses").select("id").eq("owner_id",userId);
      if(businessError)return NextResponse.json({error:"channel_limit_check_failed",detail:businessError.message},{status:500});
      const ids=(ownedBusinesses||[]).map(item=>String(item.id));
      let channelCount=0;
      if(ids.length){
        const {count,error:countError}=await supabase.from("social_connections").select("id",{count:"exact",head:true}).in("business_id",ids).neq("status","disconnected");
        if(countError)return NextResponse.json({error:"channel_limit_check_failed",detail:countError.message},{status:500});
        channelCount=count||0;
      }
      if(channelCount>=commercial.limits.channels)return NextResponse.json({error:"channel_limit_reached",limit:commercial.limits.channels,commercial},{status:402});
    }
  }

  const state = crypto.randomUUID();
  const authorizationUrl = buildOAuthUrl(platform, state);
  const response = NextResponse.json({ ...base, authorizationUrl });
  const payload = Buffer.from(JSON.stringify({ state, platform, businessId, issuedAt: Date.now() })).toString("base64url");
  response.cookies.set("hay_oauth_state", payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/social/callback",
    maxAge: 10 * 60,
  });
  return response;
}
