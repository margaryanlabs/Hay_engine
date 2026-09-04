"use client";

import { useEffect, useMemo, useState } from "react";

type Command={label:string;hint:string;action:()=>void};

export default function StudioCommandPalette(){
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState(0);

  function close(){setOpen(false);setQuery("");setSelected(0);}
  function scroll(selector:string){const node=document.querySelector<HTMLElement>(selector);node?.scrollIntoView({behavior:"smooth",block:"start"});close();}
  function go(path:string){window.location.href=path;}
  function click(selector:string){const node=document.querySelector<HTMLElement>(selector);node?.click();close();}
  function openOnboarding(){window.dispatchEvent(new Event("hay:onboarding-open"));close();}

  const commands=useMemo<Command[]>(()=>[
    {label:"Build the next 7 days",hint:"PLAN",action:()=>click(".heroActions .hayPrimary")},
    {label:"Refresh business context",hint:"CONTEXT",action:()=>click(".heroActions .haySecondary")},
    {label:"Toggle Autopilot",hint:"AUTO / REVIEW",action:()=>click(".autopilot")},
    {label:"Open setup guide",hint:"SETUP",action:openOnboarding},
    {label:"Business context",hint:"BRAND",action:()=>scroll(".businessCard")},
    {label:"Connected channels",hint:"CHANNELS",action:()=>scroll(".channelsCard")},
    {label:"Competitors",hint:"MARKET",action:()=>scroll(".competitorsCard")},
    {label:"Campaign planning",hint:"CAMPAIGN",action:()=>scroll(".studioCampaignBrain")},
    {label:"Campaign performance",hint:"MEASURE",action:()=>scroll(".studioCampaignAnalytics")},
    {label:"Conversion tracking",hint:"LEADS",action:()=>scroll(".studioConversionBridge")},
    {label:"Content desk",hint:"CONTENT",action:()=>scroll(".contentPulse")},
    {label:"Publishing calendar",hint:"SCHEDULE",action:()=>scroll(".studioScheduleQueue")},
    {label:"Content series",hint:"SERIES",action:()=>scroll(".studioSeries")},
    {label:"Content history",hint:"MEMORY",action:()=>scroll(".studioMemory")},
    {label:"Publishing rules",hint:"CONTROL",action:()=>scroll(".studioPolicy")},
    {label:"Approval inbox",hint:"APPROVE",action:()=>scroll(".studioApprovalPanel")},
    {label:"Performance",hint:"LEARN",action:()=>scroll(".studioPerformancePanel")},
    {label:"Creator",hint:"CREATE",action:()=>go("/creator")},
    {label:"Voice",hint:"VOICE",action:()=>go("/voice")},
    {label:"Armenian quality",hint:"REPORT",action:()=>go("/quality")},
    {label:"Account & setup",hint:"ACCOUNT",action:()=>go("/login")},
  ],[]);

  const filtered=commands.filter(command=>`${command.label} ${command.hint}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(()=>{setSelected(0);},[query]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setOpen(value=>!value);}
      if(event.key==="Escape")close();
    };
    const onClick=(event:MouseEvent)=>{const target=event.target as HTMLElement|null;if(target?.closest(".commandButton")){event.preventDefault();setOpen(true);}};
    window.addEventListener("keydown",onKey);document.addEventListener("click",onClick);
    return()=>{window.removeEventListener("keydown",onKey);document.removeEventListener("click",onClick);};
  },[]);

  function onInputKeyDown(event:React.KeyboardEvent<HTMLInputElement>){
    if(event.key==="ArrowDown"){event.preventDefault();setSelected(value=>filtered.length?Math.min(value+1,filtered.length-1):0);}
    if(event.key==="ArrowUp"){event.preventDefault();setSelected(value=>Math.max(value-1,0));}
    if(event.key==="Enter"&&filtered[selected]){event.preventDefault();filtered[selected].action();}
  }

  if(!open)return null;
  return <div className="studioCommandBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
    <section className="studioCommandPalette" role="dialog" aria-modal="true" aria-label="HAY command palette">
      <header><span><i/>QUICK ACTIONS</span><kbd>ESC</kbd></header>
      <div className="studioCommandSearch"><span>⌕</span><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={onInputKeyDown} placeholder="Find an action or section…"/></div>
      <div className="studioCommandList">{filtered.map((command,index)=><button key={command.label} className={selected===index?"active":""} onMouseEnter={()=>setSelected(index)} onClick={command.action}><span>{String(index+1).padStart(2,"0")}</span><strong>{command.label}</strong><small>{command.hint}</small><b>↗</b></button>)}{filtered.length===0&&<p>No action found.</p>}</div>
      <footer><span>↑↓ NAVIGATE</span><span>ENTER OPEN</span><span>⌘K TOGGLE</span></footer>
    </section>
  </div>;
}
