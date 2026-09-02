import "server-only";
import type { BusinessProfile, MarketingPlan, SocialPlatform } from "./types";

export type CampaignType="launch"|"promotion"|"event"|"seasonal"|"holiday"|"sales";
export type CampaignPhaseName="prelaunch"|"launch"|"sustain"|"last_call";

export type CampaignBrief={
  name:string;
  type:CampaignType;
  objective:string;
  offer:string;
  startDate:string;
  endDate:string;
  eventDate?:string;
  audience?:string;
  constraints?:string;
};

export type CampaignPhase={
  name:CampaignPhaseName;
  label:string;
  startDate:string;
  endDate:string;
  purpose:string;
  contentItemIds:string[];
};

export type CampaignBlueprint={
  id:string;
  name:string;
  type:CampaignType;
  objective:string;
  offer:string;
  startDate:string;
  endDate:string;
  eventDate?:string;
  audience:string;
  primaryKpi:"reach"|"trust"|"conversion"|"retention"|"community";
  status:"upcoming"|"active"|"completed";
  phases:CampaignPhase[];
  guardrails:string[];
  createdAt:string;
};

const allowedTypes:CampaignType[]=["launch","promotion","event","seasonal","holiday","sales"];
const DAY=24*60*60*1000;
const YEREVAN_OFFSET="+04:00";
const CAMPAIGN_WINDOWS:Record<SocialPlatform,string[]>={instagram:["12:30","19:30"],tiktok:["18:30","21:00"],youtube:["18:00","20:00"],facebook:["13:00","20:00"],linkedin:["10:00","14:00"]};

function text(value:unknown,max=500){return typeof value==="string"?value.trim().slice(0,max):"";}
function isoDay(value:unknown){const raw=text(value,32);if(!raw)return "";const time=Date.parse(raw);return Number.isFinite(time)?new Date(time).toISOString().slice(0,10):"";}
function localIso(day:string,time:string){return `${day}T${time}:00${YEREVAN_OFFSET}`;}
function localDayStart(day:string){return Date.parse(`${day}T00:00:00${YEREVAN_OFFSET}`);}
function localDayEnd(day:string){return Date.parse(`${day}T23:59:59${YEREVAN_OFFSET}`);}
function yerevanDay(time:number){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Yerevan",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(time));
  const read=(type:string)=>parts.find(part=>part.type===type)?.value||"";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
function objectiveToKpi(objective:string):CampaignBlueprint["primaryKpi"]{
  const value=objective.toLowerCase();
  if(/sale|book|lead|order|reserve|conversion|revenue|signup|purchase/.test(value))return "conversion";
  if(/retain|repeat|loyal/.test(value))return "retention";
  if(/community|comment|engage/.test(value))return "community";
  if(/trust|proof|authority/.test(value))return "trust";
  return "reach";
}

export function normalizeCampaignBrief(input:unknown):CampaignBrief{
  const row=input&&typeof input==="object"&&!Array.isArray(input)?input as Record<string,unknown>:{};
  const type=allowedTypes.includes(row.type as CampaignType)?row.type as CampaignType:"promotion";
  const today=yerevanDay(Date.now());
  const startDate=isoDay(row.startDate)||today;
  const requestedEnd=isoDay(row.endDate);
  const start=Date.parse(startDate);
  const endDate=requestedEnd&&Date.parse(requestedEnd)>=start?requestedEnd:new Date(start+13*DAY).toISOString().slice(0,10);
  const eventDate=isoDay(row.eventDate);
  return {name:text(row.name,120)||"HAY Campaign",type,objective:text(row.objective,300)||"Create measurable demand and a clear audience action.",offer:text(row.offer,700),startDate,endDate,eventDate:eventDate||undefined,audience:text(row.audience,500)||undefined,constraints:text(row.constraints,1000)||undefined};
}

export function campaignPlanningContext(brief:CampaignBrief,business:BusinessProfile){
  return `\n\nHAY CAMPAIGN MODE — temporary priority layer over the evergreen brand strategy:\n${JSON.stringify({campaign:brief,business:{name:business.name,category:business.category,location:business.location,primaryLanguage:business.primaryLanguage}})}\nCampaign rules: build a coherent campaign arc, not isolated posts. Move the audience through anticipation/proof/action/urgency where appropriate. The offer and dates must remain exact. Do not invent discounts, availability, event details, testimonials, scarcity or legal claims. Preserve the brand voice and existing Content Memory. Vary formats and hooks. Include campaign conversion assets but keep enough trust/reach content to avoid a feed made only of ads. If the campaign conflicts with evergreen posting, campaign priority wins only inside the stated date window.`;
}

function campaignStatus(brief:CampaignBrief){
  const now=Date.now();const start=localDayStart(brief.startDate);const end=localDayEnd(brief.endDate);
  return now<start?"upcoming" as const:now>end?"completed" as const:"active" as const;
}

function phaseWindows(brief:CampaignBrief):Array<Omit<CampaignPhase,"contentItemIds">>{
  const start=Date.parse(brief.startDate);const end=Date.parse(brief.endDate)+DAY-1;
  const days=Math.max(1,Math.floor((end-start)/DAY)+1);
  const launchAnchor=brief.eventDate?Math.min(end,Math.max(start,Date.parse(brief.eventDate))):start+Math.max(0,Math.floor(days*.28)-1)*DAY;
  const lastCallStart=Math.max(launchAnchor+DAY,end-Math.max(DAY,Math.floor(days*.2)*DAY));
  const launchEnd=Math.min(lastCallStart-DAY,launchAnchor+Math.max(DAY,Math.floor(days*.18)*DAY));
  const sustainStart=Math.min(end,launchEnd+DAY);
  const toDay=(time:number)=>new Date(Math.min(end,Math.max(start,time))).toISOString().slice(0,10);
  const result:Array<Omit<CampaignPhase,"contentItemIds">>=[];
  if(launchAnchor>start)result.push({name:"prelaunch",label:"PRE-LAUNCH",startDate:toDay(start),endDate:toDay(launchAnchor-DAY),purpose:"Create context, curiosity and reasons to care before the main conversion moment."});
  result.push({name:"launch",label:"LAUNCH",startDate:toDay(launchAnchor),endDate:toDay(Math.max(launchAnchor,launchEnd)),purpose:"Make the campaign proposition unmistakable and drive the primary action."});
  if(sustainStart<lastCallStart)result.push({name:"sustain",label:"SUSTAIN",startDate:toDay(sustainStart),endDate:toDay(lastCallStart-DAY),purpose:"Add proof, objections, demonstrations and fresh creative angles without repeating the launch."});
  if(lastCallStart<=end)result.push({name:"last_call",label:"LAST CALL",startDate:toDay(lastCallStart),endDate:toDay(end),purpose:"Close the campaign with accurate timing and urgency without fabricated scarcity."});
  return result;
}

export function applyCampaignWindowSchedule(plan:MarketingPlan,brief:CampaignBrief,now=new Date()):MarketingPlan{
  const requestedStart=localDayStart(brief.startDate);
  const end=localDayEnd(brief.endDate);
  const minimumLead=now.getTime()+90*60*1000;
  const effectiveStart=Math.min(end,Math.max(requestedStart,minimumLead));
  const startDay=requestedStart>=minimumLead?brief.startDate:yerevanDay(effectiveStart);
  const endDay=brief.endDate;
  const span=Math.max(0,Math.round((Date.parse(`${endDay}T00:00:00Z`)-Date.parse(`${startDay}T00:00:00Z`))/DAY));
  const use=new Map<SocialPlatform,number>();
  const total=Math.max(1,plan.items.length);
  const items=plan.items.map((item,index)=>{
    const offset=total===1?0:Math.round(index*span/(total-1));
    const dayDate=new Date(Date.parse(`${startDay}T00:00:00Z`)+offset*DAY).toISOString().slice(0,10);
    const windows=CAMPAIGN_WINDOWS[item.platform]||["19:00"];
    const count=use.get(item.platform)||0;use.set(item.platform,count+1);
    let publishAt=localIso(dayDate,windows[count%windows.length]);
    if(Date.parse(publishAt)<minimumLead&&dayDate<endDay){const nextDay=new Date(Date.parse(`${dayDate}T00:00:00Z`)+DAY).toISOString().slice(0,10);publishAt=localIso(nextDay,windows[count%windows.length]);}
    if(Date.parse(publishAt)<minimumLead&&dayDate===endDay){publishAt=new Date(Math.min(end,minimumLead+index*15*60*1000)).toISOString();}
    return {...item,day:offset+1,publishAt};
  });
  return {...plan,horizonDays:Math.max(1,span+1),items};
}

export function buildCampaignBlueprint(brief:CampaignBrief,plan:MarketingPlan,idMap:Record<string,string>={}):CampaignBlueprint{
  const windows=phaseWindows(brief);
  const planStart=plan.items.map(item=>item.publishAt?Date.parse(item.publishAt):Number.NaN).filter(Number.isFinite).sort((a,b)=>a-b)[0]||localDayStart(brief.startDate);
  const items=plan.items.map(item=>({id:idMap[item.id]||item.id,time:item.publishAt?Date.parse(item.publishAt):planStart+(Math.max(1,item.day)-1)*DAY}));
  const phases=windows.map(phase=>{
    const phaseStart=localDayStart(phase.startDate);const phaseEnd=localDayEnd(phase.endDate);
    const contentItemIds=items.filter(item=>item.time>=phaseStart&&item.time<=phaseEnd).map(item=>item.id);
    return {...phase,contentItemIds};
  });
  return {id:`campaign-${crypto.randomUUID()}`,name:brief.name,type:brief.type,objective:brief.objective,offer:brief.offer,startDate:brief.startDate,endDate:brief.endDate,eventDate:brief.eventDate,audience:brief.audience||plan.business.audience||"Primary business audience",primaryKpi:objectiveToKpi(brief.objective),status:campaignStatus(brief),phases,guardrails:["Never invent discount, scarcity, availability, testimonial or event facts.","Keep campaign dates and offer wording exact across every channel.","Campaign priority is temporary; evergreen brand memory remains authoritative outside the window.",...(brief.constraints?[brief.constraints]:[])],createdAt:new Date().toISOString()};
}

export function remapCampaignBlueprint(campaign:CampaignBlueprint,idMap:Record<string,string>):CampaignBlueprint{
  return {...campaign,phases:campaign.phases.map(phase=>({...phase,contentItemIds:phase.contentItemIds.map(id=>idMap[id]||id)}))};
}
