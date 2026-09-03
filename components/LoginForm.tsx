"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import HayLogo from "./HayLogo";

type SetupStatus = { mode?: "demo" | "persistent"; persistence?: { supabase?: boolean } };

function safeNextPath(){
  if(typeof window==="undefined")return "/studio";
  const value=new URLSearchParams(window.location.search).get("next")||"/studio";
  return value.startsWith("/")&&!value.startsWith("//")?value:"/studio";
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
      setMessage("HAY is running in demo mode. A dedicated HAY Supabase project must be activated before accounts and social connections can be saved.");
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

  return <main className="loginPage"><section className="loginPanel"><a href="/"><HayLogo /></a><div className="loginIndex">ACCOUNT / 01 · {setup?.mode?.toUpperCase() || "CHECKING"}</div><h1>Մեկ բիզնես։<br/><span>Մեկ մարքեթինգային ուղեղ։</span></h1><p>{persistenceReady ? "Sign in to save businesses, connect social channels, keep Creator projects and run HAY Marketing OS continuously." : "Demo mode is active: strategy and Creator can be explored while persistent accounts and social authorization wait for the dedicated HAY database."}</p><form onSubmit={signIn}><label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.am" disabled={!persistenceReady} /></label><button className="hayPrimary" disabled={busy || !persistenceReady}>{busy ? "···" : persistenceReady ? "Continue with secure link" : "Persistence not activated"}</button></form>{!persistenceReady && <a href="/" className="haySecondary" style={{display:"inline-flex",marginTop:12,textDecoration:"none"}}>Continue in demo mode →</a>}{message && <div className="loginMessage">{message}</div>}<small>HAY never asks for your Instagram, TikTok or YouTube password. Social accounts connect through provider authorization.</small></section><aside className="loginAside"><div className="loginGlyph">Հ</div><div><span>ANALYZE</span><span>STRATEGIZE</span><span>CREATE</span><span>PUBLISH</span><span>LEARN</span></div></aside></main>;
}
