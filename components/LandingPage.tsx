"use client";

import { useState } from "react";
import HayLogo from "./HayLogo";
import { AGENCY_STARTING_AMD, HAY_PLANS } from "@/lib/pricing";
import type { Locale } from "@/lib/hay/types";

const copy = {
  hy: {
    navProduct:"Ապրանք", navVoice:"Հայերեն ձայն", navPricing:"Գներ", navStudio:"Բացել HAY-ը",
    eyebrow:"ARMENIAN-FIRST AI MARKETING OPERATING SYSTEM",
    heroA:"Քո բիզնեսը։", heroB:"Մի ամբողջ մարքեթինգային թիմ՝ մեկ համակարգում։",
    sub:"HAY-ը հասկանում է բիզնեսը, մրցակիցներին ու հայաստանյան կոնտեքստը, գրում է բնական հայերենով, ստեղծում է կոնտենտ, ձայնավորում, հրապարակում և սովորում արդյունքներից։",
    primary:"Սկսել անվճար", secondary:"Տեսնել՝ ինչպես է աշխատում",
    proof1:"Բնական հայերեն", proof2:"AI video + voice", proof3:"Instagram · TikTok · YouTube", proof4:"Strategy → Publish → Learn",
    section1:"Ոչ թե ևս մեկ content generator", section1Title:"HAY-ը մարքեթինգի օպերացիոն համակարգ է։",
    cards:[
      ["01 / UNDERSTAND","Business Intelligence","Բրենդ, առաջարկ, լսարան, կայք, մրցակիցներ, շուկա և կոնտենտային բացեր։"],
      ["02 / SPEAK","Խոսակցական հայերեն","Գրում և խոսում է ոչ թե բառացի թարգմանությամբ, այլ բնական արևելահայերենով՝ tone controls-ով։"],
      ["03 / CREATE","Creator Engine","Reels, Shorts, posts, carousels, հայկական captions, ձայն և cinematic visuals։"],
      ["04 / DISTRIBUTE","Autopilot","Approval, schedule, direct publishing և անվտանգ OAuth կապեր։"],
      ["05 / LEARN","Performance Memory","Դիտումներ, reach, saves, clicks ու conversions-ը վերադառնում են հաջորդ ռազմավարության մեջ։"],
      ["06 / SCALE","One brain, many brands","Բլոգերից մինչև ռեստորան, հյուրանոց, խանութ, կլինիկա կամ agency portfolio։"],
    ],
    voiceKicker:"HAY VOICE / HY-AM", voiceTitle:"Հայերենը պետք է հնչի հայերեն։", voiceText:"HAY Voice-ը կառուցվում է provider-agnostic ձևով՝ ElevenLabs custom voices + Azure Anahit/Hayk fallback + ապագա Gemini/voice-clone շերտ։ Տեքստը նախ անցնում է pronunciation, numbers, code-switch և conversational naturalization pipeline-ով։",
    voiceModes:["Մաքուր / Clear","Ջերմ / Warm","Վստահ / Deep","Խոսակցական / Natural","Երևանյան / Casual","Արևմտահայերեն / Western"],
    pricingKicker:"PRICING / ARMENIA", pricingTitle:"Սկսիր փոքրից։ HAY-ը աճում է բիզնեսիդ հետ։", perMonth:"/ ամիս", choose:"Ընտրել", agency:"Agency / Enterprise", agencyText:"15+ բրենդ, white-label, custom limits, onboarding և API։", from:"սկսած",
    finalTitle:"Մարքեթինգը այլևս չպետք է լինի 7 տարբեր գործիք ու 5 տարբեր մարդ։", finalText:"HAY-ի նպատակը պարզ է՝ մեկ տեղում հասկանալ, ստեղծել, հրապարակել և ավելի լավը դառնալ ամեն ցիկլից հետո։", finalButton:"Բացել Marketing OS",
  },
  en: {
    navProduct:"Product", navVoice:"Armenian Voice", navPricing:"Pricing", navStudio:"Open HAY",
    eyebrow:"ARMENIAN-FIRST AI MARKETING OPERATING SYSTEM",
    heroA:"Your business.", heroB:"An entire marketing team in one system.",
    sub:"HAY understands your business, competitors and Armenian market context, writes in natural Armenian, creates content, voices it, publishes it and learns from results.",
    primary:"Start free", secondary:"See how it works",
    proof1:"Natural Armenian", proof2:"AI video + voice", proof3:"Instagram · TikTok · YouTube", proof4:"Strategy → Publish → Learn",
    section1:"Not another content generator", section1Title:"HAY is a marketing operating system.",
    cards:[
      ["01 / UNDERSTAND","Business Intelligence","Brand, offer, audience, website, competitors, market signals and content gaps."],
      ["02 / SPEAK","Conversational Armenian","Writes and speaks native-feeling Eastern Armenian instead of literal translated copy."],
      ["03 / CREATE","Creator Engine","Reels, Shorts, posts, carousels, Armenian captions, voice and cinematic visuals."],
      ["04 / DISTRIBUTE","Autopilot","Approval, scheduling, direct publishing and secure OAuth connections."],
      ["05 / LEARN","Performance Memory","Views, reach, saves, clicks and conversions feed the next strategy."],
      ["06 / SCALE","One brain, many brands","From creators to restaurants, hotels, retail, clinics and agency portfolios."],
    ],
    voiceKicker:"HAY VOICE / HY-AM", voiceTitle:"Armenian should sound Armenian.", voiceText:"HAY Voice is provider-agnostic: ElevenLabs custom voices + Azure Anahit/Hayk fallback + future Gemini/voice-clone layers. Text first passes pronunciation, numbers, code-switch and conversational naturalization.",
    voiceModes:["Clear","Warm","Deep","Conversational","Yerevan Casual","Western Armenian"],
    pricingKicker:"PRICING / ARMENIA", pricingTitle:"Start small. HAY grows with the business.", perMonth:"/ month", choose:"Choose", agency:"Agency / Enterprise", agencyText:"15+ brands, white-label, custom limits, onboarding and API.", from:"from",
    finalTitle:"Marketing should not require seven tools and five different people.", finalText:"HAY puts understanding, creation, publishing and learning into one operating loop.", finalButton:"Open Marketing OS",
  },
  ru: {
    navProduct:"Продукт", navVoice:"Армянский голос", navPricing:"Цены", navStudio:"Открыть HAY",
    eyebrow:"ARMENIAN-FIRST AI MARKETING OPERATING SYSTEM",
    heroA:"Твой бизнес.", heroB:"Целая маркетинговая команда в одной системе.",
    sub:"HAY понимает бизнес, конкурентов и армянский контекст, пишет естественно на армянском, создаёт контент, озвучивает, публикует и учится на результатах.",
    primary:"Начать бесплатно", secondary:"Как это работает",
    proof1:"Живой армянский", proof2:"AI video + voice", proof3:"Instagram · TikTok · YouTube", proof4:"Strategy → Publish → Learn",
    section1:"Не ещё один генератор контента", section1Title:"HAY — операционная система маркетинга.",
    cards:[
      ["01 / UNDERSTAND","Business Intelligence","Бренд, оффер, аудитория, сайт, конкуренты, рынок и контентные пробелы."],
      ["02 / SPEAK","Разговорный армянский","Пишет и говорит естественным восточноармянским, а не буквальным переводом."],
      ["03 / CREATE","Creator Engine","Reels, Shorts, посты, карусели, армянские captions, голос и cinematic visuals."],
      ["04 / DISTRIBUTE","Autopilot","Approval, расписание, direct publishing и безопасный OAuth."],
      ["05 / LEARN","Performance Memory","Просмотры, reach, saves, clicks и conversions возвращаются в следующую стратегию."],
      ["06 / SCALE","Один мозг — много брендов","От блогера до ресторанов, отелей, retail, клиник и агентств."],
    ],
    voiceKicker:"HAY VOICE / HY-AM", voiceTitle:"Армянский должен звучать по-армянски.", voiceText:"HAY Voice строится независимо от одного провайдера: ElevenLabs custom voices + Azure Anahit/Hayk как fallback + будущие Gemini/voice-clone слои. Перед TTS текст проходит pronunciation, числа, code-switch и conversational naturalization.",
    voiceModes:["Чистый","Тёплый","Глубокий","Разговорный","Ереванский casual","Западноармянский"],
    pricingKicker:"PRICING / ARMENIA", pricingTitle:"Начни с малого. HAY растёт вместе с бизнесом.", perMonth:"/ месяц", choose:"Выбрать", agency:"Agency / Enterprise", agencyText:"15+ брендов, white-label, custom limits, onboarding и API.", from:"от",
    finalTitle:"Маркетинг не должен состоять из семи сервисов и пяти разных людей.", finalText:"HAY объединяет понимание, создание, публикацию и обучение в один непрерывный цикл.", finalButton:"Открыть Marketing OS",
  },
} as const;

function amd(value:number){ return value === 0 ? "0 ֏" : `${value.toLocaleString("en-US")} ֏`; }

export default function LandingPage(){
  const [locale,setLocale]=useState<Locale>("hy");
  const t=copy[locale];
  return <main className="landingPage">
    <header className="landingNav">
      <a href="/" className="landingBrand"><HayLogo compact/></a>
      <nav><a href="#product">{t.navProduct}</a><a href="#voice">{t.navVoice}</a><a href="#pricing">{t.navPricing}</a></nav>
      <div className="landingNavRight"><div className="landingLocale">{(["hy","en","ru"] as Locale[]).map(l=><button key={l} className={locale===l?"active":""} onClick={()=>setLocale(l)}>{l==="hy"?"ՀԱՅ":l.toUpperCase()}</button>)}</div><a className="landingOpen" href="/studio">{t.navStudio} ↗</a></div>
    </header>

    <section className="landingHero">
      <div className="landingHeroCopy"><span className="landingEyebrow"><i/>{t.eyebrow}</span><h1><small>{t.heroA}</small>{t.heroB}</h1><p>{t.sub}</p><div className="landingActions"><a className="landingPrimary" href="/studio">{t.primary}</a><a className="landingSecondary" href="#product">{t.secondary} ↓</a></div></div>
      <div className="landingSignal" aria-hidden="true"><div className="signalGrid"/><div className="signalCore"><b>Հ</b><span>HAY<br/>ENGINE</span></div><div className="signalNode n1"><i>01</i>UNDERSTAND</div><div className="signalNode n2"><i>02</i>CREATE</div><div className="signalNode n3"><i>03</i>PUBLISH</div><div className="signalNode n4"><i>04</i>LEARN</div></div>
    </section>

    <section className="landingProof"><span>{t.proof1}</span><span>{t.proof2}</span><span>{t.proof3}</span><span>{t.proof4}</span></section>

    <section id="product" className="landingSection productSection"><div className="sectionIntro"><span>{t.section1}</span><h2>{t.section1Title}</h2></div><div className="featureMatrix">{t.cards.map(card=><article key={card[0]}><span>{card[0]}</span><h3>{card[1]}</h3><p>{card[2]}</p></article>)}</div></section>

    <section id="voice" className="voiceSection"><div className="voiceCopy"><span>{t.voiceKicker}</span><h2>{t.voiceTitle}</h2><p>{t.voiceText}</p><div className="voiceModeList">{t.voiceModes.map((mode,i)=><div key={mode}><i>{String(i+1).padStart(2,"0")}</i><b>{mode}</b><span>HY-AM</span></div>)}</div></div><div className="voiceWave" aria-hidden="true"><div className="waveBars">{Array.from({length:72},(_,i)=><i key={i} style={{height:`${18+((i*37)%82)}%`}}/>)}</div><div className="voiceQuote">«Բարև, հիմա ցույց տամ՝ HAY-ը ոնց է քո բիզնեսի համար ամբողջ շաբաթվա կոնտենտը կառուցում»</div><div className="voiceMeta"><span>NATURAL EASTERN ARMENIAN</span><b>խոսակցական / conversational</b></div></div></section>

    <section id="pricing" className="landingSection pricingSection"><div className="sectionIntro"><span>{t.pricingKicker}</span><h2>{t.pricingTitle}</h2></div><div className="pricingGrid">{HAY_PLANS.map(plan=><article key={plan.id} className={plan.id==="growth"?"featured":""}>{plan.badge&&<em>{plan.badge}</em>}<div className="planTop"><span>HAY / {plan.name.toUpperCase()}</span><h3>{plan.name}</h3><p>{plan.description[locale]}</p></div><div className="planPrice"><b>{amd(plan.priceAmd)}</b><span>{t.perMonth}</span></div><ul>{plan.features[locale].map(feature=><li key={feature}>↗ {feature}</li>)}</ul><a href="/studio">{t.choose} →</a></article>)}</div><div className="agencyBand"><div><span>{t.agency}</span><h3>{t.from} {amd(AGENCY_STARTING_AMD)} / {locale==="hy"?"ամիս":locale==="ru"?"месяц":"month"}</h3></div><p>{t.agencyText}</p><a href="mailto:hello@hay.engine">CONTACT →</a></div><p className="pricingNote">AI video credits protect predictable pricing because premium generative video is usage-based. Extra generation can be purchased as add-on credits.</p></section>

    <section className="landingFinal"><div><span>HAY / ARMENIA / 2026</span><h2>{t.finalTitle}</h2><p>{t.finalText}</p></div><a href="/studio">{t.finalButton} ↗</a></section>
    <footer className="landingFooter"><HayLogo compact/><span>Հայկական AI ենթակառուցվածք · Armenian AI Infrastructure</span><span>YEREVAN / GLOBAL</span></footer>
  </main>;
}
