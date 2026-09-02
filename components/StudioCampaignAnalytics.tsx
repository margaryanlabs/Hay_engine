"use client";

import { useEffect, useMemo, useState } from "react";

type Totals={views:number;reach:number;likes:number;comments:number;shares:number;saves:number;clicks:number;conversions:number;watchTimeSeconds:number};
type Content={id:string;platform:string;format:string;objective:string;hook:string;phase:string;metrics:Totals;measuredAt:string};
type Phase={name:string;label:string;totalItems:number;measuredItems:number;coverage:number;totals:Totals;score:number};
type Experiment={ready:boolean;reason?:string;hypothesis?:string;control?:string;variant?:string;holdConstant?:string[];primaryMetric?:string;caveat?:string};
type Analytics={campaignId:string;campaignName:string;primaryKpi:string;totalItems:number;measuredItems:number;coverage:number;totals:Totals;phasePerformance:Phase[];topContent:Content[];formatPerformance:Array<{format:string;items:number;totals:Totals;score:number}>;platformPerformance:Array<{platform:string;items:number;totals:Totals;score:number}>;primarySignal:{metric:string;value:number;label:string};evidenceQuality:"none"|"early"|"partial"|"strong";experiment:Experiment;caveats:string[]};
type CampaignSummary={id:string;name:string;startDate:string;endDate:string;primaryKpi:string;planId:string};
type Response={configured:boolean;error?:string;business?:{id:string;name:string}|null;analytics?:Analytics|null;campaigns?:CampaignSummary[]};

const fmt=(value:number)=>new Intl.NumberFormat("en-US",{notation:value>=10000?"compact":"standard",maximumFractionDigits:1}).format(value||0);
const pct=(value:number)=>`${Math.round((value||0)*100)}%`;
const platformCode=(value:string)=>({instagram:"IG",tiktok:"TT",youtube:"YT",facebook:"FB",linkedin:"LI"}[value]||value.slice(0,2).toUpperCase());

export default function StudioCampaignAnalytics(){
  const [data,setData]=useState<Response|null>(null);
  const [selected,setSelected]=useState("");
  const [loading,setLoading]=useState(true);

  async function load(campaignId?:string){
    setLoading(true);
    try{
      const path=campaignId?`/api/studio/campaign-analytics?campaignId=${encodeURIComponent(campaignId)}`:"/api/studio/campaign-analytics";
      const response=await fetch(path,{cache:"no-store"});
      if(response.status===401){setData({configured:true,error:"unauthorized",campaigns:[]});return;}
      const next=await response.json() as Response;setData(next);
      if(!selected&&next.analytics?.campaignId)setSelected(next.analytics.campaignId);
    }catch{setData({configured:false,error:"unavailable",campaigns:[]});}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    void load();
    const refresh=()=>{void load(selected||undefined);};
    window.addEventListener("hay:studio-refresh",refresh);
    return()=>window.removeEventListener("hay:studio-refresh",refresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function changeCampaign(id:string){setSelected(id);await load(id);}
  const analytics=data?.analytics||null;
  const maxPhase=useMemo(()=>Math.max(...(analytics?.phasePerformance||[]).map(item=>item.score),1),[analytics]);
  const bestFormat=analytics?.formatPerformance?.[0]||null;
  const bestPlatform=analytics?.platformPerformance?.[0]||null;

  return <section className="studioCampaignAnalytics" aria-label="HAY Campaign Analytics and Experiment Brain">
    <header className="campaignAnalyticsHead">
      <div><span><i/>CAMPAIGN ANALYTICS / EXPERIMENT BRAIN</span><h2>Measure the campaign. Then test what might actually be better.</h2><p>HAY uses the latest real metric snapshot for each campaign asset. Rankings are observational signals, not causal claims.</p></div>
      <div className="campaignAnalyticsSelect"><span>CAMPAIGN</span><select value={selected} onChange={e=>void changeCampaign(e.target.value)} disabled={loading||!(data?.campaigns?.length)}>{!data?.campaigns?.length&&<option value="">No campaigns</option>}{(data?.campaigns||[]).map(item=><option key={item.id} value={item.id}>{item.name} · {item.startDate}</option>)}</select></div>
    </header>

    {loading?<div className="campaignAnalyticsEmpty"><strong>Reading campaign evidence…</strong></div>:
      data?.configured===false?<div className="campaignAnalyticsEmpty"><strong>Campaign Analytics activates with HAY persistence.</strong><span>No synthetic campaign results are generated in demo mode.</span></div>:
      data?.error==="unauthorized"?<div className="campaignAnalyticsEmpty"><strong>Sign in to read campaign evidence.</strong><a href="/login">SIGN IN →</a></div>:
      !analytics?<div className="campaignAnalyticsEmpty"><strong>No campaign analytics yet.</strong><span>Create a campaign first. After its posts publish and metrics are measured, evidence appears here.</span></div>:
      <>
        <div className="campaignEvidenceStrip">
          <article className={`evidence-${analytics.evidenceQuality}`}><span>EVIDENCE</span><strong>{analytics.evidenceQuality.toUpperCase()}</strong><small>{analytics.measuredItems}/{analytics.totalItems} assets measured · {pct(analytics.coverage)} coverage</small></article>
          <article><span>{analytics.primarySignal.label.toUpperCase()}</span><strong>{fmt(analytics.primarySignal.value)}</strong><small>Primary KPI · {analytics.primaryKpi.toUpperCase()}</small></article>
          <article><span>BEST FORMAT SIGNAL</span><strong>{bestFormat?.format.toUpperCase()||"—"}</strong><small>{bestFormat?`${bestFormat.items} measured assets`:"No evidence"}</small></article>
          <article><span>BEST PLATFORM SIGNAL</span><strong>{bestPlatform?.platform.toUpperCase()||"—"}</strong><small>{bestPlatform?`${bestPlatform.items} measured assets`:"No evidence"}</small></article>
        </div>

        <div className="campaignAnalyticsGrid">
          <article className="phaseAnalytics">
            <div className="analyticsPanelTitle"><span>01 / PHASE PERFORMANCE</span><strong>WHERE THE CAMPAIGN MOVED</strong></div>
            <div className="phaseRows">{analytics.phasePerformance.map(phase=><div key={phase.name}><div><span>{phase.label}</span><strong>{phase.measuredItems}/{phase.totalItems}</strong></div><i><b style={{width:`${Math.max(2,Math.round(phase.score/maxPhase*100))}%`}}/></i><small>{fmt(phase.totals.views)} views · {fmt(phase.totals.clicks)} clicks · {fmt(phase.totals.conversions)} conv.</small></div>)}</div>
          </article>

          <article className="creativeAnalytics">
            <div className="analyticsPanelTitle"><span>02 / TOP CREATIVE</span><strong>OBSERVED SIGNALS</strong></div>
            <div className="creativeRows">{analytics.topContent.slice(0,5).map((item,index)=><div key={item.id}><b>{String(index+1).padStart(2,"0")}</b><span>{platformCode(item.platform)}</span><div><strong>{item.hook||"Untitled content"}</strong><small>{item.format} · {item.phase} · {fmt(item.metrics.views)} views · {fmt(item.metrics.saves)} saves · {fmt(item.metrics.conversions)} conv.</small></div></div>)}{analytics.topContent.length===0&&<p>No measured campaign content yet.</p>}</div>
          </article>
        </div>

        <article className={`experimentBrain ${analytics.experiment.ready?"ready":"waiting"}`}>
          <div className="experimentLabel"><span>03 / NEXT CONTROLLED EXPERIMENT</span><b>{analytics.experiment.ready?"READY TO TEST":"WAITING FOR EVIDENCE"}</b></div>
          {analytics.experiment.ready?<div className="experimentGrid">
            <div className="experimentHypothesis"><span>HYPOTHESIS</span><strong>{analytics.experiment.hypothesis}</strong><small>{analytics.experiment.caveat}</small></div>
            <div><span>CONTROL</span><strong>{analytics.experiment.control}</strong></div>
            <div><span>VARIANT</span><strong>{analytics.experiment.variant}</strong></div>
            <div><span>HOLD CONSTANT</span><strong>{analytics.experiment.holdConstant?.join(" · ")}</strong><small>Primary metric: {analytics.experiment.primaryMetric}</small></div>
          </div>:<div className="experimentWaiting"><strong>{analytics.experiment.reason}</strong><span>HAY will not manufacture an A/B recommendation from insufficient data.</span></div>}
        </article>

        <footer className="campaignAnalyticsCaveats">{analytics.caveats.map((item,index)=><span key={index}>{String(index+1).padStart(2,"0")} · {item}</span>)}</footer>
      </>}
  </section>;
}
