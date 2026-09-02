"use client";

import { useEffect, useState } from "react";

type Mode="manual"|"approval"|"autoqueue";
type Connection={id:string;platform:string;status:string;account_name?:string|null;account_id?:string|null;automation_mode?:Mode|null;publish_defaults?:Record<string,unknown>|null};

const platformLabel=(value:string)=>({instagram:"Instagram",tiktok:"TikTok",youtube:"YouTube",facebook:"Facebook",linkedin:"LinkedIn"}[value]||value);

export default function StudioPublishingPolicy(){
  const [businessId,setBusinessId]=useState("");
  const [connections,setConnections]=useState<Connection[]>([]);
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");

  async function load(){
    try{
      const businessResponse=await fetch("/api/businesses",{cache:"no-store"});
      if(businessResponse.status===401){setConfigured(true);return;}
      const businessData=await businessResponse.json();
      if(businessData.configured===false){setConfigured(false);return;}
      const id=String(businessData.businesses?.[0]?.id||"");
      setConfigured(true);setBusinessId(id);
      if(!id){setConnections([]);return;}
      const response=await fetch(`/api/social/connections?businessId=${encodeURIComponent(id)}`,{cache:"no-store"});
      const data=await response.json();
      if(response.ok)setConnections((data.connections||[]).filter((item:Connection)=>item.status==="connected"));
    }catch{setConfigured(false);}
  }

  useEffect(()=>{void load();},[]);

  async function setPolicy(connection:Connection,mode:Mode,defaults?:Record<string,unknown>){
    if(!businessId||busy)return;
    setBusy(connection.id);setMessage("");
    try{
      const response=await fetch(`/api/social/connections?businessId=${encodeURIComponent(businessId)}`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({connectionId:connection.id,automationMode:mode,publishDefaults:defaults??connection.publish_defaults??{}}),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.detail||data.error||"policy_update_failed");
      setConnections(current=>current.map(item=>item.id===connection.id?{...item,...data.connection}:item));
      setMessage(data.tiktokAutoqueueDowngraded?"TikTok stays on approval mode because fresh privacy options and explicit consent are required before Direct Post.":`${platformLabel(connection.platform)} publishing policy updated.`);
    }catch(error){setMessage(error instanceof Error?error.message:"Policy update failed");}
    finally{setBusy("");}
  }

  async function updateYoutubePrivacy(connection:Connection,privacyStatus:string){
    await setPolicy(connection,connection.automation_mode||"approval",{...(connection.publish_defaults||{}),privacyStatus});
  }

  async function updateInstagramFeed(connection:Connection,share_to_feed:boolean){
    await setPolicy(connection,connection.automation_mode||"approval",{...(connection.publish_defaults||{}),share_to_feed});
  }

  return <section className="studioPolicy" aria-label="Publishing automation policies">
    <header><div><span><i/>AUTOPILOT POLICY / HUMAN CONTROL</span><h2>Choose how far HAY may go for each channel.</h2></div><p>Approval is the default. Autoqueue only works where the platform and your saved defaults make it safe.</p></header>

    {configured===false?<div className="policyEmpty"><strong>Publishing policies activate with the dedicated HAY database.</strong><span>No automation preference is invented in demo mode.</span></div>:
      connections.length===0?<div className="policyEmpty"><strong>No connected publishing channels yet.</strong><span>Connect Instagram, TikTok or YouTube in Channels before enabling automation.</span></div>:
      <div className="policyGrid">{connections.map(connection=>{
        const mode=connection.automation_mode||"approval";
        const defaults=connection.publish_defaults||{};
        return <article key={connection.id}>
          <div className="policyTop"><div><span>{platformLabel(connection.platform)}</span><strong>{connection.account_name||connection.account_id||"Connected account"}</strong></div><i className="connected"/></div>
          <div className="policyModes">{(["manual","approval","autoqueue"] as Mode[]).map(option=><button key={option} disabled={busy===connection.id||(connection.platform==="tiktok"&&option==="autoqueue")} className={mode===option?"active":""} onClick={()=>void setPolicy(connection,option)}><span>{option.toUpperCase()}</span><small>{option==="manual"?"You decide every publish":option==="approval"?"HAY prepares, you approve":"Approved content enters queue"}</small></button>)}</div>
          {connection.platform==="instagram"&&<label className="policyDefault"><span>DEFAULT / SHARE REELS TO FEED</span><input type="checkbox" checked={defaults.share_to_feed!==false} onChange={event=>void updateInstagramFeed(connection,event.target.checked)}/></label>}
          {connection.platform==="youtube"&&<label className="policyDefault"><span>DEFAULT / YOUTUBE PRIVACY</span><select value={String(defaults.privacyStatus||"private")} onChange={event=>void updateYoutubePrivacy(connection,event.target.value)}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label>}
          {connection.platform==="tiktok"&&<div className="policyGate"><span>PLATFORM GATE</span><p>Fresh creator info, privacy selection and explicit consent remain mandatory for every Direct Post.</p></div>}
          {!["instagram","youtube","tiktok"].includes(connection.platform)&&<div className="policyGate"><span>CONNECTOR STATE</span><p>HAY can prepare content, but automatic publisher support for this channel is not enabled yet.</p></div>}
        </article>;
      })}</div>}
    {message&&<footer>{message}</footer>}
  </section>;
}
