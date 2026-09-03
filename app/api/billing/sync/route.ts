import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime="nodejs";

const plans=["free","creator","growth","business","agency"] as const;
const statuses=["active","trialing","past_due","canceled","paused"] as const;
const MAX_EVENT_FUTURE_SKEW_MS=10*60*1000;

function secretMatches(header:string|null){
  const configured=process.env.HAY_BILLING_SYNC_SECRET||"";
  const supplied=header?.startsWith("Bearer ")?header.slice(7):"";
  if(!configured||!supplied)return false;
  const a=Buffer.from(configured);const b=Buffer.from(supplied);
  return a.length===b.length&&timingSafeEqual(a,b);
}

function validUuid(value:string){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isoOrNull(value:unknown){
  if(typeof value!=="string"||!value)return null;
  const date=new Date(value);
  return Number.isNaN(date.getTime())?null:date.toISOString();
}

function object(value:unknown):Record<string,unknown>{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
}

function cleanText(value:unknown,max:number){
  return typeof value==="string"?value.trim().slice(0,max):"";
}

export async function POST(request:Request){
  if(!secretMatches(request.headers.get("authorization")))return NextResponse.json({error:"unauthorized"},{status:401});
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"supabase_admin_required"},{status:503});

  const body=await request.json().catch(()=>({}));
  const ownerId=String(body.ownerId||"");
  const plan=String(body.plan||"");
  const status=String(body.status||"");
  const provider=cleanText(body.provider,64).toLowerCase();
  const providerEventId=cleanText(body.providerEventId,255);
  const providerEventCreatedAt=isoOrNull(body.providerEventCreatedAt);
  const periodStart=isoOrNull(body.currentPeriodStart);
  const periodEnd=isoOrNull(body.currentPeriodEnd);

  if(!validUuid(ownerId))return NextResponse.json({error:"invalid_owner_id"},{status:400});
  if(!plans.includes(plan as (typeof plans)[number]))return NextResponse.json({error:"invalid_plan"},{status:400});
  if(!statuses.includes(status as (typeof statuses)[number]))return NextResponse.json({error:"invalid_status"},{status:400});
  if(!provider)return NextResponse.json({error:"provider_required"},{status:400});
  if(!providerEventId)return NextResponse.json({error:"provider_event_id_required"},{status:400});
  if(!providerEventCreatedAt)return NextResponse.json({error:"provider_event_created_at_required"},{status:400});
  if(new Date(providerEventCreatedAt).getTime()>Date.now()+MAX_EVENT_FUTURE_SKEW_MS)return NextResponse.json({error:"provider_event_time_in_future"},{status:400});
  if(!periodStart||!periodEnd||new Date(periodEnd)<=new Date(periodStart))return NextResponse.json({error:"invalid_billing_period"},{status:400});

  const overrides=body.overrides&&typeof body.overrides==="object"&&!Array.isArray(body.overrides)?body.overrides:{};
  const allowedOverrideKeys=["brands","channels","contentAssets","aiVideoCredits","voiceMinutes"];
  const cleanOverrides=Object.fromEntries(Object.entries(overrides).filter(([key,value])=>allowedOverrideKeys.includes(key)&&Number.isFinite(Number(value))&&Number(value)>=0).map(([key,value])=>[key,Number(value)]));

  const admin=createAdminClient();
  const {data,error}=await admin.rpc("hay_apply_billing_entitlement",{
    p_owner_id:ownerId,
    p_plan_id:plan,
    p_status:status,
    p_provider:provider,
    p_provider_customer_id:cleanText(body.providerCustomerId,255)||null,
    p_provider_subscription_id:cleanText(body.providerSubscriptionId,255)||null,
    p_current_period_start:periodStart,
    p_current_period_end:periodEnd,
    p_overrides:cleanOverrides,
    p_event_id:providerEventId,
    p_event_created_at:providerEventCreatedAt,
  });
  if(error){
    console.error("Atomic billing sync RPC failed",error.message);
    return NextResponse.json({error:"billing_sync_migration_required"},{status:503});
  }

  const result=object(data);
  const reason=String(result.reason||"");
  if(reason==="owner_not_found")return NextResponse.json({error:reason},{status:404});
  if(reason&&!["duplicate_event","stale_event"].includes(reason)&&result.applied!==true){
    return NextResponse.json({error:reason||"entitlement_sync_failed"},{status:400});
  }

  // Duplicate and stale verified events are acknowledged as successfully processed so
  // billing providers do not retry forever. `applied` tells the adapter whether state moved.
  return NextResponse.json({
    ok:true,
    applied:result.applied===true,
    duplicate:result.duplicate===true,
    stale:result.stale===true,
    eventId:result.eventId||null,
    entitlement:{
      planId:result.planId||null,
      status:result.status||null,
      currentPeriodStart:result.currentPeriodStart||periodStart,
      currentPeriodEnd:result.currentPeriodEnd||periodEnd,
      billingEventCreatedAt:result.billingEventCreatedAt||null,
      billingEventId:result.billingEventId||null,
    },
  },{headers:{"Cache-Control":"no-store"}});
}
