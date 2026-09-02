"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type BestPlatform={platform:string;views:number;reach:number;saves:number;clicks:number;conversions:number;posts:number};
type Operations={attentionCount:number;draftCount:number;approvedCount:number;scheduledCount:number;publishedCount:number;needsApprovalCount:number;failedCount:number;scheduledNext24h:number;nextScheduled:Array<{id:string;platform:string;status:string;scheduledFor?:string|null}>;bestPlatform:BestPlatform|null};
type Overview={configured:boolean;error?:string;business?:{id:string;name:string}|null;metrics?:{measuredItems:number}|null;operations?:Operations|null};

const compact=(value:number)=>new Intl.NumberFormat("en-US",{notation:value>=10000?"compact":"standard",maximumFractionDigits:1}).format(value||0);

export default function StudioTodayBrief(){
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [overview,setOverview]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{setTarget(document.querySelector<HTMLElement>(".marketingHero"));},[]);
  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const response=await fetch("/api/studio/overview",{cache:"no-store"});
        if(response.status===401){if(active)setOverview({configured:true,error:"unauthorized"});return;}
        const data=await response.json() as Overview;
        if(active)setOverview(data);
      }catch{if(active)setOverview({configured:false,error:"unavailable"});}
      finally{if(active)setLoading(false);}
    }
    void load();
    const refresh=()=>{void load();};
    window.addEventListener("hay:studio-refresh",refresh);
    const timer=window.setInterval(load,60000);
    return()=>{active=false;window.removeEventListener("hay:studio-refresh",refresh);window.clearInterval(timer);};
  },[]);

  const nextMove=useMemo(()=>{
    const ops=overview?.operations;
    if(loading)return "Reading business state…";
    if(overview?.configured===false)return "Activate HAY persistence to unlock a real operational brief.";
    if(overview?.error==="unauthorized")return "Sign in to load your business decisions, schedule and measured performance.";
    if(!ops)return "Create the first plan so HAY has an executable marketing state.";
    if(ops.failedCount>0)return `Resolve ${ops.failedCount} failed publish job${ops.failedCount===1?"":"s"} before adding more queue.`;
    if(ops.needsApprovalCount>0)return `Approve ${ops.needsApprovalCount} platform gate${ops.needsApprovalCount===1?"":"s"} waiting for a human decision.`;
    if(ops.attentionCount>0)return `Review ${ops.attentionCount} content decision${ops.attentionCount===1?"":"s"} that need attention.`;
    if(ops.scheduledNext24h>0)return `${ops.scheduledNext24h} post${ops.scheduledNext24h===1?" is":"s are"} scheduled in the next 24 hours. Queue is healthy.`;
    if(ops.bestPlatform)return `Use ${ops.bestPlatform.platform.toUpperCase()} as the strongest measured signal in the next content cycle.`;
    return "Generate the next 7-day plan and start collecting real performance memory.";
  },[loading,overview]);

  function runPrimary(){document.querySelector<HTMLElement>(".heroActions .hayPrimary")?.click();}
  function openApprovals(){document.querySelector<HTMLElement>(".studioApprovalPanel")?.scrollIntoView({behavior:"smooth",block:"start"});}
  function openPerformance(){document.querySelector<HTMLElement>(".studioPerformancePanel")?.scrollIntoView({behavior:"smooth",block:"start"});}

  if(!target)return null;
  const ops=overview?.operations;
  const next=ops?.nextScheduled?.[0];
  const best=ops?.bestPlatform;

  return createPortal(<aside className="studioTodayBrief" aria-label="HAY operational brief">
    <div className="todayMove"><span><i/>HAY / NEXT MOVE</span><strong>{nextMove}</strong><button onClick={ops?.attentionCount?openApprovals:runPrimary}>{ops?.attentionCount?"OPEN DECISIONS":"RUN NEXT PLAN"} ↗</button></div>
    <div className="todayMetric attention"><span>ATTENTION</span><strong>{loading?"—":compact(ops?.attentionCount||0)}</strong><small>{ops?.needsApprovalCount||0} platform gates · {ops?.failedCount||0} failed</small></div>
    <div className="todayMetric schedule"><span>NEXT 24H</span><strong>{loading?"—":compact(ops?.scheduledNext24h||0)}</strong><small>{next?`${next.platform.toUpperCase()} · ${next.scheduledFor?new Date(next.scheduledFor).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"scheduled"}`:"No scheduled publish"}</small></div>
    <button className="todayMetric signal" onClick={openPerformance}><span>BEST SIGNAL</span><strong>{best?best.platform.toUpperCase():"—"}</strong><small>{best?`${compact(best.views)} views · ${compact(best.saves)} saves`:`${overview?.metrics?.measuredItems||0} measured posts`}</small></button>
  </aside>,target);
}
