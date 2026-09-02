import "server-only";

export type CampaignMetricTotals={views:number;reach:number;likes:number;comments:number;shares:number;saves:number;clicks:number;conversions:number;watchTimeSeconds:number};
export type CampaignAnalyticsContent={id:string;platform:string;format:string;objective:string;hook:string;phase:string;metrics:CampaignMetricTotals;measuredAt:string};
export type CampaignPhaseAnalytics={name:string;label:string;totalItems:number;measuredItems:number;coverage:number;totals:CampaignMetricTotals;score:number};
export type CampaignExperiment={
  ready:boolean;
  reason?:string;
  hypothesis?:string;
  control?:string;
  variant?:string;
  holdConstant?:string[];
  primaryMetric?:string;
  caveat?:string;
};
export type CampaignAnalytics={
  campaignId:string;
  campaignName:string;
  primaryKpi:string;
  totalItems:number;
  measuredItems:number;
  coverage:number;
  totals:CampaignMetricTotals;
  phasePerformance:CampaignPhaseAnalytics[];
  topContent:CampaignAnalyticsContent[];
  formatPerformance:Array<{format:string;items:number;totals:CampaignMetricTotals;score:number}>;
  platformPerformance:Array<{platform:string;items:number;totals:CampaignMetricTotals;score:number}>;
  primarySignal:{metric:string;value:number;label:string};
  evidenceQuality:"none"|"early"|"partial"|"strong";
  experiment:CampaignExperiment;
  caveats:string[];
};

type CampaignPhaseInput={name?:unknown;label?:unknown;contentItemIds?:unknown};
type CampaignInput={id?:unknown;name?:unknown;primaryKpi?:unknown;phases?:unknown};
type ContentInput={id?:unknown;platform?:unknown;format?:unknown;objective?:unknown;hook?:unknown};
type MetricInput={content_item_id?:unknown;measured_at?:unknown;views?:unknown;reach?:unknown;likes?:unknown;comments?:unknown;shares?:unknown;saves?:unknown;clicks?:unknown;conversions?:unknown;watch_time_seconds?:unknown};

const number=(value:unknown)=>Number(value)||0;
const text=(value:unknown)=>String(value||"").trim();
const empty=():CampaignMetricTotals=>({views:0,reach:0,likes:0,comments:0,shares:0,saves:0,clicks:0,conversions:0,watchTimeSeconds:0});
const add=(target:CampaignMetricTotals,row:CampaignMetricTotals)=>{for(const key of Object.keys(target) as Array<keyof CampaignMetricTotals>)target[key]+=row[key];return target;};
function metricRow(row:MetricInput):CampaignMetricTotals{return {views:number(row.views),reach:number(row.reach),likes:number(row.likes),comments:number(row.comments),shares:number(row.shares),saves:number(row.saves),clicks:number(row.clicks),conversions:number(row.conversions),watchTimeSeconds:number(row.watch_time_seconds)};}
function score(metrics:CampaignMetricTotals,kpi:string){
  if(kpi==="conversion")return metrics.conversions*100+metrics.clicks*12+metrics.saves*3+metrics.views*.05;
  if(kpi==="trust")return metrics.saves*20+metrics.shares*18+metrics.comments*10+metrics.clicks*4+metrics.views*.05;
  if(kpi==="community")return metrics.comments*20+metrics.shares*16+metrics.likes*3+metrics.views*.03;
  if(kpi==="retention")return metrics.saves*16+metrics.clicks*8+metrics.conversions*40+metrics.views*.03;
  return metrics.reach+metrics.views*.7+metrics.shares*10+metrics.saves*8;
}
function primarySignal(totals:CampaignMetricTotals,kpi:string){
  if(kpi==="conversion")return {metric:"conversions",value:totals.conversions,label:"Recorded conversions"};
  if(kpi==="trust")return {metric:"saves",value:totals.saves,label:"Saves (trust proxy)"};
  if(kpi==="community")return {metric:"comments",value:totals.comments,label:"Comments (community proxy)"};
  if(kpi==="retention")return {metric:"conversions",value:totals.conversions,label:"Conversions (retention not directly measured)"};
  return {metric:"reach",value:totals.reach,label:"Reach"};
}
function evidenceQuality(total:number,measured:number):CampaignAnalytics["evidenceQuality"]{
  if(!measured)return "none";const coverage=measured/Math.max(1,total);
  if(measured<3)return "early";if(coverage<.7)return "partial";return "strong";
}
function aggregateBy(items:CampaignAnalyticsContent[],key:"format"|"platform",kpi:string){
  const groups=new Map<string,{items:number;totals:CampaignMetricTotals}>();
  for(const item of items){const name=item[key]||"unknown";const current=groups.get(name)||{items:0,totals:empty()};current.items+=1;add(current.totals,item.metrics);groups.set(name,current);}
  return [...groups.entries()].map(([name,value])=>({[key]:name,items:value.items,totals:value.totals,score:score(value.totals,kpi)})).sort((a,b)=>b.score-a.score) as Array<{format:string;items:number;totals:CampaignMetricTotals;score:number}> & Array<{platform:string;items:number;totals:CampaignMetricTotals;score:number}>;
}
function experimentFor(items:CampaignAnalyticsContent[],formats:Array<{format:string;items:number;score:number}>,kpi:string):CampaignExperiment{
  if(items.length<2)return {ready:false,reason:"At least two measured campaign assets are required before HAY proposes a controlled experiment."};
  const ranked=[...items].sort((a,b)=>score(b.metrics,kpi)-score(a.metrics,kpi));
  const leader=ranked[0];const challenger=ranked.find(item=>item.id!==leader.id);
  if(!challenger)return {ready:false,reason:"Not enough distinct measured assets for a comparison."};
  const bestFormat=formats[0]?.format||leader.format;
  const alternative=formats.find(row=>row.format!==bestFormat)?.format||challenger.format;
  const primary=kpi==="conversion"?"conversions":kpi==="trust"?"saves":kpi==="community"?"comments":kpi==="reach"?"reach":"conversions";
  return {
    ready:true,
    hypothesis:`The ${bestFormat} creative pattern may outperform ${alternative} for this campaign objective; test it under controlled conditions rather than treating the observed difference as causal.`,
    control:`Reuse the weaker pattern as control: ${challenger.platform} / ${challenger.format} / “${challenger.hook.slice(0,100)}”.`,
    variant:`Test the stronger pattern: ${leader.platform} / ${bestFormat} / a new hook with the same offer and audience.`,
    holdConstant:["offer","audience segment","campaign phase","CTA intent","publish window as closely as practical"],
    primaryMetric:primary,
    caveat:"This recommendation is based on observational campaign data. A controlled follow-up is required before claiming causality.",
  };
}

export function buildCampaignAnalytics(args:{campaign:CampaignInput;content:ContentInput[];metrics:MetricInput[]}):CampaignAnalytics{
  const campaign=args.campaign||{};const campaignId=text(campaign.id);const campaignName=text(campaign.name)||"Campaign";const kpi=text(campaign.primaryKpi)||"reach";
  const phases=(Array.isArray(campaign.phases)?campaign.phases:[]) as CampaignPhaseInput[];
  const phaseByContent=new Map<string,string>();const phaseMeta=new Map<string,{label:string;ids:string[]}>();
  for(const raw of phases){const name=text(raw.name)||"unassigned";const label=text(raw.label)||name.toUpperCase();const ids=Array.isArray(raw.contentItemIds)?raw.contentItemIds.map(text).filter(Boolean):[];phaseMeta.set(name,{label,ids});for(const id of ids)phaseByContent.set(id,name);}
  const allIds=[...new Set([...phaseByContent.keys()])];
  const contentById=new Map(args.content.map(row=>[text(row.id),row]));
  const latest=new Map<string,MetricInput>();
  for(const row of args.metrics){const id=text(row.content_item_id);if(id&&!latest.has(id))latest.set(id,row);}
  const measured:CampaignAnalyticsContent[]=[];const totals=empty();
  for(const id of allIds){const metric=latest.get(id);if(!metric)continue;const content=contentById.get(id)||{};const metrics=metricRow(metric);add(totals,metrics);measured.push({id,platform:text(content.platform)||"unknown",format:text(content.format)||"unknown",objective:text(content.objective),hook:text(content.hook),phase:phaseByContent.get(id)||"unassigned",metrics,measuredAt:text(metric.measured_at)});}
  const phasePerformance:CampaignPhaseAnalytics[]=[];
  for(const [name,meta] of phaseMeta){const phaseItems=measured.filter(item=>item.phase===name);const phaseTotals=empty();for(const item of phaseItems)add(phaseTotals,item.metrics);phasePerformance.push({name,label:meta.label,totalItems:meta.ids.length,measuredItems:phaseItems.length,coverage:meta.ids.length?phaseItems.length/meta.ids.length:0,totals:phaseTotals,score:score(phaseTotals,kpi)});}
  const formats=aggregateBy(measured,"format",kpi) as Array<{format:string;items:number;totals:CampaignMetricTotals;score:number}>;
  const platforms=aggregateBy(measured,"platform",kpi) as Array<{platform:string;items:number;totals:CampaignMetricTotals;score:number}>;
  const topContent=[...measured].sort((a,b)=>score(b.metrics,kpi)-score(a.metrics,kpi)).slice(0,6);
  const totalItems=allIds.length;const measuredItems=measured.length;const quality=evidenceQuality(totalItems,measuredItems);
  return {
    campaignId,campaignName,primaryKpi:kpi,totalItems,measuredItems,coverage:totalItems?measuredItems/totalItems:0,totals,
    phasePerformance,topContent,formatPerformance:formats,platformPerformance:platforms,primarySignal:primarySignal(totals,kpi),evidenceQuality:quality,
    experiment:experimentFor(measured,formats,kpi),
    caveats:[
      "Campaign analytics use the latest stored metric snapshot per content item.",
      "Observed differences are correlations, not proof that a hook, format or phase caused the result.",
      ...(kpi==="retention"?["HAY does not currently have a dedicated retention event in content_metrics; displayed outcome metrics are proxies only."]:[]),
      ...(quality!=="strong"?["Evidence is incomplete; interpret rankings as directional until more campaign items have measured snapshots."]:[]),
    ],
  };
}
