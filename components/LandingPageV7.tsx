"use client";

import { useState } from "react";
import HayLogo from "./HayLogo";
import SocialBrandIcon from "./SocialBrandIcon";
import { AGENCY_STARTING_AMD, HAY_PLANS } from "@/lib/pricing";
import type { Locale } from "@/lib/hay/types";
import type { SocialPlatform } from "@/lib/marketing/types";

const channels: Array<{ platform: SocialPlatform; label: string }> = [
  { platform: "instagram", label: "Instagram" },
  { platform: "tiktok", label: "TikTok" },
  { platform: "youtube", label: "YouTube" },
  { platform: "facebook", label: "Facebook" },
];

const copy = {
  hy: {
    navProduct: "Ապրանք",
    navLanguage: "Հայերեն",
    navPricing: "Գներ",
    open: "Բացել HAY",
    eyebrow: "MARKETING SOFTWARE / BUILT IN ARMENIA",
    heroA: "Մարքեթինգը՝",
    heroB: "մեկ աշխատանքային համակարգում։",
    heroBody: "HAY-ը պահում է բրենդի կոնտեքստը, հետևում է շուկային, կառուցում է պլանը, ստեղծում է կոնտենտ և տանում է աշխատանքը մինչև հաստատում ու հրապարակում։",
    primary: "Սկսել անվճար",
    secondary: "Տեսնել համակարգը",
    note: "Առանց քարտի · վերջնական հաստատումը միշտ քո մոտ է",
    today: "ՕՐԻՆԱԿ / ARARAT HOUSE",
    status: "WORKSPACE",
    nextMove: "Հաջորդ քայլը",
    nextMoveText: "Ուրբաթ երեկոյի համար շեշտը տեղափոխել product proof-ի վրա և ուժեղացնել reservation CTA-ն։",
    review: "Պատրաստ է հաստատման",
    reviewText: "Reel · 12 sec · HY-AM",
    publish: "Հրապարակում",
    publishText: "Այսօր · 19:20",
    channels: "Ալիքներ",
    contextLabel: "BRAND CONTEXT",
    contextTitle: "HAY-ը սկսում է ոչ թե prompt-ից, այլ բիզնեսից։",
    contextBody: "Offer, tone, location, goals, competitors, performance history և այն, ինչ արդեն փորձել ես՝ մեկ շարունակական հիշողության մեջ։",
    workflowLabel: "WORKFLOW",
    workflowTitle: "Որոշումից մինչև հրապարակում՝ առանց հինգ տարբեր գործիքի։",
    workflow: [
      ["01", "Հասկանալ", "Բրենդ, շուկա, մրցակիցներ"],
      ["02", "Որոշել", "Հաջորդ լավագույն քայլը"],
      ["03", "Ստեղծել", "Copy, visual, voice, video"],
      ["04", "Հաստատել", "Մարդու վերջնական վերահսկողություն"],
      ["05", "Հրապարակել", "Schedule և direct publishing"],
      ["06", "Սովորել", "Արդյունքը դառնում է հաջորդ որոշման կոնտեքստ"],
    ],
    armenianLabel: "ARMENIAN LAYER",
    armenianTitle: "Հայերենը առանձին feature չէ։ Այն HAY-ի հիմքն է։",
    armenianBody: "Բրենդային բառեր, թվեր, արժույթներ, code-switching, spoken copy և արտասանություն մշակվում են որպես համակարգային լեզվական շերտ, ոչ թե վերջում ավելացված թարգմանություն։",
    written: "DISPLAY COPY",
    spoken: "SPOKEN COPY",
    writtenText: "Նոր համը արդեն այստեղ է։",
    spokenText: "Նոր համը արդեն ստեղ ա։ Արի փորձի։",
    productLabel: "ONE PRODUCT",
    productTitle: "Այն, ինչ սովորաբար բաժանված է թիմերի ու dashboard-ների միջև։",
    modules: [
      ["Ռազմավարություն", "Բիզնեսի կոնտեքստ, մրցակիցներ, արշավներ"],
      ["Կոնտենտ", "Posts, Reels, series և պատմություն"],
      ["Ձայն", "Բնական հայերեն խոսք և արտասանություն"],
      ["Հրապարակում", "Հաստատումներ, schedule և միացված ալիքներ"],
      ["Արդյունքներ", "Performance, experiments և հաջորդ որոշումներ"],
      ["API", "Լեզվական և product գործիքներ թիմերի համար"],
    ],
    pricingLabel: "PRICING",
    pricingTitle: "Սկսիր փոքրից։ Մեծացրու՝ երբ HAY-ը արդեն աշխատում է։",
    month: "/ ամիս",
    choose: "Ընտրել",
    agency: "Agency / Enterprise",
    agencyBody: "15+ բրենդ, թիմային approval, custom limits, white-label և API։",
    agencyCta: "Կապվել / Սկսել",
    from: "սկսած",
    finalLabel: "HAY",
    finalTitle: "Միացրու բիզնեսը մեկ անգամ։ Հետո աշխատիր նույն կոնտեքստի վրա ամեն օր։",
    finalBody: "Առաջին session-ից HAY-ը սկսում է հավաքել բիզնեսի հիշողությունը և կառուցել հաջորդ քայլերը։",
  },
  en: {
    navProduct: "Product",
    navLanguage: "Armenian",
    navPricing: "Pricing",
    open: "Open HAY",
    eyebrow: "MARKETING SOFTWARE / BUILT IN ARMENIA",
    heroA: "Marketing,",
    heroB: "inside one working system.",
    heroBody: "HAY keeps the brand context, watches the market, builds the plan, creates the content and carries the work through review and publishing.",
    primary: "Start free",
    secondary: "See the system",
    note: "No card · final approval always stays with you",
    today: "EXAMPLE / ARARAT HOUSE",
    status: "WORKSPACE",
    nextMove: "Next move",
    nextMoveText: "Shift Friday evening toward product proof and strengthen the reservation CTA.",
    review: "Ready for approval",
    reviewText: "Reel · 12 sec · HY-AM",
    publish: "Publishing",
    publishText: "Today · 19:20",
    channels: "Channels",
    contextLabel: "BRAND CONTEXT",
    contextTitle: "HAY starts with the business, not with a prompt.",
    contextBody: "Offer, tone, location, goals, competitors, performance history and what you already tried live in one continuous memory.",
    workflowLabel: "WORKFLOW",
    workflowTitle: "From decision to publishing without five separate tools.",
    workflow: [
      ["01", "Understand", "Brand, market and competitors"],
      ["02", "Decide", "The next best move"],
      ["03", "Create", "Copy, visual, voice and video"],
      ["04", "Approve", "Human final control"],
      ["05", "Publish", "Schedule and direct publishing"],
      ["06", "Learn", "The outcome becomes context for the next decision"],
    ],
    armenianLabel: "ARMENIAN LAYER",
    armenianTitle: "Armenian is not an extra feature. It is part of the system.",
    armenianBody: "Brand terms, numbers, currencies, code-switching, spoken copy and pronunciation are handled as a language layer — not as translation added at the end.",
    written: "DISPLAY COPY",
    spoken: "SPOKEN COPY",
    writtenText: "Նոր համը արդեն այստեղ է։",
    spokenText: "Նոր համը արդեն ստեղ ա։ Արի փորձի։",
    productLabel: "ONE PRODUCT",
    productTitle: "What is usually split across teams and dashboards.",
    modules: [
      ["Strategy", "Business context, competitors and campaigns"],
      ["Content", "Posts, Reels, series and history"],
      ["Voice", "Natural Armenian speech and pronunciation"],
      ["Publishing", "Approvals, schedules and connected channels"],
      ["Results", "Performance, experiments and next decisions"],
      ["API", "Language and product tools for teams"],
    ],
    pricingLabel: "PRICING",
    pricingTitle: "Start small. Scale when HAY is already working.",
    month: "/ month",
    choose: "Choose",
    agency: "Agency / Enterprise",
    agencyBody: "15+ brands, team approval, custom limits, white-label and API.",
    agencyCta: "Contact / Start",
    from: "from",
    finalLabel: "HAY",
    finalTitle: "Connect the business once. Keep working from the same context every day.",
    finalBody: "From the first session, HAY starts building business memory and the next useful actions.",
  },
  ru: {
    navProduct: "Продукт",
    navLanguage: "Армянский",
    navPricing: "Цены",
    open: "Открыть HAY",
    eyebrow: "MARKETING SOFTWARE / BUILT IN ARMENIA",
    heroA: "Маркетинг —",
    heroB: "в одной рабочей системе.",
    heroBody: "HAY хранит контекст бренда, следит за рынком, строит план, создаёт контент и ведёт работу до проверки и публикации.",
    primary: "Начать бесплатно",
    secondary: "Посмотреть систему",
    note: "Без карты · финальное подтверждение всегда остаётся у вас",
    today: "ПРИМЕР / ARARAT HOUSE",
    status: "WORKSPACE",
    nextMove: "Следующий шаг",
    nextMoveText: "На вечер пятницы сместить акцент на product proof и усилить CTA на бронирование.",
    review: "Готово к подтверждению",
    reviewText: "Reel · 12 sec · HY-AM",
    publish: "Публикация",
    publishText: "Сегодня · 19:20",
    channels: "Каналы",
    contextLabel: "BRAND CONTEXT",
    contextTitle: "HAY начинает с бизнеса, а не с prompt-а.",
    contextBody: "Offer, tone, location, цели, конкуренты, история performance и уже сделанные попытки живут в одной непрерывной памяти.",
    workflowLabel: "WORKFLOW",
    workflowTitle: "От решения до публикации без пяти разных инструментов.",
    workflow: [
      ["01", "Понять", "Бренд, рынок и конкуренты"],
      ["02", "Решить", "Следующее лучшее действие"],
      ["03", "Создать", "Copy, visual, voice и video"],
      ["04", "Подтвердить", "Финальный контроль человека"],
      ["05", "Опубликовать", "Schedule и direct publishing"],
      ["06", "Учесть результат", "Результат становится контекстом следующего решения"],
    ],
    armenianLabel: "ARMENIAN LAYER",
    armenianTitle: "Армянский — не дополнительная функция. Это слой системы.",
    armenianBody: "Брендовые слова, числа, валюты, code-switching, spoken copy и произношение обрабатываются как языковой слой, а не перевод в самом конце.",
    written: "DISPLAY COPY",
    spoken: "SPOKEN COPY",
    writtenText: "Նոր համը արդեն այստեղ է։",
    spokenText: "Նոր համը արդեն ստեղ ա։ Արի փորձի։",
    productLabel: "ONE PRODUCT",
    productTitle: "То, что обычно разбросано по командам и dashboard-ам.",
    modules: [
      ["Стратегия", "Контекст бизнеса, конкуренты и кампании"],
      ["Контент", "Posts, Reels, series и история"],
      ["Голос", "Естественная армянская речь и произношение"],
      ["Публикация", "Подтверждения, schedule и подключённые каналы"],
      ["Результаты", "Performance, experiments и следующие решения"],
      ["API", "Языковые и product-инструменты для команд"],
    ],
    pricingLabel: "PRICING",
    pricingTitle: "Начните с малого. Масштабируйте, когда HAY уже работает.",
    month: "/ месяц",
    choose: "Выбрать",
    agency: "Agency / Enterprise",
    agencyBody: "15+ брендов, командный approval, custom limits, white-label и API.",
    agencyCta: "Связаться / Начать",
    from: "от",
    finalLabel: "HAY",
    finalTitle: "Подключите бизнес один раз. Дальше работайте из одного контекста каждый день.",
    finalBody: "С первой сессии HAY начинает собирать память бизнеса и строить следующие полезные действия.",
  },
} as const;

function formatAmd(value:number){ return new Intl.NumberFormat("en-US").format(value); }

export default function LandingPageV7(){
  const [locale,setLocale]=useState<Locale>("hy");
  const t=copy[locale];

  return <main className="hayLandingV7">
    <header className="hv7Nav">
      <a className="hv7Brand" href="/" aria-label="HAY home"><HayLogo compact/></a>
      <nav>
        <a href="#product">{t.navProduct}</a>
        <a href="#armenian">{t.navLanguage}</a>
        <a href="#pricing">{t.navPricing}</a>
      </nav>
      <div className="hv7NavActions">
        <div className="hv7Locale">{(["hy","en","ru"] as Locale[]).map(item=><button key={item} className={locale===item?"active":""} onClick={()=>setLocale(item)}>{item==="hy"?"ՀԱՅ":item.toUpperCase()}</button>)}</div>
        <a className="hv7Open" href="/studio">{t.open}</a>
      </div>
    </header>

    <section className="hv7Hero" id="product">
      <div className="hv7HeroCopy">
        <span className="hv7Eyebrow">{t.eyebrow}</span>
        <h1><span>{t.heroA}</span><strong>{t.heroB}</strong></h1>
        <p>{t.heroBody}</p>
        <div className="hv7HeroActions"><a className="hv7Primary" href="/login?next=%2Fstudio">{t.primary}<span>↗</span></a><a className="hv7Secondary" href="#workflow">{t.secondary}</a></div>
        <small>{t.note}</small>
      </div>

      <div className="hv7Cockpit" aria-label="HAY workspace example">
        <header><div><span>{t.today}</span><b><i/>{t.status}</b></div><strong>WORKSPACE PREVIEW</strong></header>
        <section className="hv7Decision"><span>{t.nextMove}</span><h2>{t.nextMoveText}</h2><div><b>CONTEXT</b><p>Friday demand · competitor gap · previous Reel performance</p></div></section>
        <div className="hv7CockpitGrid">
          <article><span>{t.review}</span><strong>{t.reviewText}</strong><small>Caption + voice + visual ready</small></article>
          <article><span>{t.publish}</span><strong>{t.publishText}</strong><small>Approval required</small></article>
        </div>
        <footer><span>{t.channels}</span><div>{channels.map(item=><i key={item.platform} title={item.label}><SocialBrandIcon platform={item.platform} size={17} decorative/></i>)}</div><b>4 CHANNELS</b></footer>
      </div>
    </section>

    <section className="hv7Context">
      <div><span>{t.contextLabel}</span><h2>{t.contextTitle}</h2></div>
      <p>{t.contextBody}</p>
      <div className="hv7ContextRail"><span>OFFER</span><span>TONE</span><span>LOCATION</span><span>COMPETITORS</span><span>PERFORMANCE</span><span>MEMORY</span></div>
    </section>

    <section className="hv7Workflow" id="workflow">
      <header><span>{t.workflowLabel}</span><h2>{t.workflowTitle}</h2></header>
      <div>{t.workflow.map(([index,title,text])=><article key={index}><b>{index}</b><strong>{title}</strong><p>{text}</p></article>)}</div>
    </section>

    <section className="hv7Armenian" id="armenian">
      <div className="hv7ArmenianCopy"><span>{t.armenianLabel}</span><h2>{t.armenianTitle}</h2><p>{t.armenianBody}</p><div className="hv7ArmenianLinks"><a href="/language">Language ↗</a><a href="/voice">Voice ↗</a><a href="/quality">Quality ↗</a></div></div>
      <div className="hv7LanguageCard"><div><span>{t.written}</span><p>{t.writtenText}</p></div><div><span>{t.spoken}</span><p>{t.spokenText}</p></div><footer><b>HY-AM</b><span>brand-safe</span><span>pronunciation-aware</span><span>human-reviewable</span></footer></div>
    </section>

    <section className="hv7Modules">
      <header><span>{t.productLabel}</span><h2>{t.productTitle}</h2></header>
      <div>{t.modules.map(([title,text],index)=><article key={title}><b>{String(index+1).padStart(2,"0")}</b><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section className="hv7Pricing" id="pricing">
      <header><span>{t.pricingLabel}</span><h2>{t.pricingTitle}</h2></header>
      <div className="hv7PlanGrid">{HAY_PLANS.map(plan=><article key={plan.id} className={plan.id==="growth"?"featured":""}><div><span>{plan.name}</span>{plan.badge&&<b>{plan.badge}</b>}</div><p>{plan.description[locale]}</p><strong>{plan.priceAmd?`${formatAmd(plan.priceAmd)} ֏`:"0 ֏"}<small>{t.month}</small></strong><ul>{plan.features[locale].slice(0,5).map(feature=><li key={feature}>{feature}</li>)}</ul><a href={`/login?next=%2Fstudio&plan=${plan.id}`}>{t.choose}<span>↗</span></a></article>)}</div>
      <div className="hv7Agency"><div><span>{t.agency}</span><p>{t.agencyBody}</p></div><strong>{t.from} {formatAmd(AGENCY_STARTING_AMD)} ֏</strong><a href="/login?next=%2Fstudio&plan=agency">{t.agencyCta} ↗</a></div>
    </section>

    <section className="hv7Final"><div><span>{t.finalLabel}</span><h2>{t.finalTitle}</h2><p>{t.finalBody}</p></div><a href="/login?next=%2Fstudio">{t.open}<span>↗</span></a></section>

    <footer className="hv7Footer"><span>HAY ENGINE · YEREVAN / 2026</span><div><a href="/developers">API</a><a href="/benchmark">Benchmark</a><a href="/corrections">Corrections</a></div><span>MARKETING SOFTWARE · ARMENIAN LANGUAGE LAYER</span></footer>
  </main>;
}
