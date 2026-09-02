"use client";

import { useEffect, useMemo, useState } from "react";
import { selectBusinessInUrl, selectedBusinessId } from "@/lib/studio/business-selection";

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
      const response=await fetch("/api/businesses",{cache:"no-store"});
      if(response.status===401){setConfigured(true);setBusinesses([]);return;}
      const data=await response.json();
      setConfigured(data.configured!==false);setBusinesses(data.businesses||[]);
    }catch{setConfigured(false);setBusinesses([]);}
  }
  useEffect(()=>{void load();},[]);

  const requested=selectedBusinessId();
  const selected=useMemo(()=>businesses.find(item=>item.id===requested)||businesses[0]||null,[businesses,requested]);

  async function createBusiness(){
    if(!name.trim()||!category.trim()||busy)return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/businesses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({business:{name:name.trim(),category:category.trim(),description:"",location:location.trim(),primaryLanguage:language,goals:[],audience:"",offer:"",tone:""}})});
      if(response.status===401){window.location.href="/login";return;}
      const data=await response.json();
      if(!response.ok)throw new Error(data.detail||data.error||"business_create_failed");
      if(data.configured===false){setMessage("Activate the dedicated HAY database to create workspaces.");return;}
      selectBusinessInUrl(String(data.business.id));
    }catch(error){setMessage(error instanceof Error?error.message:"Workspace creation failed");}
    finally{setBusy(false);}
  }

  return <section className="studioWorkspaceBar" aria-label="Business workspace selector">
    <div className="workspaceIdentity"><span><i/>WORKSPACE</span><strong>{configured===false?"DEMO":selected?.name||"NO BUSINESS"}</strong><small>{selected?`${selected.category}${selected.location?` · ${selected.location}`:""}`:"Create or select a business workspace"}</small></div>
    <div className="workspaceSelect">
      <span>ACTIVE BRAND</span>
      <select value={selected?.id||""} disabled={!businesses.length} onChange={event=>selectBusinessInUrl(event.target.value)}>
        {!businesses.length&&<option value="">No business</option>}
        {businesses.map(item=><option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
      </select>
    </div>
    <div className="workspaceMeta"><span>WORKSPACES</span><strong>{businesses.length}</strong><small>owner-scoped</small></div>
    <button className="workspaceAdd" onClick={()=>setCreating(value=>!value)}>＋ NEW BRAND</button>
    {creating&&<div className="workspaceCreate">
      <header><span>CREATE BUSINESS WORKSPACE</span><button onClick={()=>setCreating(false)}>×</button></header>
      <label>Brand name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ararat House"/></label>
      <label>Category<input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Restaurant / Hospitality"/></label>
      <label>Location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Yerevan, Armenia"/></label>
      <label>Primary language<select value={language} onChange={e=>setLanguage(e.target.value as "hy"|"en"|"ru")}><option value="hy">Հայերեն</option><option value="en">English</option><option value="ru">Русский</option></select></label>
      <button className="workspaceCreateAction" onClick={()=>void createBusiness()} disabled={busy||!name.trim()||!category.trim()}>{busy?"CREATING…":"CREATE WORKSPACE →"}</button>
      {message&&<p>{message}</p>}
    </div>}
  </section>;
}
