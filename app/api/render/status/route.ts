import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ configured:false, status:"unconfigured" });
    const jobId = new URL(request.url).searchParams.get("jobId") || "";
    if (!jobId) return NextResponse.json({ error:"job_id_required" }, { status:400 });
    const supabase = await createClient();
    const { data:claims, error:claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claims?.claims?.sub) return NextResponse.json({ error:"unauthorized" }, { status:401 });
    const { data, error } = await supabase.from("render_jobs").select("id,project_id,status,output_url,error,created_at,updated_at").eq("id",jobId).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error:"render_job_not_found" }, { status:404 });
    return NextResponse.json({ configured:true, job:data });
  } catch (error) {
    console.error("Render status failed", error);
    return NextResponse.json({ error:"render_status_failed" }, { status:500 });
  }
}
