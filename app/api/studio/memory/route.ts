import { NextResponse } from "next/server";
import { loadContentMemory } from "@/lib/marketing/content-memory";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(){
  if(!isSupabaseConfigured())return NextResponse.json({configured:false,memory:null});
  try{
    const memory=await loadContentMemory();
    return NextResponse.json({configured:true,memory});
  }catch(error){
    console.error("Studio content memory failed",error);
    return NextResponse.json({error:"content_memory_failed"},{status:500});
  }
}
