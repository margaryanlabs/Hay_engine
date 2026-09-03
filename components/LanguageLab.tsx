"use client";

import { useMemo, useState } from "react";
import HayLogo from "./HayLogo";

type Mode="pronounce"|"translate"|"captions"|"transcribe";
type Locale="hy"|"en"|"ru";

const initial="Instagram-ում այսօր նոր առաջարկ ունենք՝ 14,900 ֏։ HAY-ը պատրաստում է բնական հայերեն կոնտենտ։";

export default function LanguageLab(){
  const [mode,setMode]=useState<Mode>("pronounce");
  const [text,setText]=useState(initial);
  const [target,setTarget]=useState<Locale>("en");
  const [duration,setDuration]=useState(15);
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<Record<string,unknown>|null>(null);
  const [message,setMessage]=useState("");

  const output=useMemo(()=>{
    if(!result)return "Run a HAY language operation to inspect the structured output.";
    if(typeof result.spokenText==="string")return result.spokenText;
    if(typeof result.text==="string")return result.text;
    if(typeof result.srt==="string")return result.srt;
    return JSON.stringify(result,null,2);
  },[result]);

  async function run(){
    setBusy(true);setMessage("");setResult(null);
    try{
      let response:Response;
      if(mode==="transcribe"){
        if(!file)throw new Error("Choose an audio file first.");
        const form=new FormData();form.append("file",file);form.append("language","hy");form.append("correct","true");
        response=await fetch("/api/transcribe",{method:"POST",body:form});
      }else{
        const endpoint=mode==="pronounce"?"/api/pronounce":mode==="translate"?"/api/translate":"/api/captions";
        const body=mode==="pronounce"?{text,dialect:"eastern"}:mode==="translate"?{text,source:"auto",target}:{text,duration,wordsPerCue:4};
        response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      }
      const data=await response.json();
      setResult(data);
      if(!response.ok)setMessage(data.message||data.error||"Language operation failed");
    }catch(error){setMessage(error instanceof Error?error.message:"Language operation failed");}
    finally{setBusy(false);}
  }

  const descriptions:{[K in Mode]:string}={
    pronounce:"Display text → speech-safe Armenian. Handles commercial numbers, currencies, brands, suffixes and code-switching.",
    translate:"Translate HY / EN / RU while preserving prices, numbers, URLs, brand tokens and natural Armenian syntax.",
    captions:"Generate production-ready cue timing plus SRT and WebVTT from text, or use provider alignment through the API.",
    transcribe:"Audio → STT → HAY Armenian correction. The correction layer refuses edits that lose protected values or brand tokens.",
  };

  return <main className="languageLabPage">
    <header className="languageLabNav"><a href="/"><HayLogo/></a><nav><a href="/studio">MARKETING OS</a><a href="/creator">CREATOR</a><a href="/voice">VOICE</a><a href="/quality">QUALITY</a><a href="/pronunciations">DICTIONARY</a><a href="/corrections">TEACH HAY</a><a href="/developers">DEVELOPERS</a></nav><span>HAY / LANGUAGE API V1</span></header>

    <section className="languageHero"><div><span>ARMENIAN LANGUAGE INFRASTRUCTURE / 01</span><h1>Հայերենը ոչ թե<br/><em>թարգմանություն է։</em></h1></div><p>Pronunciation, transcription correction, captions and translation behind one Armenian-first control layer. Foundation models stay replaceable; HAY owns the Armenian behavior.</p></section>

    <section className="languageWorkbench">
      <div className="languageModes">{(["pronounce","translate","captions","transcribe"] as Mode[]).map((item,index)=><button key={item} className={mode===item?"active":""} onClick={()=>{setMode(item);setResult(null);setMessage("");}}><span>0{index+1}</span><b>{item.toUpperCase()}</b></button>)}</div>
      <div className="languageComposer">
        <header><span>INPUT / {mode.toUpperCase()}</span><b>HY-AM</b></header>
        <p>{descriptions[mode]}</p>
        {mode!=="transcribe"?<textarea value={text} onChange={event=>setText(event.target.value)} maxLength={7000}/>:<label className="languageDrop"><input type="file" accept="audio/*,.mp3,.wav,.m4a,.webm,.mp4" onChange={event=>setFile(event.target.files?.[0]||null)}/><span>{file?file.name:"Choose Armenian audio"}</span><small>{file?`${Math.round(file.size/1024)} KB`:"MP3 · WAV · M4A · WEBM · audio/video containers supported by the STT provider"}</small></label>}
        <div className="languageControls">
          {mode==="translate"&&<label>Target<select value={target} onChange={event=>setTarget(event.target.value as Locale)}><option value="hy">Armenian</option><option value="en">English</option><option value="ru">Russian</option></select></label>}
          {mode==="captions"&&<label>Duration<input type="number" min="1" max="3600" value={duration} onChange={event=>setDuration(Number(event.target.value)||15)}/><i>seconds</i></label>}
          <button onClick={run} disabled={busy||(mode==="transcribe"?!file:!text.trim())}>{busy?"PROCESSING ···":`RUN ${mode.toUpperCase()} →`}</button>
        </div>
        {message&&<div className="languageMessage">{message}</div>}
      </div>
      <aside className="languageOutput">
        <header><span>OUTPUT / 02</span><b>{result?"READY":"STANDBY"}</b></header>
        <div className="languageOutputText"><small>{mode==="pronounce"?"SPOKEN FORM":mode==="captions"?"SRT / STRUCTURED CUES":"HAY RESULT"}</small><pre>{output}</pre></div>
        {result&&<details><summary>STRUCTURED JSON</summary><pre>{JSON.stringify(result,null,2)}</pre></details>}
      </aside>
    </section>

    <section className="languageArchitecture"><div><span>HAY LANGUAGE PIPELINE</span><h2>Provider in. Armenian control out.</h2></div><ol><li><b>01</b><span>FOUNDATION PROVIDER</span><p>OpenAI STT / language models, ElevenLabs, Azure, future Chirp routing.</p></li><li><b>02</b><span>HAY CONTROL</span><p>Protected values, pronunciation graph, code-switch rules, transcript and editorial correction.</p></li><li><b>03</b><span>QUALITY GATE</span><p>Deterministic Armenian regressions plus reviewed blind benchmarks.</p></li><li><b>04</b><span>HUMAN MEMORY</span><p>Private corrections can become reviewed provenance only after explicit consent and human review.</p></li></ol></section>

    <footer className="languageLabFooter"><span>HAY LANGUAGE API / V1</span><span>HY-AM FIRST · EN · RU</span><a href="/corrections">TEACH HAY A CORRECTION ↗</a></footer>
  </main>;
}
