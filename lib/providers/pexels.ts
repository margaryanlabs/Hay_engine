import "server-only";

import type { Locale } from "@/lib/hay/types";
import type { StockMediaAsset } from "@/lib/creator/types";

const PEXELS_API = "https://api.pexels.com";
const PEXELS_HOME = "https://www.pexels.com" as const;
const SEARCH_RESULTS = 8;
const REQUEST_TIMEOUT_MS = 5_000;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function array(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === "object") as UnknownRecord[] : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanQuery(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[#@]/g, " ")
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function supportedLocale(locale: Locale) {
  if (locale === "ru") return "ru-RU";
  if (locale === "en") return "en-US";
  // Pexels currently does not list Armenian as a supported search locale.
  // Omitting locale is safer than pretending hy-AM is supported.
  return null;
}

function safePexelsUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !(host === "pexels.com" || host.endsWith(".pexels.com"))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function creatorUrl(value: unknown) {
  return safePexelsUrl(value) || PEXELS_HOME;
}

function selectVideo(payload: unknown, minDuration: number): StockMediaAsset | null {
  const candidates = array(record(payload).videos);
  const ranked = candidates
    .map(video => {
      const width = number(video.width);
      const height = number(video.height);
      const duration = number(video.duration);
      const files = array(video.video_files)
        .map(file => ({
          url: safePexelsUrl(file.link),
          width: number(file.width),
          height: number(file.height),
          quality: text(file.quality),
          fileType: text(file.file_type),
        }))
        .filter(file => file.url && file.width > 0 && file.height > 0 && file.height >= file.width && file.fileType.startsWith("video/"))
        .sort((a, b) => {
          const aTarget = Math.abs(a.height - 1280) + Math.abs(a.width - 720) + (a.quality === "hd" ? -100 : 0);
          const bTarget = Math.abs(b.height - 1280) + Math.abs(b.width - 720) + (b.quality === "hd" ? -100 : 0);
          return aTarget - bTarget;
        });
      const file = files[0];
      if (!file) return null;
      return { video, width, height, duration, file, longEnough: duration >= minDuration };
    })
    .filter(Boolean) as Array<{video:UnknownRecord;width:number;height:number;duration:number;file:{url:string|null;width:number;height:number;quality:string;fileType:string};longEnough:boolean}>;

  ranked.sort((a, b) => Number(b.longEnough) - Number(a.longEnough) || Math.abs(a.duration - minDuration) - Math.abs(b.duration - minDuration));
  const chosen = ranked[0];
  if (!chosen?.file.url) return null;
  const user = record(chosen.video.user);
  const name = text(user.name) || "Pexels creator";
  const page = safePexelsUrl(chosen.video.url) || PEXELS_HOME;
  const preview = safePexelsUrl(chosen.video.image);
  return {
    provider: "pexels",
    mediaType: "video",
    id: String(chosen.video.id || ""),
    url: chosen.file.url,
    previewUrl: preview,
    width: chosen.file.width || chosen.width,
    height: chosen.file.height || chosen.height,
    duration: chosen.duration || null,
    sourcePage: page,
    creatorName: name,
    creatorUrl: creatorUrl(user.url),
    providerUrl: PEXELS_HOME,
    attribution: `Video by ${name} on Pexels`,
  };
}

function selectPhoto(payload: unknown): StockMediaAsset | null {
  const photos = array(record(payload).photos);
  for (const photo of photos) {
    const src = record(photo.src);
    const portrait = safePexelsUrl(src.portrait) || safePexelsUrl(src.large2x) || safePexelsUrl(src.large) || safePexelsUrl(src.original);
    if (!portrait) continue;
    const name = text(photo.photographer) || "Pexels photographer";
    return {
      provider: "pexels",
      mediaType: "image",
      id: String(photo.id || ""),
      url: portrait,
      previewUrl: safePexelsUrl(src.medium) || safePexelsUrl(src.small) || portrait,
      width: number(photo.width),
      height: number(photo.height),
      duration: null,
      sourcePage: safePexelsUrl(photo.url) || PEXELS_HOME,
      creatorName: name,
      creatorUrl: creatorUrl(photo.photographer_url),
      providerUrl: PEXELS_HOME,
      attribution: `Photo by ${name} on Pexels`,
    };
  }
  return null;
}

async function pexelsGet(path: string, params: URLSearchParams) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const response = await fetch(`${PEXELS_API}${path}?${params.toString()}`, {
    headers: { Authorization: key },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`pexels_${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

export function isPexelsConfigured() {
  return Boolean(process.env.PEXELS_API_KEY);
}

export async function searchPexelsStock(input: { query: string; locale: Locale; minDuration?: number }) {
  if (!isPexelsConfigured()) return null;
  const query = cleanQuery(input.query);
  if (!query) return null;
  const locale = supportedLocale(input.locale);
  const base = new URLSearchParams({ query, orientation: "portrait", per_page: String(SEARCH_RESULTS) });
  if (locale) base.set("locale", locale);

  try {
    const videos = await pexelsGet("/v1/videos/search", base);
    const video = selectVideo(videos, Math.max(1, input.minDuration || 1));
    if (video) return video;
  } catch (error) {
    console.warn("Pexels video search failed", error);
  }

  try {
    const photos = await pexelsGet("/v1/search", base);
    return selectPhoto(photos);
  } catch (error) {
    console.warn("Pexels photo search failed", error);
    return null;
  }
}
