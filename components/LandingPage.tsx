"use client";

import { useState } from "react";
import HayLogo from "./HayLogo";
import { AGENCY_STARTING_AMD, HAY_PLANS } from "@/lib/pricing";
import type { Locale } from "@/lib/hay/types";

const copy = {
  hy: {
    navProduct:"Ապրանք", navVoice:"Հայերեն ձայն", navPricing:"Գներ", navStudio:"Բացել HAY-ը",
    eyebrow:"ARMENIAN-FIRST MARKETING INTELLIGENCE",
    heroA:"Քո ամբողջ մարքեթինգը։", heroB:"Մեկ AI համակարգում։",
    sub:"HAY-ը ուսումնասիրում է բիզնեսը և մրցակիցներին, մտածում է ռազմավարությունը, ստեղծում է կոնտենտ բնական հայերենով, ձայնավորում, հրապարակում և ամեն արդյունքից դառնում է ավելի ճշգրիտ։",
    primary:"Սկսել անվճար", secondary:"Տեսնել համակարգը",
    live:"HAY AUTOPILOT · LIVE", command:"AI MARKETING COMMAND CENTER",
    sectionKicker:"ONE OPERATING LOOP", sectionTitle:"Մարքեթոլոգի աշխատանքը՝ ավտոմատացված, բայց վերահսկելի։",
    voiceTitle:"Հայերենը պետք է հնչի հայերեն։", voiceText:"Գրական, բնական խոսակցական, Երևանյան casual և ապագայում արևմտահայերեն։ HAY-ը առանձին է մշակում բովանդակությունը, արտասանությունը, թվերը, բրենդները և code-switch-ը։", voiceCta:"Բացել Voice Lab-ը",
    pricingTitle:"Մեկ մարդուց մինչև ամբողջ բիզնես։", perMonth:"/ ամիս", choose:"Ընտրել", agency:"Agency / Enterprise", agencyText:"15+ բրենդ, white-label, թիմային approval, API և custom limits։", from:"սկսած",
    finalTitle:"Միացրու բիզնեսը։ HAY-ը կկառավարի կոնտենտային ցիկլը։", finalText:"Instagram, TikTok, YouTube, analytics, Armenian voice, AI video, competitor intelligence և performance memory՝ մեկ տեղում։", finalButton:"Բացել Marketing OS",
  },
  en: {
    navProduct:"Product", navVoice:"Armenian Voice", navPricing:"Pricing", navStudio:"Open HAY",
    eyebrow:"ARMENIAN-FIRST MARKETING INTELLIGENCE",
    heroA:"Your entire marketing operation.", heroB:"Inside one AI system.",
    sub:"HAY studies the business and competitors, builds strategy, creates content in natural Armenian, voices it, publishes it and gets more precise from every result.",
    primary:"Start free", secondary:"See the system",
    live:"HAY AUTOPILOT · LIVE", command:"AI MARKETING COMMAND CENTER",
    sectionKicker:"ONE OPERATING LOOP", sectionTitle:"The work of a marketing team, automated without losing control.",
    voiceTitle:"Armenian should sound Armenian.", voiceText:"Standard, natural spoken Armenian, Yerevan casual and future Western Armenian. HAY separately handles meaning, pronunciation, numbers, brands and code-switching.", voiceCta:"Open Voice Lab",
    pricingTitle:"From one creator to an entire business.", perMonth:"/ month", choose:"Choose", agency:"Agency / Enterprise", agencyText:"15+ brands, white-label, team approval, API and custom limits.", from:"from",
    finalTitle:"Connect the business. HAY runs the content loop.", finalText:"Instagram, TikTok, YouTube, analytics, Armenian voice, AI video, competitor intelligence and performance memory in one place.", finalButton:"Open Marketing OS",
  },
  ru: {
    navProduct:"Продукт", navVoice:"Армянский голос", navPricing:"Цены", navStudio:"Открыть HAY",
    eyebrow:"ARMENIAN-FIRST MARKETING INTELLIGENCE",
    heroA:"Весь маркетинг бизнеса.", heroB:"В одной AI-системе.",
    sub:"HAY изучает бизнес и конкурентов, строит стратегию, создаёт контент на естественном армянском, озвучивает, публикует и становится точнее после каждого результата.",
    primary:"Начать бесплатно", secondary:"Посмотреть систему",
    live:"HAY AUTOPILOT · LIVE", command:"AI MARKETING COMMAND CENTER",
    sectionKicker:"ONE OPERATING LOOP", sectionTitle:"Работа маркетинговой команды — автоматизирована, но остаётся под контролем.",
    voiceTitle:"Армянский должен звучать по-армянски.", voiceText:"Литературный, естественный разговорный, ереванский casual и в будущем западноармянский. HAY отдельно обрабатывает смысл, произношение, числа, бренды и code-switching.", voiceCta:"Открыть Voice Lab",
    pricingTitle:"От одного автора до целого бизнеса.", perMonth:"/ месяц", choose:"Выбрать", agency:"Agency / Enterprise", agencyText:"15+ брендов, white-label, team approval, API и custom limits.", from:"от",
    finalTitle:"Подключи бизнес. HAY ведёт контентный цикл.", finalText:"Instagram, TikTok, YouTube, analytics, Armenian voice, AI video, competitor intelligence и performance memory в одном месте.", finalButton:"Открыть Marketing OS",
  },
} as const;

const capabilities = [
  ["01","UNDERSTAND","Business + competitors","Website, positioning, audience, content gaps"],
  ["02","PLAN","Strategy engine","Goals, channels, hooks, weekly content plan"],
  ["03","CREATE","Creator engine","Reels, posts, carousels, AI visuals, captions"],
  ["04","SPEAK","HAY Voice","Natural Armenian, Yerevan mode, brand pronunciation"],
  ["05","PUBLISH","Social autopilot","Approval, schedule, Instagram, TikTok, YouTube"],
  ["06","LEARN","Performance memory","Views, saves, clicks, conversions → next strategy"],
] as const;

function amd(value:number){ return value === 0 ? "0 ֏" : `${value.toLocaleString("en-US")} ֏`; }

export default function LandingPage(){
  const [locale,setLocale]=useState<Locale>("hy");
  const t=copy[locale];

  return <main className="landingPage">
    <div className="landingAura landingAuraA"/><div className="landingAura landingAuraB"/><div className="landingNoise"/>

    <header className="landingNav">
      <a href="/" className="landingBrand"><HayLogo/></a>
      <nav><a href="#product">{t.navProduct}</a><a href="/voice">{t.navVoice}</a><a href="#pricing">{t.navPricing}</a></nav>
      <div className="landingNavRight">
        <div className="landingLocale">{(["hy","en","ru"] as Locale[]).map(item=><button key={item} className={locale===item?"active":""} onClick={()=>setLocale(item)}>{item.toUpperCase()}</button>)}</div>
        <a className="landingOpen" href="/studio">{t.navStudio}<span>↗</span></a>
      </div>
    </header>

    <section className="landingHero">
      <div className="heroContent">
        <div className="landingEyebrow"><i/>{t.eyebrow}<span>HY / EN / RU</span></div>
        <h1><span>{t.heroA}</span><strong>{t.heroB}</strong></h1>
        <p>{t.sub}</p>
        <div className="landingActions"><a className="landingPrimary" href="/studio?plan=free">{t.primary}<b>→</b></a><a className="landingSecondary" href="#product">{t.secondary}</a></div>
        <div className="heroProof"><span><i/>Natural Armenian</span><span><i/>AI Content Factory</span><span><i/>Social Autopilot</span></div>
      </div>

      <div className="commandVisual" aria-label="HAY command center preview">
        <div className="commandGlow"/><div className="commandGrid"/>
        <div className="commandTop"><span><i/>{t.live}</span><b>09:41:22</b></div>
        <div className="commandTitle"><small>{t.command}</small><strong>HAY<span>/</span>01</strong></div>
        <div className="commandPulse"><div className="pulseRing p1"/><div className="pulseRing p2"/><div className="pulseRing p3"/><div className="pulseCore">Հ</div><span className="pulseNode nodeA">STRATEGY <b>READY</b></span><span className="pulseNode nodeB">VOICE <b>HY-AM</b></span><span className="pulseNode nodeC">PUBLISH <b>QUEUED</b></span><span className="pulseNode nodeD">LEARN <b>+18.4%</b></span></div>
        <div className="commandFeed"><div><span>01</span><p>Competitor gap detected</p><b>+ 3 content angles</b></div><div><span>02</span><p>Armenian Reel generated</p><b>00:15 · 9:16</b></div><div><span>03</span><p>Instagram scheduled</p><b>19:30 · READY</b></div></div>
        <div className="commandFooter"><span>BUSINESS INTELLIGENCE</span><span>CREATOR</span><span>VOICE</span><span>PUBLISH</span><span>LEARN</span></div>
      </div>
    </section>

    <div className="landingTicker"><div>ANALYZE <i>●</i> STRATEGY <i>●</i> ARMENIAN COPY <i>●</i> AI VIDEO <i>●</i> VOICE <i>●</i> CAPTIONS <i>●</i> PUBLISH <i>●</i> MEASURE <i>●</i> LEARN <i>●</i> ANALYZE <i>●</i> STRATEGY <i>●</i> ARMENIAN COPY <i>●</i> AI VIDEO <i>●</i> VOICE <i>●</i> CAPTIONS <i>●</i> PUBLISH <i>●</i> MEASURE <i>●</i> LEARN</div></div>

    <section id="product" className="landingSection productSection">
      <div className="sectionHead"><span>{t.sectionKicker}</span><h2>{t.sectionTitle}</h2><p>HAY / MARKETING OPERATING LOOP</p></div>
      <div className="capabilityGrid">{capabilities.map(([num,kicker,title,text],index)=><article key={num} className={index===1||index===4?"featuredCap":""}><div className="capTop"><span>{num}</span><i>{kicker}</i></div><h3>{title}</h3><p>{text}</p><div className="capLine"><span/></div></article>)}</div>
    </section>

    <section className="voiceSection">
      <div className="voiceVisual">
        <div className="voiceStatus"><span><i/>HAY VOICE ENGINE</span><b>HY-AM</b></div>
        <div className="voiceGlyph">Հ</div>
        <div className="voiceWave">{Array.from({length:38}).map((_,i)=><i key={i} style={{height:`${18 + ((i*19)%76)}%`,animationDelay:`${i*35}ms`}}/>)}</div>
        <p>«HAY-ը բիզնեսիդ անունից խոսում է բնական հայերենով»</p>
        <div className="voiceModes"><span>STANDARD</span><span className="active">NATURAL</span><span>YEREVAN</span><span>WESTERN</span></div>
      </div>
      <div className="voiceCopy"><span>02 / ARMENIAN LANGUAGE LAYER</span><h2>{t.voiceTitle}</h2><p>{t.voiceText}</p><div className="voiceStats"><div><b>3</b><span>speech modes</span></div><div><b>50/50</b><span>quality cases</span></div><div><b>100</b><span>quality score</span></div></div><a href="/voice">{t.voiceCta}<b>↗</b></a></div>
    </section>

    <section id="pricing" className="landingSection pricingSection">
      <div className="sectionHead"><span>03 / PRICING</span><h2>{t.pricingTitle}</h2><p>AMD · MONTHLY</p></div>
      <div className="pricingGrid">{HAY_PLANS.map(plan=><article key={plan.id} className={plan.id==="growth"?"featured":""}>{plan.badge&&<em>{plan.badge}</em>}<div className="planTop"><span>{String(HAY_PLANS.indexOf(plan)+1).padStart(2,"0")} / PLAN</span><h3>{plan.name}</h3><p>{plan.description[locale]}</p></div><div className="planPrice"><b>{amd(plan.priceAmd)}</b><span>{t.perMonth}</span></div><ul>{plan.features[locale].map(item=><li key={item}><i>↳</i>{item}</li>)}</ul><a href={`/studio?plan=${plan.id}`}>{t.choose}<b>→</b></a></article>)}</div>
      <div className="agencyBand"><div><span>05 / CUSTOM</span><h3>{t.agency}</h3></div><p>{t.agencyText}</p><div className="agencyPrice"><small>{t.from}</small><b>{amd(AGENCY_STARTING_AMD)}</b></div><a href="/studio?plan=agency">TALK TO HAY ↗</a></div>
    </section>

    <section className="landingFinal">
      <div className="finalGrid"/><div className="finalGlow"/>
      <span>HAY ENGINE / ARMENIA / 2026</span><h2>{t.finalTitle}</h2><p>{t.finalText}</p><a href="/studio">{t.finalButton}<b>→</b></a>
    </section>

    <footer className="landingFooter"><HayLogo compact/><span>ARMENIAN AI MARKETING INFRASTRUCTURE</span><div><a href="/voice">VOICE</a><a href="/quality">QUALITY</a><a href="/creator">CREATOR</a><a href="/studio">OS</a></div></footer>
  </main>;
}
