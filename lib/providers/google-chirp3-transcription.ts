import "server-only";

import { createSign } from "node:crypto";

export type GoogleChirp3TranscriptionResult = {
  provider: "google-chirp3";
  model: "chirp_3";
  text: string;
  languageCode: string | null;
  location: string;
};

type GoogleSpeechConfig = {
  projectId: string;
  location: string;
  clientEmail: string;
  privateKey: string;
};

type TokenCache = { token: string; expiresAt: number } | null;
let tokenCache: TokenCache = null;

function cleanPrivateKey(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

function speechLocation() {
  const value = String(process.env.GOOGLE_CLOUD_SPEECH_LOCATION || "us").trim().toLowerCase();
  return value === "eu" ? "eu" : "us";
}

function config(): GoogleSpeechConfig | null {
  const projectId = String(process.env.GOOGLE_CLOUD_PROJECT || "").trim();
  const clientEmail = String(process.env.GOOGLE_CLOUD_SPEECH_CLIENT_EMAIL || "").trim();
  const privateKey = cleanPrivateKey(String(process.env.GOOGLE_CLOUD_SPEECH_PRIVATE_KEY || ""));
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, location: speechLocation(), clientEmail, privateKey };
}

export function isGoogleChirp3TranscriptionConfigured() {
  return Boolean(config());
}

export function googleChirp3TranscriptionReadiness() {
  const current = config();
  return {
    configured: Boolean(current),
    model: "chirp_3" as const,
    locale: "hy-AM",
    location: current?.location || speechLocation(),
    synchronousMaxBytes: 10 * 1024 * 1024,
    synchronousMaxSeconds: 60,
  };
}

function localeForLanguage(language?: string) {
  const value = String(language || "hy").trim();
  if (/^[a-z]{2,3}-[A-Z]{2}$/u.test(value)) return value;
  if (value === "en") return "en-US";
  if (value === "ru") return "ru-RU";
  return "hy-AM";
}

async function accessToken(current: GoogleSpeechConfig) {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: current.clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(current.privateKey).toString("base64url");
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`google_speech_oauth_${response.status}:${detail.slice(0, 500)}`);
  }
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  const token = String(payload.access_token || "");
  if (!token) throw new Error("google_speech_oauth_empty_token");
  const expiresIn = Math.max(300, Number(payload.expires_in) || 3600);
  tokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

export async function transcribeWithGoogleChirp3(args: {
  bytes: Uint8Array;
  language?: string;
}): Promise<GoogleChirp3TranscriptionResult | null> {
  const current = config();
  if (!current) return null;
  const maxBytes = 10 * 1024 * 1024;
  if (args.bytes.byteLength > maxBytes) throw new Error(`google_chirp3_sync_audio_too_large:${maxBytes}`);

  const token = await accessToken(current);
  const locale = localeForLanguage(args.language);
  const endpoint = `https://${current.location}-speech.googleapis.com/v2/projects/${encodeURIComponent(current.projectId)}/locations/${current.location}/recognizers/_:recognize`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      "x-goog-user-project": current.projectId,
    },
    body: JSON.stringify({
      config: {
        autoDecodingConfig: {},
        languageCodes: [locale],
        model: "chirp_3",
        features: { enableAutomaticPunctuation: true },
      },
      content: Buffer.from(args.bytes).toString("base64"),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`google_chirp3_transcription_${response.status}:${detail.slice(0, 500)}`);
  }
  const payload = await response.json() as {
    results?: Array<{
      languageCode?: string;
      alternatives?: Array<{ transcript?: string }>;
    }>;
  };
  const text = (payload.results || [])
    .map((result) => String(result.alternatives?.[0]?.transcript || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!text) throw new Error("google_chirp3_transcription_empty");
  const languageCode = (payload.results || []).map((result) => result.languageCode).find(Boolean) || null;
  return { provider: "google-chirp3", model: "chirp_3", text, languageCode, location: current.location };
}
