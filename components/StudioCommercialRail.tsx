"use client";

import { useEffect, useRef, useState } from "react";

type PaidPlan="creator"|"growth"|"business"|"agency";
type Context={
  configured:boolean;
  authenticated:boolean;
  enforcementEnabled:boolean;
  migrationReady:boolean;
  planId:"free"|PaidPlan;
  status:string;
  limits:{contentAssets:number;aiVideoCredits:number;voiceMinutes:number};
  usage:{content_assets:number;ai_video_credits:number;voice_minutes:number};
};

const label={content_assets:"CONTENT",ai_video_credits:"VIDEO",voice_minutes:"VOICE"} as const;
const paidPlans=new Set<PaidPlan>(["creator","growth","business","agency"]);

export default function StudioCommercialRail(){
  const [context,setContext]=useState<Context|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const attemptedPlan=useRef(false);

  useEffect(()=>{void refresh();},[]);
  useEffect(()=>{
    if(!context||attemptedPlan.current)return;
    const requested=new URLSearchParams(window.location.search).get("plan") as PaidPlan|null;
    if(requested&&paidPlans.has(requested)&&requested!==context.planId){
      attemptedPlan.current=true;
      void upgrade(requested);
    }
  },[context]);

  async function refresh(){
    try{
      const response=await fetch("/api/account/entitlement",{cache:"no-store"});
      const data=await response.json();
      if(response.ok||data.configured===false)setContext(data);
    }catch{/* Studio still works if plan diagnostics are temporarily unavailable. */}
  }

  async function upgrade(plan:PaidPlan){
    setBusy(plan);setMessage("");
    try{
      const response=await fetch("/api/billing/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan})});
      const data=await response.json();
      if(!response.ok){setMessage(data.message||data.error||"Checkout is not configured yet.");return;}
      window.location.assign(data.checkoutUrl);
    }catch{setMessage("Checkout is temporarily unavailable.");}
    finally{setBusy(null);}
  }

  if(!context||!context.configured)return null;
  const meters=[
    {key:"content_assets" as const,used:context.usage.content_assets,limit:context.limits.contentAssets,unit:"assets"},
    {key:"ai_video_credits" as const,used:context.usage.ai_video_credits,limit:context.limits.aiVideoCredits,unit:"credits"},
    {key:"voice_minutes" as const,used:context.usage.voice_minutes,limit:context.limits.voiceMinutes,unit:"min"},
  ];

  return <section className="studioCommercial" aria-label="HAY plan and usage">
    <header><div><span>PLAN & USAGE</span><strong>{context.planId.toUpperCase()}</strong></div><div className={`commercialState ${context.status}`}>{context.status.toUpperCase()}</div></header>
    <div className="commercialMeters">{meters.map(item=>{
      const ratio=item.limit?Math.min(100,(item.used/item.limit)*100):0;
      return <div className="commercialMeter" key={item.key}><div><span>{label[item.key]}</span><b>{Math.round(item.used*10)/10} / {item.limit} {item.unit}</b></div><i><b style={{width:`${ratio}%`}}/></i></div>;
    })}</div>
    <footer>
      {context.planId==="free"&&<button disabled={busy!==null} onClick={()=>upgrade("creator")}>{busy?"…":"UPGRADE →"}</button>}
      {context.planId==="creator"&&<button disabled={busy!==null} onClick={()=>upgrade("growth")}>{busy?"…":"MOVE TO GROWTH →"}</button>}
      {context.planId==="growth"&&<button disabled={busy!==null} onClick={()=>upgrade("business")}>{busy?"…":"MOVE TO BUSINESS →"}</button>}
      {context.planId==="business"&&<button disabled={busy!==null} onClick={()=>upgrade("agency")}>{busy?"…":"AGENCY →"}</button>}
      {context.planId==="agency"&&<a href="/#pricing">PLAN DETAILS →</a>}
    </footer>
    {message&&<p className="commercialMessage">{message}</p>}
  </section>;
}
