import MarketingOS from "@/components/MarketingOS";
import StudioStatusRail from "@/components/StudioStatusRail";

export const metadata = {
  title: "HAY Studio — Marketing OS",
  description: "Analyze, create, publish and learn with the HAY Armenian-first Marketing OS.",
};

export default function StudioPage(){
  return <>
    <StudioStatusRail/>
    <MarketingOS/>
  </>;
}
