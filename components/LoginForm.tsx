"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import HayLogo from "./HayLogo";

type SetupStatus = { mode?: "demo" | "persistent"; persistence?: { supabase?: boolean } };

const allowedPlans=new Set(["free","creator","growth","business","agency"]);

function safeNextPath(){
  if(typeof window==="undefined")return "/studio";
  const params=new URLSearchParams(window.location.search);
  const value=params.get("next")||"/studio";
  const safe=value.startsWith("/")&&!value.startsWith("//")?value:"/studio";
  const plan=params.get("plan");
  if(plan&&plan!=="free"&&allowedPlans.has(plan)&&safe.startsWith("/studio")){
    const target=new URL(safe,window.location.origin);
    if(!target.searchParams.has("plan"))target.searchParams.set("plan",plan);
    return `${target.pathname}${target.search}${target.hash}`;
  }
  return safe;
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [setup, setSetup] = useState<SetupStatus | null>(null);

  useEffect(() => {
    fetch("/api/setup/status").then(response => response.json()).then(setSetup).catch(() => setSetup({ mode: "demo" }));
  }, []);

  const persistenceReady = setup?.persistence?.supabase === true;

  useEffect(()=>{
    if(!persistenceReady)return;
    const supabase=createClient();
    let active=true;
    void supabase.auth.getSession().then(({data})=>{
      if(active&&data.session)window.location.replace(safeNextPath());
    });
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(active&&session)window.location.replace(safeNextPath());
    });
    return()=>{active=false;listener.subscription.unsubscribe();};
  },[persistenceReady]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!persistenceReady) {
      setMessage("Accounts are not active in this environment yet.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const next=safeNextPath();
      const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      setMessage("Check your email — HAY sent a secure sign-in link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed");
    } finally { setBusy(false); }
  }

  const accountState=!setup?"CHECKING":persistenceReady?"SECURE SIGN-IN":"PREVIEW";

  return <main className="loginPage"><section className="loginPanel"><a href="/"><HayLogo /></a><div className="loginIndex">ACCOUNT / {accountState}</div><h1>Մեկ բիզնես։<br/><span>Մեկ աշխատանքային կոնտեքստ։</span></h1><p>{persistenceReady ? "Sign in to save the business, connect channels, keep Creator projects and continue from the same context every time." : "You can explore the product now. Saved businesses, account history and social authorization become available when accounts are active."}</p><form onSubmit={signIn}><label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.am" disabled={!persistenceReady} /></label><button className="hayPrimary" disabled={busy || !persistenceReady}>{busy ? "···" : persistenceReady ? "Continue with secure link" : "Accounts not active yet"}</button></form>{!persistenceReady && <a href="/" className="haySecondary" style={{display:"inline-flex",marginTop:12,textDecoration:"none"}}>Explore HAY →</a>}{message && <div className="loginMessage">{message}</div>}<small>HAY never asks for your Instagram, TikTok or YouTube password. Social accounts connect through provider authorization.</small></section><aside className="loginAside"><div className="loginGlyph">Հ</div><div><span>CONTEXT</span><span>PLAN</span><span>CREATE</span><span>APPROVE</span><span>PUBLISH</span></div></aside></main>;
}
