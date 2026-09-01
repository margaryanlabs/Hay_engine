import "server-only";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type ContentMemoryContext = {
  recentItems: Array<{ platform:string; format:string; objective:string; hook:string; concept:string; status:string; createdAt:string }>;
  recentHooks: string[];
  formatCounts: Record<string,number>;
  platformCounts: Record<string,number>;
};

export async function loadContentMemory(businessId?: string, businessName?: string): Promise<ContentMemoryContext|null> {
  if(!isSupabaseConfigured()) return null;
  const supabase=await createClient();
  const {data:claims,error:claimsError}=await supabase.auth.getClaims();
  const userId=claims?.claims?.sub;
  if(claimsError||!userId)return null;

  let query=supabase.from("businesses").select("id").eq("owner_id",userId).limit(1);
  if(businessId)query=query.eq("id",businessId);
  else if(businessName?.trim())query=query.eq("name",businessName.trim());
  else return null;
  const {data:business}=await query.maybeSingle();
  if(!business?.id)return null;

  const {data,error}=await supabase.from("content_items")
    .select("platform,format,objective,hook,concept,status,created_at")
    .eq("business_id",String(business.id))
    .order("created_at",{ascending:false})
    .limit(60);
  if(error||!data?.length)return null;

  const recentItems=data.map(item=>({
    platform:String(item.platform||""),format:String(item.format||""),objective:String(item.objective||""),hook:String(item.hook||""),concept:String(item.concept||""),status:String(item.status||""),createdAt:String(item.created_at||"")
  }));
  const recentHooks=[...new Set(recentItems.map(item=>item.hook.trim()).filter(Boolean))].slice(0,24);
  const formatCounts:Record<string,number>={};
  const platformCounts:Record<string,number>={};
  for(const item of recentItems){
    formatCounts[item.format]=(formatCounts[item.format]||0)+1;
    platformCounts[item.platform]=(platformCounts[item.platform]||0)+1;
  }
  return {recentItems:recentItems.slice(0,30),recentHooks,formatCounts,platformCounts};
}

export function contentMemoryForPlan(memory:ContentMemoryContext|null){
  if(!memory)return "";
  return `\n\nHAY CONTENT MEMORY (real recent content from this business):\n${JSON.stringify(memory)}\nRules: do not repeat recent hooks verbatim; avoid near-duplicate concepts; rotate formats and objectives deliberately; reuse proven themes only with a materially new angle. Treat scheduled/draft content as already used for duplication control.`;
}
