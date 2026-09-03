"use client";

import { useMemo, useState } from "react";
import HayLogo from "./HayLogo";
import { averageRubric, blindCandidates, NATIVE_BENCHMARK_CASES, NATIVE_BENCHMARK_RUBRIC, NATIVE_BENCHMARK_VERSION, type BenchmarkCandidateInput, type BenchmarkRubricScore } from "@/lib/hay/native-benchmark";

type ReviewRecord={candidateId:string;score:BenchmarkRubricScore;note:string};
type BlindState={caseId:string;sessionId:string;candidates:Array<{id:string;text:string}>;reveal:Record<string,string>;reviews:Record<string,ReviewRecord>;preferred?:string};

const emptyScore=():BenchmarkRubricScore=>({naturalness:3,grammar:3,meaning:3,localAuthenticity:3,codeSwitch:3,brandSafety:3});
const defaultCandidates:BenchmarkCandidateInput[]=[{providerId:"HAY",text:""},{providerId:"Provider 2",text:""},{providerId:"Provider 3",text:""}];

export default function NativeBenchmarkLab(){
  const [caseId,setCaseId]=useState(NATIVE_BENCHMARK_CASES[0].id);
  const [candidates,setCandidates]=useState<BenchmarkCandidateInput[]>(defaultCandidates);
  const [blind,setBlind]=useState<BlindState|null>(null);
  const [activeCandidate,setActiveCandidate]=useState("A");
  const [score,setScore]=useState<BenchmarkRubricScore>(emptyScore());
  const [note,setNote]=useState("");
  const [message,setMessage]=useState("");
  const benchmarkCase=NATIVE_BENCHMARK_CASES.find(item=>item.id===caseId)||NATIVE_BENCHMARK_CASES[0];
  const active=blind?.candidates.find(item=>item.id===activeCandidate)||blind?.candidates[0];
  const completed=blind?blind.candidates.filter(item=>blind.reviews[item.id]).length:0;
  const allDone=Boolean(blind&&completed===blind.candidates.length);

  const ranking=useMemo(()=>{
    if(!blind)return [];
    return blind.candidates.map(candidate=>({candidateId:candidate.id,provider:blind.reveal[candidate.id],average:blind.reviews[candidate.id]?averageRubric(blind.reviews[candidate.id].score):0})).sort((a,b)=>b.average-a.average);
  },[blind]);

  function resetCase(id:string){setCaseId(id);setCandidates(defaultCandidates.map(item=>({...item})));setBlind(null);setActiveCandidate("A");setScore(emptyScore());setNote("");setMessage("");}
  function patchCandidate(index:number,key:keyof BenchmarkCandidateInput,value:string){setCandidates(current=>current.map((item,i)=>i===index?{...item,[key]:value}:item));}

  function startBlind(){
    const valid=candidates.filter(item=>item.providerId.trim()&&item.text.trim());
    if(valid.length<2){setMessage("Add at least two real provider outputs before blinding the case.");return;}
    const sessionId=crypto.randomUUID();
    const value=blindCandidates(caseId,sessionId,valid);
    setBlind({caseId,sessionId,candidates:value.candidates,reveal:value.reveal,reviews:{}});
    setActiveCandidate(value.candidates[0].id);setScore(emptyScore());setNote("");setMessage("Provider names are hidden. Score the text, not the model.");
  }

  function loadCandidate(id:string){
    if(!blind)return;
    setActiveCandidate(id);
    const review=blind.reviews[id];
    setScore(review?.score||emptyScore());setNote(review?.note||"");
  }

  function saveReview(){
    if(!blind||!active)return;
    const next={...blind,reviews:{...blind.reviews,[active.id]:{candidateId:active.id,score,note:note.trim()}}};
    setBlind(next);
    const nextCandidate=next.candidates.find(item=>!next.reviews[item.id]);
    if(nextCandidate){setActiveCandidate(nextCandidate.id);setScore(emptyScore());setNote("");setMessage(`Saved ${active.id}. Continue with ${nextCandidate.id}.`);}else setMessage("Blind scoring complete. You can now choose the preferred output and reveal providers.");
  }

  function exportResult(){
    if(!blind)return;
    const payload={version:NATIVE_BENCHMARK_VERSION,exportedAt:new Date().toISOString(),case:benchmarkCase,sessionId:blind.sessionId,reviews:Object.values(blind.reviews),preferred:blind.preferred||null,reveal:allDone?blind.reveal:undefined,ranking:allDone?ranking:undefined};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`hay-benchmark-${benchmarkCase.id}-${blind.sessionId.slice(0,8)}.json`;anchor.click();URL.revokeObjectURL(url);
  }

  return <main className="nativeBenchmarkPage">
    <header className="nativeBenchmarkNav"><a href="/"><HayLogo/></a><nav><a href="/language">LANGUAGE</a><a href="/voice">VOICE</a><a href="/quality">QUALITY</a><a className="active" href="/benchmark">NATIVE BENCHMARK</a></nav><span>{NATIVE_BENCHMARK_VERSION.toUpperCase()}</span></header>

    <section className="nativeBenchmarkHero"><div><span>BLIND NATIVE-SPEAKER EVALUATION / ARMENIAN</span><h1>Չիմանալ՝ ով է գրել։<br/><em>Միայն լսել՝ որն է լավը։</em></h1></div><p>HAY deterministic regression catches engineering mistakes. This lab is for the harder question: which output actually sounds better to native Armenian speakers when provider identity is hidden?</p></section>

    <section className="nativeBenchmarkShell">
      <aside className="benchmarkCases"><header><span>TEST PACK</span><b>{NATIVE_BENCHMARK_CASES.length} CASES</b></header>{NATIVE_BENCHMARK_CASES.map(item=><button key={item.id} className={caseId===item.id?"active":""} onClick={()=>resetCase(item.id)}><span>{item.id.toUpperCase()}</span><strong>{item.domain}</strong><small>{item.task}</small></button>)}</aside>

      <div className="benchmarkMain">
        <section className="benchmarkBrief"><div><span>{benchmarkCase.id.toUpperCase()} / {benchmarkCase.domain.toUpperCase()}</span><b>{benchmarkCase.task.toUpperCase()}</b></div><h2>{benchmarkCase.prompt}</h2><ul>{benchmarkCase.constraints.map(value=><li key={value}>{value}</li>)}</ul>{benchmarkCase.protectedValues.length>0&&<footer><span>PROTECTED</span>{benchmarkCase.protectedValues.map(value=><b key={value}>{value}</b>)}</footer>}</section>

        {!blind?<section className="benchmarkSetup"><header><span>OPERATOR SETUP</span><b>PROVIDER NAMES WILL BE HIDDEN AFTER START</b></header><p>Paste real outputs from HAY and the providers you want to compare. Do not edit them after generation. At least two candidates are required.</p>{candidates.map((candidate,index)=><article key={index}><input value={candidate.providerId} onChange={event=>patchCandidate(index,"providerId",event.target.value)} aria-label={`Provider ${index+1}`}/><textarea value={candidate.text} onChange={event=>patchCandidate(index,"text",event.target.value)} placeholder="Paste exact provider output…"/></article>)}<button className="benchmarkPrimary" onClick={startBlind}>START BLIND REVIEW →</button></section>:
        <section className="benchmarkReview"><header><div><span>BLIND REVIEW</span><strong>{completed}/{blind.candidates.length} SCORED</strong></div><div className="candidateTabs">{blind.candidates.map(candidate=><button key={candidate.id} className={activeCandidate===candidate.id?"active":""} onClick={()=>loadCandidate(candidate.id)}>{candidate.id}{blind.reviews[candidate.id]?<i>✓</i>:null}</button>)}</div></header>{active&&<><blockquote>{active.text}</blockquote><div className="rubricGrid">{NATIVE_BENCHMARK_RUBRIC.map(rubric=>{const key=rubric.key as keyof BenchmarkRubricScore;return <label key={key}><span><b>{rubric.label}</b><small>{rubric.description}</small></span><input type="range" min="1" max="5" step="1" value={score[key]} onChange={event=>setScore(current=>({...current,[key]:Number(event.target.value)}))}/><strong>{score[key]}/5</strong></label>;})}</div><label className="reviewNote"><span>Reviewer note</span><textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="What sounds natural or wrong? Avoid guessing the provider."/></label><button className="benchmarkPrimary" onClick={saveReview}>SAVE SCORE →</button></>}</section>}

        {blind&&allDone&&<section className="benchmarkReveal"><header><span>REVIEW COMPLETE / REVEAL</span><b>PROVIDERS UNBLINDED ONLY AFTER SCORING</b></header><div className="revealGrid">{ranking.map((item,index)=><button key={item.candidateId} className={blind.preferred===item.candidateId?"preferred":""} onClick={()=>setBlind(current=>current?{...current,preferred:item.candidateId}:current)}><span>#{index+1} · CANDIDATE {item.candidateId}</span><strong>{item.average.toFixed(2)} / 5</strong><p>{item.provider}</p><small>{blind.preferred===item.candidateId?"PREFERRED ✓":"MARK PREFERRED"}</small></button>)}</div><button className="benchmarkExport" onClick={exportResult}>EXPORT REVIEW JSON ↓</button><p>No result is a public benchmark claim by itself. Aggregate multiple independent native-speaker reviews before publishing comparisons.</p></section>}
        {message&&<div className="benchmarkMessage">{message}</div>}
      </div>
    </section>

    <section className="benchmarkProtocol"><div><span>PROTOCOL / 01</span><h2>What counts as evidence.</h2></div><ol><li><b>01</b><strong>BLIND</strong><p>Provider identity stays hidden until every candidate is scored.</p></li><li><b>02</b><strong>NATIVE</strong><p>Reviewers must be fluent native speakers; record dialect/region only with consent.</p></li><li><b>03</b><strong>REPEATED</strong><p>One reviewer is an anecdote. Aggregate independent reviews and disagreement.</p></li><li><b>04</b><strong>HONEST</strong><p>Publish prompt set, rubric, model/version/date and limitations with the result.</p></li></ol></section>

    <footer className="nativeBenchmarkFooter"><span>HAY / NATIVE SPEAKER BENCHMARK</span><span>NO SYNTHETIC WIN RATE · NO PROVIDER LABELS DURING REVIEW</span><a href="/quality">DETERMINISTIC QUALITY ↗</a></footer>
  </main>;
}
