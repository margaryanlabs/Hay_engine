import type { MarketingPlan } from "./types";

export type SeriesEpisode={
  contentItemId:string;
  day:number;
  platform:string;
  format:string;
  objective:string;
  hook:string;
};

export type ContentSeries={
  key:string;
  title:string;
  premise:string;
  primaryObjective:string;
  plannedWeeks:number;
  cadence:string;
  episodes:SeriesEpisode[];
  nextAngle:string;
};

export type ContentSeriesArchitecture={
  version:"hay-series-v1";
  plannedWeeks:number;
  createdAt:string;
  series:ContentSeries[];
};

function slug(value:string,index:number){
  const cleaned=value.toLocaleLowerCase("hy-AM").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-+|-+$/g,"");
  return cleaned||`series-${index+1}`;
}

function mode(values:string[],fallback:string){
  const counts=new Map<string,number>();
  for(const value of values)counts.set(value,(counts.get(value)||0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||fallback;
}

export function buildContentSeriesArchitecture(plan:MarketingPlan,idMap:Record<string,string>={}):ContentSeriesArchitecture{
  const pillars=(plan.brand.contentPillars||[]).filter(Boolean);
  const seriesCount=Math.max(1,Math.min(3,pillars.length||3,Math.ceil(plan.items.length/2)));
  const titles=Array.from({length:seriesCount},(_,index)=>pillars[index]||`Series ${index+1}`);
  const buckets=titles.map(()=>[] as MarketingPlan["items"]);
  plan.items.forEach((item,index)=>buckets[index%seriesCount].push(item));

  const series=titles.map((title,index)=>{
    const episodes=buckets[index].map(item=>({
      contentItemId:idMap[item.id]||item.id,
      day:item.day,
      platform:item.platform,
      format:item.format,
      objective:item.objective,
      hook:item.hook,
    }));
    const primaryObjective=mode(episodes.map(item=>item.objective),"trust");
    const differentiator=plan.brand.differentiators[index%Math.max(plan.brand.differentiators.length,1)]||plan.brand.promise;
    return {
      key:slug(title,index),
      title,
      premise:`${title} · ${plan.brand.promise}`,
      primaryObjective,
      plannedWeeks:4,
      cadence:episodes.length>=3?"2× / week":"1× / week",
      episodes,
      nextAngle:differentiator||plan.strategySummary,
    };
  });

  return {version:"hay-series-v1",plannedWeeks:4,createdAt:plan.createdAt,series};
}
