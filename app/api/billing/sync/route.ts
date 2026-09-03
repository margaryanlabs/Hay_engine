import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const runtime="nodejs";

const plans=["free","creator","growth","business","agency"] as const;
const statuses=["active","trialing","past_due","canceled","paused"] as const;

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

export async function POST(request:Request){
  if(!secretMatches(request.headers.get("authorization")))return NextResponse.json({error:"unauthorized"},{status:401});
  if(!isSupabaseAdminConfigured())return NextResponse.json({error:"supabase_admin_required"},{status:503});

  const body=await request.json().catch(()=>({}));
  const ownerId=String(body.ownerId||"");
  const plan=String(body.plan||"");
  const status=String(body.status||"active");
  if(!validUuid(ownerId))return NextResponse.json({error:"invalid_owner_id"},{status:400});
  if(!plans.includes(plan as (typeof plans)[number]))return NextResponse.json({error:"invalid_plan"},{status:400});
  if(!statuses.includes(status as (typeof statuses)[number]))return NextResponse.json({error:"invalid_status"},{status:400});

  const now=new Date();
  const defaultStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();
  const defaultEnd=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString();
  const periodStart=isoOrNull(body.currentPeriodStart)||defaultStart;
  const periodEnd=isoOrNull(body.currentPeriodEnd)||defaultEnd;
  if(new Date(periodEnd)<=new Date(periodStart))return NextResponse.json({error:"invalid_billing_period"},{status:400});

  const overrides=body.overrides&&typeof body.overrides==="object"&&!Array.isArray(body.overrides)?body.overrides:{};
  const allowedOverrideKeys=["brands","channels","contentAssets","aiVideoCredits","voiceMinutes"];
  const cleanOverrides=Object.fromEntries(Object.entries(overrides).filter(([key,value])=>allowedOverrideKeys.includes(key)&&Number.isFinite(Number(value))&&Number(value)>=0).map(([key,value])=>[key,Number(value)]));

  const admin=createAdminClient();
  const {data:user,error:userError}=await admin.auth.admin.getUserById(ownerId);
  if(userError||!user?.user)return NextResponse.json({error:"owner_not_found"},{status:404});

  const {data,error}=await admin.from("account_entitlements").upsert({
    owner_id:ownerId,
    plan_id:plan,
    status,
    provider:typeof body.provider==="string"?body.provider.slice(0,64):null,
    provider_customer_id:typeof body.providerCustomerId==="string"?body.providerCustomerId.slice(0,255):null,
    provider_subscription_id:typeof body.providerSubscriptionId==="string"?body.providerSubscriptionId.slice(0,255):null,
    current_period_start:periodStart,
    current_period_end:periodEnd,
    overrides:cleanOverrides,
    updated_at:new Date().toISOString(),
  },{onConflict:"owner_id"}).select("owner_id,plan_id,status,current_period_start,current_period_end,updated_at").single();
  if(error)return NextResponse.json({error:"entitlement_sync_failed",detail:error.message},{status:500});

  return NextResponse.json({ok:true,entitlement:data},{headers:{"Cache-Control":"no-store"}});
}
