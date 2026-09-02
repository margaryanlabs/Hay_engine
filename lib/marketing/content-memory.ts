import "server-only";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type ContentMemoryContext = {
  recentItems: Array<{ platform:string; format:string; objective:string; hook:string; concept:string; status:string; createdAt:string }>;
  recentHooks: string[];
  recentSeries: Array<{key:string;title:string;primaryObjective:string;plannedWeeks:number;cadence:string;episodeCount:number;nextAngle:string}>;
  recentCampaigns: Array<{id:string;name:string;type:string;objective:string;offer:string;startDate:string;endDate:string;primaryKpi:string;status:string}>;
  recentCampaignLearnings:Array<{
    campaignId:string;campaignName:string;campaignStatus:string;primaryKpi:string;primaryMetric:string;totalItems:number;measuredItems:number;coverage:number;evidenceQuality:string;primaryMetricTotal:number;viewsTotal:number;reachTotal:number;
    topPrimaryContent:null|{platform:string;format:string;hook:string;primaryValue:number};
    secondaryReachLeader:null|{platform:string;format:string;hook:string;views:number;reach:number};
    formatSignals:Array<{format:string;measuredItems:number;averagePrimaryMetric:number;averageViews:number;averageReach:number}>;
    phaseSignals:Array<{name:string;label:string;totalItems:number;measuredItems:number;averagePrimaryMetric:number;averageViews:number;averageReach:number}>;
    latestMeasuredAt:string;
  }>;
  formatCounts: Record<string,number>;
  platformCounts: Record<string,number>;
  objectiveCounts: Record<string,number>;
  duplicateRisk: { level:"low"|"medium"|"high"; repeatedHooks:string[]; totalRemembered:number };
};

function clean(value:unknown){return String(value||"").trim();}
function numeric(value:unknown){return Number(value)||0;}
function hookKey(value:string){return value.toLocaleLowerCase("hy-AM").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");}
function countBy(values:string[]){const out:Record<string,number>={};for(const value of values){if(value)out[value]=(out[value]||0)+1;}return out;}
function asRecord(value:unknown){return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function liveCampaignStatus(startDate:string,endDate:string){const start=Date.parse(`${startDate}T00:00:00+04:00`);const end=Date.parse(`${endDate}T23:59:59+04:00`);const now=Date.now();if(Number.isFinite(start)&&now<start)return "upcoming";if(Number.isFinite(end)&&now>end)return "completed";return "active";}
function compactLearning(raw:Record<string,unknown>):ContentMemoryContext["recentCampaignLearnings"][number]{
  const primary=asRecord(raw.topPrimaryContent);const reach=asRecord(raw.secondaryReachLeader);
  const formatSignals=(Array.isArray(raw.formatSignals)?raw.formatSignals:[]).slice(0,4).map(item=>{const row=asRecord(item);return {format:clean(row.format),measuredItems:numeric(row.measuredItems),averagePrimaryMetric:numeric(row.averagePrimaryMetric),averageViews:numeric(row.averageViews),averageReach:numeric(row.averageReach)};});
  const phaseSignals=(Array.isArray(raw.phaseSignals)?raw.phaseSignals:[]).slice(0,4).map(item=>{const row=asRecord(item);return {name:clean(row.name),label:clean(row.label),totalItems:numeric(row.totalItems),measuredItems:numeric(row.measuredItems),averagePrimaryMetric:numeric(row.averagePrimaryMetric),averageViews:numeric(row.averageViews),averageReach:numeric(row.averageReach)};});
  return {
    campaignId:clean(raw.campaignId),campaignName:clean(raw.campaignName)||"Campaign",campaignStatus:clean(raw.campaignStatus),primaryKpi:clean(raw.primaryKpi),primaryMetric:clean(raw.primaryMetric),totalItems:numeric(raw.totalItems),measuredItems:numeric(raw.measuredItems),coverage:numeric(raw.coverage),evidenceQuality:clean(raw.evidenceQuality),primaryMetricTotal:numeric(raw.primaryMetricTotal),viewsTotal:numeric(raw.viewsTotal),reachTotal:numeric(raw.reachTotal),
    topPrimaryContent:Object.keys(primary).length?{platform:clean(primary.platform),format:clean(primary.format),hook:clean(primary.hook),primaryValue:numeric(primary.primaryValue)}:null,
    secondaryReachLeader:Object.keys(reach).length?{platform:clean(reach.platform),format:clean(reach.format),hook:clean(reach.hook),views:numeric(reach.views),reach:numeric(reach.reach)}:null,
    formatSignals,phaseSignals,latestMeasuredAt:clean(raw.latestMeasuredAt),
  };
}

export async function loadContentMemory(businessId?:string,businessName?:string):Promise<ContentMemoryContext|null>{
  if(!isSupabaseConfigured())return null;
  const supabase=await createClient();
  const {data:claims,error:claimsError}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;
  if(claimsError||!userId)return null;

  let businessQuery=supabase.from("businesses").select("id").eq("owner_id",userId).order("created_at",{ascending:false}).limit(1);
  if(businessId)businessQuery=businessQuery.eq("id",businessId);else if(businessName?.trim())businessQuery=businessQuery.eq("name",businessName.trim());
  const {data:business}=await businessQuery.maybeSingle();if(!business?.id)return null;const resolvedBusinessId=String(business.id);

  const [contentResult,planResult]=await Promise.all([
    supabase.from("content_items").select("platform,format,objective,hook,concept,status,created_at").eq("business_id",resolvedBusinessId).order("created_at",{ascending:false}).limit(80),
    supabase.from("marketing_plans").select("strategy,created_at").eq("business_id",resolvedBusinessId).order("created_at",{ascending:false}).limit(16),
  ]);
  const data=contentResult.data;if(contentResult.error||!data?.length)return null;

  const recentItems=data.map(item=>({platform:clean(item.platform),format:clean(item.format),objective:clean(item.objective),hook:clean(item.hook),concept:clean(item.concept),status:clean(item.status),createdAt:clean(item.created_at)}));
  const hookCounts=new Map<string,{label:string;count:number}>();for(const item of recentItems){const key=hookKey(item.hook);if(!key)continue;const current=hookCounts.get(key)||{label:item.hook,count:0};current.count+=1;hookCounts.set(key,current);}
  const repeatedHooks=[...hookCounts.values()].filter(item=>item.count>1).sort((a,b)=>b.count-a.count).map(item=>item.label).slice(0,12);const recentHooks=[...new Set(recentItems.map(item=>item.hook).filter(Boolean))].slice(0,30);
  const duplicateRatio=repeatedHooks.length/Math.max(1,recentHooks.length);const level:ContentMemoryContext["duplicateRisk"]["level"]=duplicateRatio>=.25?"high":duplicateRatio>=.1?"medium":"low";

  const seenSeries=new Set<string>();const seenCampaigns=new Set<string>();const seenLearnings=new Set<string>();
  const recentSeries:ContentMemoryContext["recentSeries"]=[];const recentCampaigns:ContentMemoryContext["recentCampaigns"]=[];const recentCampaignLearnings:ContentMemoryContext["recentCampaignLearnings"]=[];
  for(const row of planResult.data||[]){
    const strategy=asRecord(row.strategy);const architecture=asRecord(strategy.series);const list=Array.isArray(architecture.series)?architecture.series:[];
    for(const raw of list){if(!raw||typeof raw!=="object")continue;const item=raw as Record<string,unknown>;const key=clean(item.key)||clean(item.title);if(!key||seenSeries.has(key))continue;seenSeries.add(key);recentSeries.push({key,title:clean(item.title)||key,primaryObjective:clean(item.primaryObjective)||"trust",plannedWeeks:Number(item.plannedWeeks)||4,cadence:clean(item.cadence)||"1× / week",episodeCount:Array.isArray(item.episodes)?item.episodes.length:0,nextAngle:clean(item.nextAngle)});}

    const campaign=asRecord(strategy.campaign);if(Object.keys(campaign).length){const id=clean(campaign.id)||`${clean(campaign.name)}:${clean(campaign.startDate)}`;if(id&&!seenCampaigns.has(id)){seenCampaigns.add(id);const startDate=clean(campaign.startDate);const endDate=clean(campaign.endDate);recentCampaigns.push({id,name:clean(campaign.name)||"Campaign",type:clean(campaign.type),objective:clean(campaign.objective),offer:clean(campaign.offer),startDate,endDate,primaryKpi:clean(campaign.primaryKpi),status:liveCampaignStatus(startDate,endDate)});}}

    const learning=asRecord(strategy.campaignLearning);if(Object.keys(learning).length){const id=clean(learning.campaignId)||clean(campaign.id);if(id&&!seenLearnings.has(id)){seenLearnings.add(id);recentCampaignLearnings.push(compactLearning(learning));}}
    if(recentSeries.length>=8&&recentCampaigns.length>=6&&recentCampaignLearnings.length>=6)break;
  }

  return {recentItems:recentItems.slice(0,40),recentHooks,recentSeries:recentSeries.slice(0,8),recentCampaigns:recentCampaigns.slice(0,6),recentCampaignLearnings:recentCampaignLearnings.slice(0,6),formatCounts:countBy(recentItems.map(item=>item.format)),platformCounts:countBy(recentItems.map(item=>item.platform)),objectiveCounts:countBy(recentItems.map(item=>item.objective)),duplicateRisk:{level,repeatedHooks,totalRemembered:recentItems.length}};
}

export function contentMemoryForPlan(memory:ContentMemoryContext|null){
  if(!memory)return "";
  const compact={recentHooks:memory.recentHooks.slice(0,24),recentItems:memory.recentItems.slice(0,24),recentSeries:memory.recentSeries,recentCampaigns:memory.recentCampaigns,recentCampaignLearnings:memory.recentCampaignLearnings,formatCounts:memory.formatCounts,platformCounts:memory.platformCounts,objectiveCounts:memory.objectiveCounts,duplicateRisk:memory.duplicateRisk};
  return `\n\nHAY CONTENT MEMORY — real recent content and measured learning from this business:\n${JSON.stringify(compact)}\nPlanning rules: treat draft, scheduled and published items as already used for duplication control. Do not repeat hooks verbatim. Avoid near-duplicate concepts, openings and CTAs. Continue strong recentSeries when strategically useful, but every episode must add a materially new angle, proof, audience segment or format. Do not recreate recentCampaigns with the same offer/angle unless the user explicitly asks to repeat them. Use recentCampaignLearnings as observational evidence only: respect coverage and evidenceQuality, prefer patterns with stronger measured support, and never claim that a format, phase or hook caused the result unless a controlled experiment later establishes it. If the primary metric was unavailable or zero, secondary reach signals may guide exploration but must not be presented as conversion proof. Reuse campaign learnings without pretending old campaign facts are still current. Retire weak or exhausted series instead of forcing continuity. Deliberately rebalance overused formats/objectives while preserving measured winners.`;
}
