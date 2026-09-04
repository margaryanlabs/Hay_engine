"use client";

import { useEffect,useMemo,useState } from "react";
import { EMPLOYEE_PLANS } from "@/lib/employee/pricing";
import HayLogo from "./HayLogo";

type Employee={id:string;displayName:string;role:string;locale:string;speechStyle:string;greeting:string;status:string;capabilities:Record<string,boolean>};
type Turn={role:"caller"|"employee";text:string};
type Action={type:string;summaryHy:string;requiresConfirmation:boolean;payload:Record<string,string|number|boolean|null>};
type InboxItem={id:string;kind:string;status:string;title:string;customer_name?:string|null;phone?:string|null;scheduled_for?:string|null;created_at:string};
type PreviewResult={turn?:{reply:string;intent:string;confidence:number;action?:Action|null;shouldHandoff:boolean;handoffReason?:string|null}};
type Readiness={subscription?:{enforced:boolean;ready:boolean;summary?:{entitlement?:{plan_id?:string;status?:string;employee_seats?:number;included_minutes?:number;concurrent_calls?:number}|null;usedMinutes?:number;activeCalls?:number}};realtimePilotConfigured?:boolean;blockers?:string[]};

const amd=(value:number)=>new Intl.NumberFormat("hy-AM").format(value);

export default function EmployeeLab(){
  const [business,setBusiness]=useState<{id:string;name:string}|null>(null);
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [name,setName]=useState("Անի");
  const [role,setRole]=useState("receptionist");
  const [style,setStyle]=useState("natural");
  const [greeting,setGreeting]=useState("Բարև ձեզ։ HAY-ից Անի-ն է։ Ինչո՞վ կարող եմ օգնել։");
  const [message,setMessage]=useState("");
  const [turns,setTurns]=useState<Turn[]>([]);
  const [lastResult,setLastResult]=useState<PreviewResult["turn"]|null>(null);
  const [inbox,setInbox]=useState<InboxItem[]>([]);
  const [readiness,setReadiness]=useState<Readiness|null>(null);
  const [busy,setBusy]=useState(false);
  const [actionBusy,setActionBusy]=useState(false);
  const [notice,setNotice]=useState("");

  const selected=useMemo(()=>employees.find(item=>item.id===selectedId)||employees[0]||null,[employees,selectedId]);
  const subscription=readiness?.subscription?.summary;
  const entitlement=subscription?.entitlement||null;

  async function refreshInbox(businessId?:string){
    const id=businessId||business?.id;if(!id)return;
    const response=await fetch(`/api/employee/inbox?businessId=${encodeURIComponent(id)}`,{cache:"no-store"});
    const data=await response.json().catch(()=>({}));if(response.ok)setInbox(data.items||[]);
  }

  async function refresh(){
    const [studioResponse,employeeResponse,readinessResponse]=await Promise.all([fetch("/api/studio/overview",{cache:"no-store"}),fetch("/api/employees",{cache:"no-store"}),fetch("/api/employee/readiness",{cache:"no-store"})]);
    const studio=await studioResponse.json().catch(()=>({}));
    const employeeData=await employeeResponse.json().catch(()=>({}));
    const readyData=await readinessResponse.json().catch(()=>({}));
    if(studioResponse.ok&&studio.business){setBusiness(studio.business);void refreshInbox(studio.business.id);}
    if(employeeResponse.ok){setEmployees(employeeData.employees||[]);if(!selectedId&&employeeData.employees?.[0]?.id)setSelectedId(employeeData.employees[0].id);}
    else if(employeeData.error)setNotice(employeeData.error);
    if(readinessResponse.ok)setReadiness(readyData);
  }

  useEffect(()=>{refresh().catch(()=>setNotice("employee_load_failed"));},[]);

  async function hire(){
    if(!business){setNotice("Сначала создайте бизнес workspace в HAY Studio.");return;}
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/employees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId:business.id,displayName:name,role,locale:"hy-AM",speechStyle:style,greeting,capabilities:{appointments:true,leads:true,callbacks:true,orders:role==="orders",humanHandoff:true},actionPolicy:{requireCallerConfirmation:true,autoExecute:[],neverExecute:[]},businessRules:["Մի հաստատիր գին, հասանելիություն կամ ամրագրում, եթե տվյալը համակարգում չկա։","Անունը, հեռախոսահամարը, օրը և ժամը գործողությունից առաջ մեկ անգամ հաստատիր։","Եթե հաճախորդը բարկացած է կամ պահանջում է ղեկավար, փոխանցիր մարդուն։"]})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"employee_create_failed");
      setEmployees(current=>[data.employee,...current]);setSelectedId(data.employee.id);setTurns([]);setNotice("Աշխատակիցը ստեղծված է։ Հիմա կարող եք փորձարկել խոսակցությունը։");void refresh();
    }catch(error){setNotice(error instanceof Error?error.message:"employee_create_failed");}finally{setBusy(false);}
  }

  async function send(){
    if(!selected||!message.trim())return;
    const callerText=message.trim();const history=turns.slice(-16);setTurns(current=>[...current,{role:"caller",text:callerText}]);setMessage("");setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/employee/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employeeId:selected.id,message:callerText,history})});
      const data:PreviewResult&{error?:string}=await response.json();if(!response.ok||!data.turn)throw new Error(data.error||"employee_preview_failed");
      setLastResult(data.turn);setTurns(current=>[...current,{role:"employee",text:data.turn!.reply}]);
    }catch(error){setNotice(error instanceof Error?error.message:"employee_preview_failed");}finally{setBusy(false);}
  }

  async function confirmAction(){
    if(!selected||!lastResult?.action)return;
    setActionBusy(true);setNotice("");
    try{
      const response=await fetch("/api/employee/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employeeId:selected.id,action:lastResult.action,callerConfirmed:true,idempotencyKey:`preview:${crypto.randomUUID()}`})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"employee_action_failed");
      setNotice(data.inbox?`Գործողությունը գրանցվեց HAY Inbox-ում՝ ${data.inbox.kind}.`:data.executed?"Գործողությունը հաստատվեց։":"Գործողությունը սպասում է հաստատման։");
      await refreshInbox();
    }catch(error){setNotice(error instanceof Error?error.message:"employee_action_failed");}finally{setActionBusy(false);}
  }

  return <main className="employeePage">
    <header className="employeeNav"><a href="/"><HayLogo/></a><nav><a href="/studio">MARKETING OS</a><a href="/language">LANGUAGE</a><a href="/voice">VOICE</a><a href="/developers">DEVELOPERS</a></nav><span>HAY / AI EMPLOYEE</span></header>

    <section className="employeeHero"><div><span>ARMENIAN AI WORKFORCE / 01</span><h1>Վարձեք աշխատակից,<br/><em>որը խոսում է ինչպես մարդ։</em></h1></div><p>24/7 Armenian receptionist, dispatcher, sales or order operator. HAY owns the business rules, Armenian behavior, action gates and outcome memory; speech/model providers stay replaceable.</p></section>

    <section className="employeeSubscriptionBar">
      <div><span>CURRENT EMPLOYEE PLAN</span><b>{entitlement?.plan_id|| (readiness?.subscription?.enforced?"NOT ACTIVE":"DEMO MODE")}</b></div>
      <div><span>EMPLOYEE SEATS</span><b>{employees.length}{entitlement?.employee_seats?` / ${entitlement.employee_seats}`:""}</b></div>
      <div><span>CALL MINUTES</span><b>{subscription?.usedMinutes||0}{entitlement?.included_minutes?` / ${entitlement.included_minutes}`:""}</b></div>
      <div><span>ACTIVE CALLS</span><b>{subscription?.activeCalls||0}{entitlement?.concurrent_calls?` / ${entitlement.concurrent_calls}`:""}</b></div>
      <div className={readiness?.realtimePilotConfigured?"ready":"notReady"}><span>PHONE READINESS</span><b>{readiness?.realtimePilotConfigured?"READY":"SETUP"}</b></div>
    </section>

    <section className="employeeGrid">
      <aside className="employeeHire">
        <header><span>HIRE / CONFIGURE</span><b>{business?.name||"NO BUSINESS"}</b></header>
        <label>Name<input value={name} onChange={event=>setName(event.target.value)} maxLength={80}/></label>
        <label>Role<select value={role} onChange={event=>setRole(event.target.value)}><option value="receptionist">Receptionist</option><option value="dispatcher">Dispatcher</option><option value="sales">Sales</option><option value="orders">Orders</option></select></label>
        <label>Armenian tone<select value={style} onChange={event=>setStyle(event.target.value)}><option value="standard">Standard</option><option value="natural">Natural Armenia</option><option value="yerevan">Yerevan conversational</option></select></label>
        <label>First line<textarea value={greeting} onChange={event=>setGreeting(event.target.value)} maxLength={500}/></label>
        <button onClick={hire} disabled={busy||!business}>HIRE EMPLOYEE →</button>
        <div className="employeePrinciples"><b>HAY ACTION GATE</b><span>Booking · lead · callback · order · human handoff</span><p>No side effect is trusted just because a model said it happened. Every action is schema-checked, owner-scoped and auditable.</p></div>
      </aside>

      <section className="employeeConsole">
        <header><div><span>LIVE BEHAVIOR LAB</span><h2>{selected?`${selected.displayName} · ${selected.role}`:"Create your first employee"}</h2></div>{selected&&<select value={selected.id} onChange={event=>{setSelectedId(event.target.value);setTurns([]);setLastResult(null);}}>{employees.map(item=><option key={item.id} value={item.id}>{item.displayName} — {item.role}</option>)}</select>}</header>
        <div className="employeeTranscript">{turns.length===0?<div className="employeeEmpty"><b>TEST A REAL CALL FLOW</b><p>Try: «Բարև, ուզում եմ վաղը ժամը 4-ին ատամնաբույժի մոտ գրանցվել։» or «Կարո՞ղ եք ղեկավարին փոխանցել».</p></div>:turns.map((turn,index)=><div key={index} className={`employeeTurn ${turn.role}`}><span>{turn.role==="caller"?"CALLER":"HAY EMPLOYEE"}</span><p>{turn.text}</p></div>)}</div>
        <div className="employeeInput"><textarea value={message} onChange={event=>setMessage(event.target.value)} placeholder="Խոսեք ինչպես իրական հաճախորդը…" onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();send();}}}/><button onClick={send} disabled={busy||!selected||!message.trim()}>{busy?"THINKING ···":"SEND →"}</button></div>
      </section>

      <aside className="employeeTelemetry"><header><span>DECISION / ACTION</span><b>{lastResult?"LIVE":"STANDBY"}</b></header>{lastResult?<><dl><div><dt>INTENT</dt><dd>{lastResult.intent}</dd></div><div><dt>CONFIDENCE</dt><dd>{Math.round(lastResult.confidence*100)}%</dd></div><div><dt>HANDOFF</dt><dd>{lastResult.shouldHandoff?"YES":"NO"}</dd></div></dl>{lastResult.action?<div className="employeeAction"><span>PROPOSED ACTION</span><b>{lastResult.action.type}</b><p>{lastResult.action.summaryHy}</p><small>{lastResult.action.requiresConfirmation?"CALLER CONFIRMATION REQUIRED":"NO CALLER CONFIRMATION REQUIRED"}</small><button onClick={confirmAction} disabled={actionBusy}>{actionBusy?"CAPTURING…":"CONFIRM + CAPTURE →"}</button></div>:<div className="employeeNoAction">No external action proposed.</div>}</>:<p className="employeeTelemetryHelp">HAY separates speech from action. The model may suggest what to do; the action gate decides whether the business system may actually do it.</p>}
        <div className="employeeInbox"><span>HAY INBOX</span>{inbox.length?inbox.slice(0,5).map(item=><div key={item.id}><b>{item.kind}</b><p>{item.title}</p><small>{item.status}{item.scheduled_for?` · ${new Date(item.scheduled_for).toLocaleString()}`:""}</small></div>):<p>No captured work yet.</p>}</div>
      </aside>
    </section>
    {notice&&<div className="employeeNotice">{notice}</div>}

    <section className="employeePlans"><header><span>HIRE BY MONTH / 02</span><h2>Не токены. Рабочее место.</h2><p>Каждый тариф — это сотрудники, включённые минуты и лимит параллельных звонков. Финальные цены можно скорректировать после живого армянского пилота.</p></header><div>{EMPLOYEE_PLANS.map(plan=><article key={plan.id} className={entitlement?.plan_id===plan.id?"active":""}><span>{plan.name.toUpperCase()}</span><h3>{plan.priceAmd?`${amd(plan.priceAmd)} ֏` : "FREE"}<small>/ ամիս</small></h3><p>{plan.descriptionHy}</p><ul><li>{plan.employeeSeats} AI employee{plan.employeeSeats>1?"s":""}</li><li>{plan.includedMinutes} call min / month</li><li>{plan.concurrentCalls} concurrent call{plan.concurrentCalls>1?"s":""}</li><li>max {plan.maxCallMinutes} min / call</li></ul><b>{entitlement?.plan_id===plan.id?"CURRENT PLAN":"MONTHLY EMPLOYEE"}</b></article>)}</div></section>

    <section className="employeeMoat"><span>WHY THIS IS NOT “GPT WITH ARMENIAN VOICE”</span><div><article><b>01</b><h3>Armenian Interaction Kernel</h3><p>Eastern Armenian, Yerevan conversational forms, code-switching, names, numbers, dates, prices and pronunciation behavior owned by HAY.</p></article><article><b>02</b><h3>Business Action Gate</h3><p>Appointments, leads, orders and transfers are typed business actions with confirmation, permissions, idempotency and audit — not free-form model claims.</p></article><article><b>03</b><h3>Outcome Memory</h3><p>Calls become measurable outcomes: appointment request, callback, order, lead, handoff or resolved without action. This feeds the Armenian benchmark loop.</p></article></div></section>
  </main>;
}
