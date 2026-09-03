"use client";

import { useEffect, useMemo, useState } from "react";
import HayLogo from "./HayLogo";

type ApiKeyRecord={id:string;name:string;key_prefix:string;scopes:string[];last_used_at?:string|null;expires_at?:string|null;revoked_at?:string|null;created_at:string};
type Usage={configured:boolean;periodStart?:string;requests?:number;inputChars?:number;audioBytes?:number;byEndpoint?:Record<string,number>};

export default function DeveloperConsole(){
  const [keys,setKeys]=useState<ApiKeyRecord[]>([]);
  const [scopes,setScopes]=useState<string[]>([]);
  const [name,setName]=useState("Production API");
  const [newKey,setNewKey]=useState("");
  const [usage,setUsage]=useState<Usage|null>(null);
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [enabled,setEnabled]=useState(false);
  const [hourlyLimit,setHourlyLimit]=useState(0);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{void refresh();},[]);
  async function refresh(){
    try{
      const [keyResponse,usageResponse]=await Promise.all([fetch("/api/developer/keys",{cache:"no-store"}),fetch("/api/developer/usage",{cache:"no-store"})]);
      if(keyResponse.status===401){setConfigured(true);setMessage("Sign in to manage developer API keys.");return;}
      const keyData=await keyResponse.json();const usageData=await usageResponse.json();
      setConfigured(keyData.configured!==false&&keyData.migrationReady!==false);setKeys(keyData.keys||[]);setScopes(keyData.scopes||[]);setEnabled(Boolean(keyData.developerApiEnabled));setHourlyLimit(Number(keyData.hourlyRequestLimit)||0);setUsage(usageData);
    }catch{setConfigured(false);setMessage("Developer API diagnostics are unavailable.");}
  }

  async function createKey(){
    setBusy(true);setMessage("");setNewKey("");
    try{
      const response=await fetch("/api/developer/keys",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,scopes:["language"]})});
      const data=await response.json();
      if(response.status===401){window.location.href="/login?next=%2Fdevelopers";return;}
      if(!response.ok)throw new Error(data.error||"key_creation_failed");
      setNewKey(String(data.key||""));setMessage(data.message||"Key created.");await refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Key creation failed");}
    finally{setBusy(false);}
  }

  async function revoke(id:string){
    if(!window.confirm("Revoke this HAY API key? Existing integrations using it will stop working."))return;
    const response=await fetch("/api/developer/keys",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    const data=await response.json();if(!response.ok){setMessage(data.error||"revoke_failed");return;}setMessage(data.revoked?"Key revoked.":"Key was already revoked.");await refresh();
  }

  async function copy(value:string){try{await navigator.clipboard.writeText(value);setMessage("Copied to clipboard.");}catch{setMessage("Copy failed. Select the key manually.");}}
  const activeCount=keys.filter(item=>!item.revoked_at).length;
  const apiReady=enabled&&hourlyLimit>0;
  const apiState=apiReady?"API READY":enabled?"RATE LIMIT REQUIRED":"API DISABLED";
  const curl=useMemo(()=>`curl -X POST https://YOUR_DOMAIN/api/v1/language/translate \\\n  -H "Authorization: Bearer ${newKey||"hay_live_YOUR_KEY"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"text":"Your business deserves natural Armenian.","target":"hy"}'`,[newKey]);

  return <main className="developerPage">
    <header className="developerNav"><a href="/"><HayLogo/></a><nav><a href="/studio">MARKETING OS</a><a href="/language">LANGUAGE LAB</a><a href="/benchmark">BENCHMARK</a><a className="active" href="/developers">DEVELOPERS</a></nav><span>HAY / API CONSOLE</span></header>
    <section className="developerHero"><div><span>ARMENIAN LANGUAGE INFRASTRUCTURE / DEVELOPERS</span><h1>Հայերենը՝<br/><em>API-ով։</em></h1></div><p>Create revocable server-side credentials for HAY Language API V1. Raw keys are shown once; HAY persists only their SHA-256 hashes.</p></section>

    {configured===false?<section className="developerBlocker"><span>DEVELOPER API NOT ACTIVATED</span><h2>Commercial schema 007 must be applied to the dedicated HAY Supabase project.</h2><p>Do not apply it to Meqena or the old shared Margaryan Labs database. After the dedicated HAY project exists, apply the canonical migrations and enable the developer API explicitly.</p></section>:
    <section className="developerGrid">
      <div className="developerKeys">
        <header><div><span>API KEYS</span><strong>{activeCount} ACTIVE</strong></div><b className={apiReady?"live":"off"}>{apiState}</b></header>
        <div className="developerCreate"><label><span>KEY NAME</span><input value={name} onChange={event=>setName(event.target.value)} maxLength={80}/></label><button disabled={busy||!name.trim()} onClick={createKey}>{busy?"CREATING ···":"CREATE SECRET KEY →"}</button></div>
        {newKey&&<div className="developerSecret"><span>COPY NOW — THIS VALUE WILL NOT BE SHOWN AGAIN</span><code>{newKey}</code><button onClick={()=>copy(newKey)}>COPY KEY</button><button className="dismiss" onClick={()=>setNewKey("")}>I SAVED IT</button></div>}
        <div className="developerKeyList">{keys.length?keys.map(item=><article key={item.id} className={item.revoked_at?"revoked":""}><div><span>{item.name}</span><code>{item.key_prefix}</code></div><div><small>{item.scopes?.join(" · ")||"language"}</small><small>{item.last_used_at?`last used ${new Date(item.last_used_at).toLocaleDateString()}`:"never used"}</small></div><div><b>{item.revoked_at?"REVOKED":"ACTIVE"}</b>{!item.revoked_at&&<button onClick={()=>revoke(item.id)}>REVOKE</button>}</div></article>):<p className="developerEmpty">No developer keys yet.</p>}</div>
      </div>

      <aside className="developerUsage"><header><span>API USAGE / CURRENT MONTH</span><b>{usage?.configured?"LIVE":"STANDBY"}</b></header><div className="developerMetric"><span>REQUESTS</span><strong>{usage?.requests||0}</strong></div><div className="developerMetric"><span>PER-KEY HOURLY LIMIT</span><strong>{hourlyLimit>0?hourlyLimit.toLocaleString():"—"}</strong></div><div className="developerMetric"><span>INPUT CHARACTERS</span><strong>{(usage?.inputChars||0).toLocaleString()}</strong></div><div className="developerMetric"><span>AUDIO BYTES</span><strong>{((usage?.audioBytes||0)/1024/1024).toFixed(2)} MB</strong></div><div className="developerEndpoints">{Object.entries(usage?.byEndpoint||{}).sort((a,b)=>b[1]-a[1]).map(([endpoint,count])=><div key={endpoint}><span>{endpoint.replace("/api/v1/language/","")}</span><b>{count}</b></div>)}</div></aside>
    </section>}

    <section className="developerDocs"><div><span>V1 / QUICK START</span><h2>One key. Armenian control layer.</h2><p>Use the key only from your backend. Do not embed `hay_live_…` credentials in browser JavaScript, mobile bundles or public repositories. Production API access also fails closed until a positive per-key hourly request limit is configured.</p></div><pre>{curl}</pre><div className="developerScopes"><span>AVAILABLE SCOPES</span>{scopes.map(scope=><code key={scope}>{scope}</code>)}</div></section>
    {message&&<div className="developerToast">{message}</div>}
    <footer className="developerFooter"><span>HAY LANGUAGE API / V1</span><span>RAW KEY ONCE · SHA-256 AT REST · RATE-LIMITED · REVOCABLE</span><a href="/api/v1/language">API MANIFEST ↗</a></footer>
  </main>;
}
