"use client";

import { useState } from "react";
import HayLogo from "./HayLogo";
import SocialBrandIcon from "./SocialBrandIcon";
import { AGENCY_STARTING_AMD, HAY_PLANS } from "@/lib/pricing";
import type { Locale } from "@/lib/hay/types";
import type { SocialPlatform } from "@/lib/marketing/types";

const platformStack: Array<{platform:SocialPlatform;label:string}> = [
  {platform:"instagram",label:"Instagram"},
  {platform:"tiktok",label:"TikTok"},
  {platform:"youtube",label:"YouTube"},
  {platform:"facebook",label:"Facebook"},
];

const copy = {
  hy: {
    navProduct:"Ապրանքը", navArmenian:"Հայերեն", navPricing:"Գներ", open:"Բացել HAY-ը",
    badge:"MARKETING OPERATING SYSTEM / ARMENIA",
    heroA:"Դու զբաղվիր բիզնեսով։", heroB:"HAY-ը կզբաղվի մարքեթինգով։",
    heroBody:"Միացրու բրենդը մեկ անգամ։ HAY-ը հետևում է շուկային, որոշում է հաջորդ քայլը, ստեղծում է կոնտենտ, սպասում է հաստատմանը, հրապարակում և սովորում արդյունքից։",
    start:"Սկսել անվճար", see:"Տեսնել աշխատանքային օրը", noCard:"Առանց քարտի · մեկ բիզնես · human approval միշտ քո մոտ",
    connected:"CONNECTED CHANNELS", live:"LIVE OPERATING DAY", business:"ARARAT HOUSE / YEREVAN",
    now:"Հիմա", event1:"Մրցակցի առաջարկը փոխվել է", detail1:"HAY-ը փոխեց այս շաբաթվա angle-ը",
    event2:"Reel-ը պատրաստ է review-ի", detail2:"Natural HY voice · captions · CTA",
    event3:"Հաստատված է", detail3:"Հրապարակում այսօր 19:20",
    previewKicker:"READY TO PUBLISH", previewTitle:"Երևանը առավոտից հետո էլ սուրճ է խմում։", previewMeta:"12 sec · HY-AM · Reel",
    rail:"Մեկ համակարգ։ Քո բոլոր ալիքները։ Ոչ մի նոր dashboard ամեն հաջորդ քայլի համար։",
    howEyebrow:"FROM CONTEXT TO OUTCOME", howTitle:"HAY-ը չի տալիս գաղափարների ցուցակ։ Այն պահում է մարքեթինգը շարժման մեջ։",
    step1:"ՀԱՍԿԱՆԱԼ", step1Title:"Բրենդը, շուկան, մրցակիցները", step1Text:"Կայք, offer, tone, location, performance և մրցակիցների փոփոխություններ։",
    step2:"ՈՐՈՇԵԼ", step2Title:"Ինչ անել հենց հիմա", step2Text:"Campaign angle, content mix, timing, experiments և ինչ չանել։",
    step3:"ՍՏԵՂԾԵԼ + ԳՈՐԾԱՐԿԵԼ", step3Title:"Պատրաստ asset-ից մինչև հրապարակում", step3Text:"Reels, posts, Armenian voice, captions, approval, schedule, publish, learn։",
    languageEyebrow:"ARMENIAN IS A PRODUCT LAYER", languageTitle:"Հայերենը պետք է հնչի ինչպես մարդ, ոչ թե ինչպես թարգմանիչ։",
    languageText:"HAY-ը պահում է բրենդները, թվերը և code-switch-ը, տարբերում է display copy-ն ու spoken copy-ն և կարող է աշխատել բնական արևելահայերեն, թեթև երևանյան ու արևմտահայերեն շերտերով։",
    written:"DISPLAY", spoken:"SPOKEN", writtenText:"Նոր համը արդեն այստեղ է։", spokenText:"Նոր համը արդեն ստեղ ա։ Արի փորձի։",
    guard1:"brand terms protected", guard2:"pronunciation aware", guard3:"human review ready",
    loopEyebrow:"ONE MEMORY / EVERY DAY", loopTitle:"Այսօրվա արդյունքը դառնում է վաղվա որոշման կոնտեքստ։",
    loopText:"HAY-ը հիշում է ինչ հրապարակվեց, ինչ աշխատեց, ինչ չաշխատեց և ինչ արդեն փորձել ես։ Նոր շաբաթը չի սկսվում զրոյից։",
    loopA:"WATCH", loopB:"DECIDE", loopC:"CREATE", loopD:"APPROVE", loopE:"PUBLISH", loopF:"LEARN",
    pricingEyebrow:"START SMALL", pricingTitle:"Սկսիր մեկ բիզնեսից։ Մեծացրու միայն երբ HAY-ը արդեն աշխատում է քեզ համար։",
    month:"/ ամիս", choose:"Ընտրել", agency:"Agency / Enterprise", agencyText:"15+ բրենդ, թիմային approval, custom limits, white-label և API։", from:"սկսած",
    finalEyebrow:"HAY / ALWAYS ON", finalTitle:"Վաղվա մարքեթինգը պետք չէ վաղը սկսել։", finalText:"Միացրու բիզնեսը այսօր։ HAY-ը սկսում է հավաքել կոնտեքստն ու կառուցել հաջորդ քայլերը առաջին session-ից։", finalCta:"Բացել HAY-ը",
  },
  en: {
    navProduct:"Product", navArmenian:"Armenian", navPricing:"Pricing", open:"Open HAY",
    badge:"MARKETING OPERATING SYSTEM / ARMENIA",
    heroA:"Run the business.", heroB:"Let HAY run the marketing.",
    heroBody:"Connect the brand once. HAY watches the market, decides the next move, creates content, waits for approval, publishes and learns from the outcome.",
    start:"Start free", see:"See the operating day", noCard:"No card · one business · human approval stays with you",
    connected:"CONNECTED CHANNELS", live:"LIVE OPERATING DAY", business:"ARARAT HOUSE / YEREVAN",
    now:"Now", event1:"A competitor changed its offer", detail1:"HAY changed this week's angle",
    event2:"A Reel is ready for review", detail2:"Natural HY voice · captions · CTA",
    event3:"Approved", detail3:"Publishing today at 19:20",
    previewKicker:"READY TO PUBLISH", previewTitle:"Yerevan still drinks coffee after the morning rush.", previewMeta:"12 sec · HY-AM · Reel",
    rail:"One system. All your channels. No new dashboard for every next step.",
    howEyebrow:"FROM CONTEXT TO OUTCOME", howTitle:"HAY does not hand you a list of ideas. It keeps marketing moving.",
    step1:"UNDERSTAND", step1Title:"Brand, market and competitors", step1Text:"Site, offer, tone, location, performance and competitor changes.",
    step2:"DECIDE", step2Title:"What should happen now", step2Text:"Campaign angle, content mix, timing, experiments and what not to do.",
    step3:"CREATE + OPERATE", step3Title:"From ready asset to published result", step3Text:"Reels, posts, Armenian voice, captions, approval, schedule, publish and learn.",
    languageEyebrow:"ARMENIAN IS A PRODUCT LAYER", languageTitle:"Armenian should sound like a person, not a translator.",
    languageText:"HAY preserves brands, numbers and code-switching, separates display copy from spoken copy and can work across natural Eastern Armenian, light Yerevan speech and Western Armenian layers.",
    written:"DISPLAY", spoken:"SPOKEN", writtenText:"Նոր համը արդեն այստեղ է։", spokenText:"Նոր համը արդեն ստեղ ա։ Արի փորձի։",
    guard1:"brand terms protected", guard2:"pronunciation aware", guard3:"human review ready",
    loopEyebrow:"ONE MEMORY / EVERY DAY", loopTitle:"Today's outcome becomes context for tomorrow's decision.",
    loopText:"HAY remembers what was published, what worked, what failed and what you already tried. A new week does not start from zero.",
    loopA:"WATCH", loopB:"DECIDE", loopC:"CREATE", loopD:"APPROVE", loopE:"PUBLISH", loopF:"LEARN",
    pricingEyebrow:"START SMALL", pricingTitle:"Start with one business. Scale only after HAY is already working for you.",
    month:"/ month", choose:"Choose", agency:"Agency / Enterprise", agencyText:"15+ brands, team approvals, custom limits, white-label and API.", from:"from",
    finalEyebrow:"HAY / ALWAYS ON", finalTitle:"Tomorrow's marketing does not need to start tomorrow.", finalText:"Connect the business today. HAY starts building context and the next moves from the first session.", finalCta:"Open HAY",
  },
  ru: {
    navProduct:"Продукт", navArmenian:"Армянский", navPricing:"Цены", open:"Открыть HAY",
    badge:"MARKETING OPERATING SYSTEM / ARMENIA",
    heroA:"Занимайся бизнесом.", heroB:"Маркетинг пусть ведёт HAY.",
    heroBody:"Подключи бренд один раз. HAY следит за рынком, решает следующий шаг, создаёт контент, ждёт подтверждения, публикует и учится на результате.",
    start:"Начать бесплатно", see:"Посмотреть рабочий день", noCard:"Без карты · один бизнес · human approval всегда остаётся у тебя",
    connected:"CONNECTED CHANNELS", live:"LIVE OPERATING DAY", business:"ARARAT HOUSE / YEREVAN",
    now:"Сейчас", event1:"Конкурент изменил предложение", detail1:"HAY поменял angle этой недели",
    event2:"Reel готов к review", detail2:"Natural HY voice · captions · CTA",
    event3:"Подтверждено", detail3:"Публикация сегодня в 19:20",
    previewKicker:"READY TO PUBLISH", previewTitle:"Ереван пьёт кофе не только утром.", previewMeta:"12 sec · HY-AM · Reel",
    rail:"Одна система. Все твои каналы. Не новый dashboard для каждого следующего шага.",
    howEyebrow:"FROM CONTEXT TO OUTCOME", howTitle:"HAY не отдаёт список идей. Он держит маркетинг в движении.",
    step1:"ПОНЯТЬ", step1Title:"Бренд, рынок и конкурентов", step1Text:"Сайт, offer, tone, location, performance и изменения конкурентов.",
    step2:"РЕШИТЬ", step2Title:"Что делать именно сейчас", step2Text:"Campaign angle, content mix, timing, experiments и что не надо делать.",
    step3:"СОЗДАТЬ + ЗАПУСТИТЬ", step3Title:"От готового asset до публикации", step3Text:"Reels, posts, армянский voice, captions, approval, schedule, publish и learning.",
    languageEyebrow:"ARMENIAN IS A PRODUCT LAYER", languageTitle:"Армянский должен звучать как человек, а не как переводчик.",
    languageText:"HAY сохраняет бренды, числа и code-switch, разделяет display copy и spoken copy и умеет работать с естественным восточноармянским, лёгким ереванским и западноармянским слоями.",
    written:"DISPLAY", spoken:"SPOKEN", writtenText:"Նոր համը արդեն այստեղ է։", spokenText:"Նոր համը արդեն ստեղ ա։ Արի փորձի։",
    guard1:"brand terms protected", guard2:"pronunciation aware", guard3:"human review ready",
    loopEyebrow:"ONE MEMORY / EVERY DAY", loopTitle:"Результат сегодня становится контекстом решения завтра.",
    loopText:"HAY помнит, что публиковалось, что сработало, что не сработало и что ты уже пробовал. Новая неделя не начинается с нуля.",
    loopA:"WATCH", loopB:"DECIDE", loopC:"CREATE", loopD:"APPROVE", loopE:"PUBLISH", loopF:"LEARN",
    pricingEyebrow:"START SMALL", pricingTitle:"Начни с одного бизнеса. Масштабируй только когда HAY уже работает на тебя.",
    month:"/ месяц", choose:"Выбрать", agency:"Agency / Enterprise", agencyText:"15+ брендов, team approvals, custom limits, white-label и API.", from:"от",
    finalEyebrow:"HAY / ALWAYS ON", finalTitle:"Маркетинг на завтра не надо начинать завтра.", finalText:"Подключи бизнес сегодня. HAY начинает собирать контекст и готовить следующие шаги с первой сессии.", finalCta:"Открыть HAY",
  },
} as const;

function amd(value:number){return value===0?"0 ֏":`${value.toLocaleString("en-US")} ֏`;}

export default function LandingPageV6(){
  const [locale,setLocale]=useState<Locale>("hy");
  const t=copy[locale];
  const loop=[t.loopA,t.loopB,t.loopC,t.loopD,t.loopE,t.loopF];

  return <main className="hayLandingV6">
    <header className="hv6Nav">
      <a href="/" className="hv6Brand" aria-label="HAY Engine home"><HayLogo/></a>
      <nav aria-label="Primary navigation">
        <a href="#product">{t.navProduct}</a><a href="#armenian">{t.navArmenian}</a><a href="#pricing">{t.navPricing}</a>
      </nav>
      <div className="hv6NavActions">
        <div className="hv6Locale">{(["hy","en","ru"] as Locale[]).map(item=><button type="button" key={item} className={item===locale?"active":""} onClick={()=>setLocale(item)}>{item.toUpperCase()}</button>)}</div>
        <a href="/studio" className="hv6Open">{t.open}<span>↗</span></a>
      </div>
    </header>

    <section className="hv6Hero">
      <div className="hv6HeroCopy">
        <div className="hv6Eyebrow"><i/>{t.badge}</div>
        <h1><span>{t.heroA}</span><strong>{t.heroB}</strong></h1>
        <p>{t.heroBody}</p>
        <div className="hv6HeroActions"><a className="hv6Primary" href="/studio?plan=free">{t.start}<span>↗</span></a><a className="hv6Ghost" href="#product">{t.see}<span>↓</span></a></div>
        <small>{t.noCard}</small>
      </div>

      <div className="hv6ProductWindow" aria-label="HAY live operating day preview">
        <div className="hv6WindowBar"><div><i/><i/><i/></div><span>HAY / STUDIO</span><b>{t.business}</b></div>
        <div className="hv6ChannelBar"><span>{t.connected}</span><div>{platformStack.map(({platform,label})=><div key={platform} title={label}><SocialBrandIcon platform={platform} size={18}/><i/></div>)}</div></div>
        <div className="hv6WindowBody">
          <div className="hv6DayStream">
            <div className="hv6DayHead"><span>{t.live}</span><b><i/>{t.now}</b></div>
            <article><time>09:12</time><div><strong>{t.event1}</strong><p>{t.detail1}</p></div><em>DONE</em></article>
            <article className="active"><time>13:40</time><div><strong>{t.event2}</strong><p>{t.detail2}</p></div><button type="button">REVIEW</button></article>
            <article><time>14:06</time><div><strong>{t.event3}</strong><p>{t.detail3}</p></div><em>QUEUED</em></article>
          </div>
          <div className="hv6AssetPreview">
            <div className="hv6AssetTop"><span>{t.previewKicker}</span><div><SocialBrandIcon platform="instagram" size={15} decorative/><SocialBrandIcon platform="tiktok" size={15} decorative/></div></div>
            <div className="hv6Poster"><div className="hv6PosterH">Հ</div><div className="hv6PosterLines"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
            <strong>{t.previewTitle}</strong><p>{t.previewMeta}</p>
          </div>
        </div>
      </div>
    </section>

    <section className="hv6PlatformRail" aria-label="Supported social channels">
      <p>{t.rail}</p>
      <div>{platformStack.map(({platform,label})=><span key={platform}><SocialBrandIcon platform={platform} size={20}/><b>{label}</b></span>)}</div>
    </section>

    <section id="product" className="hv6How">
      <div className="hv6SectionLead"><span>{t.howEyebrow}</span><h2>{t.howTitle}</h2></div>
      <div className="hv6Steps">
        <article><div><b>01</b><span>{t.step1}</span></div><h3>{t.step1Title}</h3><p>{t.step1Text}</p><div className="hv6StepVisual scan"><i/><i/><i/><span>your-business.am</span></div></article>
        <article><div><b>02</b><span>{t.step2}</span></div><h3>{t.step2Title}</h3><p>{t.step2Text}</p><div className="hv6StepVisual decision"><span>HAY</span><i/><i/><i/></div></article>
        <article className="wide"><div><b>03</b><span>{t.step3}</span></div><h3>{t.step3Title}</h3><p>{t.step3Text}</p><div className="hv6StepChannels">{platformStack.map(({platform})=><SocialBrandIcon key={platform} platform={platform} size={22}/>)}</div></article>
      </div>
    </section>

    <section id="armenian" className="hv6Armenian">
      <div className="hv6ArmenianCopy"><span>{t.languageEyebrow}</span><h2>{t.languageTitle}</h2><p>{t.languageText}</p><div className="hv6Guards"><i>{t.guard1}</i><i>{t.guard2}</i><i>{t.guard3}</i></div><a href="/voice">VOICE LAB <b>↗</b></a></div>
      <div className="hv6SpeechDemo">
        <div><span>{t.written}</span><p>{t.writtenText}</p><small>STANDARD / BRAND SAFE</small></div>
        <b>→</b>
        <div className="spoken"><span>{t.spoken}</span><p>{t.spokenText}</p><small>NATURAL / YEREVAN</small></div>
        <footer><i/><span>HAY LANGUAGE LAYER / HY-AM</span></footer>
      </div>
    </section>

    <section className="hv6Loop">
      <div className="hv6LoopCopy"><span>{t.loopEyebrow}</span><h2>{t.loopTitle}</h2><p>{t.loopText}</p></div>
      <div className="hv6LoopTrack">{loop.map((item,index)=><div key={item}><b>{String(index+1).padStart(2,"0")}</b><strong>{item}</strong>{index<loop.length-1&&<i>→</i>}</div>)}</div>
    </section>

    <section id="pricing" className="hv6Pricing">
      <div className="hv6SectionLead"><span>{t.pricingEyebrow}</span><h2>{t.pricingTitle}</h2></div>
      <div className="hv6PlanRail">{HAY_PLANS.map(plan=><article key={plan.id} className={plan.id==="growth"?"featured":""}><div><span>HAY / {plan.id.toUpperCase()}</span>{plan.badge&&<em>{plan.badge}</em>}</div><h3>{plan.name}</h3><p>{plan.description[locale]}</p><strong>{amd(plan.priceAmd)} <small>{t.month}</small></strong><a href={`/studio?plan=${plan.id}`}>{t.choose}<b>↗</b></a></article>)}</div>
      <div className="hv6Agency"><div><span>HAY / SCALE</span><h3>{t.agency}</h3><p>{t.agencyText}</p></div><strong>{t.from} {amd(AGENCY_STARTING_AMD)} <small>{t.month}</small></strong><a href="/studio?plan=agency">TALK TO HAY <b>↗</b></a></div>
    </section>

    <section className="hv6Final">
      <div><span>{t.finalEyebrow}</span><h2>{t.finalTitle}</h2><p>{t.finalText}</p></div><a href="/studio?plan=free">{t.finalCta}<b>↗</b></a>
    </section>

    <footer className="hv6Footer"><HayLogo/><span>ARMENIAN-FIRST MARKETING OPERATING SYSTEM</span><span>YEREVAN / 2026</span></footer>
  </main>;
}
