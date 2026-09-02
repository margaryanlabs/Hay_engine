"use client";

import { useEffect, useMemo, useState } from "react";

type Counts={clicks:number;conversions:number;leads:number;bookings:number;orders:number;signups:number;purchases:number};
type Content={id:string;platform:string;format:string;hook:string;status:string;published_at?:string|null;scheduled_for?:string|null};
type Link={id:string;content_item_id:string;slug:string;destination_url:string;trackingUrl:string;is_active:boolean;counts?:Counts|null};
type Response={configured:boolean;error?:string;business?:{id:string;name:string;website?:string|null}|null;content?:Content[];links?:Link[];attribution?:{totals:Counts;top:Array<{contentItemId:string}&Counts>}|null;eventEndpoint?:string;migrationRequired?:string};

const fmt=(value:number)=>new Intl.NumberFormat("en-US",{notation:value>=10000?"compact":"standard",maximumFractionDigits:1}).format(value||0);
const platformCode=(value:string)=>({instagram:"IG",tiktok:"TT",youtube:"YT",facebook:"FB",linkedin:"LI"}[value]||value.slice(0,2).toUpperCase());

export default function StudioConversionBridge(){
  const [data,setData]=useState<Response|null>(null);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState("");
  const [destination,setDestination]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [createdUrl,setCreatedUrl]=useState("");

  async function load(){
    setLoading(true);
    try{
      const response=await fetch("/api/studio/attribution",{cache:"no-store"});
      if(response.status===401){setData({configured:true,error:"unauthorized",content:[],links:[]});return;}
      const next=await response.json() as Response;setData(next);
      const first=next.content?.[0]?.id||"";if(!selected&&first)setSelected(first);
      if(!destination&&next.business?.website)setDestination(next.business.website);
    }catch{setData({configured:false,error:"unavailable",content:[],links:[]});}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    void load();
    const refresh=()=>{void load();};window.addEventListener("hay:studio-refresh",refresh);
    return()=>window.removeEventListener("hay:studio-refresh",refresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const contentById=useMemo(()=>new Map((data?.content||[]).map(item=>[item.id,item])),[data]);
  const totals=data?.attribution?.totals;
  const selectedContent=contentById.get(selected)||null;
  const existing=(data?.links||[]).find(link=>link.content_item_id===selected)||null;
  const endpoint=data?.eventEndpoint||"https://YOUR-HAY-DOMAIN/api/attribution/event";
  const snippet=`<script>\nconst p=new URLSearchParams(location.search);\nif(p.get("hay_click")) localStorage.setItem("hay_click",p.get("hay_click"));\nwindow.hayConvert=(eventType,opts={})=>{\n  const clickId=localStorage.getItem("hay_click");\n  if(!clickId)return Promise.resolve({skipped:true});\n  return fetch("${endpoint}",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clickId,eventType,...opts})});\n};\n</script>`;

  async function createLink(){
    if(!selected||!destination.trim()||busy)return;setBusy(true);setMessage("");setCreatedUrl("");
    try{
      const response=await fetch("/api/attribution/links",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contentItemId:selected,destinationUrl:destination.trim()})});
      if(response.status===401){window.location.href="/login";return;}
      const result=await response.json();if(!response.ok)throw new Error(result.detail||result.error||"tracking_link_failed");
      setCreatedUrl(result.trackingUrl||"");setMessage(result.reused?"Existing active tracking link reused.":"Tracking link created. Use this URL in the social CTA/bio/campaign asset.");await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Tracking link failed");}
    finally{setBusy(false);}
  }
  async function copy(value:string){try{await navigator.clipboard.writeText(value);setMessage("Copied to clipboard.");}catch{setMessage("Copy failed — select the text manually.");}}

  return <section className="studioConversionBridge" aria-label="HAY first-party Conversion Bridge">
    <header className="conversionHead"><div><span><i/>CONVERSION BRIDGE / FIRST-PARTY OUTCOMES</span><h2>Know which post created the click, lead, booking or order.</h2><p>HAY keeps social reach/engagement from the platforms, then adds privacy-first first-party outcome events from the business website.</p></div><div><span>ACTIVE WORKSPACE</span><strong>{data?.business?.name||"—"}</strong><small>{data?.business?.website||"Business website required"}</small></div></header>

    {loading?<div className="conversionEmpty"><strong>Reading first-party attribution…</strong></div>:
      data?.configured===false?<div className="conversionEmpty"><strong>Conversion Bridge activates with HAY persistence.</strong><span>No synthetic leads or orders are shown in demo mode.</span></div>:
      data?.error==="unauthorized"?<div className="conversionEmpty"><strong>Sign in to use first-party attribution.</strong><a href="/login">SIGN IN →</a></div>:
      data?.migrationRequired?<div className="conversionEmpty"><strong>Apply the first-party attribution migration.</strong><span>{data.migrationRequired}</span><p>This is intentionally a separate migration because public click/conversion routes use server-side service-role access while owner dashboards stay RLS-protected.</p></div>:
      !data?.business?.website?<div className="conversionEmpty"><strong>Add the business HTTPS website first.</strong><span>Tracking redirects are restricted to the business domain so HAY cannot become an open redirect.</span></div>:
      <>
        <div className="conversionMetrics">
          <article><span>TRACKED CLICKS</span><strong>{fmt(totals?.clicks||0)}</strong><small>HAY redirect events</small></article>
          <article><span>CONVERSIONS</span><strong>{fmt(totals?.conversions||0)}</strong><small>First-party outcome events</small></article>
          <article><span>LEADS / BOOKINGS</span><strong>{fmt((totals?.leads||0)+(totals?.bookings||0))}</strong><small>{totals?.leads||0} leads · {totals?.bookings||0} bookings</small></article>
          <article><span>ORDERS / PURCHASES</span><strong>{fmt((totals?.orders||0)+(totals?.purchases||0))}</strong><small>{totals?.orders||0} orders · {totals?.purchases||0} purchases</small></article>
        </div>

        <div className="conversionGrid">
          <article className="conversionLinkBuilder">
            <div className="conversionPanelTitle"><span>01 / CREATE TRACKING LINK</span><b>CONTENT → WEBSITE</b></div>
            <label><span>CONTENT ASSET</span><select value={selected} onChange={e=>{setSelected(e.target.value);setCreatedUrl("");}}><option value="">Select content</option>{(data?.content||[]).map(item=><option key={item.id} value={item.id}>{platformCode(item.platform)} · {item.format} · {item.hook||item.id}</option>)}</select></label>
            <label><span>DESTINATION ON BUSINESS DOMAIN</span><input value={destination} onChange={e=>setDestination(e.target.value)} placeholder={data?.business?.website||"https://business.am/offer"}/></label>
            <button onClick={()=>void createLink()} disabled={busy||!selected||!destination.trim()}>{busy?"CREATING…":existing?"REUSE / VERIFY TRACKING URL →":"CREATE TRACKING URL →"}</button>
            {(createdUrl||existing?.trackingUrl)&&<div className="conversionUrl"><span>TRACKING URL</span><div><input readOnly value={createdUrl||existing?.trackingUrl||""}/><button onClick={()=>void copy(createdUrl||existing?.trackingUrl||"")}>COPY</button></div><small>{selectedContent?`${platformCode(selectedContent.platform)} · ${selectedContent.hook}`:""}</small></div>}
            {message&&<p className="conversionMessage">{message}</p>}
          </article>

          <article className="conversionInstall">
            <div className="conversionPanelTitle"><span>02 / WEBSITE BRIDGE</span><b>NO PII</b></div>
            <p>Add this once to the business website. It stores only the random <code>hay_click</code> identifier and exposes <code>hayConvert()</code>.</p>
            <pre>{snippet}</pre>
            <div className="conversionExamples"><span>EXAMPLES</span><code>hayConvert("lead")</code><code>hayConvert("booking")</code><code>hayConvert("purchase", &#123;value:49000,currency:"AMD",eventId:"order-123"&#125;)</code></div>
            <button onClick={()=>void copy(snippet)}>COPY INSTALL SNIPPET</button>
            <small>Do not send email, phone, name, message text or other personal data. HAY needs the outcome type, optional value/currency and an optional deduplication event ID.</small>
          </article>
        </div>

        <div className="conversionTop"><div className="conversionPanelTitle"><span>03 / ATTRIBUTED CONTENT</span><b>REAL OUTCOMES</b></div>{(data?.attribution?.top||[]).length?<div>{(data?.attribution?.top||[]).slice(0,8).map((row,index)=>{const item=contentById.get(row.contentItemId);return <article key={row.contentItemId}><b>{String(index+1).padStart(2,"0")}</b><span>{item?platformCode(item.platform):"—"}</span><div><strong>{item?.hook||row.contentItemId}</strong><small>{row.clicks} clicks · {row.leads} leads · {row.bookings} bookings · {row.orders+row.purchases} orders/purchases</small></div><em>{row.conversions} CONV.</em></article>})}</div>:<p>No first-party outcomes yet. Create a link, drive real traffic, then fire a conversion event on the business website.</p>}</div>
      </>}

    <footer className="conversionPrivacy"><span>PRIVACY RULE</span><strong>Random click IDs, not people profiles.</strong><p>HAY does not store raw IP addresses, emails, phone numbers or user-agent strings in this attribution layer.</p></footer>
  </section>;
}
