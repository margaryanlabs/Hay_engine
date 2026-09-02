import MarketingOS from "@/components/MarketingOS";
import StudioCommandPalette from "@/components/StudioCommandPalette";
import StudioContentMemory from "@/components/StudioContentMemory";
import StudioContentSeries from "@/components/StudioContentSeries";
import StudioDecisionConsole from "@/components/StudioDecisionConsole";
import StudioOnboarding from "@/components/StudioOnboarding";
import StudioPublishingPolicy from "@/components/StudioPublishingPolicy";
import StudioScheduleQueue from "@/components/StudioScheduleQueue";
import StudioStatusRail from "@/components/StudioStatusRail";
import StudioTodayBrief from "@/components/StudioTodayBrief";
import StudioWorkspaceSwitcher from "@/components/StudioWorkspaceSwitcher";

export const metadata = {
  title: "HAY Studio — Marketing OS",
  description: "Analyze, create, publish and learn with the HAY Armenian-first Marketing OS.",
};

export default function StudioPage(){
  return <>
    <StudioStatusRail/>
    <StudioWorkspaceSwitcher/>
    <MarketingOS/>
    <StudioTodayBrief/>
    <StudioDecisionConsole/>
    <StudioScheduleQueue/>
    <StudioContentSeries/>
    <StudioContentMemory/>
    <StudioPublishingPolicy/>
    <StudioOnboarding/>
    <StudioCommandPalette/>
  </>;
}
