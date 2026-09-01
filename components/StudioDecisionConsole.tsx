"use client";

import { useEffect, useMemo, useState } from "react";

type Approval = {
  id:string; platform:string; format:string; hook:string; caption:string; status:string; scheduled_for?:string|null; asset_url?:string|null; action:string;
  publishJob?: { id:string; status:string; scheduledFor?:string|null; error?:string|null; attemptCount?:number } | null;
};

type Metrics = {
  totals:{ impressions:number; reach:number; views:number; likes:number; comments:number; shares:number; saves:number; clicks:number; conversions:number; watchTimeSeconds:number };
  byPlatform:Array<{ platform:string; views:number; reach:number; saves:number; clicks:number; conversions:number; posts:number }>;
  measuredItems:number;
  latestMeasuredAt?:string|null;
};

type Overview={ configured:boolean; business?:{id:string;name:string}|null; approvals:Approval[]; metrics:Metrics|null; recentPublished?:unknown[]; error?:string };

const fmt=(value:number)=>new Intl.NumberFormat("en-US",{notation:value>=10000?"compact":"standard",maximumFractionDigits:1}).format(value||0);
const platformCode=(platform:string)=>({instagram:"IG",tiktok:"TT",youtube:"YT",facebook:"FB"}[platform]||platform.slice(0,2).toUpperCase());

export default function StudioDecisionConsole(){
  const [overview,setOverview]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);
    try{
      const response=await fetch("/api/studio/overview",{cache:"no-store"});
      if(response.status===401){setOverview({configured:true,approvals:[],metrics:null,error:"unauthorized"});return;}
      setOverview(await response.json());
    }catch{setOverview({configured:false,approvals:[],metrics:null,error:"unavailable"});}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[]);

  async function approve(item:Approval){
    setBusy(item.id);setMessage("");
    try{
      const response=await fetch("/api/marketing/content/update",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({contentItemId:item.id,status:"approved"})});
      if(response.status===401){window.location.href="/login";return;}
      const data=await response.json();
      if(!response.ok)throw new Error(data.detail||data.error||"approval_failed");
      setMessage("Content approved. It is ready for scheduling or publishing.");
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Approval failed");}
    finally{setBusy(null);}
  }

  function openContentPulse(){document.querySelector<HTMLElement>(".contentPulse")?.scrollIntoView({behavior:"smooth",block:"start"});}

  const metrics=overview?.metrics;
  const bestPlatform=useMemo(()=>metrics?.byPlatform.slice().sort((a,b)=>(b.views+b.saves*4+b.clicks*6)-(a.views+a.saves*4+a.clicks*6))[0]||null,[metrics]);
  const engagement=metrics?metrics.totals.likes+metrics.totals.comments+metrics.totals.shares+metrics.totals.saves:0;

  return <section className="studioDecisionConsole" aria-label="HAY approvals and performance">
    <header className="studioDecisionHead"><div><span><i/>DECISION LAYER</span><h2>Approve what matters. Learn from what worked.</h2></div><div><span>{overview?.business?.name||"HAY STUDIO"}</span><button onClick={()=>void load()} disabled={loading}>{loading?"SYNCING…":"REFRESH ↻"}</button></div></header>

    {!loading&&overview?.configured===false&&<div className="studioDecisionSetup"><span>DEMO / NO PERSISTENCE</span><strong>Approval Inbox and Performance Memory activate with the dedicated HAY database.</strong><p>The UI stays available, but HAY will not invent approvals or metrics while persistence is offline.</p></div>}
    {!loading&&overview?.error==="unauthorized"&&<div className="studioDecisionSetup"><span>ACCOUNT REQUIRED</span><strong>Sign in to see durable approvals and measured performance.</strong><a href="/login">SIGN IN →</a></div>}

    <div className="studioDecisionGrid">
      <article className="studioApprovalPanel">
        <div className="decisionPanelTop"><div><span>01 / APPROVAL INBOX</span><strong>{overview?.approvals?.length||0} requiring attention</strong></div><b>HUMAN GATE</b></div>
        <div className="studioApprovalList">
          {overview?.approvals?.slice(0,6).map(item=><div className="studioApprovalItem" key={item.id}>
            <div className="approvalPlatform"><span>{platformCode(item.platform)}</span><small>{item.format}</small></div>
            <div className="approvalCopy"><strong>{item.hook||item.caption||"Untitled content"}</strong><p>{item.caption||"No caption yet."}</p><div><span>{item.status.toUpperCase()}</span>{item.publishJob&&<span className={`job-${item.publishJob.status}`}>JOB · {item.publishJob.status.toUpperCase().replaceAll("_"," ")}</span>}</div></div>
            <div className="approvalAction">
              {item.status==="draft"?<button onClick={()=>void approve(item)} disabled={busy===item.id}>{busy===item.id?"…":"APPROVE"}</button>:<button onClick={openContentPulse}>{item.publishJob?.status==="needs_approval"?"REVIEW PUBLISH":"OPEN"}</button>}
              <small>{item.scheduled_for?new Date(item.scheduled_for).toLocaleString():item.action.replaceAll("_"," ")}</small>
            </div>
          </div>)}
          {!loading&&overview?.configured!==false&&!overview?.error&&(overview?.approvals?.length||0)===0&&<div className="decisionEmpty"><span>✓</span><strong>Nothing waiting for approval.</strong><p>HAY will surface drafts, scheduled items and platform approval gates here.</p></div>}
          {loading&&<div className="decisionEmpty"><span>·</span><strong>Reading decision state…</strong></div>}
        </div>
      </article>

      <article className="studioPerformancePanel">
        <div className="decisionPanelTop"><div><span>02 / PERFORMANCE MEMORY</span><strong>{metrics?.measuredItems||0} measured posts</strong></div><b>LEARN → NEXT PLAN</b></div>
        {metrics&&metrics.measuredItems>0?<>
          <div className="performanceHero"><div><span>VIEWS</span><strong>{fmt(metrics.totals.views)}</strong><small>{fmt(metrics.totals.reach)} reach</small></div><div><span>ENGAGEMENT</span><strong>{fmt(engagement)}</strong><small>{fmt(metrics.totals.saves)} saves · {fmt(metrics.totals.shares)} shares</small></div><div><span>OUTCOMES</span><strong>{fmt(metrics.totals.conversions)}</strong><small>{fmt(metrics.totals.clicks)} clicks</small></div></div>
          <div className="performancePlatforms">{metrics.byPlatform.slice(0,4).map(row=>{const max=Math.max(...metrics.byPlatform.map(item=>item.views),1);return <div key={row.platform}><span>{platformCode(row.platform)}</span><div><strong>{row.platform}</strong><small>{row.posts} measured · {fmt(row.views)} views</small></div><i><b style={{width:`${Math.max(5,Math.round(row.views/max*100))}%`}}/></i><em>{fmt(row.saves)} saves</em></div>;})}</div>
          <footer className="performanceInsight"><span>BEST CURRENT SIGNAL</span><strong>{bestPlatform?`${bestPlatform.platform.toUpperCase()} · ${fmt(bestPlatform.views)} views · ${fmt(bestPlatform.saves)} saves`:"Collecting data"}</strong><small>{metrics.latestMeasuredAt?`Last measured ${new Date(metrics.latestMeasuredAt).toLocaleString()}`:""}</small></footer>
        </>:<div className="decisionEmpty performance"><span>↗</span><strong>No measured performance yet.</strong><p>After real posts are published, HAY stores snapshots and feeds the result into the next strategy. No synthetic numbers are shown here.</p></div>}
      </article>
    </div>
    {message&&<p className="studioDecisionMessage">{message}</p>}
  </section>;
}
