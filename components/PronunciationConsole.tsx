"use client";

import { useEffect, useMemo, useState } from "react";
import HayLogo from "./HayLogo";

type Business={id:string;name:string};
type Entry={id:string;scope:"account"|"business";business_id:string|null;written:string;spoken_hy_eastern:string;spoken_hy_western:string;category:string;source_type:string;source_reference:string|null;consent_reference:string|null;status:string;version:number;notes:string|null;updated_at:string};
type CoreEntry={written:string;spokenHyEastern:string;spokenHyWestern:string;category:string;source:string;status:string};

const categories=["brand","acronym","finance","technology","social","place","person","product","general"];

export default function PronunciationConsole(){
  const [businesses,setBusinesses]=useState<Business[]>([]);
  const [businessId,setBusinessId]=useState("");
  const [scope,setScope]=useState<"account"|"business">("account");
  const [entries,setEntries]=useState<Entry[]>([]);
  const [reviewedCount,setReviewedCount]=useState(0);
  const [core,setCore]=useState<CoreEntry[]>([]);
  const [coreVersion,setCoreVersion]=useState("");
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [written,setWritten]=useState("");
  const [eastern,setEastern]=useState("");
  const [western,setWestern]=useState("");
  const [category,setCategory]=useState("brand");
  const [notes,setNotes]=useState("");
  const [sourceReference,setSourceReference]=useState("");
  const [consentReference,setConsentReference]=useState("");
  const [testText,setTestText]=useState("Instagram-ում HAY-ը ներկայացնում է նոր ապրանք՝ Acme Pro։");
  const [testResult,setTestResult]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{void loadBusinesses();},[]);
  useEffect(()=>{void refresh();},[businessId]);

  async function loadBusinesses(){
    try{const response=await fetch("/api/businesses",{cache:"no-store"});if(response.status===401)return;const data=await response.json();setBusinesses((data.businesses||[]).map((item:Business)=>({id:String(item.id),name:String(item.name)})));}catch{/* registry can still work account-wide */}
  }

  async function refresh(){
    try{
      const query=businessId?`?businessId=${encodeURIComponent(businessId)}`:"";
      const response=await fetch(`/api/pronunciations${query}`,{cache:"no-store"});
      if(response.status===401){setConfigured(true);setMessage("Sign in to manage your pronunciation registry.");return;}
      const data=await response.json();
      setConfigured(data.configured!==false&&data.migrationReady!==false);setEntries(data.entries||[]);setReviewedCount(Number(data.reviewedCount)||0);setCore(data.core||[]);setCoreVersion(data.coreVersion||"");
    }catch{setConfigured(false);setMessage("Pronunciation registry diagnostics are unavailable.");}
  }

  async function save(){
    if(scope==="business"&&!businessId){setMessage("Choose a business for a business-specific pronunciation.");return;}
    if(!written.trim()||!eastern.trim()){setMessage("Written form and Eastern Armenian pronunciation are required.");return;}
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/pronunciations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scope,businessId:scope==="business"?businessId:null,written,spokenEastern:eastern,spokenWestern:western||eastern,category,notes,sourceReference,consentReference})});
      const data=await response.json();
      if(response.status===401){window.location.href="/login?next=%2Fpronunciations";return;}
      if(!response.ok)throw new Error(data.error||"pronunciation_save_failed");
      setMessage(data.updated?"Pronunciation updated — a new audited version was created.":"Pronunciation added to the persistent registry.");
      setWritten("");setEastern("");setWestern("");setNotes("");setSourceReference("");setConsentReference("");await refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Pronunciation save failed");}
    finally{setBusy(false);}
  }

  async function archive(id:string){
    if(!window.confirm("Archive this pronunciation override? HAY will immediately fall back to the next registry layer."))return;
    const response=await fetch("/api/pronunciations",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    const data=await response.json();if(!response.ok){setMessage(data.error||"archive_failed");return;}setMessage(data.archived?"Pronunciation archived.":"Entry was already unavailable.");await refresh();
  }

  async function test(){
    setBusy(true);setMessage("");
    try{const response=await fetch("/api/pronounce",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:testText,dialect:"eastern",businessId:businessId||null})});const data=await response.json();if(!response.ok)throw new Error(data.error||"pronunciation_test_failed");setTestResult(String(data.spokenText||""));setMessage(`Registry ${data.version||"core"} · ${data.registry?.appliedEntries||0} persistent entries applied.`);}catch(error){setMessage(error instanceof Error?error.message:"Pronunciation test failed");}finally{setBusy(false);}
  }

  const customEntries=useMemo(()=>entries.filter(item=>item.status!=="archived"),[entries]);
  const selectedBusiness=businesses.find(item=>item.id===businessId)?.name||"No business selected";

  return <main className="pronunciationPage">
    <header className="pronunciationNav"><a href="/"><HayLogo/></a><nav><a href="/language">LANGUAGE LAB</a><a href="/voice">VOICE</a><a href="/quality">QUALITY</a><a href="/benchmark">BENCHMARK</a><a href="/developers">DEVELOPERS</a><a className="active" href="/pronunciations">DICTIONARY</a></nav><span>HAY / PRONUNCIATION DATA</span></header>

    <section className="pronunciationHero"><div><span>PROPRIETARY ARMENIAN LANGUAGE MEMORY / 01</span><h1>Սովորեցնել HAY-ին<br/><em>ինչպես է խոսում քո բրենդը։</em></h1></div><p>Core dictionary stays deterministic. Reviewed system entries and your account/business overrides sit above it, with versioning and provenance preserved automatically.</p></section>

    {configured===false?<section className="pronunciationBlocker"><span>REGISTRY MIGRATION REQUIRED</span><h2>Apply `008_language_registry.sql` only to the dedicated HAY Supabase project.</h2><p>The current in-code Armenian dictionary remains active until that migration exists; no existing pronunciation behavior is lost.</p></section>:
    <>
      <section className="pronunciationStats"><article><span>CORE</span><b>{core.length}</b><small>{coreVersion||"curated fallback"}</small></article><article><span>HAY REVIEWED</span><b>{reviewedCount}</b><small>server-side persistent layer</small></article><article><span>CUSTOM</span><b>{customEntries.length}</b><small>account + selected business</small></article><article><span>BUSINESS</span><b>{businessId?selectedBusiness:"—"}</b><small>{businessId?"override layer active":"account layer only"}</small></article></section>

      <section className="pronunciationGrid">
        <div className="pronunciationComposer"><header><span>ADD / UPDATE ENTRY</span><b>VERSIONED</b></header><div className="pronunciationScope"><button className={scope==="account"?"active":""} onClick={()=>setScope("account")}>ACCOUNT</button><button className={scope==="business"?"active":""} onClick={()=>setScope("business")}>BUSINESS</button></div>{scope==="business"&&<label><span>BUSINESS</span><select value={businessId} onChange={event=>setBusinessId(event.target.value)}><option value="">Choose business</option>{businesses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<div className="pronunciationPair"><label><span>WRITTEN FORM</span><input value={written} onChange={event=>setWritten(event.target.value)} placeholder="Acme Pro" maxLength={160}/></label><label><span>CATEGORY</span><select value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(item=><option key={item} value={item}>{item}</option>)}</select></label></div><label><span>EASTERN ARMENIAN / HY-AM</span><input value={eastern} onChange={event=>setEastern(event.target.value)} placeholder="Աքմե Փրո" maxLength={240}/></label><label><span>WESTERN ARMENIAN</span><input value={western} onChange={event=>setWestern(event.target.value)} placeholder="Optional — defaults to Eastern" maxLength={240}/></label><label><span>NOTES</span><textarea value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Pronunciation context, suffix behavior, exceptions…" maxLength={1000}/></label><div className="pronunciationPair"><label><span>SOURCE REFERENCE</span><input value={sourceReference} onChange={event=>setSourceReference(event.target.value)} placeholder="Brand guide / URL / internal source" maxLength={500}/></label><label><span>CONSENT REFERENCE</span><input value={consentReference} onChange={event=>setConsentReference(event.target.value)} placeholder="Optional consent record" maxLength={500}/></label></div><button className="pronunciationSave" disabled={busy} onClick={save}>{busy?"SAVING ···":"SAVE PRONUNCIATION →"}</button></div>

        <aside className="pronunciationTest"><header><span>LIVE TEST</span><b>{businessId?"BUSINESS LAYER":"ACCOUNT LAYER"}</b></header><textarea value={testText} onChange={event=>setTestText(event.target.value)}/><button onClick={test} disabled={busy||!testText.trim()}>RUN THROUGH REGISTRY →</button><div><span>SPOKEN OUTPUT</span><p>{testResult||"Save an override, then test the exact text HAY would send toward Armenian TTS."}</p></div></aside>
      </section>

      <section className="pronunciationEntries"><header><div><span>02 / YOUR ACTIVE OVERRIDES</span><h2>Business beats account. Account beats reviewed system. System beats core.</h2></div><select value={businessId} onChange={event=>setBusinessId(event.target.value)}><option value="">Account only</option>{businesses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></header><div className="pronunciationTable"><div className="pronunciationRow head"><span>WRITTEN</span><span>SPOKEN / EASTERN</span><span>SCOPE</span><span>PROVENANCE</span><span>VERSION</span><span/></div>{customEntries.length?customEntries.map(item=><div className="pronunciationRow" key={item.id}><span><b>{item.written}</b><small>{item.category}</small></span><span>{item.spoken_hy_eastern}</span><span>{item.scope}{item.scope==="business"?" · selected brand":""}</span><span><small>{item.source_type}</small>{item.source_reference&&<small>{item.source_reference}</small>}</span><span>v{item.version}</span><span><button onClick={()=>archive(item.id)}>ARCHIVE</button></span></div>):<p className="pronunciationEmpty">No custom pronunciation overrides yet.</p>}</div></section>

      <section className="pronunciationCore"><div><span>03 / CURATED CORE</span><h2>Fallback that never depends on the database.</h2></div><div>{core.slice(0,48).map(item=><article key={item.written}><b>{item.written}</b><span>{item.spokenHyEastern}</span><small>{item.category}</small></article>)}</div></section>
    </>}

    {message&&<div className="pronunciationToast">{message}</div>}
    <footer className="pronunciationFooter"><span>CORE → HAY REVIEWED → ACCOUNT → BUSINESS</span><span>VERSIONED · AUDITED · PROVENANCE-AWARE</span><a href="/language">OPEN LANGUAGE LAB ↗</a></footer>
  </main>;
}
