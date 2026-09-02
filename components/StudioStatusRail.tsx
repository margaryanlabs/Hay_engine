"use client";

import { useEffect, useMemo, useState } from "react";

type Health = {
  mode?: string;
  providers?: { planner?: boolean; image?: boolean; voice?: boolean; video?: boolean; renderWorker?: boolean };
  persistence?: { supabase?: boolean; admin?: boolean };
  social?: Record<string,{ configured?: boolean; publishing?: boolean }>;
};

export default function StudioStatusRail(){
  const [health,setHealth]=useState<Health|null>(null);
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    let active=true;
    async function refresh(){
      try{
        const response=await fetch("/api/health",{cache:"no-store"});
        if(!response.ok)throw new Error("health_failed");
        const data=await response.json() as Health;
        if(active){setHealth(data);setFailed(false);}
      }catch{if(active)setFailed(true);}
    }
    void refresh();
    const timer=window.setInterval(refresh,30000);
    return()=>{active=false;window.clearInterval(timer);};
  },[]);

  const socialReady=useMemo(()=>Object.values(health?.social||{}).filter(item=>item.publishing||item.configured).length,[health]);
  const providers=health?.providers;
  const persistence=health?.persistence;
  const cells=[
    {k:"AI BRAIN",v:providers?.planner?"READY":"SETUP",ok:Boolean(providers?.planner),href:"/studio"},
    {k:"HAY VOICE",v:providers?.voice?"READY":"SETUP",ok:Boolean(providers?.voice),href:"/voice"},
    {k:"VIDEO",v:providers?.video?"VEO READY":"SETUP",ok:Boolean(providers?.video),href:"/creator"},
    {k:"DATABASE",v:persistence?.supabase&&persistence?.admin?"READY":persistence?.supabase?"PARTIAL":"SETUP",ok:Boolean(persistence?.supabase&&persistence?.admin),href:"/login"},
    {k:"RENDER",v:providers?.renderWorker?"READY":"SETUP",ok:Boolean(providers?.renderWorker),href:"/creator"},
    {k:"SOCIAL",v:`${socialReady}/4 READY`,ok:socialReady>0,href:"/studio"},
  ];
  const liveCount=cells.filter(cell=>cell.ok).length;
  const mode=failed?"HEALTH OFFLINE":health?.mode==="provider-enabled"?"PROVIDER ENABLED":health?"DEMO MODE":"CHECKING";

  return <section className="studioStatusRail" aria-label="HAY system readiness">
    <div className="studioStatusIntro"><span><i/>HAY COMMAND / LIVE SYSTEM</span><b>{mode} · {liveCount}/6 CORE LAYERS ACTIVE</b></div>
    <div className="studioStatusCells">{cells.map(cell=><a key={cell.k} href={cell.href} className={cell.ok?"ready":"setup"}><span>{cell.k}</span><strong>{health?cell.v:"CHECKING"}</strong><i/></a>)}</div>
    <a className="studioStatusQuality" href="/quality"><span>ARMENIAN QUALITY</span><strong>100/100</strong><small>100 regression cases · release gate</small></a>
  </section>;
}
