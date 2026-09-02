"use client";

import { useEffect, useMemo, useState } from "react";

type CalendarItem={id:string;platform:string;format:string;objective:string;hook:string;status:string;scheduledFor?:string|null;hasPublishJob:boolean;publishJobStatus?:string|null};
type Overview={configured:boolean;error?:string;business?:{id:string;name:string}|null;calendar?:CalendarItem[]};

const platformCode=(platform:string)=>({instagram:"IG",tiktok:"TT",youtube:"YT",facebook:"FB",linkedin:"LI"}[platform]||platform.slice(0,2).toUpperCase());
const dateLabel=(value?:string|null)=>value?new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Yerevan",weekday:"short",month:"short",day:"numeric"}).format(new Date(value)):"—";
const timeLabel=(value?:string|null)=>value?new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Yerevan",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value)):"—";

export default function StudioScheduleQueue(){
  const [overview,setOverview]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const response=await fetch("/api/studio/overview",{cache:"no-store"});
        if(response.status===401){if(active)setOverview({configured:true,error:"unauthorized",calendar:[]});return;}
        const data=await response.json() as Overview;
        if(active)setOverview(data);
      }catch{if(active)setOverview({configured:false,error:"unavailable",calendar:[]});}
      finally{if(active)setLoading(false);}
    }
    void load();
    const refresh=()=>{void load();};
    window.addEventListener("hay:studio-refresh",refresh);
    const timer=window.setInterval(load,60000);
    return()=>{active=false;window.removeEventListener("hay:studio-refresh",refresh);window.clearInterval(timer);};
  },[]);

  const items=overview?.calendar||[];
  const grouped=useMemo(()=>items.slice(0,14),[items]);
  function openPulse(){document.querySelector<HTMLElement>(".contentPulse")?.scrollIntoView({behavior:"smooth",block:"start"});}
  function runPlan(){document.querySelector<HTMLElement>(".heroActions .hayPrimary")?.click();}

  return <section className="studioScheduleQueue" aria-label="HAY smart publishing calendar">
    <header className="scheduleHead"><div><span><i/>SMART CALENDAR / ASIA-YEREVAN</span><h2>Plan the week. Turn approved content into a real publishing queue.</h2></div><div><b>BASELINE → LEARNED</b><small>Default windows first. Performance windows after evidence.</small></div></header>

    {loading?<div className="scheduleEmpty"><span>·</span><strong>Reading publishing calendar…</strong></div>:
      overview?.configured===false?<div className="scheduleEmpty"><span>DB</span><strong>Smart Calendar activates with HAY persistence.</strong><p>HAY will not pretend content is scheduled while the durable database is offline.</p></div>:
      overview?.error==="unauthorized"?<div className="scheduleEmpty"><span>↗</span><strong>Sign in to load your durable content calendar.</strong><a href="/login">SIGN IN →</a></div>:
      grouped.length===0?<div className="scheduleEmpty"><span>Հ</span><strong>No planned publishing windows yet.</strong><p>Generate a new 7-day plan. HAY will assign Armenia-local baseline windows automatically.</p><button onClick={runPlan}>GENERATE PLAN →</button></div>:
      <div className="scheduleRail">{grouped.map((item,index)=><article key={item.id} className={item.hasPublishJob?"job-ready":"plan-window"}>
        <div className="scheduleIndex"><span>{String(index+1).padStart(2,"0")}</span><b>{platformCode(item.platform)}</b></div>
        <div className="scheduleWhen"><strong>{dateLabel(item.scheduledFor)}</strong><span>{timeLabel(item.scheduledFor)} · AMT</span></div>
        <div className="scheduleContent"><small>{item.platform} / {item.format} / {item.objective}</small><strong>{item.hook||"Untitled content"}</strong></div>
        <div className="scheduleState"><span>{item.hasPublishJob?"PUBLISH JOB":"PLANNED WINDOW"}</span><b>{(item.publishJobStatus||item.status).toUpperCase().replaceAll("_"," ")}</b></div>
      </article>)}</div>}

    <footer className="scheduleFooter"><span>BASELINE WINDOWS ARE SCHEDULING DEFAULTS — NOT PERFORMANCE CLAIMS.</span><button onClick={openPulse}>OPEN CONTENT PULSE ↗</button></footer>
  </section>;
}
