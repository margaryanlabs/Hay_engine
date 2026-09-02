import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime="nodejs";
const COOKIE="hay_business_id";

export async function POST(request:Request){
  try{
    if(!isSupabaseConfigured())return NextResponse.json({configured:false,selected:false});
    const body=await request.json();
    const businessId=String(body.businessId||"");
    if(!businessId)return NextResponse.json({error:"business_required"},{status:400});

    const supabase=await createClient();
    const {data:claims,error:claimsError}=await supabase.auth.getClaims();
    const userId=claims?.claims?.sub;
    if(claimsError||!userId)return NextResponse.json({error:"unauthorized"},{status:401});

    const {data:business,error}=await supabase.from("businesses").select("id,name").eq("id",businessId).eq("owner_id",userId).maybeSingle();
    if(error)return NextResponse.json({error:"workspace_read_failed",detail:error.message},{status:500});
    if(!business)return NextResponse.json({error:"business_not_found"},{status:404});

    const store=await cookies();
    const previous=store.get(COOKIE)?.value||"";
    store.set(COOKIE,businessId,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*180});
    return NextResponse.json({configured:true,selected:true,changed:previous!==businessId,business});
  }catch(error){
    console.error("Workspace selection failed",error);
    return NextResponse.json({error:"workspace_selection_failed",detail:error instanceof Error?error.message:String(error)},{status:500});
  }
}
