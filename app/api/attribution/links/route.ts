import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime="nodejs";
type TrackingLinkRow={id:string;slug:string;destination_url:string;is_active:boolean};

function httpsUrl(value:unknown){
  try{
    const url=new URL(String(value||""));
    if(url.protocol!=="https:"||url.username||url.password)return null;
    return url;
  }catch{return null;}
}
function baseHost(value:string){const host=value.toLowerCase();return host.startsWith("www.")?host.slice(4):host;}
function allowedDestination(destination:URL,website:URL){
  const host=baseHost(destination.hostname);const root=baseHost(website.hostname);
  return host===root||host.endsWith(`.${root}`);
}
function missingTable(error:{code?:string;message?:string}|null|undefined){return error?.code==="42P01"||String(error?.message||"").includes("tracking_links");}

export async function POST(request:Request){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,error:"supabase_required"},{status:503});
  try{
    const body=await request.json();const contentItemId=String(body.contentItemId||"").trim();const destination=httpsUrl(body.destinationUrl);
    if(!contentItemId||!destination)return NextResponse.json({error:"valid_content_and_https_destination_required"},{status:400});
    const supabase=await createClient();const {data:claims,error:claimsError}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;
    if(claimsError||!userId)return NextResponse.json({error:"unauthorized"},{status:401});

    const {data:content,error:contentError}=await supabase.from("content_items").select("id,business_id,platform,format,hook").eq("id",contentItemId).maybeSingle();
    if(contentError)return NextResponse.json({error:"content_read_failed",detail:contentError.message},{status:500});
    if(!content)return NextResponse.json({error:"content_not_found"},{status:404});
    const {data:business,error:businessError}=await supabase.from("businesses").select("id,name,website").eq("id",content.business_id).eq("owner_id",userId).maybeSingle();
    if(businessError)return NextResponse.json({error:"business_read_failed",detail:businessError.message},{status:500});
    if(!business)return NextResponse.json({error:"forbidden"},{status:403});
    const website=httpsUrl(business.website);
    if(!website)return NextResponse.json({error:"business_https_website_required",detail:"Set the business website before creating first-party tracking links."},{status:409});
    if(!allowedDestination(destination,website))return NextResponse.json({error:"destination_domain_not_allowed",detail:`Destination must stay on ${website.hostname} or one of its subdomains.`},{status:400});

    const normalized=destination.toString();
    const existing=await supabase.from("tracking_links").select("id,slug,destination_url,is_active").eq("business_id",business.id).eq("content_item_id",contentItemId).eq("destination_url",normalized).eq("is_active",true).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(missingTable(existing.error))return NextResponse.json({error:"attribution_migration_required",migration:"supabase/006_first_party_attribution.sql"},{status:409});
    if(existing.error)return NextResponse.json({error:"tracking_link_read_failed",detail:existing.error.message},{status:500});
    const origin=(process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin).replace(/\/$/,"");
    if(existing.data)return NextResponse.json({configured:true,reused:true,link:existing.data,trackingUrl:`${origin}/r/${existing.data.slug}`});

    let created:TrackingLinkRow|null=null;
    for(let attempt=0;attempt<3&&!created;attempt++){
      const slug=crypto.randomUUID().replaceAll("-","").slice(0,14);
      const result=await supabase.from("tracking_links").insert({business_id:business.id,content_item_id:contentItemId,slug,destination_url:normalized,is_active:true}).select("id,slug,destination_url,is_active").single();
      if(missingTable(result.error))return NextResponse.json({error:"attribution_migration_required",migration:"supabase/006_first_party_attribution.sql"},{status:409});
      if(result.error){if(result.error.code==="23505")continue;return NextResponse.json({error:"tracking_link_create_failed",detail:result.error.message},{status:500});}
      if(result.data)created={id:String(result.data.id),slug:String(result.data.slug),destination_url:String(result.data.destination_url),is_active:Boolean(result.data.is_active)};
    }
    if(!created)return NextResponse.json({error:"tracking_slug_collision"},{status:500});
    return NextResponse.json({configured:true,reused:false,link:created,trackingUrl:`${origin}/r/${created.slug}`});
  }catch(error){console.error("Tracking link creation failed",error);return NextResponse.json({error:"tracking_link_failed",detail:error instanceof Error?error.message:String(error)},{status:500});}
}
