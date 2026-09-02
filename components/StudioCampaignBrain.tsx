"use client";

import { useEffect, useMemo, useState } from "react";

type BusinessRow={id:string;name:string;category:string;description?:string|null;website?:string|null;location?:string|null;primary_language?:"hy"|"en"|"ru";goals?:string[];audience?:string|null;offer?:string|null;tone?:string|null};
type CampaignPhase={name:string;label:string;startDate:string;endDate:string;purpose:string;contentItemIds:string[]};
type Campaign={id:string;name:string;type:string;objective:string;offer:string;startDate:string;endDate:string;eventDate?:string;audience:string;primaryKpi:string;status:string;phases:CampaignPhase[];createdAt:string;planId?:string};
type CampaignsResponse={configured:boolean;error?:string;business?:{id:string;name:string}|null;campaigns?:Campaign[]};

const addDays=(value:string,days:number)=>{const date=new Date(`${value}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
const typeLabel=(value:string)=>({launch:"PRODUCT / SERVICE LAUNCH",promotion:"PROMOTION",event:"EVENT",seasonal:"SEASONAL",holiday:"HOLIDAY / LOCAL MOMENT",sales:"SALES PUSH"}[value]||value.toUpperCase());
const phaseCode=(value:string)=>({prelaunch:"01",launch:"02",sustain:"03",last_call:"04"}[value]||"·");

export default function StudioCampaignBrain(){
  const [business,setBusiness]=useState<BusinessRow|null>(null);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [name,setName]=useState("");
  const [type,setType]=useState("promotion");
  const [objective,setObjective]=useState("Drive measurable bookings, orders or qualified leads.");
  const [offer,setOffer]=useState("");
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [eventDate,setEventDate]=useState("");
  const [audience,setAudience]=useState("");
  const [constraints,setConstraints]=useState("");

  async function load(){
    setLoading(true);
    try{
      const [businessResponse,campaignResponse]=await Promise.all([fetch("/api/businesses",{cache:"no-store"}),fetch("/api/studio/campaigns",{cache:"no-store"})]);
      if(businessResponse.status===401||campaignResponse.status===401){setConfigured(true);setBusiness(null);setCampaigns([]);return;}
      const businessData=await businessResponse.json();
      const campaignData=await campaignResponse.json() as CampaignsResponse;
      setConfigured(businessData.configured!==false&&campaignData.configured!==false);
      const row=(businessData.businesses||[])[0] as BusinessRow|undefined;
      setBusiness(row||null);setCampaigns(campaignData.campaigns||[]);
      if(row&&!audience)setAudience(row.audience||"");
    }catch{setConfigured(false);setBusiness(null);setCampaigns([]);}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    const today=new Date().toISOString().slice(0,10);setStartDate(today);setEndDate(addDays(today,13));void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const featured=useMemo(()=>campaigns.find(item=>item.status==="active")||campaigns.find(item=>item.status==="upcoming")||campaigns[0]||null,[campaigns]);

  async function runCampaign(){
    if(!business||!name.trim()||!objective.trim()||!startDate||!endDate||busy)return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/marketing/campaign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        businessId:business.id,
        business:{id:business.id,name:business.name,category:business.category,description:business.description||"",website:business.website||"",location:business.location||"",primaryLanguage:business.primary_language||"hy",goals:business.goals||[],audience:business.audience||"",offer:business.offer||"",tone:business.tone||""},
        campaign:{name:name.trim(),type,objective:objective.trim(),offer:offer.trim(),startDate,endDate,eventDate:eventDate||undefined,audience:audience.trim(),constraints:constraints.trim()},
      })});
      if(response.status===401){window.location.href="/login";return;}
      const data=await response.json();
      if(!response.ok)throw new Error(data.detail||data.error||"campaign_generation_failed");
      if(data.persistence?.persisted===false){setMessage(`Campaign generated but not persisted · ${data.persistence?.reason||"database unavailable"}`);return;}
      const campaign=data.campaign as Campaign;
      setCampaigns(current=>[campaign,...current.filter(item=>item.id!==campaign.id)].slice(0,8));
      setMessage(`Campaign plan saved · ${data.plan?.items?.length||0} content items mapped inside ${campaign.startDate} → ${campaign.endDate}.`);
      window.dispatchEvent(new Event("hay:studio-refresh"));
    }catch(error){setMessage(error instanceof Error?error.message:"Campaign generation failed");}
    finally{setBusy(false);}
  }

  return <section className="studioCampaignBrain" aria-label="HAY Campaign Brain">
    <header className="campaignHead">
      <div><span><i/>CAMPAIGN BRAIN / TEMPORARY PRIORITY LAYER</span><h2>Turn a launch, offer or event into one coherent marketing campaign.</h2><p>Campaign mode can override evergreen posting inside its date window, without deleting Brand DNA, Series or Content Memory.</p></div>
      <div className="campaignState"><span>ACTIVE WORKSPACE</span><strong>{business?.name||"—"}</strong><small>{featured?`${featured.status.toUpperCase()} · ${featured.primaryKpi.toUpperCase()}`:"No campaign history yet"}</small></div>
    </header>

    {configured===false?<div className="campaignEmpty"><strong>Campaign Brain activates with HAY persistence.</strong><span>Campaigns are durable strategy objects; demo mode does not invent campaign history.</span></div>:
      !business&&!loading?<div className="campaignEmpty"><strong>Create a business workspace first.</strong><span>Campaigns always belong to one owner-scoped brand.</span></div>:
      <div className="campaignComposer">
        <div className="campaignForm">
          <label><span>CAMPAIGN NAME</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Autumn menu launch"/></label>
          <label><span>TYPE</span><select value={type} onChange={e=>setType(e.target.value)}><option value="launch">Launch</option><option value="promotion">Promotion</option><option value="event">Event</option><option value="seasonal">Seasonal</option><option value="holiday">Holiday / local moment</option><option value="sales">Sales push</option></select></label>
          <label className="wide"><span>PRIMARY OBJECTIVE</span><input value={objective} onChange={e=>setObjective(e.target.value)} placeholder="Drive reservations for launch week"/></label>
          <label className="wide"><span>EXACT OFFER / PROPOSITION</span><textarea value={offer} onChange={e=>setOffer(e.target.value)} placeholder="Write the exact offer. HAY will not invent a discount or scarcity."/></label>
          <label><span>START</span><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
          <label><span>END</span><input type="date" value={endDate} min={startDate||undefined} onChange={e=>setEndDate(e.target.value)}/></label>
          <label><span>EVENT / LAUNCH DATE</span><input type="date" value={eventDate} min={startDate||undefined} max={endDate||undefined} onChange={e=>setEventDate(e.target.value)}/></label>
          <label><span>AUDIENCE OVERRIDE</span><input value={audience} onChange={e=>setAudience(e.target.value)} placeholder="Optional campaign-specific audience"/></label>
          <label className="wide"><span>CONSTRAINTS / FACTS HAY MUST RESPECT</span><textarea value={constraints} onChange={e=>setConstraints(e.target.value)} placeholder="Stock limits, legal wording, opening hours, geographic restrictions…"/></label>
          <button className="campaignRun" disabled={busy||!business||!name.trim()||!objective.trim()||!startDate||!endDate} onClick={()=>void runCampaign()}>{busy?"BUILDING CAMPAIGN…":"GENERATE CAMPAIGN PLAN →"}</button>
          {message&&<p className="campaignMessage">{message}</p>}
        </div>

        <aside className="campaignRules"><span>HAY CAMPAIGN LOGIC</span><div><b>01</b><strong>PRE-LAUNCH</strong><small>Context · curiosity · problem</small></div><div><b>02</b><strong>LAUNCH</strong><small>Proposition · proof · action</small></div><div><b>03</b><strong>SUSTAIN</strong><small>Objections · demonstration · new angles</small></div><div><b>04</b><strong>LAST CALL</strong><small>Exact deadline · no fake scarcity</small></div><p>Every campaign remains subordinate to verified business facts. HAY never invents a discount, stock limit, testimonial or deadline.</p></aside>
      </div>}

    <div className="campaignHistory">
      <div className="campaignHistoryHead"><span>CAMPAIGN MEMORY</span><strong>{loading?"READING…":`${campaigns.length} RECENT`}</strong></div>
      {!loading&&campaigns.length===0?<div className="campaignNoHistory">No campaign strategy has been persisted for this workspace yet.</div>:
      campaigns.map(campaign=><article key={campaign.id} className={`campaignCard ${campaign.status}`}>
        <div className="campaignCardTop"><div><span>{typeLabel(campaign.type)}</span><h3>{campaign.name}</h3><p>{campaign.objective}</p></div><div className="campaignKpi"><span>PRIMARY KPI</span><strong>{campaign.primaryKpi.toUpperCase()}</strong><small>{campaign.startDate} → {campaign.endDate}</small></div></div>
        {campaign.offer&&<div className="campaignOffer"><span>OFFER</span><strong>{campaign.offer}</strong></div>}
        <div className="campaignPhases">{(campaign.phases||[]).map(phase=><div key={`${campaign.id}-${phase.name}`}><b>{phaseCode(phase.name)}</b><span>{phase.label}</span><strong>{phase.startDate} → {phase.endDate}</strong><small>{phase.contentItemIds?.length||0} content items</small></div>)}</div>
      </article>)}
    </div>
  </section>;
}
