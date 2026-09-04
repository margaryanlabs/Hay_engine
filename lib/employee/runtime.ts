import "server-only";
import OpenAI from "openai";
import { buildEmployeeSystemPrompt,normalizeEmployeeReply,sanitizeAction } from "./armenian-policy";
import type { EmployeeActionDraft,EmployeeBusinessContext,EmployeeConversationTurn,EmployeeProfile,EmployeeTurnResult } from "./types";

const MAX_HISTORY_TURNS=16;
const MAX_CALLER_CHARS=4000;

function safeObject(value:unknown):Record<string,unknown>{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function safeStringMap(value:unknown){
  const input=safeObject(value);const result:Record<string,string>={};
  for(const [key,item] of Object.entries(input).slice(0,20))if(typeof item==="string")result[key.slice(0,80)]=item.slice(0,300);
  return result;
}
function safeMissing(value:unknown){return Array.isArray(value)?value.filter(item=>typeof item==="string").slice(0,12).map(item=>String(item).slice(0,80)):[];}
function parseAction(value:unknown):EmployeeActionDraft|null{
  const input=safeObject(value);const type=String(input.type||"");
  if(!["book_appointment","create_lead","create_callback","take_order","handoff_human"].includes(type))return null;
  const payload=safeObject(input.payload);const safePayload:Record<string,string|number|boolean|null>={};
  for(const [key,item] of Object.entries(payload).slice(0,24)){
    if(typeof item==="string")safePayload[key.slice(0,80)]=item.slice(0,500);
    else if(typeof item==="number"||typeof item==="boolean"||item===null)safePayload[key.slice(0,80)]=item;
  }
  return {type:type as EmployeeActionDraft["type"],summaryHy:String(input.summaryHy||"").slice(0,300),payload:safePayload,requiresConfirmation:input.requiresConfirmation!==false};
}
function parseModelResult(raw:string,profile:EmployeeProfile):EmployeeTurnResult|null{
  try{
    const cleaned=raw.trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();
    const value=safeObject(JSON.parse(cleaned));
    const reply=normalizeEmployeeReply(String(value.reply||""),profile);
    if(!reply)return null;
    return {
      reply,
      intent:String(value.intent||"unknown").slice(0,100),
      confidence:Math.min(1,Math.max(0,Number(value.confidence)||0.5)),
      collected:safeStringMap(value.collected),
      missing:safeMissing(value.missing),
      action:sanitizeAction(profile,parseAction(value.action)),
      shouldHandoff:Boolean(value.shouldHandoff),
      handoffReason:value.handoffReason?String(value.handoffReason).slice(0,300):null,
      generatedBy:"openai",
    };
  }catch{return null;}
}
function fallbackTurn(message:string,profile:EmployeeProfile):EmployeeTurnResult{
  const lower=message.toLocaleLowerCase("hy-AM");
  const asksHuman=/օպերատոր|մարդու հետ|աշխատակցի հետ|ղեկավար|բողոք/u.test(lower);
  const greeting=/^(բարև|բարեւ|ողջույն|hello|hi)\b/iu.test(message.trim());
  const reply=asksHuman
    ? "Իհարկե, փոխանցեմ աշխատակցին։ Մի պահ նշեք՝ ինչ հարցով եք զանգել, որ ճիշտ մարդուն փոխանցեմ։"
    : greeting
      ? `${profile.greeting||"Բարև ձեզ։ Ինչո՞վ կարող եմ օգնել։"}`
      : "Հասկացա։ Մի փոքր հստակեցնե՞ք՝ կոնկրետ ինչ եք ուզում անել, որ ճիշտ օգնեմ։";
  return {reply:normalizeEmployeeReply(reply,profile),intent:asksHuman?"human_handoff":"clarify",confidence:0.45,collected:{},missing:[],action:asksHuman&&profile.capabilities.humanHandoff?sanitizeAction(profile,{type:"handoff_human",summaryHy:"Փոխանցել զանգը աշխատակցին",payload:{reason:message.slice(0,300)},requiresConfirmation:false}):null,shouldHandoff:asksHuman,handoffReason:asksHuman?"caller_requested_human":null,generatedBy:"rules"};
}

export async function runEmployeeTurn(args:{profile:EmployeeProfile;business:EmployeeBusinessContext;message:string;history?:EmployeeConversationTurn[];signal?:AbortSignal}):Promise<EmployeeTurnResult>{
  const message=String(args.message||"").trim().slice(0,MAX_CALLER_CHARS);
  if(!message)throw new Error("employee_message_required");
  const history=(args.history||[]).slice(-MAX_HISTORY_TURNS).map(turn=>({role:turn.role==="employee"?"assistant" as const:"user" as const,content:String(turn.text||"").slice(0,2500)}));
  if(!process.env.OPENAI_API_KEY)return fallbackTurn(message,args.profile);
  try{
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const response=await client.responses.create({
      model:process.env.HAY_EMPLOYEE_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna",
      reasoning:{effort:"low"},
      instructions:buildEmployeeSystemPrompt(args.profile,args.business),
      input:[...history,{role:"user",content:message}],
    },args.signal?{signal:args.signal}:undefined);
    return parseModelResult(response.output_text,args.profile)||fallbackTurn(message,args.profile);
  }catch(error){
    if(args.signal?.aborted)throw error;
    console.error("HAY Employee turn failed",error);
    return fallbackTurn(message,args.profile);
  }
}