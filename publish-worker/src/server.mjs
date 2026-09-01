import http from "node:http";
import dns from "node:dns/promises";
import net from "node:net";
import { createClient } from "@supabase/supabase-js";

const PORT = Number(process.env.PORT || 8080);
const WORKER_SECRET = process.env.PUBLISH_WORKER_SECRET || "";
const SUPABASE_URL = process.env.HAY_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const POLL_MS = Math.max(10_000, Number(process.env.PUBLISH_POLL_MS || 30_000));
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";
const META_TOKEN_MODE = process.env.META_TOKEN_MODE || "facebook";

if (!WORKER_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("HAY publish worker missing PUBLISH_WORKER_SECRET / Supabase server configuration");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

class NeedsApprovalError extends Error {}
class NeedsAuthError extends Error {}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function nowIso() { return new Date().toISOString(); }

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function providerJson(url, init = {}) {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* provider may return text */ }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new NeedsAuthError(`${response.status}:${text.slice(0, 500)}`);
    throw new Error(`${response.status}:${text.slice(0, 500)}`);
  }
  return { data, response };
}

async function getCredential(connectionId) {
  const { data, error } = await supabase.rpc("hay_get_oauth_secret", { p_connection_id: connectionId });
  if (error) throw error;
  if (!data) throw new NeedsAuthError("oauth_credential_missing");
  return JSON.parse(String(data));
}

async function saveCredential(connectionId, credential) {
  const { error } = await supabase.rpc("hay_store_oauth_secret", {
    p_connection_id: connectionId,
    p_secret: JSON.stringify(credential),
  });
  if (error) throw error;
}

async function loadJob(jobId) {
  const { data: job, error } = await supabase.from("publish_jobs")
    .select("id,business_id,content_item_id,connection_id,platform,status,scheduled_for,provider_settings,external_post_id,attempt_count")
    .eq("id", jobId).maybeSingle();
  if (error) throw error;
  if (!job) throw new Error("publish_job_not_found");

  const [{ data: content, error: contentError }, { data: connection, error: connectionError }] = await Promise.all([
    supabase.from("content_items").select("id,business_id,platform,format,hook,caption,cta,hashtags,asset_url,status").eq("id", job.content_item_id).maybeSingle(),
    supabase.from("social_connections").select("id,business_id,platform,status,account_id,account_name,credential_ref").eq("id", job.connection_id).maybeSingle(),
  ]);
  if (contentError) throw contentError;
  if (connectionError) throw connectionError;
  if (!content) throw new Error("content_item_not_found");
  if (!connection || connection.status !== "connected" || !connection.credential_ref) throw new NeedsAuthError("social_connection_not_ready");
  if (content.business_id !== job.business_id || connection.business_id !== job.business_id) throw new Error("job_business_mismatch");
  if (content.platform !== job.platform || connection.platform !== job.platform) throw new Error("job_platform_mismatch");
  return { job, content, connection };
}

async function updateJob(jobId, patch) {
  const { error } = await supabase.from("publish_jobs").update({ ...patch, updated_at: nowIso() }).eq("id", jobId);
  if (error) throw error;
}

async function markPublished({ job, content }, externalId, providerSettings = {}) {
  await Promise.all([
    supabase.from("publish_jobs").update({
      status: "published",
      external_post_id: externalId || null,
      error: null,
      provider_settings: providerSettings,
      updated_at: nowIso(),
    }).eq("id", job.id),
    supabase.from("content_items").update({ status: "published", published_at: nowIso(), updated_at: nowIso() }).eq("id", content.id),
  ]);
  return { status: "published", externalId };
}

function metaBase() {
  if (process.env.META_GRAPH_BASE_URL) return process.env.META_GRAPH_BASE_URL.replace(/\/$/, "");
  return META_TOKEN_MODE === "instagram"
    ? `https://graph.instagram.com/${META_GRAPH_VERSION}`
    : `https://graph.facebook.com/${META_GRAPH_VERSION}`;
}

function contentCaption(content) {
  const hashtags = Array.isArray(content.hashtags) ? content.hashtags.join(" ") : "";
  return [content.caption, content.cta, hashtags].filter(Boolean).join("\n\n").slice(0, 2100);
}

async function publishInstagram(context, credential) {
  const { job, content, connection } = context;
  const accountId = connection.account_id || credential.accountId;
  if (!accountId) throw new NeedsAuthError("instagram_account_id_missing_reconnect_required");
  if (!content.asset_url) throw new Error("content_asset_missing");
  const base = metaBase();
  const isVideo = ["reel", "short", "video"].includes(content.format);
  const params = new URLSearchParams({ access_token: credential.accessToken, caption: contentCaption(content) });
  if (isVideo) {
    params.set("media_type", "REELS");
    params.set("video_url", content.asset_url);
    params.set("share_to_feed", String(job.provider_settings?.share_to_feed !== false));
  } else {
    params.set("image_url", content.asset_url);
  }
  const create = await providerJson(`${base}/${encodeURIComponent(accountId)}/media?${params}`, { method: "POST" });
  const containerId = create.data.id;
  if (!containerId) throw new Error(`instagram_container_missing:${JSON.stringify(create.data).slice(0, 300)}`);

  if (isVideo) {
    let finished = false;
    for (let attempt = 0; attempt < 18; attempt++) {
      await sleep(attempt === 0 ? 2500 : 5000);
      const status = await providerJson(`${base}/${encodeURIComponent(containerId)}?fields=status_code,status&access_token=${encodeURIComponent(credential.accessToken)}`);
      const code = String(status.data.status_code || "");
      if (code === "FINISHED") { finished = true; break; }
      if (["ERROR", "EXPIRED"].includes(code)) throw new Error(`instagram_container_${code}:${String(status.data.status || "")}`);
    }
    if (!finished) throw new Error("instagram_container_timeout");
  }

  const publish = await providerJson(`${base}/${encodeURIComponent(accountId)}/media_publish?creation_id=${encodeURIComponent(containerId)}&access_token=${encodeURIComponent(credential.accessToken)}`, { method: "POST" });
  const mediaId = publish.data.id;
  if (!mediaId) throw new Error(`instagram_publish_id_missing:${JSON.stringify(publish.data).slice(0, 300)}`);
  return markPublished(context, String(mediaId), { ...(job.provider_settings || {}), container_id: String(containerId) });
}

async function queryTikTokCreator(accessToken) {
  const result = await providerJson("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: "{}",
  });
  return result.data.data || {};
}

function requireTikTokApproval(settings, creatorInfo) {
  const consentAt = Date.parse(String(settings.consent_at || settings.consentAt || ""));
  const creatorFetchedAt = Date.parse(String(settings.creator_info_fetched_at || settings.creatorInfoFetchedAt || ""));
  const privacy = String(settings.privacy_level || "");
  if (!Number.isFinite(consentAt) || !Number.isFinite(creatorFetchedAt) || consentAt < creatorFetchedAt) {
    throw new NeedsApprovalError("tiktok_explicit_consent_required");
  }
  if (!privacy) throw new NeedsApprovalError("tiktok_privacy_selection_required");
  const options = Array.isArray(creatorInfo.privacy_level_options) ? creatorInfo.privacy_level_options.map(String) : [];
  if (!options.includes(privacy)) throw new NeedsApprovalError("tiktok_privacy_options_changed_reapproval_required");
  for (const key of ["disable_comment", "disable_duet", "disable_stitch"]) {
    if (typeof settings[key] !== "boolean") throw new NeedsApprovalError(`tiktok_${key}_selection_required`);
  }
}

async function pollTikTok(context, credential, publishId) {
  const result = await providerJson("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
    method: "POST",
    headers: { Authorization: `Bearer ${credential.accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const data = result.data.data || {};
  if (data.status === "PUBLISH_COMPLETE") {
    const postIds = Array.isArray(data.publicaly_available_post_id) ? data.publicaly_available_post_id : [];
    const externalId = postIds.length ? String(postIds[0]) : String(publishId);
    return markPublished(context, externalId, { ...(context.job.provider_settings || {}), publish_id: String(publishId), last_status: data });
  }
  if (data.status === "FAILED") throw new Error(`tiktok_publish_failed:${String(data.fail_reason || "unknown")}`);
  await updateJob(context.job.id, {
    status: "processing",
    provider_settings: { ...(context.job.provider_settings || {}), publish_id: String(publishId), last_status: data },
    error: null,
  });
  return { status: "processing", publishId: String(publishId) };
}

async function publishTikTok(context, credential) {
  const { job, content } = context;
  if (!content.asset_url) throw new Error("content_asset_missing");
  const existingPublishId = job.provider_settings?.publish_id;
  if (existingPublishId) return pollTikTok(context, credential, String(existingPublishId));

  const creatorInfo = await queryTikTokCreator(credential.accessToken);
  requireTikTokApproval(job.provider_settings || {}, creatorInfo);
  const settings = job.provider_settings || {};
  const postInfo = {
    title: contentCaption(content).slice(0, 2200),
    privacy_level: settings.privacy_level,
    disable_comment: settings.disable_comment,
    disable_duet: settings.disable_duet,
    disable_stitch: settings.disable_stitch,
  };
  if (typeof settings.brand_content_toggle === "boolean") postInfo.brand_content_toggle = settings.brand_content_toggle;
  if (typeof settings.brand_organic_toggle === "boolean") postInfo.brand_organic_toggle = settings.brand_organic_toggle;

  const init = await providerJson("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${credential.accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      post_info: postInfo,
      source_info: { source: "PULL_FROM_URL", video_url: content.asset_url },
    }),
  });
  const publishId = init.data.data?.publish_id;
  if (!publishId) throw new Error(`tiktok_publish_id_missing:${JSON.stringify(init.data).slice(0, 350)}`);
  await updateJob(job.id, {
    status: "processing",
    provider_settings: { ...settings, publish_id: String(publishId), creator_info_at_publish: creatorInfo },
    error: null,
  });
  return pollTikTok({ ...context, job: { ...job, provider_settings: { ...settings, publish_id: String(publishId) } } }, credential, String(publishId));
}

function isPrivateIp(ip) {
  if (!net.isIP(ip)) return true;
  if (ip.includes(":")) {
    const value = ip.toLowerCase();
    return value === "::1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd");
  }
  const parts = ip.split(".").map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

async function assertPublicHttpsUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("media_url_https_required");
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(record => isPrivateIp(record.address))) throw new Error("media_url_private_network_blocked");
  return url;
}

async function ensureGoogleAccessToken(connectionId, credential) {
  const expires = credential.expiresAt ? Date.parse(credential.expiresAt) : Number.POSITIVE_INFINITY;
  if (expires > Date.now() + 90_000) return credential;
  if (!credential.refreshToken) throw new NeedsAuthError("youtube_refresh_token_missing_reconnect_required");
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: credential.refreshToken,
    grant_type: "refresh_token",
  });
  const refreshed = await providerJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const next = {
    ...credential,
    accessToken: String(refreshed.data.access_token || ""),
    expiresAt: new Date(Date.now() + (Number(refreshed.data.expires_in) || 3600) * 1000).toISOString(),
    tokenType: refreshed.data.token_type ? String(refreshed.data.token_type) : credential.tokenType,
  };
  if (!next.accessToken) throw new NeedsAuthError("youtube_refresh_failed");
  await saveCredential(connectionId, next);
  return next;
}

async function publishYouTube(context, rawCredential) {
  const { job, content, connection } = context;
  if (!content.asset_url) throw new Error("content_asset_missing");
  await assertPublicHttpsUrl(content.asset_url);
  const credential = await ensureGoogleAccessToken(connection.id, rawCredential);

  const media = await fetch(content.asset_url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!media.ok || !media.body) throw new Error(`youtube_media_fetch_${media.status}`);
  const contentType = media.headers.get("content-type") || "video/mp4";
  if (!contentType.startsWith("video/")) throw new Error("youtube_video_asset_required");
  const contentLength = media.headers.get("content-length");
  const settings = job.provider_settings || {};
  const title = String(settings.title || content.hook || "HAY video").slice(0, 100);
  const description = contentCaption(content).slice(0, 5000);
  const metadata = {
    snippet: { title, description },
    status: { privacyStatus: String(settings.privacyStatus || "private") },
  };
  const initResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credential.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": contentType,
      ...(contentLength ? { "X-Upload-Content-Length": contentLength } : {}),
    },
    body: JSON.stringify(metadata),
    signal: AbortSignal.timeout(30_000),
  });
  if (initResponse.status === 401 || initResponse.status === 403) throw new NeedsAuthError(`youtube_init_${initResponse.status}`);
  if (!initResponse.ok) throw new Error(`youtube_init_${initResponse.status}:${(await initResponse.text()).slice(0, 400)}`);
  const uploadUrl = initResponse.headers.get("location");
  if (!uploadUrl) throw new Error("youtube_resumable_location_missing");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, ...(contentLength ? { "Content-Length": contentLength } : {}) },
    body: media.body,
    duplex: "half",
    signal: AbortSignal.timeout(30 * 60_000),
  });
  const text = await uploadResponse.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* ignored */ }
  if (uploadResponse.status === 401 || uploadResponse.status === 403) throw new NeedsAuthError(`youtube_upload_${uploadResponse.status}`);
  if (!uploadResponse.ok) throw new Error(`youtube_upload_${uploadResponse.status}:${text.slice(0, 500)}`);
  const videoId = data.id;
  if (!videoId) throw new Error("youtube_video_id_missing");
  return markPublished(context, String(videoId), { ...settings, youtube_video_id: String(videoId) });
}

export async function processJob(jobId) {
  const context = await loadJob(jobId);
  const { job } = context;
  if (job.status === "published") return { status: "published", externalId: job.external_post_id };
  if (job.scheduled_for && Date.parse(job.scheduled_for) > Date.now() + 5_000) return { status: "scheduled" };
  if (["needs_auth", "needs_approval", "failed"].includes(job.status)) return { status: job.status };

  await updateJob(job.id, { status: "processing", attempt_count: Number(job.attempt_count || 0) + 1, error: null });
  try {
    const credential = await getCredential(job.connection_id);
    if (job.platform === "instagram") return await publishInstagram(context, credential);
    if (job.platform === "tiktok") return await publishTikTok(context, credential);
    if (job.platform === "youtube") return await publishYouTube(context, credential);
    throw new Error(`publisher_not_implemented:${job.platform}`);
  } catch (error) {
    if (error instanceof NeedsApprovalError) {
      await updateJob(job.id, { status: "needs_approval", error: error.message });
      return { status: "needs_approval", error: error.message };
    }
    if (error instanceof NeedsAuthError) {
      await updateJob(job.id, { status: "needs_auth", error: error.message });
      return { status: "needs_auth", error: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("Publish job failed", job.id, message);
    await updateJob(job.id, { status: "failed", error: message.slice(0, 1000) });
    return { status: "failed", error: message };
  }
}

let scanning = false;
async function scanDueJobs() {
  if (scanning || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  scanning = true;
  try {
    const { data, error } = await supabase.from("publish_jobs")
      .select("id")
      .in("status", ["queued", "processing"])
      .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso()}`)
      .order("created_at", { ascending: true })
      .limit(10);
    if (error) throw error;
    for (const row of data || []) await processJob(row.id);
  } catch (error) {
    console.error("Publish worker scan failed", error);
  } finally {
    scanning = false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return jsonResponse(res, 200, {
        ok: true,
        service: "HAY Publish Worker",
        providers: { instagram: true, tiktok: true, youtube: true },
        supabase: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
      });
    }
    if (req.method === "POST" && req.url === "/jobs") {
      if (!WORKER_SECRET || req.headers.authorization !== `Bearer ${WORKER_SECRET}`) return jsonResponse(res, 401, { error: "unauthorized" });
      const body = await readJson(req);
      const jobId = String(body.jobId || "");
      if (!jobId) return jsonResponse(res, 400, { error: "job_id_required" });
      void processJob(jobId).catch(error => console.error("Immediate job dispatch failed", jobId, error));
      return jsonResponse(res, 202, { accepted: true, jobId });
    }
    return jsonResponse(res, 404, { error: "not_found" });
  } catch (error) {
    console.error("Worker request failed", error);
    return jsonResponse(res, 500, { error: "worker_request_failed" });
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`HAY publish worker listening on :${PORT}`));
setInterval(() => void scanDueJobs(), POLL_MS).unref();
void scanDueJobs();
