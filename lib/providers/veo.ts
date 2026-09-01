const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type VeoStartInput = {
  prompt: string;
  durationSeconds?: 4 | 6 | 8;
  aspectRatio?: "9:16" | "16:9";
  resolution?: "720p" | "1080p" | "4k";
};

export type VeoOperation = {
  name: string;
  done?: boolean;
  error?: unknown;
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{ video?: { uri?: string; mimeType?: string } }>;
    };
  };
};

function getKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || null;
}

export function isVeoConfigured() {
  return Boolean(getKey());
}

export async function startVeoVideo(input: VeoStartInput): Promise<VeoOperation | null> {
  const apiKey = getKey();
  if (!apiKey) return null;
  const model = process.env.VEO_MODEL || "veo-3.1-fast-generate-preview";
  const durationSeconds = input.durationSeconds ?? 8;
  const resolution = input.resolution ?? "720p";

  const response = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:predictLongRunning`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      instances: [{ prompt: input.prompt }],
      parameters: {
        aspectRatio: input.aspectRatio ?? "9:16",
        durationSeconds: String(durationSeconds),
        resolution,
        numberOfVideos: 1,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Veo ${response.status}: ${detail.slice(0, 500)}`);
  }
  return response.json() as Promise<VeoOperation>;
}

function validateOperationName(name: string) {
  if (!name || name.length > 400 || name.includes("..") || !/^[A-Za-z0-9._\-/:]+$/.test(name)) throw new Error("invalid_operation_name");
  return name.replace(/^\/+/, "");
}

export async function getVeoOperation(name: string): Promise<VeoOperation | null> {
  const apiKey = getKey();
  if (!apiKey) return null;
  const safeName = validateOperationName(name);
  const response = await fetch(`${GEMINI_BASE}/${safeName}`, { headers: { "x-goog-api-key": apiKey }, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Veo operation ${response.status}: ${detail.slice(0, 500)}`);
  }
  return response.json() as Promise<VeoOperation>;
}

export function extractVeoVideoUri(operation: VeoOperation) {
  return operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? null;
}
