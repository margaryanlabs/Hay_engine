import "server-only";

export type PublishDispatchInput = {
  jobId: string;
  connectionId: string;
  contentItemId: string;
};

export type PublishDispatchResult = {
  configured: boolean;
  accepted?: boolean;
  workerJobId?: string;
  message?: string;
};

export function isPublishWorkerConfigured() {
  return Boolean(process.env.PUBLISH_WORKER_URL && process.env.PUBLISH_WORKER_SECRET);
}

export async function dispatchPublish(input: PublishDispatchInput): Promise<PublishDispatchResult> {
  const base = process.env.PUBLISH_WORKER_URL;
  const secret = process.env.PUBLISH_WORKER_SECRET;
  if (!base || !secret) return { configured: false, message: "Publish worker is not configured." };

  const response = await fetch(new URL("/jobs", base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* worker may return plain error */ }
  if (!response.ok) throw new Error(`Publish worker ${response.status}: ${text.slice(0, 400)}`);
  return {
    configured: true,
    accepted: data.accepted !== false,
    workerJobId: data.jobId ? String(data.jobId) : undefined,
  };
}
