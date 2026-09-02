import type { MarketingPlan, SocialPlatform } from "./types";

const BASELINE_WINDOWS: Record<SocialPlatform,string[]> = {
  instagram:["12:30","19:30"],
  tiktok:["18:30","21:00"],
  youtube:["18:00","20:00"],
  facebook:["13:00","20:00"],
  linkedin:["10:00","14:00"],
};

const YEREVAN_OFFSET = "+04:00";

function yerevanDateParts(date:Date){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Yerevan",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const value=(type:string)=>parts.find(part=>part.type===type)?.value||"";
  return {year:Number(value("year")),month:Number(value("month")),day:Number(value("day"))};
}

function addLocalDays(base:{year:number;month:number;day:number},days:number){
  const anchor=new Date(Date.UTC(base.year,base.month-1,base.day));
  anchor.setUTCDate(anchor.getUTCDate()+days);
  return {year:anchor.getUTCFullYear(),month:anchor.getUTCMonth()+1,day:anchor.getUTCDate()};
}

function pad(value:number){return String(value).padStart(2,"0");}
function localIso(date:{year:number;month:number;day:number},time:string){return `${date.year}-${pad(date.month)}-${pad(date.day)}T${time}:00${YEREVAN_OFFSET}`;}

export function applyBaselineSchedule(plan:MarketingPlan,now=new Date()):MarketingPlan{
  const localToday=yerevanDateParts(now);
  const minimumLeadMs=90*60*1000;
  const platformUse=new Map<SocialPlatform,number>();
  const items=plan.items.map(item=>{
    if(item.publishAt)return item;
    const windows=BASELINE_WINDOWS[item.platform]||["19:00"];
    const usage=platformUse.get(item.platform)||0;
    platformUse.set(item.platform,usage+1);
    const slot=windows[usage%windows.length];
    let localDate=addLocalDays(localToday,Math.max(0,item.day-1));
    let publishAt=localIso(localDate,slot);
    if(new Date(publishAt).getTime()<=now.getTime()+minimumLeadMs){
      localDate=addLocalDays(localDate,1);
      publishAt=localIso(localDate,slot);
    }
    return {...item,publishAt};
  });
  return {...plan,items};
}

export const baselineSchedulePolicy={
  timezone:"Asia/Yerevan",
  source:"baseline_not_performance_claim",
  windows:BASELINE_WINDOWS,
} as const;
