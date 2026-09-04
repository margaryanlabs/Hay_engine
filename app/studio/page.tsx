import { redirect } from "next/navigation";
import MarketingOSV7 from "@/components/MarketingOSV7";
import StudioCampaignAnalytics from "@/components/StudioCampaignAnalytics";
import StudioCampaignBrain from "@/components/StudioCampaignBrain";
import StudioCommandPalette from "@/components/StudioCommandPalette";
import StudioCommercialRail from "@/components/StudioCommercialRail";
import StudioContentMemory from "@/components/StudioContentMemory";
import StudioContentSeries from "@/components/StudioContentSeries";
import StudioConversionBridge from "@/components/StudioConversionBridge";
import StudioDecisionConsole from "@/components/StudioDecisionConsole";
import StudioOnboarding from "@/components/StudioOnboarding";
import StudioPublishingPolicy from "@/components/StudioPublishingPolicy";
import StudioScheduleQueue from "@/components/StudioScheduleQueue";
import StudioStatusRail from "@/components/StudioStatusRail";
import StudioTodayBrief from "@/components/StudioTodayBrief";
import StudioWorkspaceSwitcher from "@/components/StudioWorkspaceSwitcher";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata = {
  title: "HAY Studio — Marketing OS",
  description: "Context, decisions, content, publishing and performance in one HAY workspace.",
};

type StudioPageProps={searchParams:Promise<{plan?:string|string[]}>};
const allowedPlans=new Set(["free","creator","growth","business","agency"]);

export default async function StudioPage({searchParams}:StudioPageProps){
  const params=await searchParams;
  const rawPlan=Array.isArray(params.plan)?params.plan[0]:params.plan;
  const selectedPlan=rawPlan&&allowedPlans.has(rawPlan)?rawPlan:null;
  const nextPath=selectedPlan?`/studio?plan=${encodeURIComponent(selectedPlan)}`:"/studio";

  // Keep local/demo exploration possible when Supabase is intentionally absent,
  // but never expose a persistent production workspace without an authenticated owner.
  if(isSupabaseConfigured()){
    const supabase=await createClient();
    const {data,error}=await supabase.auth.getClaims();
    if(error||!data?.claims?.sub)redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return <div className="studioAppV7">
    <StudioStatusRail/>
    <StudioCommercialRail/>
    <StudioWorkspaceSwitcher/>

    <MarketingOSV7/>
    <StudioTodayBrief/>

    <div className="studioInsightGrid" aria-label="HAY intelligence and decision layer">
      <StudioCampaignBrain/>
      <StudioCampaignAnalytics/>
      <StudioConversionBridge/>
      <StudioDecisionConsole/>
    </div>

    <div className="studioExecutionGrid" aria-label="HAY publishing and memory layer">
      <StudioScheduleQueue/>
      <StudioContentSeries/>
      <StudioContentMemory/>
      <StudioPublishingPolicy/>
    </div>

    <div className="studioOnboardingWrap">
      <StudioOnboarding/>
    </div>
    <StudioCommandPalette/>
  </div>;
}
