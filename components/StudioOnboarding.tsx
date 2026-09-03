"use client";

import { useEffect, useMemo, useState } from "react";

type Mode="loading"|"demo"|"unauthorized"|"new"|"active";

export default function StudioOnboarding(){
  const [mode,setMode]=useState<Mode>("loading");
  const [businessId,setBusinessId]=useState<string|null>(null);
  const [connections,setConnections]=useState(0);
  const [firstCycleStarted,setFirstCycleStarted]=useState(false);
  const [notice,setNotice]=useState("");
  const [hidden,setHidden]=useState(false);

  useEffect(()=>{
    if(window.localStorage.getItem("hay-studio-onboarding-hidden")==="1"){setHidden(true);return;}
    void hydrate();
  },[]);

  useEffect(()=>{
    const reopen=()=>{window.localStorage.removeItem("hay-studio-onboarding-hidden");setHidden(false);setMode("loading");setNotice("");void hydrate();};
    window.addEventListener("hay:onboarding-open",reopen);
    return()=>window.removeEventListener("hay:onboarding-open",reopen);
  },[]);

  async function hydrate(){
    try{
      const response=await fetch("/api/businesses",{cache:"no-store"});
      if(response.status===401){setMode("unauthorized");return;}
      const data=await response.json();
      if(data.configured===false){setMode("demo");return;}
      const business=data.businesses?.[0];
      if(!business){setMode("new");return;}
      setBusinessId(String(business.id));
      const social=await fetch(`/api/social/connections?businessId=${encodeURIComponent(String(business.id))}`,{cache:"no-store"});
      if(social.ok){const socialData=await social.json();setConnections((socialData.connections||[]).filter((item:{status?:string})=>item.status==="connected").length);}
      setMode("active");
    }catch{setMode("demo");}
  }

  const steps=useMemo(()=>[
    {n:"01",title:"Business DNA",text:"Name, offer, audience, location and brand voice.",selector:".businessNameRow",done:mode==="active"},
    {n:"02",title:"Competitor Radar",text:"Add direct competitors and let HAY map content gaps.",selector:".competitorsCard",done:false},
    {n:"03",title:"Connect channels",text:"Instagram, TikTok, YouTube or Facebook via OAuth. You can do this after the first plan.",selector:".channelList",done:connections>0},
    {n:"04",title:"Launch first cycle",text:"One click starts the real 7-day plan in Marketing OS — no second setup flow.",selector:".heroActions",done:firstCycleStarted},
  ],[mode,connections,firstCycleStarted]);

  function jump(selector:string){document.querySelector<HTMLElement>(selector)?.scrollIntoView({behavior:"smooth",block:"center"});}
  function launchFirstCycle(){
    jump(".heroActions");
    const button=document.querySelector<HTMLButtonElement>(".heroActions .hayPrimary");
    if(!button){setNotice("Open Marketing OS and build the first 7-day plan from the main action.");return;}
    if(button.disabled){setNotice("HAY is already working on the current cycle.");return;}
    setFirstCycleStarted(true);
    setNotice("First HAY cycle started. The generated plan will appear in Marketing OS below.");
    button.click();
  }
  function stepAction(step:{n:string;selector:string}){if(step.n==="04"&&mode==="active")launchFirstCycle();else jump(step.selector);}
  function dismiss(){window.localStorage.setItem("hay-studio-onboarding-hidden","1");setHidden(true);}
  if(hidden||mode==="loading")return null;

  return <aside className="studioOnboarding" aria-label="HAY Studio onboarding">
    <header><div><span><i/>START HAY</span><strong>{mode==="active"?"Get to the first useful output":"Set up your first business"}</strong></div><button onClick={dismiss} aria-label="Hide onboarding">×</button></header>
    {mode==="unauthorized"&&<div className="studioOnboardingNotice"><span>ACCOUNT REQUIRED</span><p>Sign in to save the business and securely connect social accounts.</p><a href="/login?next=%2Fstudio">SIGN IN →</a></div>}
    {mode==="demo"&&<div className="studioOnboardingNotice demo"><span>DEMO MODE</span><p>You can explore the workflow now. Persistence and social OAuth activate when the dedicated HAY Supabase project is connected.</p></div>}
    {mode==="new"&&<div className="studioOnboardingNotice"><span>FIRST VALUE</span><p>Fill Business DNA first. HAY will reuse the same profile for strategy, content, publishing and learning.</p></div>}
    <div className="studioOnboardingSteps">{steps.map(step=><button key={step.n} onClick={()=>stepAction(step)} className={step.done?"done":""}><span>{step.n}</span><div><strong>{step.title}</strong><p>{step.text}</p></div><i>{step.done?"✓":step.n==="04"&&mode==="active"?"▶":"→"}</i></button>)}</div>
    {notice&&<div className="studioOnboardingNotice demo"><span>LIVE</span><p>{notice}</p></div>}
    <footer><span>{businessId?`BUSINESS ${businessId.slice(0,8).toUpperCase()}`:"FIRST RUN"}</span><b>{connections}/4 CHANNELS CONNECTED</b></footer>
  </aside>;
}
