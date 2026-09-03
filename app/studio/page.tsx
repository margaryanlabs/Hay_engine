import { redirect } from "next/navigation";
import MarketingOS from "@/components/MarketingOS";
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
  description: "Analyze, create, publish and learn with the HAY Armenian-first Marketing OS.",
};

export default async function StudioPage(){
  // Keep local/demo exploration possible when Supabase is intentionally absent,
  // but never expose a persistent production workspace without an authenticated owner.
  if(isSupabaseConfigured()){
    const supabase=await createClient();
    const {data,error}=await supabase.auth.getClaims();
    if(error||!data?.claims?.sub)redirect("/login?next=%2Fstudio");
  }

  return <>
    <StudioStatusRail/>
    <StudioCommercialRail/>
    <StudioWorkspaceSwitcher/>
    <MarketingOS/>
    <StudioTodayBrief/>
    <StudioCampaignBrain/>
    <StudioCampaignAnalytics/>
    <StudioConversionBridge/>
    <StudioDecisionConsole/>
    <StudioScheduleQueue/>
    <StudioContentSeries/>
    <StudioContentMemory/>
    <StudioPublishingPolicy/>
    <StudioOnboarding/>
    <StudioCommandPalette/>
  </>;
}
