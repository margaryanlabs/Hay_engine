"use client";

import { useMemo, useState } from "react";
import HayLogo from "./HayLogo";
import type { BusinessProfile, CompetitorInput, MarketingPlan, SocialPlatform } from "@/lib/marketing/types";
import type { Locale } from "@/lib/hay/types";

const copy = {
  hy: {
    eyebrow: "AI MARKETING OPERATING SYSTEM / ARMENIA",
    titleA: "Քո բիզնեսը։",
    titleB: "Մի ամբողջ մարքեթինգային թիմ՝ մեկ համակարգում։",
    sub: "HAY-ը ուսումնասիրում է բրենդը, մրցակիցներին ու լսարանը, կառուցում է ռազմավարություն, ստեղծում է կոնտենտ և պատրաստում է հրապարակումը Instagram, TikTok, YouTube և այլ ալիքների համար։",
    analyze: "Վերլուծել բիզնեսը",
    plan: "Ստեղծել 7-օրյա պլան",
    autopilot: "Autopilot",
    connections: "Ալիքներ",
    intelligence: "Business Intelligence",
    calendar: "Content Pulse",
    competitors: "Competitor Radar",
  },
  en: {
    eyebrow: "AI MARKETING OPERATING SYSTEM / ARMENIA",
    titleA: "Your business.",
    titleB: "An entire marketing team in one system.",
    sub: "HAY studies the brand, competitors and audience, builds strategy, creates content and prepares publishing across Instagram, TikTok, YouTube and more.",
    analyze: "Analyze business",
    plan: "Build 7-day plan",
    autopilot: "Autopilot",
    connections: "Channels",
    intelligence: "Business Intelligence",
    calendar: "Content Pulse",
    competitors: "Competitor Radar",
  },
  ru: {
    eyebrow: "AI MARKETING OPERATING SYSTEM / ARMENIA",
    titleA: "Твой бизнес.",
    titleB: "Целая маркетинговая команда в одной системе.",
    sub: "HAY изучает бренд, конкурентов и аудиторию, строит стратегию, создаёт контент и готовит публикации для Instagram, TikTok, YouTube и других каналов.",
    analyze: "Проанализировать бизнес",
    plan: "Создать план на 7 дней",
    autopilot: "Автопилот",
    connections: "Каналы",
    intelligence: "Business Intelligence",
    calendar: "Content Pulse",
    competitors: "Competitor Radar",
  },
} as const;

const channelMeta: Array<{ platform: SocialPlatform; code: string; label: string }> = [
  { platform: "instagram", code: "IG", label: "Instagram" },
  { platform: "tiktok", code: "TT", label: "TikTok" },
  { platform: "youtube", code: "YT", label: "YouTube" },
  { platform: "facebook", code: "FB", label: "Facebook" },
];

export default function MarketingOS() {
  const [locale, setLocale] = useState<Locale>("hy");
  const [business, setBusiness] = useState<BusinessProfile>({
    name: "Ararat House",
    category: "Restaurant / Hospitality",
    description: "Modern Armenian restaurant with local ingredients, warm hospitality and contemporary presentation.",
    website: "",
    location: "Yerevan, Armenia",
    primaryLanguage: "hy",
    goals: ["reach", "reservations", "repeat customers"],
    audience: "Yerevan locals, tourists, diaspora visitors, 23–45",
    offer: "Modern Armenian dining with a strong sense of place",
    tone: "warm, cinematic, intelligent",
  });
  const [competitorText, setCompetitorText] = useState("Lavash Restaurant\nSherep Restaurant");
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [intelligence, setIntelligence] = useState<MarketingPlan["brand"] | null>(null);
  const [connectionState, setConnectionState] = useState<Record<string, string>>({});
  const [autopilot, setAutopilot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const t = copy[locale];

  const competitors = useMemo<CompetitorInput[]>(() => competitorText.split("\n").map((name) => name.trim()).filter(Boolean).map((name) => ({ name })), [competitorText]);
  const activeItems = plan?.items.slice(0, 10) ?? [];

  function patchBusiness<K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) {
    setBusiness((current) => ({ ...current, [key]: value }));
  }

  async function analyze() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/business/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business, competitors }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "analysis_failed");
      setIntelligence(data.intelligence.brand);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Analysis failed"); }
    finally { setBusy(false); }
  }

  async function generatePlan() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/marketing/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business, competitors, horizonDays: 7 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "plan_failed");
      setPlan(data); setIntelligence(data.brand);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Plan failed"); }
    finally { setBusy(false); }
  }

  async function connect(platform: SocialPlatform) {
    setConnectionState((state) => ({ ...state, [platform]: "checking" }));
    try {
      const response = await fetch(`/api/social/connect?platform=${platform}`);
      const data = await response.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      setConnectionState((state) => ({ ...state, [platform]: data.configured ? "ready" : "setup" }));
      setMessage(data.configured ? `${platform} connector ready` : `${platform}: configure ${data.missing?.join(", ") || "developer app"}`);
    } catch { setConnectionState((state) => ({ ...state, [platform]: "error" })); }
  }

  return (
    <main className="marketingPage">
      <header className="marketingNav">
        <a href="/" className="logoLink"><HayLogo /></a>
        <nav className="productNav">
          <a className="active" href="/">Marketing OS</a>
          <a href="/creator">Creator</a>
          <span>Voice</span><span>Language API</span>
        </nav>
        <div className="navTools">
          <div className="localePill">{(["hy", "en", "ru"] as Locale[]).map((item) => <button key={item} className={locale === item ? "active" : ""} onClick={() => { setLocale(item); patchBusiness("primaryLanguage", item); }}>{item === "hy" ? "ՀԱՅ" : item.toUpperCase()}</button>)}</div>
          <button className="commandButton">⌘ K</button>
        </div>
      </header>

      <section className="marketingHero">
        <div className="heroCopy">
          <div className="signalLabel"><i />{t.eyebrow}</div>
          <h1><span>{t.titleA}</span>{t.titleB}</h1>
          <p>{t.sub}</p>
          <div className="heroActions">
            <button className="hayPrimary" onClick={generatePlan} disabled={busy}>{busy ? "HAY ···" : t.plan}</button>
            <button className="haySecondary" onClick={analyze} disabled={busy}>{t.analyze}</button>
            <label className={`autopilot ${autopilot ? "on" : ""}`}><input type="checkbox" checked={autopilot} onChange={(event) => setAutopilot(event.target.checked)} /><span /><b>{t.autopilot}</b><small>{autopilot ? "ON" : "OFF"}</small></label>
          </div>
          {message && <p className="marketingMessage">{message}</p>}
        </div>
        <div className="orbitPanel" aria-hidden="true">
          <div className="orbitCore"><span>Հ</span><small>MARKETING<br/>INTELLIGENCE</small></div>
          <div className="orbit orbitOne"><i>01</i><span>BRAND</span></div>
          <div className="orbit orbitTwo"><i>02</i><span>CREATE</span></div>
          <div className="orbit orbitThree"><i>03</i><span>PUBLISH</span></div>
          <div className="orbit orbitFour"><i>04</i><span>LEARN</span></div>
        </div>
      </section>

      <section className="marketingGrid">
        <article className="intelCard businessCard">
          <div className="panelTop"><span>01 / BUSINESS DNA</span><em>INPUT</em></div>
          <div className="businessNameRow"><input value={business.name} onChange={(e) => patchBusiness("name", e.target.value)} /><span className="pulseDot" /></div>
          <div className="fieldPair"><label>Category<input value={business.category} onChange={(e) => patchBusiness("category", e.target.value)} /></label><label>Location<input value={business.location || ""} onChange={(e) => patchBusiness("location", e.target.value)} /></label></div>
          <label className="fullField">Website<input value={business.website || ""} onChange={(e) => patchBusiness("website", e.target.value)} placeholder="https://…" /></label>
          <label className="fullField">Business / offer<textarea value={business.description} onChange={(e) => patchBusiness("description", e.target.value)} /></label>
          <div className="dnaStrip"><span>LANGUAGE <b>{business.primaryLanguage.toUpperCase()}</b></span><span>MARKET <b>ARMENIA</b></span><span>MODE <b>{autopilot ? "AUTO" : "COPILOT"}</b></span></div>
        </article>

        <article className="intelCard channelsCard">
          <div className="panelTop"><span>02 / {t.connections.toUpperCase()}</span><em>OAUTH</em></div>
          <div className="channelList">{channelMeta.map(({ platform, code, label }) => {
            const state = connectionState[platform] || "disconnected";
            return <button key={platform} onClick={() => connect(platform)}><i>{code}</i><div><strong>{label}</strong><small>{state === "setup" ? "developer app required" : state}</small></div><span className={`connectionLed ${state}`} /></button>;
          })}</div>
          <p className="microcopy">Account owner authorizes every channel. HAY never asks for social passwords.</p>
        </article>

        <article className="intelCard intelligenceCard">
          <div className="panelTop"><span>03 / {t.intelligence.toUpperCase()}</span><em>{intelligence ? "LIVE" : "STANDBY"}</em></div>
          <div className="strategyQuote">{intelligence?.positioning || "HAY maps the business before it generates content — offer, audience, category language, proof and conversion path."}</div>
          <div className="pillarCloud">{(intelligence?.contentPillars || ["Proof", "Product", "Story", "Education", "Offer"]).map((pillar, index) => <span key={pillar}><i>{String(index + 1).padStart(2, "0")}</i>{pillar}</span>)}</div>
        </article>

        <article className="intelCard competitorsCard">
          <div className="panelTop"><span>04 / {t.competitors.toUpperCase()}</span><em>{competitors.length} TRACKED</em></div>
          <textarea value={competitorText} onChange={(event) => setCompetitorText(event.target.value)} />
          <div className="radarRows">{(plan?.competitors || competitors.map((c) => ({ name: c.name, strength: "awaiting analysis", gap: "—", opportunity: "—" }))).slice(0, 3).map((item, index) => <div key={item.name}><span>0{index + 1}</span><strong>{item.name}</strong><small>{item.gap}</small></div>)}</div>
        </article>
      </section>

      <section className="contentPulse">
        <div className="pulseHeader"><div><span>05 / AUTONOMOUS CONTENT DESK</span><h2>{t.calendar}</h2></div><div className="pulseStats"><span><b>{plan?.items.length || 0}</b> assets</span><span><b>{plan ? "7" : "—"}</b> days</span><span><b>{autopilot ? "AUTO" : "REVIEW"}</b> publish</span></div></div>
        {activeItems.length ? <div className="calendarRail">{activeItems.map((item) => <article key={item.id} className="contentTile"><div className="tileMeta"><span>D{item.day}</span><i>{item.platform}</i><em>{item.objective}</em></div><h3>{item.hook}</h3><p>{item.concept}</p><footer><span>{item.format}</span><button>Review →</button></footer></article>)}</div> : <div className="emptyPulse"><div className="emptyGlyph">Հ</div><h3>Strategy first. Content second.</h3><p>Fill the business DNA, add competitors and let HAY build the first executable week.</p><button className="hayPrimary" onClick={generatePlan}>{t.plan}</button></div>}
      </section>

      <section className="systemLine"><span>HAY ENGINE / ARMENIAN AI INFRASTRUCTURE</span><span>ANALYZE → STRATEGIZE → CREATE → APPROVE → PUBLISH → LEARN</span><span>YEREVAN / 2026</span></section>
    </main>
  );
}
