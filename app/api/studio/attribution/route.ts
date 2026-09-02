import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { loadAttributionSummary } from "@/lib/marketing/attribution";

export const runtime="nodejs";
const WORKSPACE_COOKIE="hay_business_id";
function missingTable(error:{code?:string;message?:string}|null|undefined){return error?.code==="42P01"||String(error?.message||"").includes("tracking_links");}

export async function GET(request:Request){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,business:null,content:[],links:[],attribution:null});
  try{
    const supabase=await createClient();const {data:claims,error:claimsError}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;
    if(claimsError||!userId)return NextResponse.json({error:"unauthorized"},{status:401});
    const url=new URL(request.url);const explicit=url.searchParams.get("businessId");const selected=explicit||(await cookies()).get(WORKSPACE_COOKIE)?.value||null;
    let businessQuery=supabase.from("businesses").select("id,name,website").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);if(selected)businessQuery=businessQuery.eq("id",selected);
    let {data:businesses,error:businessError}=await businessQuery;
    if(!businesses?.[0]&&!explicit&&selected){const fallback=await supabase.from("businesses").select("id,name,website").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);businesses=fallback.data;businessError=fallback.error;}
    if(businessError)return NextResponse.json({error:"business_read_failed",detail:businessError.message},{status:500});
    const business=businesses?.[0];if(!business)return NextResponse.json({configured:true,business:null,content:[],links:[],attribution:null});
    const businessId=String(business.id);
    const [contentResult,linksResult,attribution]=await Promise.all([
      supabase.from("content_items").select("id,platform,format,hook,status,published_at,scheduled_for").eq("business_id",businessId).in("status",["published","approved","scheduled"]).order("updated_at",{ascending:false}).limit(40),
      supabase.from("tracking_links").select("id,content_item_id,slug,destination_url,is_active,created_at").eq("business_id",businessId).order("created_at",{ascending:false}).limit(40),
      loadAttributionSummary(supabase,businessId),
    ]);
    if(contentResult.error)return NextResponse.json({error:"attribution_content_failed",detail:contentResult.error.message},{status:500});
    if(missingTable(linksResult.error)||!attribution.available)return NextResponse.json({configured:true,business:{id:businessId,name:business.name,website:business.website},content:contentResult.data||[],links:[],attribution:null,migrationRequired:"supabase/006_first_party_attribution.sql"});
    if(linksResult.error)return NextResponse.json({error:"tracking_links_read_failed",detail:linksResult.error.message},{status:500});
    const origin=(process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin).replace(/\/$/,"");
    const links=(linksResult.data||[]).map(link=>({...link,trackingUrl:`${origin}/r/${link.slug}`,counts:attribution.byContent.get(String(link.content_item_id))||null}));
    const top=[...attribution.byContent.entries()].map(([contentItemId,counts])=>({contentItemId,...counts})).sort((a,b)=>(b.conversions*20+b.clicks)-(a.conversions*20+a.clicks)).slice(0,10);
    return NextResponse.json({configured:true,business:{id:businessId,name:business.name,website:business.website},content:contentResult.data||[],links,attribution:{totals:attribution.totals,top},eventEndpoint:`${origin}/api/attribution/event`});
  }catch(error){console.error("Studio attribution failed",error);return NextResponse.json({error:"studio_attribution_failed",detail:error instanceof Error?error.message:String(error)},{status:500});}
}
