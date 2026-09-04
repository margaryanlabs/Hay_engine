import "server-only";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { remapCampaignBlueprint, type CampaignBlueprint } from "./campaign";
import { buildContentSeriesArchitecture } from "./series";
import type { MarketingPlan } from "./types";

export type PersistedPlanResult = {
  persisted: boolean;
  businessId?: string;
  planId?: string;
  plan: MarketingPlan;
  idMap: Record<string, string>;
  reason?: string;
};

type PersistPlanOptions={campaign?:CampaignBlueprint};

function profileRow(plan:MarketingPlan){
  return {
    category: plan.business.category,
    description: plan.business.description || "",
    website: plan.business.website || null,
    location: plan.business.location || null,
    primary_language: plan.business.primaryLanguage,
    goals: plan.business.goals || [],
    audience: plan.business.audience || null,
    offer: plan.business.offer || null,
    tone: plan.business.tone || null,
    updated_at: new Date().toISOString(),
  };
}

async function ensureOwnedBusiness(plan: MarketingPlan, requestedBusinessId?: string) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;

  const profile=profileRow(plan);

  if (requestedBusinessId) {
    const { data } = await supabase.from("businesses").select("id").eq("id", requestedBusinessId).eq("owner_id", userId).maybeSingle();
    if (data?.id) {
      const {error:updateError}=await supabase.from("businesses").update(profile).eq("id",data.id).eq("owner_id",userId);
      if(updateError)throw updateError;
      return { supabase, userId, businessId: String(data.id) };
    }
  }

  const { data: existing } = await supabase.from("businesses").select("id").eq("owner_id", userId).eq("name", plan.business.name).limit(1).maybeSingle();
  if (existing?.id) {
    const {error:updateError}=await supabase.from("businesses").update(profile).eq("id", existing.id).eq("owner_id",userId);
    if(updateError)throw updateError;
    return { supabase, userId, businessId: String(existing.id) };
  }

  const { data: created, error } = await supabase.from("businesses").insert({
    owner_id: userId,
    name: plan.business.name,
    ...profile,
  }).select("id").single();
  if (error || !created?.id) throw error || new Error("business_create_failed");
  return { supabase, userId, businessId: String(created.id) };
}

export async function persistMarketingPlan(plan: MarketingPlan, requestedBusinessId?: string, options:PersistPlanOptions={}): Promise<PersistedPlanResult> {
  if (!isSupabaseConfigured()) return { persisted: false, plan, idMap: {}, reason: "supabase_unconfigured" };
  const owned = await ensureOwnedBusiness(plan, requestedBusinessId);
  if (!owned) return { persisted: false, plan, idMap: {}, reason: "unauthenticated" };
  const { supabase, businessId } = owned;
  const seriesDraft=buildContentSeriesArchitecture(plan);
  const baseStrategy={
    brand: plan.brand,
    competitors: plan.competitors,
    strategySummary: plan.strategySummary,
    generatedAt: plan.createdAt,
    schedulePolicy: "baseline_yerevan_until_learned_windows",
    series: seriesDraft,
    ...(options.campaign?{campaign:options.campaign}:{}),
  };

  const { data: planRow, error: planError } = await supabase.from("marketing_plans").insert({
    business_id: businessId,
    horizon_days: plan.horizonDays,
    strategy: baseStrategy,
    generated_by: plan.generatedBy,
  }).select("id").single();
  if (planError || !planRow?.id) throw planError || new Error("marketing_plan_persist_failed");

  const idMap: Record<string, string> = {};
  const durableItems = [] as MarketingPlan["items"];
  for (const item of plan.items) {
    const { data: row, error } = await supabase.from("content_items").insert({
      business_id: businessId,
      plan_id: planRow.id,
      platform: item.platform,
      format: item.format,
      language: item.language,
      objective: item.objective,
      hook: item.hook,
      concept: item.concept,
      caption: item.caption,
      cta: item.cta,
      hashtags: item.hashtags,
      asset_brief: item.assetBrief,
      scheduled_for: item.publishAt || null,
      status: item.status === "idea" ? "idea" : "draft",
    }).select("id").single();
    if (error || !row?.id) throw error || new Error("content_item_persist_failed");
    const durableId = String(row.id);
    idMap[item.id] = durableId;
    durableItems.push({ ...item, id: durableId });
  }

  const durableSeries=buildContentSeriesArchitecture(plan,idMap);
  const durableCampaign=options.campaign?remapCampaignBlueprint(options.campaign,idMap):undefined;
  const durableStrategy={...baseStrategy,series:durableSeries,...(durableCampaign?{campaign:durableCampaign}:{})};
  const {error:strategyError}=await supabase.from("marketing_plans").update({strategy:durableStrategy}).eq("id",planRow.id).eq("business_id",businessId);
  if(strategyError)console.warn("Plan strategy durability update skipped",strategyError.message);

  return {
    persisted: true,
    businessId,
    planId: String(planRow.id),
    idMap,
    plan: { ...plan, id: String(planRow.id), items: durableItems },
  };
}
