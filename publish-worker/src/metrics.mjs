import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.HAY_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";
const META_TOKEN_MODE = process.env.META_TOKEN_MODE || "facebook";
const METRIC_INTERVAL_MS = Math.max(60 * 60_000, Number(process.env.METRIC_SNAPSHOT_INTERVAL_MS || 6 * 60 * 60_000));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function readCredential(connectionId) {
  const { data, error } = await supabase.rpc("hay_get_oauth_secret", { p_connection_id: connectionId });
  if (error || !data) return null;
  try { return JSON.parse(String(data)); } catch { return null; }
}

async function providerJson(url, accessToken, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`metrics_provider_${response.status}:${(await response.text()).slice(0, 300)}`);
  return response.json();
}

function metaBase() {
  if (process.env.META_GRAPH_BASE_URL) return process.env.META_GRAPH_BASE_URL.replace(/\/$/, "");
  return META_TOKEN_MODE === "instagram" ? `https://graph.instagram.com/${META_GRAPH_VERSION}` : `https://graph.facebook.com/${META_GRAPH_VERSION}`;
}

function metricValue(item) {
  if (item?.total_value && typeof item.total_value.value === "number") return item.total_value.value;
  const value = item?.values?.[0]?.value;
  return typeof value === "number" ? value : Number(value) || 0;
}

async function instagramMetrics(postId, credential) {
  const requested = (process.env.META_MEDIA_INSIGHTS_METRICS || "views,reach,likes,comments,shares,saved").split(",").map(x => x.trim()).filter(Boolean);
  const output = {};
  const raw = {};
  for (const metric of requested) {
    try {
      const data = await providerJson(`${metaBase()}/${encodeURIComponent(postId)}/insights?metric=${encodeURIComponent(metric)}`, credential.accessToken);
      const row = Array.isArray(data.data) ? data.data[0] : undefined;
      output[metric] = metricValue(row);
      raw[metric] = row || data;
    } catch (error) {
      raw[metric] = { unavailable: true, error: error instanceof Error ? error.message : String(error) };
    }
  }
  return {
    views: output.views ?? null,
    reach: output.reach ?? null,
    likes: output.likes ?? null,
    comments: output.comments ?? null,
    shares: output.shares ?? null,
    saves: output.saved ?? null,
    raw,
  };
}

async function tiktokMetrics(postId, credential) {
  if (!/^\d+$/.test(String(postId))) return null;
  const fields = "id,view_count,like_count,comment_count,share_count,title,video_description,is_aigc";
  const data = await providerJson(`https://open.tiktokapis.com/v2/video/query/?fields=${encodeURIComponent(fields)}`, credential.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters: { video_ids: [String(postId)] } }),
  });
  const video = data?.data?.videos?.[0];
  if (!video) return null;
  return {
    views: Number(video.view_count) || 0,
    likes: Number(video.like_count) || 0,
    comments: Number(video.comment_count) || 0,
    shares: Number(video.share_count) || 0,
    raw: video,
  };
}

async function youtubeMetrics(videoId, credential) {
  const data = await providerJson(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoId)}`, credential.accessToken);
  const item = data?.items?.[0];
  const stats = item?.statistics;
  if (!stats) return null;
  return {
    views: Number(stats.viewCount) || 0,
    likes: Number(stats.likeCount) || 0,
    comments: Number(stats.commentCount) || 0,
    raw: item,
  };
}

async function recentlyMeasured(contentItemId) {
  const { data } = await supabase.from("content_metrics").select("measured_at").eq("content_item_id", contentItemId).order("measured_at", { ascending: false }).limit(1).maybeSingle();
  return data?.measured_at && Date.now() - Date.parse(data.measured_at) < METRIC_INTERVAL_MS;
}

export async function collectMetricSnapshot(job) {
  if (!job.external_post_id || await recentlyMeasured(job.content_item_id)) return { skipped: true };
  const credential = await readCredential(job.connection_id);
  if (!credential?.accessToken) return { skipped: true, reason: "credential_missing" };
  let metrics = null;
  if (job.platform === "instagram") metrics = await instagramMetrics(job.external_post_id, credential);
  if (job.platform === "tiktok") metrics = await tiktokMetrics(job.external_post_id, credential);
  if (job.platform === "youtube") metrics = await youtubeMetrics(job.external_post_id, credential);
  if (!metrics) return { skipped: true, reason: "metrics_unavailable" };

  const row = {
    business_id: job.business_id,
    content_item_id: job.content_item_id,
    platform: job.platform,
    external_post_id: job.external_post_id,
    measured_at: new Date().toISOString(),
    impressions: metrics.impressions ?? null,
    reach: metrics.reach ?? null,
    views: metrics.views ?? null,
    likes: metrics.likes ?? null,
    comments: metrics.comments ?? null,
    shares: metrics.shares ?? null,
    saves: metrics.saves ?? null,
    clicks: metrics.clicks ?? null,
    conversions: metrics.conversions ?? null,
    watch_time_seconds: metrics.watch_time_seconds ?? null,
    raw: metrics.raw || {},
  };
  const { error } = await supabase.from("content_metrics").insert(row);
  if (error) throw error;
  return { inserted: true, row };
}

let collecting = false;
export async function collectDueMetrics() {
  if (collecting || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  collecting = true;
  try {
    const { data, error } = await supabase.from("publish_jobs")
      .select("id,business_id,content_item_id,connection_id,platform,external_post_id,updated_at")
      .eq("status", "published")
      .not("external_post_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    for (const job of data || []) {
      try { await collectMetricSnapshot(job); }
      catch (error) { console.error("Metric collection failed", job.id, error instanceof Error ? error.message : error); }
    }
  } finally {
    collecting = false;
  }
}
