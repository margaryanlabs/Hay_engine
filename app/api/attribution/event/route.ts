import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime="nodejs";
const allowed=new Set(["lead","booking","order","signup","purchase"]);

function cors(origin:string){return {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"600","Vary":"Origin"};}
function originAllowed(origin:string,destination:string){
  try{const a=new URL(origin);const b=new URL(destination);if(a.protocol!=="https:"||b.protocol!=="https:")return false;const ah=a.hostname.toLowerCase();const bh=b.hostname.toLowerCase();return ah===bh||ah.endsWith(`.${bh}`)||bh.endsWith(`.${ah}`);}catch{return false;}
}
function externalKey(value:unknown){return String(value||"").trim().replace(/[^a-zA-Z0-9._:-]/g,"").slice(0,120);}

export async function OPTIONS(request:Request){const origin=request.headers.get("origin")||"*";return new NextResponse(null,{status:204,headers:cors(origin)});}

export async function POST(request:Request){
  const origin=request.headers.get("origin")||"";
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"attribution_unavailable"},{status:503,headers:cors(origin||"null")});
  try{
    const body=await request.json();const clickId=String(body.clickId||"").trim();const eventType=String(body.eventType||"").trim();
    if(!/^[0-9a-f-]{36}$/i.test(clickId)||!allowed.has(eventType))return NextResponse.json({error:"valid_click_and_event_required"},{status:400,headers:cors(origin||"null")});
    const supabase=createAdminClient();
    const {data:click,error:clickError}=await supabase.from("attribution_events").select("business_id,content_item_id,tracking_link_id").eq("click_id",clickId).eq("event_type","click").limit(1).maybeSingle();
    if(clickError)return NextResponse.json({error:"attribution_read_failed"},{status:clickError.code==="42P01"?503:500,headers:cors(origin||"null")});
    if(!click)return NextResponse.json({error:"click_not_found"},{status:404,headers:cors(origin||"null")});
    const {data:link,error:linkError}=await supabase.from("tracking_links").select("destination_url,is_active").eq("id",click.tracking_link_id).maybeSingle();
    if(linkError||!link||link.is_active!==true)return NextResponse.json({error:"tracking_link_unavailable"},{status:404,headers:cors(origin||"null")});
    if(!origin||!originAllowed(origin,String(link.destination_url)))return NextResponse.json({error:"origin_not_allowed"},{status:403,headers:cors(origin||"null")});

    const value=body.value===undefined||body.value===null?null:Number(body.value);if(value!==null&&(!Number.isFinite(value)||value<0||value>1_000_000_000))return NextResponse.json({error:"invalid_value"},{status:400,headers:cors(origin)});
    const currency=String(body.currency||"").trim().toUpperCase();if(currency&&!/^[A-Z]{3}$/.test(currency))return NextResponse.json({error:"invalid_currency"},{status:400,headers:cors(origin)});
    const supplied=externalKey(body.eventId);const eventKey=supplied?`${clickId}:${eventType}:${supplied}`:`${clickId}:${eventType}`;
    const result=await supabase.from("attribution_events").insert({business_id:click.business_id,content_item_id:click.content_item_id,tracking_link_id:click.tracking_link_id,click_id:clickId,event_type:eventType,event_key:eventKey,value,currency:currency||null,metadata:{}}).select("id,occurred_at").single();
    if(result.error?.code==="23505")return NextResponse.json({ok:true,deduplicated:true},{headers:cors(origin)});
    if(result.error)return NextResponse.json({error:"conversion_event_failed"},{status:500,headers:cors(origin)});
    return NextResponse.json({ok:true,deduplicated:false,event:{id:result.data.id,occurredAt:result.data.occurred_at}},{headers:cors(origin)});
  }catch(error){console.error("HAY conversion event failed",error);return NextResponse.json({error:"conversion_event_failed"},{status:500,headers:cors(origin||"null")});}
}
