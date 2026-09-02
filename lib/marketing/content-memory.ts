import "server-only";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type ContentMemoryContext = {
  recentItems: Array<{ platform:string; format:string; objective:string; hook:string; concept:string; status:string; createdAt:string }>;
  recentHooks: string[];
  formatCounts: Record<string,number>;
  platformCounts: Record<string,number>;
  objectiveCounts: Record<string,number>;
  duplicateRisk: { level:"low"|"medium"|"high"; repeatedHooks:string[]; totalRemembered:number };
};

function clean(value:unknown){return String(value||"").trim();}
function hookKey(value:string){return value.toLocaleLowerCase("hy-AM").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");}
function countBy(values:string[]){const out:Record<string,number>={};for(const value of values){if(value)out[value]=(out[value]||0)+1;}return out;}

export async function loadContentMemory(businessId?:string,businessName?:string):Promise<ContentMemoryContext|null>{
  if(!isSupabaseConfigured())return null;
  const supabase=await createClient();
  const {data:claims,error:claimsError}=await supabase.auth.getClaims();
  const userId=claims?.claims?.sub;
  if(claimsError||!userId)return null;

  let businessQuery=supabase.from("businesses").select("id").eq("owner_id",userId).limit(1);
  if(businessId)businessQuery=businessQuery.eq("id",businessId);
  else if(businessName?.trim())businessQuery=businessQuery.eq("name",businessName.trim());
  else return null;
  const {data:business}=await businessQuery.maybeSingle();
  if(!business?.id)return null;

  const {data,error}=await supabase.from("content_items")
    .select("platform,format,objective,hook,concept,status,created_at")
    .eq("business_id",String(business.id))
    .order("created_at",{ascending:false})
    .limit(80);
  if(error||!data?.length)return null;

  const recentItems=data.map(item=>({
    platform:clean(item.platform),format:clean(item.format),objective:clean(item.objective),hook:clean(item.hook),concept:clean(item.concept),status:clean(item.status),createdAt:clean(item.created_at),
  }));
  const hookCounts=new Map<string,{label:string;count:number}>();
  for(const item of recentItems){
    const key=hookKey(item.hook);if(!key)continue;
    const current=hookCounts.get(key)||{label:item.hook,count:0};current.count+=1;hookCounts.set(key,current);
  }
  const repeatedHooks=[...hookCounts.values()].filter(item=>item.count>1).sort((a,b)=>b.count-a.count).map(item=>item.label).slice(0,12);
  const recentHooks=[...new Set(recentItems.map(item=>item.hook).filter(Boolean))].slice(0,30);
  const duplicateRatio=repeatedHooks.length/Math.max(1,recentHooks.length);
  const level:ContentMemoryContext["duplicateRisk"]["level"]=duplicateRatio>=.25?"high":duplicateRatio>=.1?"medium":"low";

  return {
    recentItems:recentItems.slice(0,40),
    recentHooks,
    formatCounts:countBy(recentItems.map(item=>item.format)),
    platformCounts:countBy(recentItems.map(item=>item.platform)),
    objectiveCounts:countBy(recentItems.map(item=>item.objective)),
    duplicateRisk:{level,repeatedHooks,totalRemembered:recentItems.length},
  };
}

export function contentMemoryForPlan(memory:ContentMemoryContext|null){
  if(!memory)return "";
  const compact={recentHooks:memory.recentHooks.slice(0,24),recentItems:memory.recentItems.slice(0,24),formatCounts:memory.formatCounts,platformCounts:memory.platformCounts,objectiveCounts:memory.objectiveCounts,duplicateRisk:memory.duplicateRisk};
  return `\n\nHAY CONTENT MEMORY — real recent content from this business:\n${JSON.stringify(compact)}\nPlanning rules: treat draft, scheduled and published items as already used for duplication control. Do not repeat hooks verbatim. Avoid near-duplicate concepts, openings and CTAs. Continue a proven theme only with a materially new angle, proof, audience segment or format. Deliberately rebalance overused formats/objectives while preserving measured winners. Build recognizable series where continuity is useful, but every episode must add new information.`;
}
