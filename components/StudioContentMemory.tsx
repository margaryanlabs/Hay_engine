"use client";

import { useEffect, useMemo, useState } from "react";

type Memory={
  recentItems:Array<{platform:string;format:string;objective:string;hook:string;concept:string;status:string;createdAt:string}>;
  recentHooks:string[];
  formatCounts:Record<string,number>;
  platformCounts:Record<string,number>;
  objectiveCounts:Record<string,number>;
  duplicateRisk:{level:"low"|"medium"|"high";repeatedHooks:string[];totalRemembered:number};
};

const topEntries=(value:Record<string,number>)=>Object.entries(value).sort((a,b)=>b[1]-a[1]).slice(0,4);

export default function StudioContentMemory(){
  const [memory,setMemory]=useState<Memory|null>(null);
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    try{
      const response=await fetch("/api/studio/memory",{cache:"no-store"});
      if(response.status===401){setConfigured(true);setMemory(null);return;}
      const data=await response.json();
      setConfigured(data.configured!==false);setMemory(data.memory||null);
    }catch{setConfigured(false);setMemory(null);}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    void load();
    const refresh=()=>{void load();};
    window.addEventListener("hay:studio-refresh",refresh);
    return()=>window.removeEventListener("hay:studio-refresh",refresh);
  },[]);
  const dominantFormat=useMemo(()=>topEntries(memory?.formatCounts||{})[0]||null,[memory]);
  const dominantObjective=useMemo(()=>topEntries(memory?.objectiveCounts||{})[0]||null,[memory]);

  return <section className="studioMemory" aria-label="HAY content memory">
    <header><div><span><i/>CONTENT MEMORY / ANTI-REPETITION</span><h2>HAY remembers what the brand already said.</h2></div><button onClick={()=>void load()} disabled={loading}>{loading?"SYNCING…":"REFRESH ↻"}</button></header>
    {configured===false?<div className="memoryEmpty"><strong>Content Memory activates with the dedicated HAY database.</strong><span>Demo mode never invents a publishing history.</span></div>:
      !memory?<div className="memoryEmpty"><strong>No content history yet.</strong><span>The first durable plan becomes the baseline for future anti-duplication and series planning.</span></div>:
      <div className="memoryGrid">
        <article className={`memoryRisk risk-${memory.duplicateRisk.level}`}><span>DUPLICATION RISK</span><strong>{memory.duplicateRisk.level.toUpperCase()}</strong><small>{memory.duplicateRisk.totalRemembered} items remembered</small><i/></article>
        <article><span>MOST USED FORMAT</span><strong>{dominantFormat?.[0]?.toUpperCase()||"—"}</strong><small>{dominantFormat?`${dominantFormat[1]} recent items`:"No data"}</small></article>
        <article><span>MOST USED OBJECTIVE</span><strong>{dominantObjective?.[0]?.toUpperCase()||"—"}</strong><small>{dominantObjective?`${dominantObjective[1]} recent items`:"No data"}</small></article>
        <article className="memoryHooks"><span>RECENT HOOKS / DO NOT REPEAT</span><div>{memory.recentHooks.slice(0,6).map((hook,index)=><p key={`${hook}-${index}`}><b>{String(index+1).padStart(2,"0")}</b>{hook}</p>)}</div></article>
        <article className="memoryRotation"><span>FORMAT ROTATION</span><div>{topEntries(memory.formatCounts).map(([name,count])=><p key={name}><b>{name}</b><i><em style={{width:`${Math.max(8,Math.round(count/Math.max(...Object.values(memory.formatCounts),1)*100))}%`}}/></i><small>{count}</small></p>)}</div></article>
        <article className="memorySeries"><span>HAY RULE</span><strong>Repeat the theme, not the post.</strong><p>Proven ideas may become a series, but every next asset needs a new angle, proof, audience segment or format.</p>{memory.duplicateRisk.repeatedHooks.length>0&&<small>Repeated hooks detected: {memory.duplicateRisk.repeatedHooks.slice(0,2).join(" · ")}</small>}</article>
      </div>}
  </section>;
}
