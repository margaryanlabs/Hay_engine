"use client";

import { useMemo, useState } from "react";
import HayLogo from "./HayLogo";
import { AGENCY_STARTING_AMD, HAY_PLANS } from "@/lib/pricing";
import type { Locale } from "@/lib/hay/types";

type Audience = "business" | "creator" | "agency";

const copy = {
  hy: {
    navProduct: "Ինչ է անում",
    navArmenian: "Հայերեն",
    navForYou: "Ում համար",
    navPricing: "Գներ",
    open: "Բացել HAY-ը",
    badge: "AI MARKETING AUTOPILOT · ARMENIA",
    heroA: "Դու վարիր բիզնեսը։",
    heroB: "Մարքեթինգը թող վարի HAY-ը։",
    heroBody: "Միացրու բիզնեսը մեկ անգամ։ HAY-ը հետևում է շուկային, պլանավորում է շաբաթը, ստեղծում է բնական հայերեն կոնտենտ, պատրաստում է ձայն ու վիդեո, սպասում է approval-ին, հրապարակում և սովորում արդյունքներից։",
    start: "Սկսել անվճար",
    watch: "Տեսնել՝ ինչպես է աշխատում",
    noCard: "Առանց քարտի · 1 բիզնես · կարող ես կանգնեցնել ցանկացած պահի",
    live: "HAY LIVE",
    today: "Այսօրվա մարքեթինգը արդեն շարժման մեջ է",
    signal1: "Մրցակիցը փոխել է առաջարկը",
    action1: "HAY-ը թարմացրել է այս շաբաթվա angle-ը",
    signal2: "Reel-ը պատրաստ է",
    action2: "Բնական հայերեն voice + subtitles + CTA",
    signal3: "Հրապարակման պատուհան",
    action3: "Այսօր 19:20 · Instagram + TikTok",
    approve: "APPROVE",
    ready: "READY",
    scheduled: "SCHEDULED",
    socialTitle: "Քո սուրճը միայն առավոտվա համար չէ։",
    socialMeta: "HAY ստեղծել է · Natural HY · 12s Reel",
    flowEyebrow: "ONE INPUT → A WORKING WEEK",
    flowTitle: "Մի URL-ից՝ ամբողջ շաբաթվա մարքեթինգ։",
    flowBody: "HAY-ը չի տալիս պարզապես գաղափարների ցուցակ։ Այն հավաքում է կոնտեքստը, որոշում է ինչ ասել, պատրաստում է asset-ները և պահում է ամեն ինչ մեկ գործող workflow-ում։",
    connect: "01 / CONNECT",
    connectTitle: "Տուր կայքը կամ Instagram-ը",
    connectText: "Բիզնես, առաջարկ, tone, վայր, մրցակիցներ։",
    decide: "02 / DECIDE",
    decideTitle: "HAY-ը որոշում է ինչ անել",
    decideText: "Campaign angle, content mix, timing, experiments։",
    create: "03 / CREATE",
    createTitle: "Ստեղծում է պատրաստ կոնտենտ",
    createText: "Reels, posts, captions, Armenian voice, subtitles։",
    operate: "04 / OPERATE",
    operateTitle: "Դու approve ես անում, HAY-ը շարունակում է",
    operateText: "Schedule, publish, attribution, memory, next move։",
    languageEyebrow: "BUILT FOR HOW ARMENIA ACTUALLY SPEAKS",
    languageTitleA: "Հայերենը այստեղ",
    languageTitleB: "ֆունկցիա չէ։ Բնավորություն է։",
    languageBody: "HAY-ը տարբերում է գրական, բնական խոսակցական, թեթև երևանյան և արևմտահայերեն շերտերը։ Բրենդները, թվերը, արժույթները և code-switch-ը պահվում են ճիշտ, իսկ վիզուալի հայկական տեքստը չի թողնվում image model-ի պատահականությանը։",
    display: "DISPLAY COPY",
    spoken: "SPOKEN VERSION",
    displayText: "Նոր համը արդեն այստեղ է։",
    spokenText: "Նոր համը արդեն ստեղ ա։ Արի փորձի։",
    preserved: "Meaning preserved · brand safe · human review ready",
    audienceEyebrow: "ONE ENGINE · THREE WAYS TO USE IT",
    audienceTitle: "HAY-ը հարմարվում է նրան, թե ինչպես ես աշխատում։",
    business: "Բիզնես",
    creator: "Creator",
    agency: "Agency",
    businessHeadline: "Մարքեթինգային բաժին՝ առանց մարքեթինգային բաժին հավաքելու։",
    businessText: "Ռեստորան, հյուրանոց, կլինիկա, խանութ կամ ծառայություն — HAY-ը պահում է ռիթմը ամեն օր։",
    creatorHeadline: "Քո ձայնը, բայց առանց ամեն օր դատարկ էջից սկսելու։",
    creatorText: "Ideas → scripts → Armenian voice → captions → publishing rhythm՝ մեկ memory-ի մեջ։",
    agencyHeadline: "Մի քանի բրենդ՝ մեկ operating layer-ից։",
    agencyText: "Workspace, approvals, calendars, campaigns, attribution և reusable brand memory։",
    metric1: "շաբաթական plan",
    metric2: "կոնտենտի հիշողություն",
    metric3: "approval gate",
    metric4: "արդյունքից սովորող loop",
    pricingEyebrow: "START SMALL · SCALE WHEN IT WORKS",
    pricingTitle: "Գինը պետք է փոքր լինի այն աշխատանքի համեմատ, որը HAY-ը վերցնում է իր վրա։",
    perMonth: "/ ամիս",
    choose: "Ընտրել",
    agencyPlan: "Agency / Enterprise",
    agencyBody: "15+ բրենդ, white-label, custom limits, onboarding և API։",
    from: "սկսած",
    finalEyebrow: "HAY / READY WHEN YOU ARE",
    finalTitle: "Վաղվա կոնտենտը պետք չէ վաղը մտածել։",
    finalBody: "Միացրու բիզնեսը այսօր։ HAY-ը սկսում է հասկանալ, պլանավորել և պատրաստել հաջորդ քայլերը հենց առաջին session-ից։",
    finalCta: "Բացել HAY-ը",
  },
  en: {
    navProduct: "What it does",
    navArmenian: "Armenian",
    navForYou: "For you",
    navPricing: "Pricing",
    open: "Open HAY",
    badge: "AI MARKETING AUTOPILOT · ARMENIA",
    heroA: "Run the business.",
    heroB: "Let HAY run the marketing.",
    heroBody: "Connect the business once. HAY watches the market, plans the week, creates native Armenian content, prepares voice and video, waits for approval, publishes, and learns from outcomes.",
    start: "Start free",
    watch: "See how it works",
    noCard: "No card · 1 business · stop anytime",
    live: "HAY LIVE",
    today: "Today's marketing is already moving",
    signal1: "A competitor changed its offer",
    action1: "HAY refreshed this week's angle",
    signal2: "The Reel is ready",
    action2: "Natural Armenian voice + subtitles + CTA",
    signal3: "Publishing window",
    action3: "Today 19:20 · Instagram + TikTok",
    approve: "APPROVE",
    ready: "READY",
    scheduled: "SCHEDULED",
    socialTitle: "Your coffee isn't only for the morning.",
    socialMeta: "Created by HAY · Natural HY · 12s Reel",
    flowEyebrow: "ONE INPUT → A WORKING WEEK",
    flowTitle: "One URL becomes a working week of marketing.",
    flowBody: "HAY does not hand you a list of ideas. It gathers context, decides what to say, prepares the assets and keeps everything inside one operating workflow.",
    connect: "01 / CONNECT",
    connectTitle: "Give HAY the site or Instagram",
    connectText: "Business, offer, tone, location and competitors.",
    decide: "02 / DECIDE",
    decideTitle: "HAY decides what should happen next",
    decideText: "Campaign angle, content mix, timing and experiments.",
    create: "03 / CREATE",
    createTitle: "It creates publishable content",
    createText: "Reels, posts, captions, Armenian voice and subtitles.",
    operate: "04 / OPERATE",
    operateTitle: "You approve. HAY keeps operating.",
    operateText: "Schedule, publish, attribution, memory and the next move.",
    languageEyebrow: "BUILT FOR HOW ARMENIA ACTUALLY SPEAKS",
    languageTitleA: "Armenian here is not",
    languageTitleB: "a feature. It is the personality.",
    languageBody: "HAY separates formal, natural spoken, light Yerevan and Western Armenian modes. Brands, numbers, currencies and code-switching stay protected, while Armenian typography is rendered deterministically instead of being left to an image model.",
    display: "DISPLAY COPY",
    spoken: "SPOKEN VERSION",
    displayText: "Նոր համը արդեն այստեղ է։",
    spokenText: "Նոր համը արդեն ստեղ ա։ Արի փորձի։",
    preserved: "Meaning preserved · brand safe · human review ready",
    audienceEyebrow: "ONE ENGINE · THREE WAYS TO USE IT",
    audienceTitle: "HAY adapts to the way you work.",
    business: "Business",
    creator: "Creator",
    agency: "Agency",
    businessHeadline: "A marketing department without assembling a marketing department.",
    businessText: "Restaurant, hotel, clinic, shop or service — HAY keeps the marketing rhythm moving every day.",
    creatorHeadline: "Your voice, without starting from a blank page every day.",
    creatorText: "Ideas → scripts → Armenian voice → captions → publishing rhythm inside one memory.",
    agencyHeadline: "Multiple brands from one operating layer.",
    agencyText: "Workspaces, approvals, calendars, campaigns, attribution and reusable brand memory.",
    metric1: "weekly plan",
    metric2: "content memory",
    metric3: "approval gate",
    metric4: "outcome learning loop",
    pricingEyebrow: "START SMALL · SCALE WHEN IT WORKS",
    pricingTitle: "The price should feel small next to the work HAY takes off the team's plate.",
    perMonth: "/ month",
    choose: "Choose",
    agencyPlan: "Agency / Enterprise",
    agencyBody: "15+ brands, white-label, custom limits, onboarding and API.",
    from: "from",
    finalEyebrow: "HAY / READY WHEN YOU ARE",
    finalTitle: "Tomorrow's content should not be invented tomorrow.",
    finalBody: "Connect the business today. HAY starts understanding, planning and preparing the next moves from the first session.",
    finalCta: "Open HAY",
  },
  ru: {
    navProduct: "Что делает",
    navArmenian: "Армянский",
    navForYou: "Для кого",
    navPricing: "Цены",
    open: "Открыть HAY",
    badge: "AI MARKETING AUTOPILOT · ARMENIA",
    heroA: "Ты веди бизнес.",
    heroB: "Маркетинг пусть ведёт HAY.",
    heroBody: "Подключи бизнес один раз. HAY следит за рынком, планирует неделю, создаёт естественный армянский контент, готовит голос и видео, ждёт approval, публикует и учится на результатах.",
    start: "Начать бесплатно",
    watch: "Посмотреть, как работает",
    noCard: "Без карты · 1 бизнес · можно остановить в любой момент",
    live: "HAY LIVE",
    today: "Сегодняшний маркетинг уже в движении",
    signal1: "Конкурент изменил предложение",
    action1: "HAY обновил angle этой недели",
    signal2: "Reel готов",
    action2: "Естественный армянский voice + subtitles + CTA",
    signal3: "Окно публикации",
    action3: "Сегодня 19:20 · Instagram + TikTok",
    approve: "APPROVE",
    ready: "READY",
    scheduled: "SCHEDULED",
    socialTitle: "Кофе нужен не только утром.",
    socialMeta: "Создано HAY · Natural HY · 12s Reel",
    flowEyebrow: "ONE INPUT → A WORKING WEEK",
    flowTitle: "Один URL превращается в рабочую маркетинговую неделю.",
    flowBody: "HAY не отдаёт тебе очередной список идей. Он собирает контекст, решает что говорить, готовит assets и держит всё в одном рабочем процессе.",
    connect: "01 / CONNECT",
    connectTitle: "Дай сайт или Instagram",
    connectText: "Бизнес, предложение, tone, локация и конкуренты.",
    decide: "02 / DECIDE",
    decideTitle: "HAY решает, что делать дальше",
    decideText: "Campaign angle, content mix, timing и experiments.",
    create: "03 / CREATE",
    createTitle: "Создаёт готовый контент",
    createText: "Reels, posts, captions, армянский voice и subtitles.",
    operate: "04 / OPERATE",
    operateTitle: "Ты approve — HAY продолжает работать",
    operateText: "Schedule, publish, attribution, memory и следующий шаг.",
    languageEyebrow: "BUILT FOR HOW ARMENIA ACTUALLY SPEAKS",
    languageTitleA: "Армянский здесь —",
    languageTitleB: "не функция. Это характер продукта.",
    languageBody: "HAY различает литературный, естественный разговорный, лёгкий ереванский и западноармянский слои. Бренды, числа, валюты и code-switch сохраняются, а армянская типографика не оставляется на волю image model.",
    display: "DISPLAY COPY",
    spoken: "SPOKEN VERSION",
    displayText: "Նոր համը արդեն այստեղ է։",
    spokenText: "Նոր համը արդեն ստեղ ա։ Արի փորձի։",
    preserved: "Meaning preserved · brand safe · human review ready",
    audienceEyebrow: "ONE ENGINE · THREE WAYS TO USE IT",
    audienceTitle: "HAY подстраивается под то, как работаешь ты.",
    business: "Бизнес",
    creator: "Creator",
    agency: "Agency",
    businessHeadline: "Маркетинговый отдел без необходимости собирать маркетинговый отдел.",
    businessText: "Ресторан, отель, клиника, магазин или сервис — HAY каждый день держит маркетинг в ритме.",
    creatorHeadline: "Твой голос, но без пустой страницы каждое утро.",
    creatorText: "Ideas → scripts → армянский voice → captions → publishing rhythm в одной памяти.",
    agencyHeadline: "Несколько брендов из одного operating layer.",
    agencyText: "Workspaces, approvals, calendars, campaigns, attribution и reusable brand memory.",
    metric1: "план на неделю",
    metric2: "память контента",
    metric3: "approval gate",
    metric4: "обучение на результате",
    pricingEyebrow: "START SMALL · SCALE WHEN IT WORKS",
    pricingTitle: "Цена должна быть маленькой по сравнению с работой, которую HAY снимает с команды.",
    perMonth: "/ месяц",
    choose: "Выбрать",
    agencyPlan: "Agency / Enterprise",
    agencyBody: "15+ брендов, white-label, custom limits, onboarding и API.",
    from: "от",
    finalEyebrow: "HAY / READY WHEN YOU ARE",
    finalTitle: "Контент на завтра не надо придумывать завтра.",
    finalBody: "Подключи бизнес сегодня. HAY начинает понимать, планировать и готовить следующие шаги уже с первой сессии.",
    finalCta: "Открыть HAY",
  },
} as const;

const workflowKeys = [
  ["connect", "connectTitle", "connectText"],
  ["decide", "decideTitle", "decideText"],
  ["create", "createTitle", "createText"],
  ["operate", "operateTitle", "operateText"],
] as const;

function amd(value: number) {
  return value === 0 ? "0 ֏" : `${value.toLocaleString("en-US")} ֏`;
}

export default function LandingPageV5() {
  const [locale, setLocale] = useState<Locale>("hy");
  const [audience, setAudience] = useState<Audience>("business");
  const t = copy[locale];

  const audienceContent = useMemo(() => {
    if (audience === "creator") return { title: t.creatorHeadline, text: t.creatorText, code: "02" };
    if (audience === "agency") return { title: t.agencyHeadline, text: t.agencyText, code: "03" };
    return { title: t.businessHeadline, text: t.businessText, code: "01" };
  }, [audience, t]);

  return (
    <main className="hayLandingV5">
      <header className="hv5Nav">
        <a className="hv5Brand" href="/" aria-label="HAY Engine home"><HayLogo /></a>
        <nav className="hv5NavLinks" aria-label="Primary navigation">
          <a href="#product">{t.navProduct}</a>
          <a href="#armenian">{t.navArmenian}</a>
          <a href="#audience">{t.navForYou}</a>
          <a href="#pricing">{t.navPricing}</a>
        </nav>
        <div className="hv5NavRight">
          <div className="hv5Locale">
            {(["hy", "en", "ru"] as Locale[]).map(item => (
              <button type="button" key={item} className={locale === item ? "active" : ""} onClick={() => setLocale(item)}>{item.toUpperCase()}</button>
            ))}
          </div>
          <a className="hv5Open" href="/studio">{t.open}<span>↗</span></a>
        </div>
      </header>

      <section className="hv5Hero">
        <div className="hv5HeroGlow" aria-hidden="true" />
        <div className="hv5HeroCopy">
          <div className="hv5Badge"><i />{t.badge}</div>
          <h1><span>{t.heroA}</span><strong>{t.heroB}</strong></h1>
          <p>{t.heroBody}</p>
          <div className="hv5HeroActions">
            <a href="/studio?plan=free" className="hv5Primary">{t.start}<span>↗</span></a>
            <a href="#product" className="hv5Secondary">{t.watch}<span>↓</span></a>
          </div>
          <small className="hv5NoCard">{t.noCard}</small>
        </div>

        <div className="hv5HeroStage" aria-label="HAY live marketing preview">
          <div className="hv5StageTop"><span><i />{t.live}</span><b>YEREVAN · 19:34</b></div>
          <div className="hv5StageTitle"><small>TODAY</small><h2>{t.today}</h2></div>
          <div className="hv5Timeline">
            <article><time>09:12</time><div><b>{t.signal1}</b><p>{t.action1}</p></div><span>{t.ready}</span></article>
            <article className="current"><time>13:40</time><div><b>{t.signal2}</b><p>{t.action2}</p></div><button type="button">{t.approve}</button></article>
            <article><time>19:20</time><div><b>{t.signal3}</b><p>{t.action3}</p></div><span>{t.scheduled}</span></article>
          </div>
          <div className="hv5SocialCard">
            <div className="hv5SocialVisual"><span>Հ</span><div className="hv5Wave">{Array.from({length: 22}).map((_, i) => <i key={i} />)}</div></div>
            <div className="hv5SocialCopy"><small>REEL / HY-AM</small><strong>{t.socialTitle}</strong><p>{t.socialMeta}</p></div>
          </div>
        </div>
      </section>

      <section className="hv5TrustStrip" aria-label="HAY capabilities">
        <span>COMPETITOR INTELLIGENCE</span><i />
        <span>CAMPAIGN BRAIN</span><i />
        <span>ARMENIAN VOICE</span><i />
        <span>CONTENT MEMORY</span><i />
        <span>PUBLISHING</span><i />
        <span>ATTRIBUTION</span>
      </section>

      <section id="product" className="hv5Section hv5Flow">
        <div className="hv5SectionIntro">
          <span>{t.flowEyebrow}</span>
          <h2>{t.flowTitle}</h2>
          <p>{t.flowBody}</p>
        </div>
        <div className="hv5FlowRail">
          {workflowKeys.map((keys, index) => (
            <article key={keys[0]} className={index === 2 ? "featured" : ""}>
              <div className="hv5FlowIndex"><span>{t[keys[0]]}</span><b>0{index + 1}</b></div>
              <div className="hv5FlowArt" aria-hidden="true">
                {index === 0 && <><div className="hv5UrlBar">https://your-business.am</div><div className="hv5ScanLines"><i /><i /><i /></div></>}
                {index === 1 && <div className="hv5DecisionOrb"><span>HAY</span><i /><i /><i /></div>}
                {index === 2 && <div className="hv5AssetStack"><i /><i /><i /><b>REEL</b></div>}
                {index === 3 && <div className="hv5OperateDots">{[1,2,3,4,5,6].map(n => <i key={n} />)}<b>LIVE</b></div>}
              </div>
              <h3>{t[keys[1]]}</h3>
              <p>{t[keys[2]]}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="armenian" className="hv5Language">
        <div className="hv5LanguageCopy">
          <span>{t.languageEyebrow}</span>
          <h2>{t.languageTitleA}<strong>{t.languageTitleB}</strong></h2>
          <p>{t.languageBody}</p>
          <a href="/voice">VOICE LAB <span>↗</span></a>
        </div>
        <div className="hv5LanguageDemo">
          <div className="hv5LanguageLabel"><span>HAY LANGUAGE LAYER</span><b>HY-AM</b></div>
          <div className="hv5LanguagePair">
            <div><small>{t.display}</small><p>{t.displayText}</p><span>STANDARD</span></div>
            <i>→</i>
            <div className="spoken"><small>{t.spoken}</small><p>{t.spokenText}</p><span>NATURAL / YEREVAN</span></div>
          </div>
          <div className="hv5LanguageFoot"><i /><span>{t.preserved}</span></div>
        </div>
      </section>

      <section id="audience" className="hv5Section hv5Audience">
        <div className="hv5SectionIntro compact">
          <span>{t.audienceEyebrow}</span>
          <h2>{t.audienceTitle}</h2>
        </div>
        <div className="hv5AudienceShell">
          <div className="hv5AudienceTabs">
            {(["business", "creator", "agency"] as Audience[]).map((item) => (
              <button type="button" key={item} onClick={() => setAudience(item)} className={audience === item ? "active" : ""}>
                <span>0{item === "business" ? 1 : item === "creator" ? 2 : 3}</span>{t[item]}
              </button>
            ))}
          </div>
          <div className="hv5AudienceBody">
            <div className="hv5AudienceCopy"><small>HAY / MODE {audienceContent.code}</small><h3>{audienceContent.title}</h3><p>{audienceContent.text}</p><a href="/studio?plan=free">START WITH HAY <span>↗</span></a></div>
            <div className="hv5AudienceMetrics">
              {[t.metric1, t.metric2, t.metric3, t.metric4].map((item, index) => <div key={item}><span>0{index + 1}</span><p>{item}</p><i /></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="hv5Section hv5Pricing">
        <div className="hv5SectionIntro pricing">
          <span>{t.pricingEyebrow}</span>
          <h2>{t.pricingTitle}</h2>
        </div>
        <div className="hv5Plans">
          {HAY_PLANS.map(plan => (
            <article key={plan.id} className={plan.id === "growth" ? "featured" : ""}>
              <div className="hv5PlanTop"><span>HAY / {plan.id.toUpperCase()}</span>{plan.badge && <em>{plan.badge}</em>}</div>
              <h3>{plan.name}</h3>
              <p>{plan.description[locale]}</p>
              <div className="hv5Price"><strong>{amd(plan.priceAmd)}</strong><span>{t.perMonth}</span></div>
              <ul>{plan.features[locale].slice(0,5).map(feature => <li key={feature}><i />{feature}</li>)}</ul>
              <a href={`/studio?plan=${plan.id}`}>{t.choose}<span>↗</span></a>
            </article>
          ))}
        </div>
        <div className="hv5AgencyPlan">
          <div><small>HAY / SCALE</small><h3>{t.agencyPlan}</h3><p>{t.agencyBody}</p></div>
          <strong>{t.from} {amd(AGENCY_STARTING_AMD)} <span>{t.perMonth}</span></strong>
          <a href="/studio?plan=agency">TALK TO HAY <span>↗</span></a>
        </div>
      </section>

      <section className="hv5Final">
        <div className="hv5FinalGlyph" aria-hidden="true">Հ</div>
        <span>{t.finalEyebrow}</span>
        <h2>{t.finalTitle}</h2>
        <p>{t.finalBody}</p>
        <a href="/studio?plan=free">{t.finalCta}<span>↗</span></a>
      </section>

      <footer className="hv5Footer"><span>HAY ENGINE</span><span>ARMENIAN-FIRST MARKETING OS · 2026</span><span>YEREVAN / HY · EN · RU</span></footer>
    </main>
  );
}
