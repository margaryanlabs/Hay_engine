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

  useEffect(()=>{setSelected(0);},[query]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setOpen(v=>!v);}
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
      <header><span><i/>HAY COMMAND</span><kbd>ESC</kbd></header>
      <div className="studioCommandSearch"><span>⌕</span><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onInputKeyDown} placeholder="Search HAY Studio…"/></div>
      <div className="studioCommandList">{filtered.map((command,index)=><button key={command.label} className={selected===index?"active":""} onMouseEnter={()=>setSelected(index)} onClick={command.action}><span>{String(index+1).padStart(2,"0")}</span><strong>{command.label}</strong><small>{command.hint}</small><b>↗</b></button>)}{filtered.length===0&&<p>No command found.</p>}</div>
      <footer><span>↑↓ NAVIGATE</span><span>ENTER OPEN</span><span>⌘K TOGGLE</span></footer>
    </section>
  </div>;
}
