import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MetricRow = {
  platform?: string | null;
  measured_at?: string | null;
  impressions?: number | null;
  reach?: number | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
  conversions?: number | null;
  watch_time_seconds?: number | null;
};

const number = (value: unknown) => Number(value || 0);

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, approvals: [], metrics: null, recentPublished: [] });
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const requestedBusinessId = url.searchParams.get("businessId");

  let businessQuery = supabase.from("businesses").select("id,name").eq("owner_id", userId);
  if (requestedBusinessId) businessQuery = businessQuery.eq("id", requestedBusinessId);
  const { data: businesses, error: businessError } = await businessQuery.order("created_at", { ascending: false }).limit(1);
  if (businessError) return NextResponse.json({ error: "business_read_failed", detail: businessError.message }, { status: 500 });
  const business = businesses?.[0];
  if (!business) return NextResponse.json({ configured: true, business: null, approvals: [], metrics: null, recentPublished: [] });

  const businessId = String(business.id);
  const [contentResult, jobsResult, metricsResult] = await Promise.all([
    supabase.from("content_items")
      .select("id,platform,format,language,objective,hook,caption,cta,asset_url,status,scheduled_for,published_at,created_at,updated_at")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase.from("publish_jobs")
      .select("id,content_item_id,connection_id,platform,status,scheduled_for,external_post_id,error,attempt_count,created_at,updated_at")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase.from("content_metrics")
      .select("content_item_id,platform,external_post_id,measured_at,impressions,reach,views,likes,comments,shares,saves,clicks,conversions,watch_time_seconds")
      .eq("business_id", businessId)
      .order("measured_at", { ascending: false })
      .limit(250),
  ]);

  for (const result of [contentResult, jobsResult, metricsResult]) {
    if (result.error) return NextResponse.json({ error: "studio_overview_failed", detail: result.error.message }, { status: 500 });
  }

  const content = contentResult.data || [];
  const jobs = jobsResult.data || [];
  const metrics = (metricsResult.data || []) as MetricRow[];
  const contentById = new Map(content.map(item => [String(item.id), item]));
  const jobByContentId = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) if (!jobByContentId.has(String(job.content_item_id))) jobByContentId.set(String(job.content_item_id), job);

  const approvals = content
    .filter(item => ["draft", "approved", "scheduled"].includes(String(item.status)))
    .map(item => {
      const job = jobByContentId.get(String(item.id));
      return {
        ...item,
        publishJob: job ? {
          id: job.id,
          status: job.status,
          platform: job.platform,
          scheduledFor: job.scheduled_for,
          error: job.error,
          attemptCount: job.attempt_count,
        } : null,
        action: job?.status === "needs_approval" ? "approve_publish" : item.status === "draft" ? "review_content" : item.status === "approved" ? "schedule_or_publish" : "scheduled",
      };
    })
    .slice(0, 12);

  // Keep only the latest metrics snapshot for each content item so totals are not double-counted.
  const latestByContent = new Map<string, MetricRow>();
  for (const row of metrics) {
    const contentItemId = String((row as MetricRow & { content_item_id?: string }).content_item_id || "");
    if (contentItemId && !latestByContent.has(contentItemId)) latestByContent.set(contentItemId, row);
  }
  const latestMetrics = [...latestByContent.values()];
  const totals = latestMetrics.reduce((acc, row) => ({
    impressions: acc.impressions + number(row.impressions),
    reach: acc.reach + number(row.reach),
    views: acc.views + number(row.views),
    likes: acc.likes + number(row.likes),
    comments: acc.comments + number(row.comments),
    shares: acc.shares + number(row.shares),
    saves: acc.saves + number(row.saves),
    clicks: acc.clicks + number(row.clicks),
    conversions: acc.conversions + number(row.conversions),
    watchTimeSeconds: acc.watchTimeSeconds + number(row.watch_time_seconds),
  }), { impressions: 0, reach: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, conversions: 0, watchTimeSeconds: 0 });

  const byPlatform = Object.entries(latestMetrics.reduce<Record<string, { views: number; reach: number; saves: number; clicks: number; conversions: number; posts: number }>>((acc, row) => {
    const platform = String(row.platform || "unknown");
    const current = acc[platform] || { views: 0, reach: 0, saves: 0, clicks: 0, conversions: 0, posts: 0 };
    current.views += number(row.views);
    current.reach += number(row.reach);
    current.saves += number(row.saves);
    current.clicks += number(row.clicks);
    current.conversions += number(row.conversions);
    current.posts += 1;
    acc[platform] = current;
    return acc;
  }, {})).map(([platform, values]) => ({ platform, ...values }));

  const recentPublished = jobs
    .filter(job => job.status === "published")
    .slice(0, 8)
    .map(job => ({
      ...job,
      content: contentById.get(String(job.content_item_id)) || null,
    }));

  return NextResponse.json({
    configured: true,
    business: { id: businessId, name: business.name },
    approvals,
    metrics: { totals, byPlatform, measuredItems: latestMetrics.length, latestMeasuredAt: metrics[0]?.measured_at || null },
    recentPublished,
  });
}
