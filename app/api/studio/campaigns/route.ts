import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime="nodejs";
const WORKSPACE_COOKIE="hay_business_id";
const YEREVAN_OFFSET="+04:00";

function liveStatus(startDate:unknown,endDate:unknown){
  const start=Date.parse(`${String(startDate||"")}T00:00:00${YEREVAN_OFFSET}`);
  const end=Date.parse(`${String(endDate||"")}T23:59:59${YEREVAN_OFFSET}`);
  const now=Date.now();
  if(Number.isFinite(start)&&now<start)return "upcoming";
  if(Number.isFinite(end)&&now>end)return "completed";
  return "active";
}

export async function GET(request:Request){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,business:null,campaigns:[]});
  try{
    const supabase=await createClient();
    const {data:claims,error:claimsError}=await supabase.auth.getClaims();
    const userId=claims?.claims?.sub;
    if(claimsError||!userId)return NextResponse.json({error:"unauthorized"},{status:401});
    const url=new URL(request.url);
    const explicit=url.searchParams.get("businessId");
    const selected=explicit||(await cookies()).get(WORKSPACE_COOKIE)?.value||null;
    let query=supabase.from("businesses").select("id,name").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);
    if(selected)query=query.eq("id",selected);
    let {data:businesses,error:businessError}=await query;
    if(!businesses?.[0]&&!explicit&&selected){const fallback=await supabase.from("businesses").select("id,name").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);businesses=fallback.data;businessError=fallback.error;}
    if(businessError)return NextResponse.json({error:"business_read_failed",detail:businessError.message},{status:500});
    const business=businesses?.[0];
    if(!business)return NextResponse.json({configured:true,business:null,campaigns:[]});

    const {data:plans,error:planError}=await supabase.from("marketing_plans").select("id,strategy,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(24);
    if(planError)return NextResponse.json({error:"campaigns_read_failed",detail:planError.message},{status:500});
    const campaigns=[] as Array<Record<string,unknown>>;
    const seen=new Set<string>();
    for(const plan of plans||[]){
      const strategy=(plan.strategy&&typeof plan.strategy==="object"?plan.strategy:{}) as Record<string,unknown>;
      const raw=strategy.campaign;
      if(!raw||typeof raw!=="object"||Array.isArray(raw))continue;
      const campaign=raw as Record<string,unknown>;
      const id=String(campaign.id||`${campaign.name||"campaign"}:${campaign.startDate||plan.created_at}`);
      if(seen.has(id))continue;seen.add(id);
      campaigns.push({...campaign,id,status:liveStatus(campaign.startDate,campaign.endDate),planId:String(plan.id),planCreatedAt:String(plan.created_at||"")});
      if(campaigns.length>=8)break;
    }
    return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},campaigns});
  }catch(error){
    console.error("Studio campaigns failed",error);
    return NextResponse.json({error:"campaigns_read_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
