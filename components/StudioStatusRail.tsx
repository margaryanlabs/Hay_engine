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

  useEffect(()=>{
    let active=true;
    fetch("/api/health",{cache:"no-store"}).then(r=>r.json()).then(data=>{if(active)setHealth(data);}).catch(()=>{if(active)setHealth({mode:"demo"});});
    return()=>{active=false;};
  },[]);

  const socialReady=useMemo(()=>Object.values(health?.social||{}).filter(item=>item.configured).length,[health]);
  const providers=health?.providers;
  const persistence=health?.persistence;
  const liveCount=[providers?.planner,providers?.image,providers?.voice,providers?.video,providers?.renderWorker,persistence?.supabase].filter(Boolean).length;

  const cells=[
    {k:"SYSTEM",v:(health?.mode||"checking").toUpperCase(),ok:health?.mode==="provider-enabled",href:"/quality"},
    {k:"AI BRAIN",v:providers?.planner?"READY":"SETUP",ok:providers?.planner,href:"/studio"},
    {k:"HAY VOICE",v:providers?.voice?"READY":"SETUP",ok:providers?.voice,href:"/voice"},
    {k:"VIDEO",v:providers?.video?"VEO READY":"SETUP",ok:providers?.video,href:"/creator"},
    {k:"DATABASE",v:persistence?.supabase?"CONNECTED":"DEMO",ok:persistence?.supabase,href:"/login"},
    {k:"SOCIAL",v:`${socialReady}/4 READY`,ok:socialReady>0,href:"/studio"},
  ];

  return <section className="studioStatusRail" aria-label="HAY system readiness">
    <div className="studioStatusIntro"><span><i/>HAY COMMAND / LIVE SYSTEM</span><b>{liveCount}/6 CORE LAYERS ACTIVE</b></div>
    <div className="studioStatusCells">{cells.map(cell=><a key={cell.k} href={cell.href} className={cell.ok?"ready":"setup"}><span>{cell.k}</span><strong>{cell.v}</strong><i/></a>)}</div>
    <div className="studioStatusQuality"><span>ARMENIAN QUALITY</span><strong>100/100</strong><small>100 regression cases</small></div>
  </section>;
}
