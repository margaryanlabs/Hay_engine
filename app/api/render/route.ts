import { NextResponse } from "next/server";
import { dispatchRender } from "@/lib/render/client";
import type { CreatorProject } from "@/lib/creator/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

function resolvedStockMedia(project:CreatorProject){
  const sceneImages:Record<string,string>={};
  const sceneVideos:Record<string,string>={};
  for(const scene of project.scenes){
    const stock=scene.asset.stock;
    if(!stock||stock.provider!=="pexels")continue;
    if(stock.mediaType==="video")sceneVideos[scene.id]=stock.url;
    else sceneImages[scene.id]=stock.url;
  }
  return {sceneImages,sceneVideos};
}

export async function POST(request: Request) {
  try {
    if(isSupabaseConfigured()){
      const supabase=await createClient();
      const {data,error}=await supabase.auth.getClaims();
      if(error||!data?.claims?.sub)return NextResponse.json({error:"unauthorized"},{status:401});
    }

    const body = await request.json();
    const project = body.project as CreatorProject | undefined;
    if (!project?.id || project.format !== "9:16" || !Array.isArray(project.scenes)) {
      return NextResponse.json({ error: "invalid_creator_project" }, { status: 400 });
    }
    const stock=resolvedStockMedia(project);
    const result = await dispatchRender({
      project,
      sceneImages: { ...stock.sceneImages, ...(body.sceneImages ?? {}) },
      sceneVideos: { ...stock.sceneVideos, ...(body.sceneVideos ?? {}) },
      audioSrc: body.audioSrc ? String(body.audioSrc) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Render dispatch failed", error);
    return NextResponse.json({ error: "render_dispatch_failed" }, { status: 500 });
  }
}