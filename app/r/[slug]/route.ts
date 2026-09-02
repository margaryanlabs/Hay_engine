import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime="nodejs";

function referrerHost(request:Request){
  const raw=request.headers.get("referer")||"";
  try{return raw?new URL(raw).hostname.slice(0,253):"";}catch{return "";}
}

export async function GET(request:Request,context:{params:Promise<{slug:string}>}){
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"tracking_unavailable"},{status:503});
  try{
    const {slug}=await context.params;const clean=String(slug||"").trim();
    if(!/^[a-zA-Z0-9]{8,32}$/.test(clean))return NextResponse.json({error:"tracking_link_not_found"},{status:404});
    const supabase=createAdminClient();
    const {data:link,error}=await supabase.from("tracking_links").select("id,business_id,content_item_id,destination_url,is_active").eq("slug",clean).maybeSingle();
    if(error)return NextResponse.json({error:"tracking_unavailable"},{status:error.code==="42P01"?503:500});
    if(!link||link.is_active!==true)return NextResponse.json({error:"tracking_link_not_found"},{status:404});
    let destination:URL;
    try{destination=new URL(String(link.destination_url));}catch{return NextResponse.json({error:"tracking_destination_invalid"},{status:500});}
    if(destination.protocol!=="https:")return NextResponse.json({error:"tracking_destination_invalid"},{status:500});

    const clickId=crypto.randomUUID();const refHost=referrerHost(request);
    await supabase.from("attribution_events").insert({
      business_id:link.business_id,
      content_item_id:link.content_item_id,
      tracking_link_id:link.id,
      click_id:clickId,
      event_type:"click",
      event_key:`click:${clickId}`,
      metadata:refHost?{referrerHost:refHost}:{},
    });

    destination.searchParams.set("hay_click",clickId);
    if(!destination.searchParams.has("utm_source"))destination.searchParams.set("utm_source","hay");
    if(!destination.searchParams.has("utm_medium"))destination.searchParams.set("utm_medium","social");
    if(!destination.searchParams.has("utm_content"))destination.searchParams.set("utm_content",String(link.content_item_id));
    const response=NextResponse.redirect(destination,302);
    response.headers.set("Cache-Control","no-store, max-age=0");
    response.headers.set("Referrer-Policy","strict-origin-when-cross-origin");
    return response;
  }catch(error){console.error("HAY tracking redirect failed",error);return NextResponse.json({error:"tracking_redirect_failed"},{status:500});}
}
