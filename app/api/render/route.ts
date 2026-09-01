import { NextResponse } from "next/server";
import { dispatchRender } from "@/lib/render/client";
import type { CreatorProject } from "@/lib/creator/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body.project as CreatorProject | undefined;
    if (!project?.id || project.format !== "9:16" || !Array.isArray(project.scenes)) {
      return NextResponse.json({ error: "invalid_creator_project" }, { status: 400 });
    }
    const result = await dispatchRender({
      project,
      sceneImages: body.sceneImages ?? {},
      sceneVideos: body.sceneVideos ?? {},
      audioSrc: body.audioSrc ? String(body.audioSrc) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Render dispatch failed", error);
    return NextResponse.json({ error: "render_dispatch_failed" }, { status: 500 });
  }
}
