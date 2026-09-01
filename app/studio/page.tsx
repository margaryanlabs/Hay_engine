import MarketingOS from "@/components/MarketingOS";
import StudioCommandPalette from "@/components/StudioCommandPalette";
import StudioDecisionConsole from "@/components/StudioDecisionConsole";
import StudioOnboarding from "@/components/StudioOnboarding";
import StudioStatusRail from "@/components/StudioStatusRail";

export const metadata = {
  title: "HAY Studio — Marketing OS",
  description: "Analyze, create, publish and learn with the HAY Armenian-first Marketing OS.",
};

export default function StudioPage(){
  return <>
    <StudioStatusRail/>
    <MarketingOS/>
    <StudioDecisionConsole/>
    <StudioOnboarding/>
    <StudioCommandPalette/>
  </>;
}
