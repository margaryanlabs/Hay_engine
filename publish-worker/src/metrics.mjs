import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.HAY_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";
const META_TOKEN_MODE = process.env.META_TOKEN_MODE || "facebook";
const METRIC_INTERVAL_MS = Math.max(60 * 60_000, Number(process.env.METRIC_SNAPSHOT_INTERVAL_MS || 6 * 60 * 60_000));
const YEREVAN_OFFSET = "+04:00";

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

function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function text(value) { return String(value || "").trim(); }
function num(value) { return Number(value) || 0; }
function campaignContentIds(campaign) {
  const ids = [];
  for (const raw of Array.isArray(campaign?.phases) ? campaign.phases : []) {
    const phase = object(raw);
    for (const id of Array.isArray(phase.contentItemIds) ? phase.contentItemIds : []) {
      const value = text(id);
      if (value) ids.push(value);
    }
  }
  return [...new Set(ids)];
}
function campaignPrimaryMetric(kpi) {
  if (kpi === "conversion" || kpi === "retention") return "conversions";
  if (kpi === "trust") return "saves";
  if (kpi === "community") return "comments";
  return "reach";
}
function campaignStatus(campaign) {
  const start = Date.parse(`${text(campaign?.startDate)}T00:00:00${YEREVAN_OFFSET}`);
  const end = Date.parse(`${text(campaign?.endDate)}T23:59:59${YEREVAN_OFFSET}`);
  const now = Date.now();
  if (Number.isFinite(start) && now < start) return "upcoming";
  if (Number.isFinite(end) && now > end) return "completed";
  return "active";
}
function evidenceQuality(total, measured) {
  if (!measured) return "none";
  if (measured < 3) return "early";
  if (measured / Math.max(1, total) < 0.7) return "partial";
  return "strong";
}

async function updateCampaignLearning(businessId, contentItemId) {
  const { data: content, error: contentError } = await supabase.from("content_items")
    .select("id,plan_id").eq("id", contentItemId).eq("business_id", businessId).maybeSingle();
  if (contentError || !content?.plan_id) return { skipped: true, reason: "campaign_plan_missing" };

  const { data: plan, error: planError } = await supabase.from("marketing_plans")
    .select("id,strategy").eq("id", content.plan_id).eq("business_id", businessId).maybeSingle();
  if (planError || !plan) return { skipped: true, reason: "campaign_plan_missing" };
  const strategy = object(plan.strategy);
  const campaign = object(strategy.campaign);
  if (!Object.keys(campaign).length) return { skipped: true, reason: "not_campaign_plan" };
  const ids = campaignContentIds(campaign);
  if (!ids.includes(String(contentItemId)) || !ids.length) return { skipped: true, reason: "content_not_in_campaign" };

  const [contentResult, metricResult] = await Promise.all([
    supabase.from("content_items").select("id,platform,format,objective,hook").eq("business_id", businessId).in("id", ids),
    supabase.from("content_metrics").select("content_item_id,measured_at,views,reach,likes,comments,shares,saves,clicks,conversions,watch_time_seconds")
      .eq("business_id", businessId).in("content_item_id", ids).order("measured_at", { ascending: false }).limit(500),
  ]);
  if (contentResult.error || metricResult.error) return { skipped: true, reason: "campaign_learning_read_failed" };

  const contentById = new Map((contentResult.data || []).map(row => [String(row.id), row]));
  const latest = new Map();
  for (const row of metricResult.data || []) {
    const id = String(row.content_item_id || "");
    if (id && !latest.has(id)) latest.set(id, row);
  }
  const primaryMetric = campaignPrimaryMetric(text(campaign.primaryKpi));
  const measured = [];
  let primaryTotal = 0;
  let viewsTotal = 0;
  let reachTotal = 0;
  let latestMeasuredAt = "";
  for (const id of ids) {
    const metric = latest.get(id);
    if (!metric) continue;
    const item = contentById.get(id) || {};
    const primaryValue = num(metric[primaryMetric]);
    const views = num(metric.views);
    const reach = num(metric.reach);
    primaryTotal += primaryValue;
    viewsTotal += views;
    reachTotal += reach;
    if (!latestMeasuredAt || Date.parse(metric.measured_at) > Date.parse(latestMeasuredAt)) latestMeasuredAt = String(metric.measured_at || "");
    measured.push({
      id,
      platform: text(item.platform) || "unknown",
      format: text(item.format) || "unknown",
      objective: text(item.objective),
      hook: text(item.hook),
      primaryValue,
      views,
      reach,
    });
  }

  const bestPrimary = measured.filter(item => item.primaryValue > 0).sort((a, b) => b.primaryValue - a.primaryValue)[0] || null;
  const reachLeader = [...measured].sort((a, b) => (b.reach || b.views) - (a.reach || a.views))[0] || null;
  const formatMap = new Map();
  for (const item of measured) {
    const current = formatMap.get(item.format) || { items: 0, primaryTotal: 0, viewsTotal: 0, reachTotal: 0 };
    current.items += 1;
    current.primaryTotal += item.primaryValue;
    current.viewsTotal += item.views;
    current.reachTotal += item.reach;
    formatMap.set(item.format, current);
  }
  const formatSignals = [...formatMap.entries()].map(([format, value]) => ({
    format,
    measuredItems: value.items,
    averagePrimaryMetric: value.primaryTotal / Math.max(1, value.items),
    averageViews: value.viewsTotal / Math.max(1, value.items),
    averageReach: value.reachTotal / Math.max(1, value.items),
  })).sort((a, b) => b.averagePrimaryMetric - a.averagePrimaryMetric || b.averageReach - a.averageReach || b.averageViews - a.averageViews);

  const phaseSignals = [];
  for (const raw of Array.isArray(campaign.phases) ? campaign.phases : []) {
    const phase = object(raw);
    const phaseIds = Array.isArray(phase.contentItemIds) ? phase.contentItemIds.map(String) : [];
    const phaseMeasured = measured.filter(item => phaseIds.includes(item.id));
    phaseSignals.push({
      name: text(phase.name),
      label: text(phase.label),
      totalItems: phaseIds.length,
      measuredItems: phaseMeasured.length,
      averagePrimaryMetric: phaseMeasured.reduce((sum, item) => sum + item.primaryValue, 0) / Math.max(1, phaseMeasured.length),
      averageViews: phaseMeasured.reduce((sum, item) => sum + item.views, 0) / Math.max(1, phaseMeasured.length),
      averageReach: phaseMeasured.reduce((sum, item) => sum + item.reach, 0) / Math.max(1, phaseMeasured.length),
    });
  }

  const learning = {
    version: "campaign-learning-v1",
    campaignId: text(campaign.id),
    campaignName: text(campaign.name),
    campaignStatus: campaignStatus(campaign),
    primaryKpi: text(campaign.primaryKpi) || "reach",
    primaryMetric,
    totalItems: ids.length,
    measuredItems: measured.length,
    coverage: measured.length / Math.max(1, ids.length),
    evidenceQuality: evidenceQuality(ids.length, measured.length),
    primaryMetricTotal: primaryTotal,
    viewsTotal,
    reachTotal,
    topPrimaryContent: bestPrimary,
    secondaryReachLeader: reachLeader,
    formatSignals: formatSignals.slice(0, 5),
    phaseSignals,
    causalStatus: "observational_only",
    latestMeasuredAt: latestMeasuredAt || null,
    updatedAt: new Date().toISOString(),
  };
  const { error: updateError } = await supabase.from("marketing_plans").update({ strategy: { ...strategy, campaignLearning: learning } })
    .eq("id", plan.id).eq("business_id", businessId);
  if (updateError) throw updateError;
  return { updated: true, learning };
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
  let learning = null;
  try { learning = await updateCampaignLearning(job.business_id, job.content_item_id); }
  catch (error) { console.error("Campaign learning update failed", job.content_item_id, error instanceof Error ? error.message : error); }
  return { inserted: true, row, learning };
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
