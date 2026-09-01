import type { CreatorProject } from "@/lib/creator/types";

export type RenderRequest = {
  project: CreatorProject;
  sceneImages?: Record<string, string>;
  sceneVideos?: Record<string, string>;
  audioSrc?: string;
};

export type RenderDispatch = {
  configured: boolean;
  jobId?: string;
  status?: string;
  outputUrl?: string;
  message?: string;
};

export function isRenderWorkerConfigured() {
  return Boolean(process.env.RENDER_WORKER_URL && process.env.RENDER_WORKER_SECRET);
}

export async function dispatchRender(input: RenderRequest): Promise<RenderDispatch> {
  const base = process.env.RENDER_WORKER_URL;
  const secret = process.env.RENDER_WORKER_SECRET;
  if (!base || !secret) return { configured: false, message: "Render worker is not configured." };

  const url = new URL("/render", base);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Render worker ${response.status}: ${detail.slice(0, 500)}`);
  }
  return { configured: true, ...(await response.json()) };
}
