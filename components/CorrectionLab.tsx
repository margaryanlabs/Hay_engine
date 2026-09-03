"use client";

import { useEffect, useMemo, useState } from "react";
import HayLogo from "./HayLogo";

type Business={id:string;name:string};
type Correction={
  id:string;business_id:string|null;correction_type:string;locale:string;source_text:string;system_text:string|null;corrected_text:string;context?:Record<string,unknown>;
  consent_product_improvement:boolean;consent_benchmark:boolean;consent_model_training:boolean;consent_withdrawn_at:string|null;status:string;review_notes:string|null;promoted_pronunciation_id:string|null;created_at:string;
};

const correctionTypes=[
  ["pronunciation","Pronunciation"],["transcript","Transcript"],["translation","Translation"],["copy","Natural copy"],["code-switch","Code-switch"],["name-brand-place","Name / brand / place"],["other","Other"],
] as const;
const pronunciationCategories=["brand","acronym","finance","technology","social","place","person","product","general"];

export default function CorrectionLab(){
  const [businesses,setBusinesses]=useState<Business[]>([]);
  const [businessId,setBusinessId]=useState("");
  const [type,setType]=useState("copy");
  const [locale,setLocale]=useState("hy-AM");
  const [sourceText,setSourceText]=useState("");
  const [systemText,setSystemText]=useState("");
  const [correctedText,setCorrectedText]=useState("");
  const [category,setCategory]=useState("brand");
  const [western,setWestern]=useState("");
  const [productConsent,setProductConsent]=useState(false);
  const [benchmarkConsent,setBenchmarkConsent]=useState(false);
  const [trainingConsent,setTrainingConsent]=useState(false);
  const [corrections,setCorrections]=useState<Correction[]>([]);
  const [reviewQueue,setReviewQueue]=useState<Correction[]>([]);
  const [reviewer,setReviewer]=useState(false);
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{void load();void loadBusinesses();},[]);

  async function loadBusinesses(){
    try{const response=await fetch("/api/businesses",{cache:"no-store"});if(!response.ok)return;const data=await response.json();setBusinesses((data.businesses||[]).map((item:Business)=>({id:String(item.id),name:String(item.name)})));}catch{/* optional business scope */}
  }

  async function load(){
    try{
      const response=await fetch("/api/language/corrections",{cache:"no-store"});
      if(response.status===401){setConfigured(true);setMessage("Sign in to submit and manage Armenian corrections.");return;}
      const data=await response.json();
      setConfigured(data.configured!==false&&data.migrationReady!==false);setCorrections(data.corrections||[]);setReviewer(Boolean(data.reviewer));
      if(data.reviewer)await loadReviewQueue();
    }catch{setConfigured(false);setMessage("Correction diagnostics are unavailable.");}
  }

  async function loadReviewQueue(){
    try{const response=await fetch("/api/language/corrections/review",{cache:"no-store"});if(!response.ok)return;const data=await response.json();setReviewQueue(data.corrections||[]);}catch{/* reviewer queue is optional */}
  }

  async function submit(){
    if(!sourceText.trim()||!correctedText.trim()){setMessage("Source and corrected text are required.");return;}
    setBusy(true);setMessage("");
    try{
      const context=type==="pronunciation"?{category,spokenWestern:western||correctedText}:{};
      const response=await fetch("/api/language/corrections",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        businessId:businessId||null,correctionType:type,locale,sourceText,systemText:systemText||null,correctedText,context,
        sourceEndpoint:"/corrections",consentProductImprovement:productConsent,consentBenchmark:benchmarkConsent,consentModelTraining:trainingConsent,
      })});
      const data=await response.json();
      if(response.status===401){window.location.href="/login?next=%2Fcorrections";return;}
      if(!response.ok)throw new Error(data.error||"correction_submit_failed");
      setSourceText("");setSystemText("");setCorrectedText("");setWestern("");
      setProductConsent(false);setBenchmarkConsent(false);setTrainingConsent(false);
      setMessage(productConsent?"Correction saved and eligible for human review under your selected consent.":"Correction saved privately. HAY cannot reuse it without product-improvement consent.");
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Correction submit failed");}
    finally{setBusy(false);}
  }

  async function withdraw(id:string){
    if(!window.confirm("Withdraw this correction and all reuse consent? Any dataset record sourced from it will be withdrawn too."))return;
    const response=await fetch("/api/language/corrections",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    const data=await response.json();if(!response.ok){setMessage(data.error||"withdraw_failed");return;}setMessage("Correction withdrawn. Reuse consent is no longer active.");await load();
  }

  async function review(id:string,decision:"accept"|"reject",promotePronunciation=false){
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/language/corrections/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,decision,promotePronunciation})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"review_failed");
      setMessage(decision==="accept"?(promotePronunciation?"Correction accepted and promoted into the reviewed pronunciation layer.":"Correction accepted into the provenance registry."):"Correction rejected from the review queue.");
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Review failed");}
    finally{setBusy(false);}
  }

  const active=useMemo(()=>corrections.filter(item=>item.status!=="withdrawn"),[corrections]);
  const reusable=useMemo(()=>active.filter(item=>item.consent_product_improvement),[active]);
  const accepted=useMemo(()=>active.filter(item=>item.status==="accepted"),[active]);

  return <main className="correctionPage">
    <header className="correctionNav"><a href="/"><HayLogo/></a><nav><a href="/language">LANGUAGE LAB</a><a href="/pronunciations">DICTIONARY</a><a href="/quality">QUALITY</a><a href="/benchmark">BENCHMARK</a><a className="active" href="/corrections">TEACH HAY</a><a href="/developers">DEVELOPERS</a></nav><span>HAY / CONSENTED DATA</span></header>

    <section className="correctionHero"><div><span>HUMAN CORRECTION FLYWHEEL / 01</span><h1>Ուղղիր HAY-ին։<br/><em>Դու ես որոշում՝ ինչ ենք հիշում։</em></h1></div><p>Corrections can stay private. Product improvement, blind benchmark use and model-training permission are separate choices. Nothing enters HAY reviewed data without explicit product-improvement consent and human review.</p></section>

    {configured===false?<section className="correctionBlocker"><span>MIGRATION 009 REQUIRED</span><h2>Apply `009_language_corrections_and_dataset_registry.sql` only to the dedicated HAY Supabase project.</h2><p>Until then, the language engine keeps working normally; correction capture and dataset promotion remain disabled.</p></section>:
    <>
      <section className="correctionStats"><article><span>YOUR ACTIVE</span><b>{active.length}</b><small>private + consented corrections</small></article><article><span>REUSE ALLOWED</span><b>{reusable.length}</b><small>eligible for reviewer queue</small></article><article><span>ACCEPTED</span><b>{accepted.length}</b><small>reviewed provenance records</small></article><article><span>REVIEW QUEUE</span><b>{reviewer?reviewQueue.length:"—"}</b><small>{reviewer?"operator view":"reviewer-only"}</small></article></section>

      <section className="correctionGrid">
        <div className="correctionComposer"><header><span>SUBMIT A CORRECTION</span><b>PRIVATE BY DEFAULT</b></header>
          <div className="correctionPair"><label><span>TYPE</span><select value={type} onChange={event=>setType(event.target.value)}>{correctionTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>LOCALE</span><select value={locale} onChange={event=>setLocale(event.target.value)}><option value="hy-AM">Eastern Armenian / hy-AM</option><option value="hy-Western">Western Armenian</option><option value="hy-mixed">Armenian mixed / code-switch</option></select></label></div>
          <label><span>BUSINESS / OPTIONAL</span><select value={businessId} onChange={event=>setBusinessId(event.target.value)}><option value="">Account-wide / no business</option>{businesses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>{type==="pronunciation"?"WRITTEN FORM":"SOURCE TEXT"}</span><textarea value={sourceText} onChange={event=>setSourceText(event.target.value)} placeholder={type==="pronunciation"?"Acme Pro":"What you originally entered or said"}/></label>
          {type!=="pronunciation"&&<label><span>HAY OUTPUT / OPTIONAL</span><textarea value={systemText} onChange={event=>setSystemText(event.target.value)} placeholder="What HAY produced before your correction"/></label>}
          <label><span>{type==="pronunciation"?"CORRECT EASTERN PRONUNCIATION":"YOUR CORRECTION"}</span><textarea value={correctedText} onChange={event=>setCorrectedText(event.target.value)} placeholder={type==="pronunciation"?"Աքմե Փրո":"The wording you consider correct and natural"}/></label>
          {type==="pronunciation"&&<div className="correctionPair"><label><span>CATEGORY</span><select value={category} onChange={event=>setCategory(event.target.value)}>{pronunciationCategories.map(item=><option key={item}>{item}</option>)}</select></label><label><span>WESTERN / OPTIONAL</span><input value={western} onChange={event=>setWestern(event.target.value)} placeholder="Defaults to Eastern"/></label></div>}

          <div className="correctionConsent"><span>CONSENT — ALL OFF BY DEFAULT</span>
            <label><input type="checkbox" checked={productConsent} onChange={event=>setProductConsent(event.target.checked)}/><b>Product improvement</b><small>Allow HAY reviewers to consider this correction for reviewed product data. Required for any reuse.</small></label>
            <label><input type="checkbox" checked={benchmarkConsent} onChange={event=>setBenchmarkConsent(event.target.checked)}/><b>Blind benchmarks</b><small>Allow benchmark use only when product-improvement consent is also active.</small></label>
            <label><input type="checkbox" checked={trainingConsent} onChange={event=>setTrainingConsent(event.target.checked)}/><b>Model training</b><small>Allow future targeted training only when product-improvement consent is also active. Not required to use HAY.</small></label>
          </div>
          <button className="correctionSubmit" disabled={busy||!sourceText.trim()||!correctedText.trim()} onClick={submit}>{busy?"SAVING ···":"SAVE CORRECTION →"}</button>
        </div>

        <aside className="correctionPolicy"><header><span>CONSENT POLICY / 02</span><b>EXPLICIT</b></header><h2>Private first.<br/>Reviewed only by permission.</h2><ol><li><b>01</b><p>Save a correction. It belongs to your account.</p></li><li><b>02</b><p>Without product-improvement consent, it never enters the reviewer queue.</p></li><li><b>03</b><p>A human reviewer may accept a consented correction into provenance-tracked HAY data.</p></li><li><b>04</b><p>You can withdraw later; linked dataset eligibility is withdrawn too.</p></li></ol></aside>
      </section>

      <section className="correctionHistory"><header><span>03 / YOUR CORRECTIONS</span><h2>Every submission keeps its consent state.</h2></header><div>{corrections.length?corrections.map(item=><article key={item.id} className={item.status==="withdrawn"?"withdrawn":""}><div><span>{item.correction_type}</span><b>{item.status.toUpperCase()}</b></div><blockquote>{item.corrected_text}</blockquote><p>{item.source_text}</p><footer><small>PRODUCT {item.consent_product_improvement?"YES":"NO"}</small><small>BENCHMARK {item.consent_benchmark?"YES":"NO"}</small><small>TRAINING {item.consent_model_training?"YES":"NO"}</small><small>{new Date(item.created_at).toLocaleDateString()}</small>{item.status!=="withdrawn"&&<button onClick={()=>withdraw(item.id)}>WITHDRAW</button>}</footer></article>):<p className="correctionEmpty">No corrections submitted yet.</p>}</div></section>

      {reviewer&&<section className="correctionReview"><header><div><span>04 / REVIEWER QUEUE</span><h2>Only explicitly consented corrections appear here.</h2></div><b>{reviewQueue.length} PENDING</b></header><div>{reviewQueue.length?reviewQueue.map(item=><article key={item.id}><div><span>{item.correction_type} · {item.locale}</span><b>{item.status}</b></div><small>SOURCE</small><p>{item.source_text}</p>{item.system_text&&<><small>HAY OUTPUT</small><p>{item.system_text}</p></>}<small>CORRECTION</small><blockquote>{item.corrected_text}</blockquote><footer><button disabled={busy} onClick={()=>review(item.id,"reject")}>REJECT</button><button disabled={busy} onClick={()=>review(item.id,"accept",false)}>ACCEPT DATA</button>{item.correction_type==="pronunciation"&&<button className="promote" disabled={busy} onClick={()=>review(item.id,"accept",true)}>ACCEPT + PROMOTE</button>}</footer></article>):<p className="correctionEmpty">No consented corrections are waiting for review.</p>}</div></section>}
    </>}

    {message&&<div className="correctionToast">{message}</div>}
    <footer className="correctionFooter"><span>HAY CONSENTED LANGUAGE DATA</span><span>PRIVATE → CONSENT → REVIEW → PROVENANCE</span><a href="/pronunciations">OPEN DICTIONARY ↗</a></footer>
  </main>;
}
