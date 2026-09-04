"use client";

import { useEffect, useMemo, useState } from "react";
import HayLogo from "./HayLogo";
import PublishDialog from "./PublishDialog";
import SocialBrandIcon from "./SocialBrandIcon";
import { selectBusinessWorkspace } from "@/lib/studio/business-selection";
import type { BusinessProfile, CompetitorInput, ContentItem, MarketingPlan, SocialConnection, SocialPlatform } from "@/lib/marketing/types";
import type { Locale } from "@/lib/hay/types";

const copy = {
  hy: {
    eyebrow: "HAY STUDIO / ACTIVE WORKSPACE",
    titleA: "Այսօրվա մարքեթինգը։",
    titleB: "Մեկ տեղում, մեկ կոնտեքստով։",
    sub: "Բրենդը, մրցակիցները, կոնտենտը, հրապարակումները և արդյունքները աշխատում են որպես մեկ շարունակական համակարգ։",
    analyze: "Թարմացնել բիզնեսի պատկերը",
    plan: "Կառուցել հաջորդ 7 օրը",
    autopilot: "Autopilot",
    connections: "Ալիքներ",
    intelligence: "Brand position",
    calendar: "Content desk",
    competitors: "Competitors",
    context: "CONTEXT",
    decision: "DECISION",
    execution: "EXECUTION",
    contextText: "Բրենդ + շուկա + հիշողություն",
    decisionText: "Հաջորդ լավագույն քայլը",
    executionText: "Create → approve → publish",
    firstRun: "Սկզբում լրացրու բիզնեսի անունն ու կատեգորիան։",
  },
  en: {
    eyebrow: "HAY STUDIO / ACTIVE WORKSPACE",
    titleA: "Today’s marketing.",
    titleB: "One workspace, one context.",
    sub: "Brand context, competitors, content, publishing and outcomes operate as one continuous system.",
    analyze: "Refresh business picture",
    plan: "Build the next 7 days",
    autopilot: "Autopilot",
    connections: "Channels",
    intelligence: "Brand position",
    calendar: "Content desk",
    competitors: "Competitors",
    context: "CONTEXT",
    decision: "DECISION",
    execution: "EXECUTION",
    contextText: "Brand + market + memory",
    decisionText: "The next best move",
    executionText: "Create → approve → publish",
    firstRun: "Add the business name and category first.",
  },
  ru: {
    eyebrow: "HAY STUDIO / ACTIVE WORKSPACE",
    titleA: "Маркетинг на сегодня.",
    titleB: "Один workspace, один контекст.",
    sub: "Контекст бренда, конкуренты, контент, публикации и результаты работают как одна непрерывная система.",
    analyze: "Обновить картину бизнеса",
    plan: "Построить следующие 7 дней",
    autopilot: "Автопилот",
    connections: "Каналы",
    intelligence: "Позиция бренда",
    calendar: "Контент",
    competitors: "Конкуренты",
    context: "CONTEXT",
    decision: "DECISION",
    execution: "EXECUTION",
    contextText: "Бренд + рынок + память",
    decisionText: "Следующее лучшее действие",
    executionText: "Create → approve → publish",
    firstRun: "Сначала добавьте название и категорию бизнеса.",
  },
} as const;

const channels: Array<{ platform: SocialPlatform; label: string }> = [
  { platform: "instagram", label: "Instagram" },
  { platform: "tiktok", label: "TikTok" },
  { platform: "youtube", label: "YouTube" },
  { platform: "facebook", label: "Facebook" },
];

const emptyBusiness: BusinessProfile = {
  name: "",
  category: "",
  description: "",
  website: "",
  location: "Yerevan, Armenia",
  primaryLanguage: "hy",
  goals: [],
  audience: "",
  offer: "",
  tone: "",
};

const sampleBusiness: BusinessProfile = {
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
};

const wait = (ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
type WorkspaceMode="loading"|"account"|"preview";

export default function MarketingOSV7(){
  const [locale,setLocale]=useState<Locale>("hy");
  const [business,setBusiness]=useState<BusinessProfile>(emptyBusiness);
  const [businessId,setBusinessId]=useState<string|null>(null);
  const [workspaceMode,setWorkspaceMode]=useState<WorkspaceMode>("loading");
  const [competitorText,setCompetitorText]=useState("");
  const [plan,setPlan]=useState<MarketingPlan|null>(null);
  const [intelligence,setIntelligence]=useState<MarketingPlan["brand"]|null>(null);
  const [connections,setConnections]=useState<SocialConnection[]>([]);
  const [connectionState,setConnectionState]=useState<Record<string,string>>({});
  const [assetState,setAssetState]=useState<Record<string,string>>({});
  const [renderJobs,setRenderJobs]=useState<Record<string,string>>({});
  const [publishItem,setPublishItem]=useState<ContentItem|null>(null);
  const [autopilot,setAutopilot]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const t=copy[locale];

  const competitors=useMemo<CompetitorInput[]>(()=>competitorText
    .split("\n")
    .map(name=>name.trim())
    .filter(Boolean)
    .map(name=>({name})),[competitorText]);
  const activeItems=plan?.items.slice(0,10)??[];
  const canRun=Boolean(business.name.trim()&&business.category.trim());
  const previewMode=workspaceMode==="preview";

  function patchBusiness<K extends keyof BusinessProfile>(key:K,value:BusinessProfile[K]){
    setBusiness(current=>({...current,[key]:value}));
  }

  function requireContext(){
    if(canRun)return true;
    setMessage(t.firstRun);
    document.querySelector<HTMLElement>(".businessCard")?.scrollIntoView({behavior:"smooth",block:"center"});
    return false;
  }

  useEffect(()=>{void hydrateAccount();},[]);
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    const connected=query.get("connected");
    if(connected)setMessage(`${connected} connected securely.`);
  },[]);

  async function hydrateAccount(){
    try{
      const response=await fetch("/api/businesses",{cache:"no-store"});
      if(response.status===401){
        setWorkspaceMode("account");
        setMessage("Sign in to load your saved workspace.");
        return;
      }
      const data=await response.json();
      if(data.configured===false){
        setWorkspaceMode("preview");
        setBusiness(sampleBusiness);
        setCompetitorText("Lavash Restaurant\nSherep Restaurant");
        return;
      }
      setWorkspaceMode("account");
      const row=data.businesses?.[0];
      if(!row){
        setBusiness(emptyBusiness);
        setCompetitorText("");
        setMessage(t.firstRun);
        return;
      }
      setBusinessId(String(row.id));
      setBusiness({
        name:row.name,
        category:row.category,
        description:row.description||"",
        website:row.website||"",
        location:row.location||"",
        primaryLanguage:row.primary_language||"hy",
        goals:row.goals||[],
        audience:row.audience||"",
        offer:row.offer||"",
        tone:row.tone||"",
      });
      await loadConnections(String(row.id));
    }catch{
      setWorkspaceMode("account");
      setMessage("Workspace data is temporarily unavailable.");
    }
  }

  async function rememberWorkspace(id:string){
    setBusinessId(id);
    try{await selectBusinessWorkspace(id,false);}catch{/* selection is helpful, not required for the active session */}
    window.dispatchEvent(new Event("hay:studio-refresh"));
  }

  async function saveBusiness(){
    if(!requireContext())return null;
    if(previewMode){setMessage("Saving is not available in preview mode.");return null;}
    const response=await fetch("/api/businesses",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({business,id:businessId}),
    });
    if(response.status===401){window.location.href="/login?next=%2Fstudio";return null;}
    const data=await response.json();
    if(!response.ok)throw new Error(data.detail||data.error||"business_save_failed");
    if(!data.configured){setMessage("Saving is not available in preview mode.");return null;}
    const id=String(data.business.id);
    await rememberWorkspace(id);
    return id;
  }

  async function loadConnections(id:string){
    try{
      const response=await fetch(`/api/social/connections?businessId=${encodeURIComponent(id)}`,{cache:"no-store"});
      if(!response.ok)return;
      const data=await response.json();
      setConnections(data.connections||[]);
      setConnectionState(Object.fromEntries((data.connections||[]).map((item:SocialConnection)=>[item.platform,item.status])));
    }catch{/* keep workspace usable */}
  }

  async function analyze(){
    if(workspaceMode==="loading"||!requireContext())return;
    setBusy(true);setMessage("");
    try{
      let effectiveBusinessId=businessId;
      if(workspaceMode==="account"){
        const saved=await saveBusiness();
        if(!saved)return;
        effectiveBusinessId=saved;
      }
      const response=await fetch("/api/business/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({business,businessId:effectiveBusinessId,competitors}),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"analysis_failed");
      setIntelligence(data.intelligence.brand);
      setMessage("Business picture refreshed.");
    }catch(error){setMessage(error instanceof Error?error.message:"Analysis failed");}
    finally{setBusy(false);}
  }

  async function generatePlan(){
    if(workspaceMode==="loading"||!requireContext())return;
    setBusy(true);setMessage("");setAssetState({});setRenderJobs({});
    try{
      let effectiveBusinessId=businessId;
      if(workspaceMode==="account"){
        const saved=await saveBusiness();
        if(!saved)return;
        effectiveBusinessId=saved;
      }
      if(autopilot){
        const response=await fetch("/api/marketing/autopilot",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({business,businessId:effectiveBusinessId,competitors,connections,mode:"approval",horizonDays:7}),
        });
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"autopilot_failed");
        setPlan(data.plan);
        setIntelligence(data.plan.brand);
        if(data.persistence?.businessId)await rememberWorkspace(String(data.persistence.businessId));
        setMessage(`Next cycle ready · ${data.jobs.length} jobs mapped${data.performanceUsed?" · previous performance included":""}`);
      }else{
        const response=await fetch("/api/marketing/plan",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({business,businessId:effectiveBusinessId,competitors,horizonDays:7}),
        });
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"plan_failed");
        setPlan(data);
        setIntelligence(data.brand);
        if(data.persistence?.businessId)await rememberWorkspace(String(data.persistence.businessId));
        setMessage(data.performanceUsed?"Next cycle updated from measured performance.":"Next 7-day cycle ready.");
      }
    }catch(error){setMessage(error instanceof Error?error.message:"Plan failed");}
    finally{setBusy(false);}
  }

  async function waitForRender(item:ContentItem,jobId:string){
    for(let attempt=0;attempt<120;attempt++){
      await wait(attempt===0?2500:4000);
      try{
        const response=await fetch(`/api/render/status?jobId=${encodeURIComponent(jobId)}`,{cache:"no-store"});
        if(response.status===401){window.location.href="/login";return;}
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"render_status_failed");
        const status=String(data.job?.status||"");
        if(status==="rendered"){
          setAssetState(state=>({...state,[item.id]:"ready"}));
          setMessage(`${item.platform} ${item.format} ready to review and publish.`);
          return;
        }
        if(status==="failed"){
          setAssetState(state=>({...state,[item.id]:"error"}));
          setMessage(data.job?.error||"Render failed");
          return;
        }
      }catch(error){
        if(attempt>5){
          setAssetState(state=>({...state,[item.id]:"error"}));
          setMessage(error instanceof Error?error.message:"Render status failed");
          return;
        }
      }
    }
    setAssetState(state=>({...state,[item.id]:"rendering"}));
    setMessage("Render is still processing. The durable job remains in project history.");
  }

  async function createAsset(item:ContentItem){
    if(assetState[item.id]==="creating"||assetState[item.id]==="rendering")return;
    setAssetState(state=>({...state,[item.id]:"creating"}));setMessage("");
    try{
      const isStatic=item.format==="post"||item.format==="carousel";
      const endpoint=isStatic?"/api/marketing/content/static":"/api/marketing/content/create";
      const response=await fetch(endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contentItemId:item.id}),
      });
      if(response.status===401){window.location.href="/login";return;}
      const data=await response.json();
      if(!response.ok)throw new Error(data.detail||data.error||"asset_creation_failed");
      if(data.configured===false){
        setAssetState(state=>({...state,[item.id]:"setup"}));
        setMessage("Asset saving is not available in preview mode.");
        return;
      }
      if(isStatic){
        setAssetState(state=>({...state,[item.id]:"ready"}));
        setMessage(`${item.platform} ${item.format} ready · ${data.count||1} asset${data.count>1?"s":""}`);
        return;
      }
      const jobId=data.render?.configured&&data.render?.jobId?String(data.render.jobId):"";
      if(jobId){
        setRenderJobs(state=>({...state,[item.id]:jobId}));
        setAssetState(state=>({...state,[item.id]:"rendering"}));
        setMessage(`Render job ${jobId} started.`);
        void waitForRender(item,jobId);
        return;
      }
      setAssetState(state=>({...state,[item.id]:"renderable"}));
      setMessage("Video rendering is not connected yet.");
    }catch(error){
      setAssetState(state=>({...state,[item.id]:"error"}));
      setMessage(error instanceof Error?error.message:"Asset creation failed");
    }
  }

  async function connect(platform:SocialPlatform){
    if(workspaceMode==="loading")return;
    if(previewMode){setMessage("Channel connections are not available in preview mode.");return;}
    if(!requireContext())return;
    setConnectionState(state=>({...state,[platform]:"saving"}));setMessage("");
    try{
      const id=await saveBusiness();
      if(!id){setConnectionState(state=>({...state,[platform]:"disconnected"}));return;}
      const response=await fetch(`/api/social/connect?platform=${platform}&businessId=${encodeURIComponent(id)}`);
      const data=await response.json();
      if(response.status===401){window.location.href="/login?next=%2Fstudio";return;}
      if(data.authorizationUrl){window.location.href=data.authorizationUrl;return;}
      setConnectionState(state=>({...state,[platform]:data.configured?"ready":"setup"}));
      setMessage(data.configured?`${platform} is ready for authorization.`:`${platform}: connection setup is not available yet.`);
    }catch(error){
      setConnectionState(state=>({...state,[platform]:"error"}));
      setMessage(error instanceof Error?error.message:"Connection failed");
    }
  }

  function tileAction(item:ContentItem){
    if(assetState[item.id]==="ready"){setPublishItem(item);return;}
    void createAsset(item);
  }

  const assetLabel=(item:ContentItem)=>{
    const state=assetState[item.id];
    if(state==="creating")return "Creating ···";
    if(state==="rendering")return "Rendering ···";
    if(state==="ready")return "Publish →";
    if(state==="renderable")return "Rendering unavailable";
    if(state==="setup")return "Preview only";
    if(state==="error")return "Retry";
    return "Create asset →";
  };

  return <main className="marketingPage marketingPageV7">
    <header className="marketingNav">
      <a href="/" className="logoLink"><HayLogo compact/></a>
      <nav className="productNav"><a className="active" href="/studio">Studio</a><a href="/creator">Creator</a><a href="/voice">Voice</a><a href="/language">Language</a><a href="/developers">API</a></nav>
      <div className="navTools"><a href="/login" className="accountLink">ACCOUNT</a><div className="localePill">{(["hy","en","ru"] as Locale[]).map(item=><button key={item} className={locale===item?"active":""} onClick={()=>{setLocale(item);patchBusiness("primaryLanguage",item);}}>{item==="hy"?"ՀԱՅ":item.toUpperCase()}</button>)}</div><button className="commandButton">⌘ K</button></div>
    </header>

    <section className="marketingHero marketingHeroV7">
      <div className="heroCopy">
        <div className="signalLabel"><i/>{previewMode?"HAY STUDIO / PREVIEW":t.eyebrow}</div>
        <h1><span>{t.titleA}</span>{t.titleB}</h1>
        <p>{t.sub}</p>
        <div className="heroActions"><button className="hayPrimary" onClick={generatePlan} disabled={busy||workspaceMode==="loading"||!canRun}>{busy?"HAY ···":t.plan}</button><button className="haySecondary" onClick={analyze} disabled={busy||workspaceMode==="loading"||!canRun}>{t.analyze}</button><label className={`autopilot ${autopilot?"on":""}`}><input type="checkbox" checked={autopilot} onChange={event=>setAutopilot(event.target.checked)}/><span/><b>{t.autopilot}</b><small>{autopilot?"ON":"OFF"}</small></label></div>
        {message&&<p className="marketingMessage">{message}</p>}
      </div>
      <div className="studioContextStrip" aria-label="Studio operating model">
        <article><span>{t.context}</span><strong>{t.contextText}</strong></article>
        <article><span>{t.decision}</span><strong>{t.decisionText}</strong></article>
        <article><span>{t.execution}</span><strong>{t.executionText}</strong></article>
      </div>
    </section>

    <section className="marketingGrid">
      <article className="intelCard businessCard">
        <div className="panelTop"><span>01 / BUSINESS CONTEXT</span><em>{previewMode?"SAMPLE":businessId?"SAVED":workspaceMode==="loading"?"LOADING":"NEW"}</em></div>
        <div className="businessNameRow"><input value={business.name} onChange={event=>patchBusiness("name",event.target.value)} placeholder="Business name"/><span className="pulseDot"/></div>
        <div className="fieldPair"><label>Category<input value={business.category} onChange={event=>patchBusiness("category",event.target.value)} placeholder="Restaurant, retail, hotel…"/></label><label>Location<input value={business.location||""} onChange={event=>patchBusiness("location",event.target.value)} placeholder="Yerevan, Armenia"/></label></div>
        <label className="fullField">Website<input value={business.website||""} onChange={event=>patchBusiness("website",event.target.value)} placeholder="https://…"/></label>
        <label className="fullField">Business / offer<textarea value={business.description} onChange={event=>patchBusiness("description",event.target.value)} placeholder="What do you sell, who is it for, and why should people choose you?"/></label>
        <div className="dnaStrip"><span>LANGUAGE <b>{business.primaryLanguage.toUpperCase()}</b></span><span>MARKET <b>ARMENIA</b></span><span>MODE <b>{autopilot?"AUTO":"REVIEW"}</b></span></div>
      </article>

      <article className="intelCard channelsCard">
        <div className="panelTop"><span>02 / {t.connections.toUpperCase()}</span><em>AUTHORIZE</em></div>
        <div className="channelList">{channels.map(({platform,label})=>{const state=connectionState[platform]||"disconnected";return <button key={platform} onClick={()=>void connect(platform)} disabled={workspaceMode==="loading"}><i><SocialBrandIcon platform={platform} size={18} decorative/></i><div><strong>{label}</strong><small>{state==="setup"?"setup required":state}</small></div><span className={`connectionLed ${state}`}/></button>;})}</div>
        <p className="microcopy">Every channel is authorized by the account owner. Social passwords are never requested.</p>
      </article>

      <article className="intelCard intelligenceCard">
        <div className="panelTop"><span>03 / {t.intelligence.toUpperCase()}</span><em>{intelligence?"CURRENT":"NOT MEASURED"}</em></div>
        <div className="strategyQuote">{intelligence?.positioning||"Map the offer, audience, category language, proof and conversion path before producing the next content cycle."}</div>
        <div className="pillarCloud">{(intelligence?.contentPillars||[]).map((pillar,index)=><span key={pillar}><i>{String(index+1).padStart(2,"0")}</i>{pillar}</span>)}</div>
      </article>

      <article className="intelCard competitorsCard">
        <div className="panelTop"><span>04 / {t.competitors.toUpperCase()}</span><em>{competitors.length} TRACKED</em></div>
        <textarea value={competitorText} onChange={event=>setCompetitorText(event.target.value)} placeholder="One competitor per line"/>
        <div className="radarRows">{(plan?.competitors||competitors.map(item=>({name:item.name,strength:"awaiting analysis",gap:"—",opportunity:"—"}))).slice(0,3).map((item,index)=><div key={item.name}><span>0{index+1}</span><strong>{item.name}</strong><small>{item.gap}</small></div>)}</div>
      </article>
    </section>

    <section className="contentPulse">
      <div className="pulseHeader"><div><span>05 / EXECUTION QUEUE</span><h2>{t.calendar}</h2></div><div className="pulseStats"><span><b>{plan?.items.length||0}</b> assets</span><span><b>{plan?"7":"—"}</b> days</span><span><b>{autopilot?"AUTO":"REVIEW"}</b> publish</span></div></div>
      {activeItems.length?<div className="calendarRail">{activeItems.map(item=><article key={item.id} className={`contentTile asset-${assetState[item.id]||"idea"}`}><div className="tileMeta"><span>D{item.day}</span><i><SocialBrandIcon platform={item.platform} size={12} decorative/>{item.platform}</i><em>{item.objective}</em></div><h3>{item.hook}</h3><p>{item.concept}</p><footer><span>{item.format}{renderJobs[item.id]?" · job":""}</span><button onClick={()=>tileAction(item)} disabled={assetState[item.id]==="creating"||assetState[item.id]==="rendering"}>{assetLabel(item)}</button></footer></article>)}</div>:<div className="emptyPulse"><div className="emptyGlyph">Հ</div><h3>Start with context, not content volume.</h3><p>{canRun?"Add competitors if useful, then build the first executable 7-day cycle.":"Add the business name and category above. HAY will save the context when you build the first cycle."}</p><button className="hayPrimary" onClick={generatePlan} disabled={busy||workspaceMode==="loading"||!canRun}>{t.plan}</button></div>}
    </section>

    <section className="systemLine"><span>HAY ENGINE / {previewMode?"PREVIEW":"ACTIVE WORKSPACE"}</span><span>CONTEXT → DECISION → CREATE → APPROVE → PUBLISH → LEARN</span><span>YEREVAN / 2026</span></section>

    {publishItem&&<PublishDialog item={publishItem} connections={connections} locale={locale} onClose={()=>setPublishItem(null)} onMessage={setMessage} onQueued={status=>setAssetState(state=>({...state,[publishItem.id]:status==="queued"?"queued":"scheduled"}))}/>} 
  </main>;
}
