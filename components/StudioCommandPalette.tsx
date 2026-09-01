"use client";

import { useEffect, useMemo, useState } from "react";

type Command={label:string;hint:string;action:()=>void};

export default function StudioCommandPalette(){
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");

  function scroll(selector:string){
    const node=document.querySelector<HTMLElement>(selector);
    node?.scrollIntoView({behavior:"smooth",block:"start"});
    setOpen(false);setQuery("");
  }

  function go(path:string){window.location.href=path;}

  const commands=useMemo<Command[]>(()=>[
    {label:"Business Intelligence",hint:"BUSINESS",action:()=>scroll(".marketingGrid .intelCard:nth-child(1)")},
    {label:"Social Channels",hint:"CONNECT",action:()=>scroll(".channelList")},
    {label:"Competitor Radar",hint:"RADAR",action:()=>scroll(".competitorsCard")},
    {label:"Content Pulse",hint:"CALENDAR",action:()=>scroll(".contentPulse")},
    {label:"Creator Engine",hint:"CREATE",action:()=>go("/creator")},
    {label:"HAY Voice Lab",hint:"VOICE",action:()=>go("/voice")},
    {label:"Armenian Quality",hint:"100/100",action:()=>go("/quality")},
    {label:"Account & Setup",hint:"ACCOUNT",action:()=>go("/login")},
  ],[]);

  const filtered=commands.filter(command=>`${command.label} ${command.hint}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setOpen(v=>!v);}
      if(event.key==="Escape")setOpen(false);
    };
    const onClick=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target?.closest(".commandButton")){event.preventDefault();setOpen(true);}
    };
    window.addEventListener("keydown",onKey);document.addEventListener("click",onClick);
    return()=>{window.removeEventListener("keydown",onKey);document.removeEventListener("click",onClick);};
  },[]);

  if(!open)return null;
  return <div className="studioCommandBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
    <section className="studioCommandPalette" role="dialog" aria-modal="true" aria-label="HAY command palette">
      <header><span><i/>HAY COMMAND</span><kbd>ESC</kbd></header>
      <div className="studioCommandSearch"><span>⌕</span><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search HAY Studio…"/></div>
      <div className="studioCommandList">{filtered.map((command,index)=><button key={command.label} onClick={command.action}><span>{String(index+1).padStart(2,"0")}</span><strong>{command.label}</strong><small>{command.hint}</small><b>↗</b></button>)}{filtered.length===0&&<p>No command found.</p>}</div>
      <footer><span>↑↓ NAVIGATE</span><span>ENTER OPEN</span><span>⌘K TOGGLE</span></footer>
    </section>
  </div>;
}
