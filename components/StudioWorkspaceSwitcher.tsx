"use client";

import { useEffect, useMemo, useState } from "react";
import { selectBusinessWorkspace, selectedBusinessId } from "@/lib/studio/business-selection";

type Business={id:string;name:string;category:string;location?:string|null;primary_language?:"hy"|"en"|"ru"};

export default function StudioWorkspaceSwitcher(){
  const [businesses,setBusinesses]=useState<Business[]>([]);
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [creating,setCreating]=useState(false);
  const [busy,setBusy]=useState(false);
  const [name,setName]=useState("");
  const [category,setCategory]=useState("");
  const [location,setLocation]=useState("Yerevan, Armenia");
  const [language,setLanguage]=useState<"hy"|"en"|"ru">("hy");
  const [message,setMessage]=useState("");

  async function load(){
    try{
      const requested=selectedBusinessId();
      if(requested){
        const selected=await selectBusinessWorkspace(requested,false);
        if(selected.changed){window.location.reload();return;}
      }
      const response=await fetch("/api/businesses",{cache:"no-store"});
      if(response.status===401){setConfigured(true);setBusinesses([]);setMessage("Sign in to manage saved businesses.");return;}
      const data=await response.json();
      setConfigured(data.configured!==false);setBusinesses(data.businesses||[]);
    }catch(error){setConfigured(false);setBusinesses([]);setMessage(error instanceof Error?error.message:"Workspace unavailable");}
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    const refresh=()=>{void load();};
    window.addEventListener("hay:studio-refresh",refresh);
    return()=>window.removeEventListener("hay:studio-refresh",refresh);
  },[]);

  const requested=selectedBusinessId();
  const selected=useMemo(()=>businesses.find(item=>item.id===requested)||businesses[0]||null,[businesses,requested]);

  async function createBusiness(){
    if(!name.trim()||!category.trim()||busy)return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/businesses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({business:{name:name.trim(),category:category.trim(),description:"",location:location.trim(),primaryLanguage:language,goals:[],audience:"",offer:"",tone:""}})});
      if(response.status===401){window.location.href="/login?next=%2Fstudio";return;}
      const data=await response.json();
      if(!response.ok)throw new Error(data.detail||data.error||"business_create_failed");
      if(data.configured===false){setMessage("Saving businesses is not available in preview mode.");return;}
      setCreating(false);setName("");setCategory("");
      await selectBusinessWorkspace(String(data.business.id));
    }catch(error){setMessage(error instanceof Error?error.message:"Business creation failed");}
    finally{setBusy(false);}
  }

  async function changeWorkspace(id:string){
    if(!id||busy)return;
    setBusy(true);setMessage("");
    try{await selectBusinessWorkspace(id);}catch(error){setBusy(false);setMessage(error instanceof Error?error.message:"Workspace selection failed");}
  }

  return <section className="studioWorkspaceBar" aria-label="Business workspace selector">
    <div className="workspaceIdentity"><span><i/>WORKSPACE</span><strong>{configured===false?"PREVIEW":selected?.name||"NO BUSINESS YET"}</strong><small>{selected?`${selected.category}${selected.location?` · ${selected.location}`:""}`:configured===false?"Explore the product without saving changes":"Add the business context below or create a business here"}</small></div>
    <div className="workspaceSelect">
      <span>ACTIVE BUSINESS</span>
      <select value={selected?.id||""} disabled={!businesses.length||busy} onChange={event=>void changeWorkspace(event.target.value)}>
        {!businesses.length&&<option value="">No saved business</option>}
        {businesses.map(item=><option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
      </select>
    </div>
    <div className="workspaceMeta"><span>BUSINESSES</span><strong>{businesses.length}</strong><small>{businesses.length===1?"saved workspace":"saved workspaces"}</small></div>
    <button className="workspaceAdd" onClick={()=>setCreating(value=>!value)}>＋ NEW BUSINESS</button>
    {creating&&<div className="workspaceCreate">
      <header><span>CREATE BUSINESS</span><button onClick={()=>setCreating(false)}>×</button></header>
      <label>Business name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ararat House"/></label>
      <label>Category<input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Restaurant / Hospitality"/></label>
      <label>Location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Yerevan, Armenia"/></label>
      <label>Primary language<select value={language} onChange={e=>setLanguage(e.target.value as "hy"|"en"|"ru")}><option value="hy">Հայերեն</option><option value="en">English</option><option value="ru">Русский</option></select></label>
      <button className="workspaceCreateAction" onClick={()=>void createBusiness()} disabled={busy||!name.trim()||!category.trim()}>{busy?"CREATING…":"CREATE BUSINESS →"}</button>
      {message&&<p>{message}</p>}
    </div>}
  </section>;
}
