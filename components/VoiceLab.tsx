"use client";

import { useEffect, useMemo, useState } from "react";
import HayLogo from "./HayLogo";

type Voice={id:string;label:string;gender:string;dialect:string;provider:string;available:boolean;character:string};
type Style="standard"|"natural"|"yerevan";

const sample="Բարև։ Հիմա ցույց տամ՝ HAY-ը ոնց կարող է քո բիզնեսի համար բնական հայերենով կոնտենտ ստեղծել, ձայնավորել ու պատրաստել հրապարակման։";

export default function VoiceLab(){
  const [text,setText]=useState(sample);
  const [voices,setVoices]=useState<Voice[]>([]);
  const [voiceId,setVoiceId]=useState("");
  const [style,setStyle]=useState<Style>("natural");
  const [audio,setAudio]=useState<string|null>(null);
  const [spoken,setSpoken]=useState("");
  const [provider,setProvider]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{void fetch("/api/voice").then(r=>r.json()).then(data=>{setVoices(data.voices||[]);const first=(data.voices||[]).find((v:Voice)=>v.available);if(first)setVoiceId(first.id);}).catch(()=>{});},[]);
  const selected=useMemo(()=>voices.find(v=>v.id===voiceId),[voices,voiceId]);

  async function generate(){
    setBusy(true);setMessage("");setAudio(null);
    try{
      const response=await fetch("/api/voice",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,voiceId,style,dialect:"eastern"})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"voice_failed");
      setSpoken(data.normalized?.spokenText||data.naturalized?.text||text);
      if(!data.configured){setMessage(data.message||"Voice provider is not configured yet.");return;}
      setProvider(`${data.voice?.label||"HAY Voice"} · ${data.provider||data.voice?.provider||"provider"}`);
      setAudio(`data:${data.contentType||"audio/mpeg"};base64,${data.audioBase64}`);
    }catch(error){setMessage(error instanceof Error?error.message:"Voice generation failed");}
    finally{setBusy(false);}
  }

  return <main className="voiceLabPage">
    <header className="voiceLabNav"><a href="/"><HayLogo/></a><nav><a href="/">HOME</a><a href="/studio">MARKETING OS</a><a href="/creator">CREATOR</a></nav><span>HY-AM / VOICE LAB</span></header>
    <section className="voiceLabHero"><span>HAY VOICE / 01</span><h1>Հայերենը պետք է<br/><em>հնչի հայերեն։</em></h1><p>Test natural Eastern Armenian, Yerevan-casual delivery and provider fallbacks before using the voice in Reels, Shorts or ads.</p></section>
    <section className="voiceLabGrid">
      <article className="voiceComposer"><div className="voicePanelTop"><span>TEXT / խոսք</span><b>{text.length} chars</b></div><textarea value={text} onChange={e=>setText(e.target.value)} maxLength={4500}/><div className="voiceControls"><label>Speech style<select value={style} onChange={e=>setStyle(e.target.value as Style)}><option value="standard">Standard / գրական</option><option value="natural">Natural / խոսակցական</option><option value="yerevan">Yerevan / casual</option></select></label><label>Voice<select value={voiceId} onChange={e=>setVoiceId(e.target.value)}>{voices.map(v=><option key={v.id} value={v.id} disabled={!v.available}>{v.label} · {v.provider}{v.available?"":" · setup"}</option>)}</select></label></div><button onClick={generate} disabled={busy||!text.trim()}>{busy?"GENERATING ···":"GENERATE ARMENIAN VOICE →"}</button>{message&&<p className="voiceLabMessage">{message}</p>}</article>
      <aside className="voiceCatalog"><div className="voicePanelTop"><span>VOICE ROUTER</span><b>{voices.filter(v=>v.available).length} LIVE</b></div>{voices.map(v=><button key={v.id} className={voiceId===v.id?"active":""} onClick={()=>v.available&&setVoiceId(v.id)} disabled={!v.available}><i>{v.gender==="female"?"F":v.gender==="male"?"M":"N"}</i><div><strong>{v.label}</strong><small>{v.character}</small></div><span>{v.provider}<b className={v.available?"live":"off"}/></span></button>)}</aside>
    </section>
    <section className="voiceOutput"><div className="voicePanelTop"><span>OUTPUT / 02</span><b>{provider||selected?.provider||"STANDBY"}</b></div><div className="voiceOutputBody"><div className="voiceOutputMark">Հ</div><div><span>SPOKEN TEXT</span><p>{spoken||"Generate a sample to inspect the exact text HAY sends to TTS after conversational and pronunciation normalization."}</p>{audio&&<audio src={audio} controls autoPlay/>}</div></div></section>
    <footer className="voiceLabFooter"><span>STANDARD → NATURAL → YEREVAN</span><span>TEXT → NATURALIZE → PRONOUNCE → TTS → CAPTIONS</span><span>HAY / 2026</span></footer>
  </main>;
}
