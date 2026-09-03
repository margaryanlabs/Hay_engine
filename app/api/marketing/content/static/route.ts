import { NextResponse } from "next/server";
import sharp from "sharp";
import { commitUsageReservation, releaseUsageReservation, reserveUsage, type UsageReservation } from "@/lib/commercial/usage-reservations";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { generateSceneImage } from "@/lib/providers/openai-image";

export const runtime = "nodejs";

function usageStatus(reason:string|undefined){
  if(reason==="unauthorized")return 401;
  if(reason==="request_in_progress"||reason==="duplicate_request")return 409;
  if(reason==="commercial_migration_required"||reason==="atomic_usage_admin_required"||reason==="atomic_usage_migration_required"||reason==="atomic_usage_reservation_failed")return 503;
  return 402;
}

function escapeXml(value: string) {
  return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function wrap(value: string, max = 24, maxLines = 4) {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { lines.push(line); line = word; }
    else line = next;
    if (lines.length >= maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const used = lines.join(" ").split(/\s+/u).length;
  if (used < words.length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/u,"")}…`;
  return lines;
}

function overlaySvg(args: { brand: string; headline: string; kicker?: string; index?: number; total?: number }) {
  const lines = wrap(args.headline);
  const lineSvg = lines.map((line,index) => `<text x="80" y="${750 + index*92}" font-size="76" font-weight="700" fill="#F7F7F4">${escapeXml(line)}</text>`).join("");
  const page = args.total && args.total > 1 ? `${String((args.index||0)+1).padStart(2,"0")} / ${String(args.total).padStart(2,"0")}` : "";
  return Buffer.from(`<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050708" stop-opacity="0.10"/><stop offset="0.48" stop-color="#050708" stop-opacity="0.28"/><stop offset="1" stop-color="#050708" stop-opacity="0.94"/></linearGradient></defs>
    <rect width="1080" height="1350" fill="url(#shade)"/>
    <text x="80" y="92" font-family="DejaVu Sans, sans-serif" font-size="25" font-weight="600" fill="#F7F7F4" letter-spacing="2">${escapeXml(args.brand.toUpperCase())}</text>
    <text x="1000" y="92" text-anchor="end" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#D8DBD2">${escapeXml(page)}</text>
    <text x="80" y="675" font-family="DejaVu Sans, sans-serif" font-size="22" font-weight="600" fill="#C47A66" letter-spacing="3">${escapeXml((args.kicker||"ARMENIA").toUpperCase())}</text>
    <g font-family="DejaVu Sans, sans-serif">${lineSvg}</g>
    <line x1="80" y1="1220" x2="1000" y2="1220" stroke="#F7F7F4" stroke-opacity="0.22"/>
  </svg>`);
}

async function imageBytes(prompt: string) {
  const generated = await generateSceneImage(`${prompt}\nNo text, no letters, no logos, no watermarks. Premium editorial photography/composition with generous negative space for typography.`);
  if (!generated) return null;
  if (generated.b64) return Buffer.from(generated.b64,"base64");
  if (generated.url) {
    const response = await fetch(generated.url,{signal:AbortSignal.timeout(30_000)});
    if (!response.ok) throw new Error(`generated_image_fetch_${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  return null;
}

export async function POST(request: Request) {
  let pendingReservation:UsageReservation|null=null;
  try {
    if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) return NextResponse.json({configured:false,message:"Dedicated HAY Supabase is required for static publishing assets."});
    const body = await request.json();
    const contentItemId = String(body.contentItemId||"");
    const force=body.force===true;
    if (!contentItemId) return NextResponse.json({error:"content_item_id_required"},{status:400});

    const supabase = await createClient();
    const {data:claimsData,error:claimsError}=await supabase.auth.getClaims();
    const userId=claimsData?.claims?.sub;
    if(claimsError||!userId)return NextResponse.json({error:"unauthorized"},{status:401});
    const {data:content}=await supabase.from("content_items").select("id,business_id,platform,format,hook,concept,caption,cta,asset_brief,asset_url,asset_urls,status").eq("id",contentItemId).maybeSingle();
    if(!content)return NextResponse.json({error:"content_not_found"},{status:404});
    const {data:business}=await supabase.from("businesses").select("id,owner_id,name,category,offer,description,location").eq("id",content.business_id).eq("owner_id",userId).maybeSingle();
    if(!business)return NextResponse.json({error:"forbidden"},{status:403});
    if(!["post","carousel"].includes(String(content.format)))return NextResponse.json({error:"static_format_required"},{status:409});

    const existingUrls=Array.isArray(content.asset_urls)?content.asset_urls.filter((value):value is string=>typeof value==="string"&&Boolean(value)):[];
    if(content.asset_url&&!force){
      return NextResponse.json({configured:true,reused:true,contentItemId,format:content.format,assetUrl:content.asset_url,assetUrls:existingUrls.length?existingUrls:[content.asset_url],count:existingUrls.length||1});
    }

    let reservation:UsageReservation|null=null;
    if(force){
      const requestId=typeof body.requestId==="string"?body.requestId.trim().slice(0,200):"";
      const next=await reserveUsage({
        meter:"content_assets",
        quantity:1,
        businessId:String(content.business_id),
        source:"static_regeneration",
        idempotencyKey:requestId?`static-regeneration:${requestId}`:undefined,
        metadata:{contentItemId,format:content.format},
      });
      if(!next.allowed){
        return NextResponse.json({error:next.reason,meter:"content_assets",required:1,commercial:next.context},{status:usageStatus(next.reason)});
      }
      if(next.duplicate){
        if(content.asset_url){
          return NextResponse.json({configured:true,reused:true,duplicate:true,contentItemId,format:content.format,assetUrl:content.asset_url,assetUrls:existingUrls.length?existingUrls:[content.asset_url],count:existingUrls.length||1,commercialUsage:{recorded:true,duplicate:true,eventId:next.eventId,metadata:next.metadata}});
        }
        return NextResponse.json({error:"duplicate_static_regeneration_request",commercialUsage:{recorded:true,duplicate:true,eventId:next.eventId,metadata:next.metadata}},{status:409});
      }
      reservation=next;pendingReservation=next;
    }

    const base=await imageBytes(`${content.asset_brief}. Business: ${business.name}, ${business.category}. Location: ${business.location||"Armenia"}. Concept: ${content.concept}.`);
    if(!base){
      if(reservation)await releaseUsageReservation(reservation).catch(()=>undefined);
      pendingReservation=null;
      return NextResponse.json({configured:true,error:"image_provider_unconfigured_or_failed"},{status:503});
    }

    // OpenAI image work has succeeded. Commit a force-regeneration credit before local
    // compositing/storage so downstream infrastructure failures cannot create unmetered
    // paid provider work. Initial generation remains included in the plan allocation.
    let usage:{recorded:boolean;reason?:string;duplicate?:boolean;eventId?:string|null;metadata?:Record<string,unknown>}={recorded:false,reason:"included_in_plan"};
    if(reservation){
      pendingReservation=null;
      usage=await commitUsageReservation(reservation,{contentItemId,format:content.format,provider:"openai_image"});
      if(!usage.recorded)return NextResponse.json({error:"static_regeneration_usage_commit_failed",commercialUsage:usage},{status:503});
    }

    const slideTexts=content.format==="carousel"
      ? [content.hook,content.concept,business.offer||business.description||content.caption,content.cta].filter((value):value is string=>Boolean(value&&String(value).trim())).slice(0,4)
      : [content.hook];
    const admin=createAdminClient();
    const urls:string[]=[];
    for(let index=0;index<slideTexts.length;index++){
      const overlay=overlaySvg({brand:business.name,headline:String(slideTexts[index]),kicker:index===0?content.platform:content.format,index,total:slideTexts.length});
      const png=await sharp(base).resize(1080,1350,{fit:"cover",position:index%2===0?"attention":"entropy"}).composite([{input:overlay,top:0,left:0}]).png({quality:92}).toBuffer();
      const objectPath=`${userId}/${new Date().toISOString().slice(0,10)}/${content.id}-${index+1}-${crypto.randomUUID()}.png`;
      const {error:uploadError}=await admin.storage.from("hay-renders").upload(objectPath,png,{contentType:"image/png",cacheControl:"31536000",upsert:false});
      if(uploadError)throw uploadError;
      const {data:publicData}=admin.storage.from("hay-renders").getPublicUrl(objectPath);
      urls.push(publicData.publicUrl);
    }
    const {error:updateError}=await supabase.from("content_items").update({asset_url:urls[0],asset_urls:urls,status:"draft",updated_at:new Date().toISOString()}).eq("id",content.id);
    if(updateError)throw updateError;

    return NextResponse.json({configured:true,reused:false,contentItemId,format:content.format,assetUrl:urls[0],assetUrls:urls,count:urls.length,commercialUsage:usage});
  }catch(error){
    if(pendingReservation)await releaseUsageReservation(pendingReservation).catch(()=>undefined);
    console.error("Static content compositor failed",error);
    return NextResponse.json({error:"static_content_compositor_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
