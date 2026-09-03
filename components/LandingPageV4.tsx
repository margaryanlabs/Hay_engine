"use client";

import { useState } from "react";
import HayLogo from "./HayLogo";
import { AGENCY_STARTING_AMD, HAY_PLANS } from "@/lib/pricing";
import type { Locale } from "@/lib/hay/types";

const copy = {
  hy: {
    navProduct: "Համակարգ",
    navArmenian: "Հայերեն",
    navUseCases: "Բիզնեսի համար",
    navPricing: "Գներ",
    openStudio: "Բացել HAY-ը",
    eyebrow: "ARMENIAN-FIRST MARKETING INTELLIGENCE",
    heroLead: "AI մարքեթինգային թիմ,",
    heroAccent: "որը մտածում է հայերեն։",
    heroBody: "HAY-ը վերլուծում է բիզնեսը և մրցակիցներին, կառուցում է ռազմավարություն, ստեղծում է բնական հայկական կոնտենտ, պատրաստում է ձայն ու վիդեո, հրապարակում և սովորում իրական արդյունքներից։",
    start: "Սկսել անվճար",
    seeSystem: "Տեսնել համակարգը",
    proofQuality: "Հայերենը release gate է, ոչ թե prompt",
    proofModes: "Standard · Natural · Yerevan · Western",
    proofLoop: "Strategy → Create → Publish → Learn",
    proofChannels: "Instagram · TikTok · YouTube",
    commandLabel: "HAY / TODAY",
    commandTitle: "Այսօր HAY-ը աշխատում է քո բիզնեսի փոխարեն։",
    commandOne: "Մրցակիցների նոր առաջարկը վերլուծված է",
    commandTwo: "Այսօրվա Reel-ը պատրաստ է approval-ի",
    commandThree: "Լավագույն հրապարակման պատուհանը հաշվարկված է",
    commandFour: "Conversion Bridge-ը կապում է կոնտենտը արդյունքի հետ",
    sectionEyebrow: "ONE OPERATING LOOP",
    sectionTitle: "Ոչ թե ևս մեկ AI գործիք։ Մեկ ամբողջական մարքեթինգային համակարգ։",
    sectionBody: "HAY-ը պահում է կոնտեքստը, հիշում է նախկին կոնտենտը, չի կրկնվում և յուրաքանչյուր ցիկլից հետո հաջորդ որոշումը կառուցում է արդեն ստացված տվյալների վրա։",
    armenianEyebrow: "HAY LANGUAGE LAYER",
    armenianTitle: "Հայերենը HAY-ում առաջին կարգի արտադրանք է։",
    armenianBody: "Display text-ը և spoken text-ը տարբեր շերտեր են։ Թվերը, արժույթները, բրենդները, հոլովումները և code-switch-ը վերահսկվում են մինչև ձայնի provider-ին հասնելը։ Հայերեն տեքստը վիզուալի վրա HAY-ն է գրում՝ ոչ թե image model-ը։",
    benchmarkLabel: "QUALITY CONTROL",
    benchmarkTitle: "Յուրաքանչյուր release անցնում է հայկական regression suite-ով։",
    benchmarkBody: "Սա ներքին regression gate է, ոչ թե «աշխարհի լավագույն AI» պնդում։ Հաջորդ քայլը՝ native speaker blind benchmark՝ Gemini / ElevenLabs / Azure և այլ provider-ների դեմ։",
    useEyebrow: "BUILT TO SELL",
    useTitle: "Առաջին հաճախորդները պետք է արդյունք գնեն, ոչ թե software։",
    useBody: "HAY-ը կարելի է վաճառել որպես պատրաստի հայկական մարքեթինգային բաժին՝ կոնտենտից մինչև հրապարակում և attribution։",
    pricingEyebrow: "PRICING / ARMENIA",
    pricingTitle: "Սկսիր փոքրից։ HAY-ը մեծանա բիզնեսիդ հետ։",
    perMonth: "/ ամիս",
    choose: "Ընտրել",
    agency: "Agency / Enterprise",
    agencyBody: "15+ բրենդ, white-label, custom limits, onboarding և API։",
    from: "սկսած",
    finalEyebrow: "HAY / GO LIVE",
    finalTitle: "Հայկական բիզնեսը չպետք է թարգմանի իր մարքեթինգը AI-ի համար։",
    finalBody: "Միացրու բիզնեսը։ HAY-ը վերցնում է հետազոտությունը, պլանը, կոնտենտը, ձայնը, հրապարակումը և learn loop-ը մեկ համակարգի մեջ։",
    finalCta: "Բացել Marketing OS",
  },
  en: {
    navProduct: "System",
    navArmenian: "Armenian",
    navUseCases: "For business",
    navPricing: "Pricing",
    openStudio: "Open HAY",
    eyebrow: "ARMENIAN-FIRST MARKETING INTELLIGENCE",
    heroLead: "An AI marketing team",
    heroAccent: "that thinks in Armenian.",
    heroBody: "HAY analyzes your business and competitors, builds strategy, creates natural Armenian content, prepares voice and video, publishes, and learns from real outcomes.",
    start: "Start free",
    seeSystem: "Explore the system",
    proofQuality: "Armenian is a release gate, not a prompt",
    proofModes: "Standard · Natural · Yerevan · Western",
    proofLoop: "Strategy → Create → Publish → Learn",
    proofChannels: "Instagram · TikTok · YouTube",
    commandLabel: "HAY / TODAY",
    commandTitle: "Today HAY is operating your marketing system.",
    commandOne: "New competitor offer analyzed",
    commandTwo: "Today's Reel is ready for approval",
    commandThree: "Best publishing window calculated",
    commandFour: "Conversion Bridge connects content to outcomes",
    sectionEyebrow: "ONE OPERATING LOOP",
    sectionTitle: "Not another AI tool. One connected marketing operating system.",
    sectionBody: "HAY keeps business context, remembers previous content, avoids repetition, and uses each cycle's real data to make the next decision better.",
    armenianEyebrow: "HAY LANGUAGE LAYER",
    armenianTitle: "Armenian is a first-class product requirement.",
    armenianBody: "Display text and spoken text are separate layers. Numbers, currencies, brands, Armenian suffixes and code-switching are controlled before speech reaches a provider. HAY renders Armenian typography itself instead of asking an image model to guess it.",
    benchmarkLabel: "QUALITY CONTROL",
    benchmarkTitle: "Every release passes an Armenian regression suite.",
    benchmarkBody: "That is an internal regression gate, not a claim to be the world's best AI. The next proof layer is a native-speaker blind benchmark against Gemini, ElevenLabs, Azure and other providers.",
    useEyebrow: "BUILT TO SELL",
    useTitle: "Early customers should buy an outcome, not software.",
    useBody: "HAY can be sold as an Armenian marketing department in a box — from intelligence and content to publishing and attribution.",
    pricingEyebrow: "PRICING / ARMENIA",
    pricingTitle: "Start small. Let HAY scale with the business.",
    perMonth: "/ month",
    choose: "Choose",
    agency: "Agency / Enterprise",
    agencyBody: "15+ brands, white-label, custom limits, onboarding and API.",
    from: "from",
    finalEyebrow: "HAY / GO LIVE",
    finalTitle: "Armenian businesses should not have to translate themselves for AI.",
    finalBody: "Connect the business. HAY brings research, planning, content, voice, publishing and the learning loop into one system.",
    finalCta: "Open Marketing OS",
  },
  ru: {
    navProduct: "Система",
    navArmenian: "Армянский",
    navUseCases: "Для бизнеса",
    navPricing: "Цены",
    openStudio: "Открыть HAY",
    eyebrow: "ARMENIAN-FIRST MARKETING INTELLIGENCE",
    heroLead: "AI-маркетинговая команда,",
    heroAccent: "которая думает по-армянски.",
    heroBody: "HAY анализирует бизнес и конкурентов, строит стратегию, создаёт естественный армянский контент, готовит голос и видео, публикует и учится на реальных результатах.",
    start: "Начать бесплатно",
    seeSystem: "Посмотреть систему",
    proofQuality: "Армянский — release gate, а не prompt",
    proofModes: "Standard · Natural · Yerevan · Western",
    proofLoop: "Strategy → Create → Publish → Learn",
    proofChannels: "Instagram · TikTok · YouTube",
    commandLabel: "HAY / TODAY",
    commandTitle: "Сегодня HAY ведёт маркетинг бизнеса как система.",
    commandOne: "Новое предложение конкурента проанализировано",
    commandTwo: "Сегодняшний Reel готов к approval",
    commandThree: "Лучшее окно публикации рассчитано",
    commandFour: "Conversion Bridge связывает контент с результатом",
    sectionEyebrow: "ONE OPERATING LOOP",
    sectionTitle: "Не ещё один AI-инструмент. Одна связанная маркетинговая система.",
    sectionBody: "HAY хранит контекст бизнеса, помнит прошлый контент, не повторяется и после каждого цикла использует реальные данные для следующего решения.",
    armenianEyebrow: "HAY LANGUAGE LAYER",
    armenianTitle: "Армянский здесь — требование к продукту первого уровня.",
    armenianBody: "Текст на экране и текст для речи — разные слои. Числа, валюты, бренды, армянские окончания и code-switch контролируются до передачи speech-provider. Армянскую типографику HAY рендерит сам, а не просит image model угадывать буквы.",
    benchmarkLabel: "QUALITY CONTROL",
    benchmarkTitle: "Каждый релиз проходит армянский regression suite.",
    benchmarkBody: "Это внутренний regression gate, а не заявление «лучший AI в мире». Следующий слой доказательств — слепой benchmark с носителями языка против Gemini, ElevenLabs, Azure и других provider-ов.",
    useEyebrow: "BUILT TO SELL",
    useTitle: "Первые клиенты должны покупать результат, а не software.",
    useBody: "HAY можно продавать как готовый армянский маркетинговый отдел: от анализа и контента до публикации и attribution.",
    pricingEyebrow: "PRICING / ARMENIA",
    pricingTitle: "Начни с малого. HAY растёт вместе с бизнесом.",
    perMonth: "/ месяц",
    choose: "Выбрать",
    agency: "Agency / Enterprise",
    agencyBody: "15+ брендов, white-label, custom limits, onboarding и API.",
    from: "от",
    finalEyebrow: "HAY / GO LIVE",
    finalTitle: "Армянский бизнес не должен переводить себя для AI.",
    finalBody: "Подключи бизнес. HAY собирает исследование, планирование, контент, голос, публикацию и learn loop в одной системе.",
    finalCta: "Открыть Marketing OS",
  },
} as const;

const loop = [
  ["01", "UNDERSTAND", "Business + competitor intelligence"],
  ["02", "DECIDE", "Campaign Brain + content strategy"],
  ["03", "CREATE", "Reels · posts · captions · voice"],
  ["04", "APPROVE", "Human review + publishing policy"],
  ["05", "PUBLISH", "Smart Calendar + social channels"],
  ["06", "LEARN", "Performance memory + attribution"],
] as const;

const useCases = [
  { id: "01", title: "LOCAL BUSINESS", text: "Restaurants · hotels · clinics · retail", meta: "Always-on Armenian content + campaign planning" },
  { id: "02", title: "CREATOR / FOUNDER", text: "Reels · captions · voice · content memory", meta: "A consistent Armenian voice without a full SMM team" },
  { id: "03", title: "AGENCY", text: "Multi-business workspace · approvals · analytics", meta: "Run multiple Armenian brands from one operating layer" },
] as const;

const qualityModes = [
  ["STANDARD", "Գրական և կայուն"],
  ["NATURAL", "Բնական խոսակցական"],
  ["YEREVAN", "Թեթև երևանյան խոսք"],
  ["WESTERN", "Արևմտահայերեն շերտ"],
] as const;

function amd(value: number) {
  return value === 0 ? "0 ֏" : `${value.toLocaleString("en-US")} ֏`;
}

export default function LandingPageV4() {
  const [locale, setLocale] = useState<Locale>("hy");
  const t = copy[locale];

  return (
    <main className="hayLandingV4">
      <div className="hl4Aura hl4AuraOne" aria-hidden="true" />
      <div className="hl4Aura hl4AuraTwo" aria-hidden="true" />
      <div className="hl4Grain" aria-hidden="true" />

      <header className="hl4Nav">
        <a href="/" className="hl4Brand" aria-label="HAY Engine home"><HayLogo /></a>
        <nav className="hl4NavLinks" aria-label="Primary navigation">
          <a href="#system">{t.navProduct}</a>
          <a href="#armenian">{t.navArmenian}</a>
          <a href="#business">{t.navUseCases}</a>
          <a href="#pricing">{t.navPricing}</a>
        </nav>
        <div className="hl4NavActions">
          <div className="hl4Locale" aria-label="Language selector">
            {(["hy", "en", "ru"] as Locale[]).map((item) => (
              <button key={item} type="button" className={locale === item ? "active" : ""} onClick={() => setLocale(item)}>{item.toUpperCase()}</button>
            ))}
          </div>
          <a href="/studio" className="hl4NavCta">{t.openStudio}<span>↗</span></a>
        </div>
      </header>

      <section className="hl4Hero">
        <div className="hl4HeroCopy">
          <div className="hl4Eyebrow"><span>Հ</span>{t.eyebrow}</div>
          <h1><span>{t.heroLead}</span><strong>{t.heroAccent}</strong></h1>
          <p>{t.heroBody}</p>
          <div className="hl4HeroActions">
            <a href="/studio?plan=free" className="hl4Primary">{t.start}<span>↗</span></a>
            <a href="#system" className="hl4Ghost">{t.seeSystem}<span>↓</span></a>
          </div>
          <div className="hl4ProofGrid">
            {[t.proofQuality, t.proofModes, t.proofLoop, t.proofChannels].map((item, index) => (
              <div key={item}><span>0{index + 1}</span><p>{item}</p></div>
            ))}
          </div>
        </div>

        <div className="hl4CommandShell" aria-label="HAY operating system preview">
          <div className="hl4CommandHead"><span>{t.commandLabel}</span><b><i />LIVE SYSTEM</b></div>
          <div className="hl4CommandCore">
            <div className="hl4Monogram"><span>Հ</span><small>ARMENIAN<br />INTELLIGENCE</small></div>
            <div className="hl4Orbit" aria-hidden="true"><i /><i /><i /></div>
          </div>
          <h2>{t.commandTitle}</h2>
          <div className="hl4CommandRows">
            {[t.commandOne, t.commandTwo, t.commandThree, t.commandFour].map((item, index) => (
              <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p><b>{index === 1 ? "REVIEW" : index === 3 ? "MEASURE" : "READY"}</b></div>
            ))}
          </div>
          <div className="hl4CommandFoot"><span>CONTENT MEMORY</span><span>HUMAN GATES</span><span>FIRST-PARTY OUTCOMES</span></div>
        </div>
      </section>

      <section className="hl4Marquee" aria-label="HAY workflow">
        <div>{["ANALYZE", "STRATEGY", "CREATE", "APPROVE", "PUBLISH", "MEASURE", "LEARN", "REPEAT"].map((item) => <span key={item}><i />{item}</span>)}</div>
      </section>

      <section id="system" className="hl4Section hl4System">
        <div className="hl4SectionHead">
          <span>{t.sectionEyebrow}</span>
          <h2>{t.sectionTitle}</h2>
          <p>{t.sectionBody}</p>
        </div>
        <div className="hl4LoopGrid">
          {loop.map((item, index) => (
            <article key={item[1]} className={index === 2 || index === 5 ? "accent" : ""}>
              <div><span>{item[0]}</span><i /></div>
              <small>{item[1]}</small>
              <h3>{item[2]}</h3>
              <b>HAY / {item[1]}</b>
            </article>
          ))}
        </div>
      </section>

      <section id="armenian" className="hl4Section hl4Armenian">
        <div className="hl4ArmenianCopy">
          <span>{t.armenianEyebrow}</span>
          <h2>{t.armenianTitle}</h2>
          <p>{t.armenianBody}</p>
          <a href="/voice" className="hl4TextLink">VOICE LAB <b>↗</b></a>
        </div>
        <div className="hl4LanguageConsole">
          <div className="hl4LanguageTop"><span>HAY / LANGUAGE CONTROL</span><b>HY-AM</b></div>
          <div className="hl4Phrase">
            <small>DISPLAY</small>
            <strong>Քո բիզնեսը։ Քո բնական ձայնով։</strong>
          </div>
          <div className="hl4Divider" />
          <div className="hl4Modes">
            {qualityModes.map((mode, index) => (
              <div key={mode[0]} className={index === 1 ? "active" : ""}><span>0{index + 1}</span><b>{mode[0]}</b><p>{mode[1]}</p><i /></div>
            ))}
          </div>
          <div className="hl4LanguageFlags"><span>NUMBER SAFE</span><span>BRAND SUFFIX SAFE</span><span>CODE-SWITCH</span><span>TYPE LOCK</span></div>
        </div>
      </section>

      <section className="hl4Benchmark">
        <div><span>{t.benchmarkLabel}</span><h3>{t.benchmarkTitle}</h3></div>
        <p>{t.benchmarkBody}</p>
        <a href="/quality">OPEN QUALITY LAB <b>↗</b></a>
      </section>

      <section id="business" className="hl4Section hl4Business">
        <div className="hl4SectionHead compact">
          <span>{t.useEyebrow}</span>
          <h2>{t.useTitle}</h2>
          <p>{t.useBody}</p>
        </div>
        <div className="hl4UseGrid">
          {useCases.map((item) => (
            <article key={item.id}>
              <div><span>{item.id}</span><b>{item.title}</b></div>
              <h3>{item.text}</h3>
              <p>{item.meta}</p>
              <a href="/studio?plan=free">START WITH HAY <span>↗</span></a>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="hl4Section hl4Pricing">
        <div className="hl4SectionHead compact">
          <span>{t.pricingEyebrow}</span>
          <h2>{t.pricingTitle}</h2>
        </div>
        <div className="hl4PricingGrid">
          {HAY_PLANS.map((plan) => (
            <article key={plan.id} className={plan.id === "growth" ? "featured" : ""}>
              <div className="hl4PlanHead"><span>HAY / {plan.id.toUpperCase()}</span>{plan.badge && <em>{plan.badge}</em>}</div>
              <h3>{plan.name}</h3>
              <p>{plan.description[locale]}</p>
              <div className="hl4Price"><b>{amd(plan.priceAmd)}</b><span>{t.perMonth}</span></div>
              <ul>{plan.features[locale].map((feature) => <li key={feature}><i />{feature}</li>)}</ul>
              <a href={`/studio?plan=${plan.id}`}>{t.choose}<span>↗</span></a>
            </article>
          ))}
        </div>
        <div className="hl4Agency">
          <div><span>HAY / SCALE</span><h3>{t.agency}</h3></div>
          <p>{t.agencyBody}</p>
          <strong>{t.from} {amd(AGENCY_STARTING_AMD)} <small>{t.perMonth}</small></strong>
          <a href="/studio?plan=agency">TALK TO HAY <span>↗</span></a>
        </div>
      </section>

      <section className="hl4Final">
        <span>{t.finalEyebrow}</span>
        <h2>{t.finalTitle}</h2>
        <p>{t.finalBody}</p>
        <a href="/studio?plan=free">{t.finalCta}<b>↗</b></a>
      </section>

      <footer className="hl4Footer"><span>HAY ENGINE / ARMENIAN-FIRST MARKETING OS</span><span>YEREVAN · ARMENIA · 2026</span><span>HY / EN / RU</span></footer>
    </main>
  );
}
