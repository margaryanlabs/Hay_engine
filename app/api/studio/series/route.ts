import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime="nodejs";
const WORKSPACE_COOKIE="hay_business_id";

export async function GET(request:Request){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,business:null,architecture:null});
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
    if(businessError)return NextResponse.json({error:"business_read_failed",detail:businessError.message},{status:500});
    if(!businesses?.[0]&&!explicit&&selected){
      const fallback=await supabase.from("businesses").select("id,name").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);
      businesses=fallback.data;businessError=fallback.error;
    }
    if(businessError)return NextResponse.json({error:"business_read_failed",detail:businessError.message},{status:500});
    const business=businesses?.[0];
    if(!business)return NextResponse.json({configured:true,business:null,architecture:null});

    const {data:plan,error:planError}=await supabase.from("marketing_plans").select("id,strategy,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(planError)return NextResponse.json({error:"series_read_failed",detail:planError.message},{status:500});
    const strategy=(plan?.strategy&&typeof plan.strategy==="object"?plan.strategy:{}) as Record<string,unknown>;
    const architecture=(strategy.series&&typeof strategy.series==="object")?strategy.series:null;
    return NextResponse.json({configured:true,business:{id:String(business.id),name:business.name},planId:plan?.id||null,createdAt:plan?.created_at||null,architecture});
  }catch(error){
    console.error("Studio series failed",error);
    return NextResponse.json({error:"series_read_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
