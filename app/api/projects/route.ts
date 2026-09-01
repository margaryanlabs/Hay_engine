import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { CreatorProject } from "@/lib/creator/types";

export const runtime = "nodejs";

async function authUser() {
  if (!isSupabaseConfigured()) return { configured: false as const };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { configured: true as const, supabase, userId: null };
  return { configured: true as const, supabase, userId };
}

export async function GET() {
  const auth = await authUser();
  if (!auth.configured) return NextResponse.json({ configured: false, projects: [] });
  if (!auth.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await auth.supabase.from("creator_projects").select("id,status,business_id,manifest,output_url,created_at,updated_at").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "projects_read_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, projects: data });
}

export async function POST(request: Request) {
  const auth = await authUser();
  if (!auth.configured) return NextResponse.json({ configured: false, message: "Supabase is not configured." });
  if (!auth.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const project = body.project as CreatorProject | undefined;
  if (!project?.id || project.format !== "9:16") return NextResponse.json({ error: "invalid_creator_project" }, { status: 400 });

  const row = {
    id: project.id,
    owner_id: auth.userId,
    business_id: body.businessId || null,
    status: project.status,
    manifest: project,
    output_url: body.outputUrl || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await auth.supabase.from("creator_projects").upsert(row, { onConflict: "id" }).select().single();
  if (error) return NextResponse.json({ error: "project_save_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, project: data });
}
