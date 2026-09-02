import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { effectiveOutcome, loadAttributionSummary } from "@/lib/marketing/attribution";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
const WORKSPACE_COOKIE="hay_business_id";

type MetricRow = {
  content_item_id?: string | null;
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

type MetricTotals = {
  impressions:number;
  reach:number;
  views:number;
  likes:number;
  comments:number;
  shares:number;
  saves:number;
  clicks:number;
  conversions:number;
  watchTimeSeconds:number;
};

const number = (value: unknown) => Number(value || 0);
const scorePlatform = (row:{views:number;saves:number;clicks:number;conversions:number}) => row.views + row.saves * 4 + row.clicks * 6 + row.conversions * 20;

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, approvals: [], metrics: null, recentPublished: [], operations: null, calendar: [] });
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const explicitBusinessId = url.searchParams.get("businessId");
  const workspaceBusinessId = (await cookies()).get(WORKSPACE_COOKIE)?.value || null;
  const requestedBusinessId = explicitBusinessId || workspaceBusinessId;

  let businessQuery = supabase.from("businesses").select("id,name").eq("owner_id", userId);
  if (requestedBusinessId) businessQuery = businessQuery.eq("id", requestedBusinessId);
  let { data: businesses, error: businessError } = await businessQuery.order("created_at", { ascending: false }).limit(1);
  if (businessError) return NextResponse.json({ error: "business_read_failed", detail: businessError.message }, { status: 500 });

  if (!businesses?.[0] && !explicitBusinessId && workspaceBusinessId) {
    const fallback = await supabase.from("businesses").select("id,name").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1);
    businesses = fallback.data;
    businessError = fallback.error;
    if (businessError) return NextResponse.json({ error: "business_read_failed", detail: businessError.message }, { status: 500 });
  }

  const business = businesses?.[0];
  if (!business) return NextResponse.json({ configured: true, business: null, approvals: [], metrics: null, recentPublished: [], operations: null, calendar: [] });

  const businessId = String(business.id);
  const [contentResult, jobsResult, metricsResult, attribution] = await Promise.all([
    supabase.from("content_items")
      .select("id,platform,format,language,objective,hook,caption,cta,asset_url,status,scheduled_for,published_at,created_at,updated_at")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(60),
    supabase.from("publish_jobs")
      .select("id,content_item_id,connection_id,platform,status,scheduled_for,external_post_id,error,attempt_count,created_at,updated_at")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(60),
    supabase.from("content_metrics")
      .select("content_item_id,platform,external_post_id,measured_at,impressions,reach,views,likes,comments,shares,saves,clicks,conversions,watch_time_seconds")
      .eq("business_id", businessId)
      .order("measured_at", { ascending: false })
      .limit(250),
    loadAttributionSummary(supabase,businessId),
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

  const latestByContent = new Map<string, MetricRow>();
  for (const row of metrics) {
    const contentItemId = String(row.content_item_id || "");
    if (contentItemId && !latestByContent.has(contentItemId)) latestByContent.set(contentItemId, row);
  }
  const outcomeIds = new Set([...latestByContent.keys(), ...attribution.byContent.keys()]);
  const latestMetrics:MetricRow[] = [...outcomeIds].map(contentItemId => {
    const row=latestByContent.get(contentItemId)||{};
    const outcome=effectiveOutcome(number(row.clicks),number(row.conversions),attribution.byContent.get(contentItemId));
    return {...row,content_item_id:contentItemId,platform:row.platform||String(contentById.get(contentItemId)?.platform||"unknown"),clicks:outcome.clicks,conversions:outcome.conversions};
  });
  const emptyTotals: MetricTotals = { impressions: 0, reach: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, conversions: 0, watchTimeSeconds: 0 };
  const totals = latestMetrics.reduce<MetricTotals>((acc, row) => ({
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
  }), emptyTotals);

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
    .map(job => ({ ...job, content: contentById.get(String(job.content_item_id)) || null }));

  const now = Date.now();
  const next24h = now + 24 * 60 * 60 * 1000;
  const scheduledJobs = jobs
    .filter(job => job.scheduled_for && !["published", "failed", "cancelled"].includes(String(job.status)))
    .map(job => ({ ...job, scheduledAt: new Date(String(job.scheduled_for)).getTime() }))
    .filter(job => Number.isFinite(job.scheduledAt) && job.scheduledAt >= now)
    .sort((a,b) => a.scheduledAt - b.scheduledAt);

  const plannedContent = content
    .filter(item => item.scheduled_for && !["published", "failed"].includes(String(item.status)))
    .map(item => ({ ...item, scheduledAt: new Date(String(item.scheduled_for)).getTime() }))
    .filter(item => Number.isFinite(item.scheduledAt) && item.scheduledAt >= now)
    .sort((a,b) => a.scheduledAt - b.scheduledAt);

  const jobContentIds = new Set(scheduledJobs.map(job => String(job.content_item_id)));
  const combinedSchedule = [
    ...scheduledJobs.map(job => ({ id:String(job.id), contentItemId:String(job.content_item_id), platform:String(job.platform), status:String(job.status), scheduledFor:job.scheduled_for, scheduledAt:job.scheduledAt, source:"publish_job" as const, content:contentById.get(String(job.content_item_id)) || null })),
    ...plannedContent.filter(item => !jobContentIds.has(String(item.id))).map(item => ({ id:String(item.id), contentItemId:String(item.id), platform:String(item.platform), status:String(item.status), scheduledFor:item.scheduled_for, scheduledAt:item.scheduledAt, source:"plan" as const, content:item })),
  ].sort((a,b)=>a.scheduledAt-b.scheduledAt);

  const nextScheduled = combinedSchedule.slice(0, 4).map(item => ({ id:item.id, platform:item.platform, status:item.status, scheduledFor:item.scheduledFor, source:item.source, content:item.content }));
  const calendar = plannedContent.slice(0, 21).map(item => ({ id:String(item.id), platform:String(item.platform), format:String(item.format), objective:String(item.objective), hook:String(item.hook||""), status:String(item.status), scheduledFor:item.scheduled_for, hasPublishJob:jobByContentId.has(String(item.id)), publishJobStatus:jobByContentId.get(String(item.id))?.status || null }));
  const failedJobs = jobs.filter(job => job.status === "failed").slice(0, 5).map(job => ({ id: job.id, platform: job.platform, error: job.error, attemptCount: job.attempt_count }));
  const statusCounts = content.reduce<Record<string,number>>((acc,item)=>{const key=String(item.status||"unknown");acc[key]=(acc[key]||0)+1;return acc;},{});
  const needsApproval = jobs.filter(job => job.status === "needs_approval").length;
  const bestPlatform = byPlatform.slice().sort((a,b)=>scorePlatform(b)-scorePlatform(a))[0] || null;

  const operations = {
    attentionCount: approvals.filter(item => item.action !== "scheduled").length + failedJobs.length,
    draftCount: statusCounts.draft || 0,
    approvedCount: statusCounts.approved || 0,
    scheduledCount: statusCounts.scheduled || 0,
    publishedCount: statusCounts.published || 0,
    needsApprovalCount: needsApproval,
    failedCount: failedJobs.length,
    scheduledNext24h: combinedSchedule.filter(item => item.scheduledAt <= next24h).length,
    nextScheduled,
    failedJobs,
    bestPlatform,
  };

  return NextResponse.json({
    configured: true,
    business: { id: businessId, name: business.name },
    approvals,
    metrics: { totals, byPlatform, measuredItems: latestMetrics.length, latestMeasuredAt: metrics[0]?.measured_at || null, firstPartyAttribution:{available:attribution.available,trackedClicks:attribution.totals.clicks,trackedConversions:attribution.totals.conversions} },
    recentPublished,
    operations,
    calendar,
  });
}
