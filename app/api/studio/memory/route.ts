import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loadContentMemory } from "@/lib/marketing/content-memory";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
const WORKSPACE_COOKIE="hay_business_id";

export async function GET(request:Request){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,memory:null});
  try{
    const url=new URL(request.url);
    const explicit=url.searchParams.get("businessId");
    const selected=explicit||(await cookies()).get(WORKSPACE_COOKIE)?.value||undefined;
    let memory=await loadContentMemory(selected);
    if(!memory&&!explicit&&selected)memory=await loadContentMemory();
    return NextResponse.json({configured:true,memory});
  }catch(error){
    console.error("Studio content memory failed",error);
    return NextResponse.json({error:"content_memory_failed"},{status:500});
  }
}
