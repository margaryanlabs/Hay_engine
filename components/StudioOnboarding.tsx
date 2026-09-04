"use client";

import { useEffect, useMemo, useState } from "react";

type Mode="loading"|"preview"|"unauthorized"|"new"|"active";

export default function StudioOnboarding(){
  const [mode,setMode]=useState<Mode>("loading");
  const [businessName,setBusinessName]=useState("");
  const [profileReady,setProfileReady]=useState(false);
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
    const refresh=()=>{if(!hidden)void hydrate();};
    window.addEventListener("hay:onboarding-open",reopen);
    window.addEventListener("hay:studio-refresh",refresh);
    return()=>{window.removeEventListener("hay:onboarding-open",reopen);window.removeEventListener("hay:studio-refresh",refresh);};
  },[hidden]);

  async function hydrate(){
    try{
      const response=await fetch("/api/businesses",{cache:"no-store"});
      if(response.status===401){setMode("unauthorized");return;}
      const data=await response.json();
      if(data.configured===false){setMode("preview");return;}
      const business=data.businesses?.[0];
      if(!business){setBusinessName("");setProfileReady(false);setConnections(0);setMode("new");return;}
      setBusinessName(String(business.name||""));
      setProfileReady(Boolean(String(business.name||"").trim()&&String(business.category||"").trim()&&(String(business.description||"").trim()||String(business.offer||"").trim())));
      const businessId=String(business.id);
      const social=await fetch(`/api/social/connections?businessId=${encodeURIComponent(businessId)}`,{cache:"no-store"});
      if(social.ok){const socialData=await social.json();setConnections((socialData.connections||[]).filter((item:{status?:string})=>item.status==="connected").length);}
      setMode("active");
    }catch{setMode("preview");}
  }

  const steps=useMemo(()=>[
    {n:"01",title:"Business context",text:"Add the name, category and a clear description of what the business offers.",selector:".businessCard",done:profileReady},
    {n:"02",title:"Competitors",text:"Add direct competitors when they matter. One name per line is enough to start.",selector:".competitorsCard",done:false},
    {n:"03",title:"Build the first 7 days",text:"HAY saves the current business context and turns it into the first executable content cycle.",selector:".heroActions",done:firstCycleStarted},
    {n:"04",title:"Connect channels",text:"Authorize Instagram, TikTok, YouTube or Facebook when you are ready to publish.",selector:".channelList",done:connections>0},
  ],[profileReady,connections,firstCycleStarted]);

  function jump(selector:string){document.querySelector<HTMLElement>(selector)?.scrollIntoView({behavior:"smooth",block:"center"});}
  function launchFirstCycle(){
    jump(".heroActions");
    const button=document.querySelector<HTMLButtonElement>(".heroActions .hayPrimary");
    if(!button){setNotice("Open Studio and build the first 7-day cycle from the main action.");return;}
    if(button.disabled){setNotice("Add the business name and category first, then build the first 7 days.");return;}
    setFirstCycleStarted(true);
    setNotice("First cycle started. HAY will keep the business context with the generated plan.");
    button.click();
  }
  function stepAction(step:{n:string;selector:string}){if(step.n==="03")launchFirstCycle();else jump(step.selector);}
  function dismiss(){window.localStorage.setItem("hay-studio-onboarding-hidden","1");setHidden(true);}
  if(hidden||mode==="loading")return null;

  return <aside className="studioOnboarding" aria-label="HAY Studio onboarding">
    <header><div><span><i/>GET STARTED</span><strong>{mode==="active"?"Get to the first useful output":"Add your first business"}</strong></div><button onClick={dismiss} aria-label="Hide onboarding">×</button></header>
    {mode==="unauthorized"&&<div className="studioOnboardingNotice"><span>ACCOUNT REQUIRED</span><p>Sign in to save the business and securely connect social accounts.</p><a href="/login?next=%2Fstudio">SIGN IN →</a></div>}
    {mode==="preview"&&<div className="studioOnboardingNotice demo"><span>PREVIEW MODE</span><p>You can explore planning and creation now. Saved businesses and connected channels become available when accounts are active.</p></div>}
    {mode==="new"&&<div className="studioOnboardingNotice"><span>FIRST STEP</span><p>Add the business name and category in Business context. HAY will save the profile when you build the first cycle.</p></div>}
    <div className="studioOnboardingSteps">{steps.map(step=><button key={step.n} onClick={()=>stepAction(step)} className={step.done?"done":""}><span>{step.n}</span><div><strong>{step.title}</strong><p>{step.text}</p></div><i>{step.done?"✓":step.n==="03"?"▶":"→"}</i></button>)}</div>
    {notice&&<div className="studioOnboardingNotice demo"><span>NEXT</span><p>{notice}</p></div>}
    <footer><span>{businessName||"FIRST BUSINESS"}</span><b>{connections}/4 CHANNELS CONNECTED</b></footer>
  </aside>;
}
