"use client";

import { useEffect, useState } from "react";

type Episode={contentItemId:string;day:number;platform:string;format:string;objective:string;hook:string};
type Series={key:string;title:string;premise:string;primaryObjective:string;plannedWeeks:number;cadence:string;episodes:Episode[];nextAngle:string};
type Architecture={version:string;plannedWeeks:number;createdAt:string;series:Series[]};
type Response={configured:boolean;error?:string;business?:{id:string;name:string}|null;architecture?:Architecture|null;createdAt?:string|null};

const code=(platform:string)=>({instagram:"IG",tiktok:"TT",youtube:"YT",facebook:"FB",linkedin:"LI"}[platform]||platform.slice(0,2).toUpperCase());

export default function StudioContentSeries(){
  const [data,setData]=useState<Response|null>(null);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    try{
      const response=await fetch("/api/studio/series",{cache:"no-store"});
      if(response.status===401){setData({configured:true,error:"unauthorized"});return;}
      setData(await response.json());
    }catch{setData({configured:false,error:"unavailable"});}
    finally{setLoading(false);}
  }
  useEffect(()=>{
    void load();
    const refresh=()=>{void load();};
    window.addEventListener("hay:studio-refresh",refresh);
    return()=>window.removeEventListener("hay:studio-refresh",refresh);
  },[]);

  const series=data?.architecture?.series||[];
  function runPlan(){document.querySelector<HTMLElement>(".heroActions .hayPrimary")?.click();}

  return <section className="studioSeries" aria-label="HAY multi-week content series">
    <header><div><span><i/>CONTENT SERIES / 4-WEEK MEMORY</span><h2>Build recognizable shows, not random posts.</h2></div><div><b>{data?.architecture?.plannedWeeks||4} WEEKS</b><button onClick={()=>void load()} disabled={loading}>{loading?"SYNCING…":"REFRESH ↻"}</button></div></header>
    {loading?<div className="seriesEmpty"><strong>Reading series architecture…</strong></div>:
      data?.configured===false?<div className="seriesEmpty"><strong>Series Memory activates with HAY persistence.</strong><span>No fake campaign history is generated in demo mode.</span></div>:
      data?.error==="unauthorized"?<div className="seriesEmpty"><strong>Sign in to load durable brand series.</strong><a href="/login">SIGN IN →</a></div>:
      series.length===0?<div className="seriesEmpty"><strong>No durable series architecture yet.</strong><span>Generate the next plan. HAY will group the week into repeatable 4-week formats automatically.</span><button onClick={runPlan}>GENERATE PLAN →</button></div>:
      <div className="seriesGrid">{series.map((item,index)=><article key={item.key}>
        <div className="seriesTop"><span>0{index+1}</span><b>{item.primaryObjective.toUpperCase()}</b><em>{item.cadence}</em></div>
        <h3>{item.title}</h3><p>{item.premise}</p>
        <div className="seriesEpisodes">{item.episodes.slice(0,4).map((episode,episodeIndex)=><div key={`${episode.contentItemId}-${episodeIndex}`}><span>{code(episode.platform)}</span><b>EP {episodeIndex+1}</b><small>{episode.hook}</small></div>)}</div>
        <footer><span>NEXT ANGLE</span><strong>{item.nextAngle||"New proof, audience or format"}</strong></footer>
      </article>)}</div>}
    <div className="seriesRule"><span>HAY SERIES RULE</span><strong>Continuity without repetition.</strong><p>Keep the recognizable theme. Change the proof, angle, audience segment, hook or format every episode.</p></div>
  </section>;
}
