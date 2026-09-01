import "server-only";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type MarketingPerformanceContext = {
  measuredPosts: number;
  totals: { views: number; reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number; conversions: number };
  platformLeaders: Array<{ platform: string; posts: number; views: number; engagements: number }>;
  topContent: Array<{ platform: string; format: string; hook: string; objective: string; views: number; engagements: number; saves: number; clicks: number; conversions: number }>;
};

const number = (value: unknown) => Number(value) || 0;

export async function loadMarketingPerformance(businessId?: string, businessName?: string): Promise<MarketingPerformanceContext | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;

  let query = supabase.from("businesses").select("id").eq("owner_id", userId).limit(1);
  if (businessId) query = query.eq("id", businessId);
  else if (businessName?.trim()) query = query.eq("name", businessName.trim());
  else return null;
  const { data: business } = await query.maybeSingle();
  if (!business?.id) return null;
  const resolvedBusinessId = String(business.id);

  const [{ data: snapshots }, { data: content }] = await Promise.all([
    supabase.from("content_metrics")
      .select("content_item_id,platform,views,reach,likes,comments,shares,saves,clicks,conversions,measured_at")
      .eq("business_id", resolvedBusinessId).order("measured_at", { ascending: false }).limit(250),
    supabase.from("content_items")
      .select("id,platform,format,hook,objective")
      .eq("business_id", resolvedBusinessId).limit(250),
  ]);

  if (!snapshots?.length) return null;
  const latest = new Map<string, Record<string, unknown>>();
  for (const row of snapshots as Array<Record<string, unknown>>) {
    const id = String(row.content_item_id || "");
    if (id && !latest.has(id)) latest.set(id, row);
  }
  const contentById = new Map((content || []).map(item => [String(item.id), item]));
  const totals = { views:0, reach:0, likes:0, comments:0, shares:0, saves:0, clicks:0, conversions:0 };
  const platforms = new Map<string, { posts:number; views:number; engagements:number }>();
  const ranked: MarketingPerformanceContext["topContent"] = [];

  for (const [id, row] of latest) {
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += number(row[key]);
    const platform = String(row.platform || contentById.get(id)?.platform || "unknown");
    const engagements = number(row.likes) + number(row.comments) + number(row.shares) + number(row.saves);
    const p = platforms.get(platform) || { posts:0, views:0, engagements:0 };
    p.posts += 1; p.views += number(row.views); p.engagements += engagements; platforms.set(platform, p);
    const item = contentById.get(id);
    ranked.push({
      platform,
      format: String(item?.format || "unknown"),
      hook: String(item?.hook || ""),
      objective: String(item?.objective || ""),
      views: number(row.views),
      engagements,
      saves: number(row.saves),
      clicks: number(row.clicks),
      conversions: number(row.conversions),
    });
  }

  ranked.sort((a,b) => (b.views + b.engagements*8 + b.saves*10 + b.clicks*12 + b.conversions*30) - (a.views + a.engagements*8 + a.saves*10 + a.clicks*12 + a.conversions*30));
  return {
    measuredPosts: latest.size,
    totals,
    platformLeaders: [...platforms.entries()].map(([platform, stats]) => ({ platform, ...stats })).sort((a,b) => (b.views + b.engagements*8) - (a.views + a.engagements*8)),
    topContent: ranked.slice(0, 8),
  };
}
