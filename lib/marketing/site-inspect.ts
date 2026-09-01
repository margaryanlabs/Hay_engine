import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type SiteSnapshot = {
  url: string;
  title: string;
  description: string;
  text: string;
};

function isPrivateAddress(address: string) {
  if (address === "127.0.0.1" || address === "::1") return true;
  if (address.startsWith("10.") || address.startsWith("192.168.") || address.startsWith("169.254.")) return true;
  const match = address.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  return false;
}

async function assertPublicUrl(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported_protocol");
  if (["localhost", "0.0.0.0"].includes(url.hostname)) throw new Error("private_host");

  if (isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) throw new Error("private_host");
  } else {
    const records = await lookup(url.hostname, { all: true });
    if (!records.length || records.some((record) => isPrivateAddress(record.address))) throw new Error("private_host");
  }
  return url;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function pickMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return "";
}

export async function inspectPublicSite(input: string): Promise<SiteSnapshot> {
  let url = await assertPublicUrl(input);

  for (let hop = 0; hop < 3; hop += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "HAY-Engine-Business-Inspector/1.0" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("redirect_without_location");
        url = await assertPublicUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) throw new Error(`site_http_${response.status}`);
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("text/html")) throw new Error("site_not_html");
      const html = (await response.text()).slice(0, 250_000);
      const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "");
      const description = pickMeta(html, "description") || pickMeta(html, "og:description");
      const text = decodeEntities(html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim())
        .slice(0, 8_000);
      return { url: url.toString(), title, description, text };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("too_many_redirects");
}
