"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContentItem, SocialConnection } from "@/lib/marketing/types";
import type { Locale } from "@/lib/hay/types";

type Props = {
  item: ContentItem;
  connections: SocialConnection[];
  locale: Locale;
  onClose: () => void;
  onMessage: (message: string) => void;
  onQueued?: (status: string) => void;
};

type TikTokCreator = {
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

const labels = {
  hy: { title:"Վերջնական ստուգում", publish:"Հրապարակել / պլանավորել", close:"Փակել", caption:"Գրառում", schedule:"Հրապարակման ժամանակ", now:"Հիմա", account:"Հաշիվ", noAccount:"Այս ալիքը դեռ միացված չէ։", consent:"Ես ստուգել եմ գրառումը և հաստատում եմ հրապարակումը։", privacy:"Տեսանելիություն", disclosure:"Commercial content", own:"Ձեր բրենդը", branded:"Paid partnership", comments:"Անջատել մեկնաբանությունները", duet:"Անջատել Duet", stitch:"Անջատել Stitch" },
  en: { title:"Final publish review", publish:"Publish / schedule", close:"Close", caption:"Caption", schedule:"Publish time", now:"Now", account:"Account", noAccount:"This channel is not connected yet.", consent:"I reviewed this post and explicitly approve publishing it.", privacy:"Privacy", disclosure:"Commercial content", own:"Your brand", branded:"Paid partnership", comments:"Disable comments", duet:"Disable Duet", stitch:"Disable Stitch" },
  ru: { title:"Финальная проверка", publish:"Опубликовать / запланировать", close:"Закрыть", caption:"Текст публикации", schedule:"Время публикации", now:"Сейчас", account:"Аккаунт", noAccount:"Этот канал пока не подключён.", consent:"Я проверил публикацию и явно подтверждаю отправку.", privacy:"Видимость", disclosure:"Коммерческий контент", own:"Свой бренд", branded:"Платное партнёрство", comments:"Отключить комментарии", duet:"Отключить Duet", stitch:"Отключить Stitch" },
} as const;

export default function PublishDialog({ item, connections, locale, onClose, onMessage, onQueued }: Props) {
  const t = labels[locale];
  const connection = useMemo(() => connections.find(c => c.platform === item.platform && c.status === "connected"), [connections, item.platform]);
  const [caption,setCaption]=useState(item.caption);
  const [cta,setCta]=useState(item.cta);
  const [schedule,setSchedule]=useState("");
  const [busy,setBusy]=useState(false);
  const [creator,setCreator]=useState<TikTokCreator|null>(null);
  const [creatorFetchedAt,setCreatorFetchedAt]=useState("");
  const [privacy,setPrivacy]=useState("");
  const [disableComment,setDisableComment]=useState(false);
  const [disableDuet,setDisableDuet]=useState(false);
  const [disableStitch,setDisableStitch]=useState(false);
  const [commercial,setCommercial]=useState(false);
  const [ownBrand,setOwnBrand]=useState(false);
  const [brandedContent,setBrandedContent]=useState(false);
  const [consent,setConsent]=useState(false);
  const [youtubePrivacy,setYoutubePrivacy]=useState<"private"|"unlisted"|"public">("private");
  const [youtubeTitle,setYoutubeTitle]=useState(item.hook.slice(0,100));
  const [shareToFeed,setShareToFeed]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(item.platform!=="tiktok"||!connection?.id)return;
    let cancelled=false;
    setError("");
    fetch(`/api/social/tiktok/creator-info?connectionId=${encodeURIComponent(connection.id)}`)
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.detail?.message||data.error||"tiktok_creator_info_failed");return data;})
      .then(data=>{if(cancelled)return;setCreator(data.creator||{});setCreatorFetchedAt(data.fetchedAt||new Date().toISOString());setDisableComment(Boolean(data.creator?.comment_disabled));setDisableDuet(Boolean(data.creator?.duet_disabled));setDisableStitch(Boolean(data.creator?.stitch_disabled));})
      .catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:"TikTok creator info failed");});
    return()=>{cancelled=true;};
  },[item.platform,connection?.id]);

  const scheduleIso=()=>schedule?new Date(schedule).toISOString():undefined;
  const tiktokReady=item.platform!=="tiktok"||Boolean(creator&&creatorFetchedAt&&privacy&&consent&&(!commercial||ownBrand||brandedContent));
  const canPublish=Boolean(connection?.id)&&!busy&&tiktokReady;

  async function queuePublish(){
    if(!connection?.id)return;
    setBusy(true);setError("");
    try{
      const update=await fetch("/api/marketing/content/update",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({contentItemId:item.id,caption,cta,status:"approved"})});
      const updated=await update.json();
      if(!update.ok)throw new Error(updated.detail||updated.error||"content_review_save_failed");

      let providerSettings:Record<string,unknown>={};
      if(item.platform==="instagram")providerSettings={share_to_feed:shareToFeed};
      if(item.platform==="youtube")providerSettings={privacyStatus:youtubePrivacy,title:youtubeTitle};
      if(item.platform==="tiktok")providerSettings={
        privacy_level:privacy,
        disable_comment:disableComment,
        disable_duet:disableDuet,
        disable_stitch:disableStitch,
        creator_info_fetched_at:creatorFetchedAt,
        consent_at:new Date().toISOString(),
        ...(commercial?{brand_organic_toggle:ownBrand,brand_content_toggle:brandedContent}:{}),
      };
      const response=await fetch("/api/social/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contentItemId:item.id,connectionId:connection.id,platform:item.platform,scheduledFor:scheduleIso(),providerSettings})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"publish_queue_failed");
      const status=String(data.job?.status||data.next||"queued");
      onQueued?.(status);
      onMessage(schedule?`${item.platform}: publication scheduled.`:`${item.platform}: publish job queued.`);
      onClose();
    }catch(err){setError(err instanceof Error?err.message:"Publish failed");}
    finally{setBusy(false);}
  }

  const privacyOptions=creator?.privacy_level_options||[];
  const brandedBlocksPrivate=brandedContent&&privacy==="SELF_ONLY";

  return <div className="publishBackdrop" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)onClose();}}>
    <section className="publishDialog" role="dialog" aria-modal="true" aria-label={t.title}>
      <header><div><span>HAY / PUBLISH CONTROL</span><h2>{t.title}</h2></div><button onClick={onClose} aria-label={t.close}>×</button></header>
      <div className="publishAccount"><span>{t.account}</span><strong>{connection?.accountName||connection?.accountId||item.platform}</strong><em>{item.platform.toUpperCase()}</em></div>
      {!connection?.id&&<div className="publishWarning">{t.noAccount}</div>}
      <label className="publishField">{t.caption}<textarea value={caption} onChange={e=>setCaption(e.target.value)} maxLength={5000}/></label>
      <label className="publishField">CTA<input value={cta} onChange={e=>setCta(e.target.value)} maxLength={1000}/></label>
      <label className="publishField">{t.schedule}<input type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)}/><small>{schedule||t.now}</small></label>

      {item.platform==="instagram"&&<label className="publishToggle"><input type="checkbox" checked={shareToFeed} onChange={e=>setShareToFeed(e.target.checked)}/><span/>Share Reel to feed</label>}
      {item.platform==="youtube"&&<div className="publishProvider"><label>{t.privacy}<select value={youtubePrivacy} onChange={e=>setYoutubePrivacy(e.target.value as typeof youtubePrivacy)}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label><label>Title<input value={youtubeTitle} onChange={e=>setYoutubeTitle(e.target.value)} maxLength={100}/></label></div>}

      {item.platform==="tiktok"&&<div className="tiktokApproval">
        <div className="providerHead"><span>TIKTOK DIRECT POST</span><em>{creator?"FRESH CREATOR INFO":"LOADING"}</em></div>
        {creator?.creator_nickname&&<p>Creator: <strong>{creator.creator_nickname}</strong></p>}
        <label>{t.privacy}<select value={privacy} onChange={e=>setPrivacy(e.target.value)}><option value="">— choose —</option>{privacyOptions.map(option=><option key={option} value={option} disabled={brandedContent&&option==="SELF_ONLY"}>{option}</option>)}</select></label>
        {brandedBlocksPrivate&&<div className="publishWarning">Branded content cannot use SELF_ONLY. Choose another privacy level.</div>}
        <div className="tiktokToggles">
          <label><input type="checkbox" checked={disableComment} disabled={Boolean(creator?.comment_disabled)} onChange={e=>setDisableComment(e.target.checked)}/>{t.comments}</label>
          <label><input type="checkbox" checked={disableDuet} disabled={Boolean(creator?.duet_disabled)} onChange={e=>setDisableDuet(e.target.checked)}/>{t.duet}</label>
          <label><input type="checkbox" checked={disableStitch} disabled={Boolean(creator?.stitch_disabled)} onChange={e=>setDisableStitch(e.target.checked)}/>{t.stitch}</label>
        </div>
        <label className="publishToggle"><input type="checkbox" checked={commercial} onChange={e=>{setCommercial(e.target.checked);if(!e.target.checked){setOwnBrand(false);setBrandedContent(false);}}}/><span/>{t.disclosure}</label>
        {commercial&&<div className="commercialOptions"><label><input type="checkbox" checked={ownBrand} onChange={e=>setOwnBrand(e.target.checked)}/>{t.own}</label><label><input type="checkbox" checked={brandedContent} onChange={e=>{setBrandedContent(e.target.checked);if(e.target.checked&&privacy==="SELF_ONLY")setPrivacy("");}}/>{t.branded}</label></div>}
        <label className="explicitConsent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{t.consent}</span></label>
      </div>}
      {error&&<div className="publishWarning">{error}</div>}
      <footer><button className="haySecondary" onClick={onClose}>{t.close}</button><button className="hayPrimary" disabled={!canPublish||brandedBlocksPrivate} onClick={queuePublish}>{busy?"HAY ···":t.publish}</button></footer>
    </section>
  </div>;
}
