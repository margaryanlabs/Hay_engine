"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import HayLogo from "./HayLogo";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      setMessage("Check your email — HAY sent a secure sign-in link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed");
    } finally { setBusy(false); }
  }

  return <main className="loginPage"><section className="loginPanel"><a href="/"><HayLogo /></a><div className="loginIndex">ACCOUNT / 01</div><h1>Մեկ բիզնես։<br/><span>Մեկ մարքեթինգային ուղեղ։</span></h1><p>Sign in to save businesses, connect social channels, keep Creator projects and run HAY Marketing OS continuously.</p><form onSubmit={signIn}><label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.am" /></label><button className="hayPrimary" disabled={busy}>{busy ? "···" : "Continue with secure link"}</button></form>{message && <div className="loginMessage">{message}</div>}<small>HAY never asks for your Instagram, TikTok or YouTube password. Social accounts connect through provider authorization.</small></section><aside className="loginAside"><div className="loginGlyph">Հ</div><div><span>ANALYZE</span><span>STRATEGIZE</span><span>CREATE</span><span>PUBLISH</span><span>LEARN</span></div></aside></main>;
}
