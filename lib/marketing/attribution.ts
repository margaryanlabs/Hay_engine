import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AttributionCounts={clicks:number;conversions:number;leads:number;bookings:number;orders:number;signups:number;purchases:number};
export type AttributionSummary={byContent:Map<string,AttributionCounts>;totals:AttributionCounts;available:boolean};

const empty=():AttributionCounts=>({clicks:0,conversions:0,leads:0,bookings:0,orders:0,signups:0,purchases:0});
function missingTable(error:{code?:string;message?:string}|null|undefined){return error?.code==="42P01"||String(error?.message||"").includes("attribution_events");}

export async function loadAttributionSummary(supabase:SupabaseClient,businessId:string,contentIds?:string[]):Promise<AttributionSummary>{
  let query=supabase.from("attribution_events").select("content_item_id,event_type").eq("business_id",businessId).order("occurred_at",{ascending:false}).limit(10000);
  if(contentIds?.length)query=query.in("content_item_id",contentIds);
  const {data,error}=await query;
  if(missingTable(error))return {byContent:new Map(),totals:empty(),available:false};
  if(error)throw error;
  const byContent=new Map<string,AttributionCounts>();const totals=empty();
  for(const row of data||[]){
    const id=String(row.content_item_id||"");const type=String(row.event_type||"");if(!id||!type)continue;
    const current=byContent.get(id)||empty();
    if(type==="click"){current.clicks+=1;totals.clicks+=1;}
    else{
      current.conversions+=1;totals.conversions+=1;
      if(type==="lead"){current.leads+=1;totals.leads+=1;}
      if(type==="booking"){current.bookings+=1;totals.bookings+=1;}
      if(type==="order"){current.orders+=1;totals.orders+=1;}
      if(type==="signup"){current.signups+=1;totals.signups+=1;}
      if(type==="purchase"){current.purchases+=1;totals.purchases+=1;}
    }
    byContent.set(id,current);
  }
  return {byContent,totals,available:true};
}

export function effectiveOutcome(platformClicks:number,platformConversions:number,firstParty?:AttributionCounts){
  return {
    clicks:firstParty?.clicks?firstParty.clicks:platformClicks,
    conversions:firstParty?.conversions?firstParty.conversions:platformConversions,
  };
}
