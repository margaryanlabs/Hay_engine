"use client";

import { useEffect, useState } from "react";

type Context={
  configured:boolean;
  authenticated:boolean;
  enforcementEnabled:boolean;
  migrationReady:boolean;
  planId:"free"|"creator"|"growth"|"business"|"agency";
  status:string;
  limits:{contentAssets:number;aiVideoCredits:number;voiceMinutes:number};
  usage:{content_assets:number;ai_video_credits:number;voice_minutes:number};
};

const label={content_assets:"CONTENT",ai_video_credits:"VIDEO",voice_minutes:"VOICE"} as const;

export default function StudioCommercialRail(){
  const [context,setContext]=useState<Context|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState<string|null>(null);

  useEffect(()=>{void refresh();},[]);
  async function refresh(){
    try{
      const response=await fetch("/api/account/entitlement",{cache:"no-store"});
      const data=await response.json();
      if(response.ok||data.configured===false)setContext(data);
    }catch{/* Studio still works if commercial diagnostics are temporarily unavailable. */}
  }

  async function upgrade(plan:"creator"|"growth"|"business"){
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
    <header><div><span>HAY / COMMERCIAL</span><strong>{context.planId.toUpperCase()}</strong></div><div className={`commercialState ${context.status}`}>{context.status.toUpperCase()}</div></header>
    <div className="commercialMeters">{meters.map(item=>{
      const ratio=item.limit?Math.min(100,(item.used/item.limit)*100):0;
      return <div className="commercialMeter" key={item.key}><div><span>{label[item.key]}</span><b>{Math.round(item.used*10)/10} / {item.limit} {item.unit}</b></div><i><b style={{width:`${ratio}%`}}/></i></div>;
    })}</div>
    <footer>
      <div><span>{context.enforcementEnabled?"PLAN LIMITS ON":"PLAN LIMITS READY"}</span>{!context.migrationReady&&<b>APPLY 007 MIGRATION</b>}</div>
      {context.planId==="free"&&<button disabled={busy!==null} onClick={()=>upgrade("creator")}>{busy?"…":"UPGRADE →"}</button>}
      {context.planId==="creator"&&<button disabled={busy!==null} onClick={()=>upgrade("growth")}>{busy?"…":"MOVE TO GROWTH →"}</button>}
      {context.planId==="growth"&&<button disabled={busy!==null} onClick={()=>upgrade("business")}>{busy?"…":"MOVE TO BUSINESS →"}</button>}
      {(context.planId==="business"||context.planId==="agency")&&<a href="/#pricing">PLAN DETAILS →</a>}
    </footer>
    {message&&<p className="commercialMessage">{message}</p>}
  </section>;
}
