"use client";

import { useEffect, useState } from "react";
import HayLogo from "./HayLogo";
import { createClient } from "@/lib/supabase/client";

type Entitlement={
  configured:boolean;
  planId?:string;
  status?:string;
  limits?:{brands:number;channels:number;contentAssets:number;aiVideoCredits:number;voiceMinutes:number};
  usage?:{content_assets:number;ai_video_credits:number;voice_minutes:number};
};
type Business={id:string;name:string;category:string;location?:string|null;primary_language?:string|null};

function number(value:number|undefined){return new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(value||0);}

export default function AccountPage({configured,email}:{configured:boolean;email?:string}){
  const [entitlement,setEntitlement]=useState<Entitlement|null>(null);
  const [businesses,setBusinesses]=useState<Business[]>([]);
  const [loading,setLoading]=useState(configured);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(!configured)return;
    let active=true;
    async function load(){
      try{
        const [planResponse,businessResponse]=await Promise.all([
          fetch("/api/account/entitlement",{cache:"no-store"}),
          fetch("/api/businesses",{cache:"no-store"}),
        ]);
        const [planData,businessData]=await Promise.all([planResponse.json(),businessResponse.json()]);
        if(!active)return;
        if(planResponse.ok||planData.configured===false)setEntitlement(planData);
        if(businessResponse.ok)setBusinesses(businessData.businesses||[]);
      }catch{if(active)setMessage("Account data is temporarily unavailable.");}
      finally{if(active)setLoading(false);}
    }
    void load();
    return()=>{active=false;};
  },[configured]);

  async function signOut(){
    if(!configured||busy)return;
    setBusy(true);setMessage("");
    try{
      const supabase=createClient();
      const {error}=await supabase.auth.signOut();
      if(error)throw error;
      window.location.replace("/");
    }catch(error){setMessage(error instanceof Error?error.message:"Sign out failed");setBusy(false);}
  }

  const usage=entitlement?.usage;
  const limits=entitlement?.limits;
  const meters=[
    {label:"Content",used:usage?.content_assets,limit:limits?.contentAssets,unit:"assets"},
    {label:"Video",used:usage?.ai_video_credits,limit:limits?.aiVideoCredits,unit:"credits"},
    {label:"Voice",used:usage?.voice_minutes,limit:limits?.voiceMinutes,unit:"min"},
  ];

  return <main className="accountPage">
    <header className="accountNav"><a href="/" className="accountBrand"><HayLogo compact/></a><nav><a href="/studio">Studio</a><a href="/creator">Creator</a><a href="/voice">Voice</a><a href="/language">Language</a></nav><a className="accountBack" href="/studio">Back to Studio →</a></header>

    <section className="accountHero"><div><span>ACCOUNT & PLAN</span><h1>Your HAY workspace,<br/><em>without the admin clutter.</em></h1><p>See the active plan, usage and saved businesses. Authentication and connected social channels stay separate from your social passwords.</p></div><aside><span>SIGNED IN AS</span><strong>{configured?(email||"HAY account"):"Preview mode"}</strong><small>{configured?"Secure magic-link account":"Accounts are not active in this environment"}</small></aside></section>

    {!configured&&<section className="accountNotice"><span>PREVIEW MODE</span><div><h2>There is no persistent account in preview mode.</h2><p>You can explore HAY, but saved businesses, billing state and sign-out controls appear only when account persistence is active.</p></div><a href="/studio">Open Studio →</a></section>}

    {configured&&<>
      <section className="accountGrid">
        <article className="accountPlanCard"><header><span>PLAN</span><b>{loading?"LOADING":(entitlement?.status||"unknown").toUpperCase()}</b></header><strong>{loading?"—":(entitlement?.planId||"free").toUpperCase()}</strong><p>{limits?`${limits.brands} business${limits.brands===1?"":"es"} · ${limits.channels} channels`:"Plan limits are being loaded."}</p><a href="/#pricing">View plans →</a></article>
        <article className="accountIdentityCard"><header><span>ACCOUNT</span><b>SECURE LINK</b></header><strong>{email||"HAY account"}</strong><p>Sign-in uses a secure email link. HAY never asks for your social account passwords.</p><button onClick={signOut} disabled={busy}>{busy?"SIGNING OUT…":"SIGN OUT →"}</button></article>
      </section>

      <section className="accountUsage"><header><div><span>USAGE</span><h2>This billing cycle</h2></div><small>{entitlement?.planId?`${entitlement.planId.toUpperCase()} plan`:"Current plan"}</small></header><div>{meters.map(item=>{const ratio=item.limit?Math.min(100,((item.used||0)/item.limit)*100):0;return <article key={item.label}><div><span>{item.label}</span><b>{number(item.used)} / {number(item.limit)} {item.unit}</b></div><i><b style={{width:`${ratio}%`}}/></i></article>;})}</div></section>

      <section className="accountBusinesses"><header><div><span>BUSINESSES</span><h2>Saved workspaces</h2></div><strong>{businesses.length}</strong></header>{businesses.length?<div>{businesses.map(item=><a href={`/studio?businessId=${encodeURIComponent(item.id)}`} key={item.id}><div><strong>{item.name}</strong><small>{item.category}{item.location?` · ${item.location}`:""}</small></div><span>{(item.primary_language||"hy").toUpperCase()} ↗</span></a>)}</div>:<div className="accountEmpty"><p>No saved business yet. Add the business context in Studio and build the first 7-day cycle.</p><a href="/studio">Create first business →</a></div>}</section>

      <section className="accountSecurity"><div><span>ACCOUNT MODEL</span><h2>Business access stays with you.</h2></div><p>HAY uses account authentication for your workspace. Social channels are authorized separately through their providers, so social passwords are never collected by HAY.</p></section>
    </>}

    {message&&<p className="accountMessage">{message}</p>}
    <footer className="accountFooter"><span>HAY ENGINE · BUILT IN ARMENIA</span><a href="/quality">Armenian quality ↗</a></footer>
  </main>;
}
