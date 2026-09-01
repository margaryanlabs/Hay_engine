"use client";

import { useState } from "react";
import HayLogo from "./HayLogo";
import { AGENCY_STARTING_AMD, HAY_PLANS } from "@/lib/pricing";
import type { Locale } from "@/lib/hay/types";

const copy = {
  hy: {
    navProduct:"Ապրանք", navVoice:"Հայերեն ձայն", navPricing:"Գներ", navStudio:"Բացել HAY-ը",
    eyebrow:"ARMENIAN-FIRST AI MARKETING OPERATING SYSTEM",
    heroA:"Քո բիզնեսը։", heroB:"Քո AI մարքեթինգային թիմը։",
    sub:"HAY-ը հասկանում է բիզնեսը, մրցակիցներին և հայկական կոնտեքստը, ստեղծում է կոնտենտ, խոսում բնական հայերենով, հրապարակում և սովորում արդյունքներից։",
    primary:"Սկսել անվճար", secondary:"Տեսնել համակարգը",
    proof1:"Բնական հայերեն", proof2:"AI video + voice", proof3:"Instagram · TikTok · YouTube", proof4:"Strategy → Publish → Learn",
    sectionKicker:"ONE SYSTEM / FULL LOOP", sectionTitle:"Մարքեթինգի ամբողջ ցիկլը՝ մեկ ուղեղում։",
    voiceKicker:"HAY VOICE / HY-AM", voiceTitle:"Հայերենը պետք է հնչի հայերեն։", voiceText:"Գրական, բնական խոսակցական, Yerevan casual և արևմտահայերեն ուղղություններով՝ pronunciation, numbers և code-switch control-ով։", voiceCta:"Բացել Voice Lab-ը",
    pricingKicker:"PRICING / ARMENIA", pricingTitle:"Սկսիր անվճար։ Աճիր, երբ HAY-ը սկսի աշխատել քեզ համար։", perMonth:"/ ամիս", choose:"Ընտրել", agency:"Agency / Enterprise", agencyText:"15+ բրենդ, white-label, custom limits, onboarding և API։", from:"սկսած",
    finalTitle:"Մարքեթինգը չպետք է լինի 7 գործիք և 5 տարբեր մարդ։", finalText:"Միացրու բիզնեսդ։ HAY-ը կվերլուծի, կպլանավորի, կստեղծի, կհրապարակի և ամեն ցիկլից հետո ավելի լավ կաշխատի։", finalButton:"Բացել Marketing OS",
  },
  en: {
    navProduct:"Product", navVoice:"Armenian Voice", navPricing:"Pricing", navStudio:"Open HAY",
    eyebrow:"ARMENIAN-FIRST AI MARKETING OPERATING SYSTEM",
    heroA:"Your business.", heroB:"Your AI marketing team.",
    sub:"HAY understands the business, competitors and Armenian context, creates content, speaks natural Armenian, publishes and learns from performance.",
    primary:"Start free", secondary:"Explore the system",
    proof1:"Natural Armenian", proof2:"AI video + voice", proof3:"Instagram · TikTok · YouTube", proof4:"Strategy → Publish → Learn",
    sectionKicker:"ONE SYSTEM / FULL LOOP", sectionTitle:"The entire marketing cycle inside one intelligence layer.",
    voiceKicker:"HAY VOICE / HY-AM", voiceTitle:"Armenian should sound Armenian.", voiceText:"Standard, natural conversational, Yerevan casual and Western Armenian modes with pronunciation, numbers and code-switch control.", voiceCta:"Open Voice Lab",
    pricingKicker:"PRICING / ARMENIA", pricingTitle:"Start free. Scale when HAY starts working for you.", perMonth:"/ month", choose:"Choose", agency:"Agency / Enterprise", agencyText:"15+ brands, white-label, custom limits, onboarding and API.", from:"from",
    finalTitle:"Marketing should not require seven tools and five different people.", finalText:"Connect your business. HAY analyzes, plans, creates, publishes and learns from every cycle.", finalButton:"Open Marketing OS",
  },
  ru: {
    navProduct:"Продукт", navVoice:"Армянский голос", navPricing:"Цены", navStudio:"Открыть HAY",
    eyebrow:"ARMENIAN-FIRST AI MARKETING OPERATING SYSTEM",
    heroA:"Твой бизнес.", heroB:"Твоя AI-маркетинговая команда.",
    sub:"HAY понимает бизнес, конкурентов и армянский контекст, создаёт контент, говорит естественно на армянском, публикует и учится на результатах.",
    primary:"Начать бесплатно", secondary:"Посмотреть систему",
    proof1:"Живой армянский", proof2:"AI video + voice", proof3:"Instagram · TikTok · YouTube", proof4:"Strategy → Publish → Learn",
    sectionKicker:"ONE SYSTEM / FULL LOOP", sectionTitle:"Весь маркетинговый цикл внутри одного интеллекта.",
    voiceKicker:"HAY VOICE / HY-AM", voiceTitle:"Армянский должен звучать по-армянски.", voiceText:"Литературный, естественный разговорный, Yerevan casual и западноармянский режимы с контролем произношения, чисел и code-switch.", voiceCta:"Открыть Voice Lab",
    pricingKicker:"PRICING / ARMENIA", pricingTitle:"Начни бесплатно. Масштабируйся, когда HAY начнёт работать на тебя.", perMonth:"/ месяц", choose:"Выбрать", agency:"Agency / Enterprise", agencyText:"15+ брендов, white-label, custom limits, onboarding и API.", from:"от",
    finalTitle:"Маркетинг не должен состоять из семи сервисов и пяти разных людей.", finalText:"Подключи бизнес. HAY анализирует, планирует, создаёт, публикует и становится лучше после каждого цикла.", finalButton:"Открыть Marketing OS",
  },
} as const;

const systemCards = [
  ["01","UNDERSTAND","Business Intelligence","Brand · audience · competitors · market"],
  ["02","STRATEGIZE","AI Marketing Brain","Positioning · content plan · hooks · offers"],
  ["03","CREATE","Creator Engine","Reels · posts · carousels · visuals · captions"],
  ["04","SPEAK","HAY Voice","Standard · Natural · Yerevan · Western"],
  ["05","PUBLISH","Autopilot","Approval · schedule · social publishing"],
  ["06","LEARN","Performance Memory","Reach · saves · clicks · conversions"],
] as const;

const loop = ["ANALYZE","STRATEGY","CREATE","APPROVE","PUBLISH","LEARN"];

function amd(value:number){ return value === 0 ? "0 ֏" : `${value.toLocaleString("en-US")} ֏`; }

export default function LandingPageV2(){
  const [locale,setLocale]=useState<Locale>("hy");
  const t=copy[locale];

  return <main className="hayLandingV2">
    <div className="v2Noise" aria-hidden="true"/>
    <div className="v2Glow glowA" aria-hidden="true"/>
    <div className="v2Glow glowB" aria-hidden="true"/>

    <header className="v2Nav">
      <a className="v2Brand" href="/"><HayLogo/></a>
      <nav><a href="#product">{t.navProduct}</a><a href="/voice">{t.navVoice}</a><a href="#pricing">{t.navPricing}</a></nav>
      <div className="v2NavRight">
        <div className="v2Locale">{(["hy","en","ru"] as Locale[]).map(item=><button key={item} className={locale===item?"active":""} onClick={()=>setLocale(item)}>{item.toUpperCase()}</button>)}</div>
        <a className="v2Open" href="/studio"><span className="v2LiveDot"/>{t.navStudio}</a>
      </div>
    </header>

    <section className="v2Hero">
      <div className="v2Ambient" aria-hidden="true"><i/><i/><i/></div>
      <div className="v2HeroCopy">
        <div className="v2Eyebrow"><i/>{t.eyebrow}<span>LIVE / 2026</span></div>
        <h1><span>{t.heroA}</span>{t.heroB}</h1>
        <p>{t.sub}</p>
        <div className="v2Actions"><a className="v2Primary" href="/studio?plan=free"><span>{t.primary}</span><b>↗</b></a><a className="v2Secondary" href="#product"><span>{t.secondary}</span><b>↓</b></a></div>
        <div className="v2Micro"><span><i/>ARMENIAN QUALITY 100/100</span><span>50 REGRESSION CASES</span><span>HY · EN · RU</span></div>
      </div>

      <div className="v2Command">
        <div className="v2CommandTop"><span>HAY / AUTOPILOT</span><b><i/>RUNNING</b></div>
        <div className="v2Orb">
          <div className="v2Ring ringOne"/><div className="v2Ring ringTwo"/><div className="v2Ring ringThree"/>
          <div className="v2OrbCore"><strong>Հ</strong><span>MARKETING<br/>INTELLIGENCE</span></div>
          <span className="v2OrbLabel l1">BUSINESS</span><span className="v2OrbLabel l2">CONTENT</span><span className="v2OrbLabel l3">VOICE</span><span className="v2OrbLabel l4">SOCIAL</span>
        </div>
        <div className="v2Feed"><div><span>01</span><p>Competitor signal detected</p><b>+18%</b></div><div><span>02</span><p>Armenian Reel ready</p><b>READY</b></div><div><span>03</span><p>Best publish window</p><b>19:40</b></div></div>
      </div>
    </section>

    <div className="v2Ticker" aria-hidden="true"><div>{[...loop,...loop,...loop].map((item,index)=><span key={`${item}-${index}`}><i/> {item}</span>)}</div></div>
    <section className="v2Proof">{[t.proof1,t.proof2,t.proof3,t.proof4].map((item,index)=><span key={item}><b>0{index+1}</b>{item}</span>)}</section>

    <section id="product" className="v2Section v2Product">
      <div className="v2SectionIntro"><span>{t.sectionKicker}</span><h2>{t.sectionTitle}</h2><p>One connected operating loop instead of disconnected AI tools.</p></div>
      <div className="v2SystemMatrix">{systemCards.map((card,index)=><article key={card[1]} className={index===2?"featured":""}><div className="v2SystemIndex"><span>{card[0]}</span><i/></div><small>{card[1]}</small><h3>{card[2]}</h3><p>{card[3]}</p><div className="v2SystemPulse" aria-hidden="true"><i/><i/><i/></div></article>)}</div>
    </section>

    <section className="v2Autopilot">
      <div className="v2AutopilotHead"><span>HAY AUTOPILOT / CONTINUOUS LOOP</span><b>NOT A CHATBOT</b></div>
      <div className="v2AutopilotRail">{loop.map((item,index)=><div className="v2AutopilotStep" key={item}><span>{String(index+1).padStart(2,"0")}</span><strong>{item}</strong><i/></div>)}</div>
      <div className="v2AutopilotMetric"><span>EVERY OUTPUT BECOMES INPUT FOR THE NEXT CYCLE</span><strong>01 → ∞</strong></div>
    </section>

    <section className="v2Voice">
      <div className="v2VoiceCopy"><span>{t.voiceKicker}</span><h2>{t.voiceTitle}</h2><p>{t.voiceText}</p><a className="v2InlineLink" href="/voice">{t.voiceCta}<b>↗</b></a><div className="v2VoiceModes">{["STANDARD","NATURAL","YEREVAN","WESTERN"].map((item,index)=><div key={item}><span>0{index+1}</span><b>{item}</b><i className={index===1?"active":""}/></div>)}</div></div>
      <div className="v2VoiceConsole"><div className="v2VoiceTop"><span>HAY VOICE / NATURAL</span><b><i/>HY-AM</b></div><div className="v2Wave" aria-hidden="true">{Array.from({length:52},(_,i)=><i key={i} style={{height:`${18 + ((i*17)%74)}%`,animationDelay:`-${(i%9)*.13}s`}}/>)}</div><blockquote>«Հայերենը պետք է հնչի բնական, ոչ թե թարգմանված»</blockquote><div className="v2VoiceBottom"><span>PRONUNCIATION LOCK</span><span>CODE-SWITCH SAFE</span><span>QUALITY GATE 100</span></div></div>
    </section>

    <section id="pricing" className="v2Section v2Pricing">
      <div className="v2SectionIntro"><span>{t.pricingKicker}</span><h2>{t.pricingTitle}</h2><p>AI video credits keep costs predictable while core marketing intelligence scales with the plan.</p></div>
      <div className="v2PricingGrid">{HAY_PLANS.map(plan=><article key={plan.id} className={plan.id==="growth"?"featured":""}>{plan.badge&&<em>{plan.badge}</em>}<div className="v2PlanTop"><span>HAY / {plan.id.toUpperCase()}</span><h3>{plan.name}</h3><p>{plan.description[locale]}</p></div><div className="v2PlanPrice"><b>{amd(plan.priceAmd)}</b><span>{t.perMonth}</span></div><ul>{plan.features[locale].map(feature=><li key={feature}><i/> {feature}</li>)}</ul><a href={`/studio?plan=${plan.id}`}>{t.choose}<b>↗</b></a></article>)}</div>
      <div className="v2Agency"><div><span>HAY / SCALE</span><h3>{t.agency}</h3></div><p>{t.agencyText}</p><strong>{t.from} {amd(AGENCY_STARTING_AMD)} <small>{t.perMonth}</small></strong><a href="/studio?plan=agency">TALK TO HAY ↗</a></div>
    </section>

    <section className="v2Final"><div className="v2FinalGlow" aria-hidden="true"/><span>HAY / START THE LOOP</span><h2>{t.finalTitle}</h2><p>{t.finalText}</p><a href="/studio?plan=free"><span>{t.finalButton}</span><b>↗</b></a></section>
    <footer className="v2Footer"><span>HAY ENGINE / ARMENIAN AI INFRASTRUCTURE</span><span>YEREVAN · ARMENIA · 2026</span><span>HY / EN / RU</span></footer>
  </main>;
}
