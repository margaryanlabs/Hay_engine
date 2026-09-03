import "server-only";

import OpenAI from "openai";
import { ruleBasedNaturalizeArmenian } from "./conversational";
import type { MarketingPlan } from "@/lib/marketing/types";

function clean(value:string){return value.trim().replace(/\s+/g," ");}
function natural(value:string){return ruleBasedNaturalizeArmenian(clean(value),"natural");}
function strings(value:unknown,fallback:string[]){
  if(!Array.isArray(value))return fallback;
  const result=value.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim())).map(item=>clean(item));
  return result.length?result:fallback;
}
function stringValue(value:unknown,fallback:string){return typeof value==="string"&&value.trim()?clean(value):fallback;}

// Numbers, prices and Latin-script product/brand terms are factual surface tokens.
// The editorial pass is allowed to improve Armenian around them, never silently rewrite them.
function protectedTokens(value:string){
  return value.match(/(?:[$€₾֏]\s*)?[0-9]+(?:[.,][0-9]+)*(?:\s*(?:[$€₾֏]|AMD|USD|EUR|GEL|%|[kKmM]))?|[A-Za-z][A-Za-z0-9._+-]*(?:-[ընիում]|ը|ն|ի|ում)?/gu)??[];
}
function preservesProtectedTokens(original:string,revised:string){
  const haystack=revised.toLocaleLowerCase("hy-AM");
  return protectedTokens(original).every(token=>haystack.includes(token.toLocaleLowerCase("hy-AM")));
}
function safeRevision(original:string,value:unknown){
  const fallback=natural(original);
  const revised=stringValue(value,fallback);
  return preservesProtectedTokens(original,revised)?revised:fallback;
}

function deterministicPass(plan:MarketingPlan):MarketingPlan{
  if(plan.business.primaryLanguage!=="hy")return plan;
  return {
    ...plan,
    strategySummary:natural(plan.strategySummary),
    brand:{
      positioning:natural(plan.brand.positioning),
      promise:natural(plan.brand.promise),
      audience:plan.brand.audience.map(natural),
      differentiators:plan.brand.differentiators.map(natural),
      contentPillars:plan.brand.contentPillars.map(natural),
      voice:plan.brand.voice.map(natural),
      risks:plan.brand.risks.map(natural),
    },
    competitors:plan.competitors.map(item=>({
      ...item,
      strength:natural(item.strength),
      gap:natural(item.gap),
      opportunity:natural(item.opportunity),
    })),
    items:plan.items.map(item=>({
      ...item,
      hook:natural(item.hook),
      concept:natural(item.concept),
      caption:natural(item.caption),
      cta:natural(item.cta),
    })),
  };
}

export async function applyArmenianMarketingEditorialPass(plan:MarketingPlan):Promise<MarketingPlan>{
  const baseline=deterministicPass(plan);
  if(plan.business.primaryLanguage!=="hy"||!process.env.OPENAI_API_KEY)return baseline;

  const payload={
    business:{
      name:plan.business.name,
      category:plan.business.category,
      location:plan.business.location||"",
      audience:plan.business.audience||"",
      offer:plan.business.offer||"",
      tone:plan.business.tone||"",
    },
    strategySummary:baseline.strategySummary,
    brand:baseline.brand,
    competitors:baseline.competitors.map(({name,strength,gap,opportunity})=>({name,strength,gap,opportunity})),
    items:baseline.items.map(({id,hook,concept,caption,cta})=>({id,hook,concept,caption,cta})),
  };

  try{
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const response=await client.responses.create({
      model:process.env.OPENAI_MARKETING_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna",
      reasoning:{effort:"low"},
      input:`You are HAY Armenian Editorial, the final native-language editor for Armenian commercial content.\n\nTASK\nEdit ONLY the Armenian wording in the supplied marketing draft. Make it sound like contemporary, educated Eastern Armenian used by a strong Armenian brand in Armenia — written originally in Armenian, never translated word-for-word from English or Russian.\n\nNON-NEGOTIABLE RULES\n- Preserve meaning, claims, offer, CTA intent, business facts and competitive facts. Do not add claims or invented facts.\n- Preserve every number, price, percentage, currency token, URL-like token, Latin-script brand/product name and acronym exactly as written.\n- Prefer clear Armenian verbs and short natural syntax over bureaucratic nominal phrases.\n- Remove literal-translation rhythm, officialese and generic AI filler.\n- Do not force slang. Mild spoken Armenian is acceptable only where it improves a Reel hook/caption and remains brand-safe.\n- Do not inject Russian words merely to sound casual.\n- Keep hooks sharp and captions human; CTA must be direct, not robotic.\n- Keep item ids and competitor names unchanged.\n- Return ONLY valid JSON with exactly these top-level keys: strategySummary, brand, competitors, items.\n- brand must keep: positioning, promise, audience, differentiators, contentPillars, voice, risks.\n- competitors must keep: name, strength, gap, opportunity.\n- items must keep: id, hook, concept, caption, cta.\n\nDRAFT\n${JSON.stringify(payload)}`,
    });
    const parsed=JSON.parse(response.output_text.replace(/^```json\s*/i,"").replace(/```$/i,"").trim()) as Record<string,unknown>;
    const brand=parsed.brand&&typeof parsed.brand==="object"?parsed.brand as Record<string,unknown>:{};
    const competitorValues=Array.isArray(parsed.competitors)?parsed.competitors:[];
    const itemValues=Array.isArray(parsed.items)?parsed.items:[];

    return {
      ...baseline,
      strategySummary:safeRevision(baseline.strategySummary,parsed.strategySummary),
      brand:{
        positioning:safeRevision(baseline.brand.positioning,brand.positioning),
        promise:safeRevision(baseline.brand.promise,brand.promise),
        audience:strings(brand.audience,baseline.brand.audience).map((value,index)=>safeRevision(baseline.brand.audience[index]??value,value)),
        differentiators:strings(brand.differentiators,baseline.brand.differentiators).map((value,index)=>safeRevision(baseline.brand.differentiators[index]??value,value)),
        contentPillars:strings(brand.contentPillars,baseline.brand.contentPillars).map((value,index)=>safeRevision(baseline.brand.contentPillars[index]??value,value)),
        voice:strings(brand.voice,baseline.brand.voice).map((value,index)=>safeRevision(baseline.brand.voice[index]??value,value)),
        risks:strings(brand.risks,baseline.brand.risks).map((value,index)=>safeRevision(baseline.brand.risks[index]??value,value)),
      },
      competitors:baseline.competitors.map((item,index)=>{
        const candidate=competitorValues[index]&&typeof competitorValues[index]==="object"?competitorValues[index] as Record<string,unknown>:{};
        return {
          ...item,
          strength:safeRevision(item.strength,candidate.strength),
          gap:safeRevision(item.gap,candidate.gap),
          opportunity:safeRevision(item.opportunity,candidate.opportunity),
        };
      }),
      items:baseline.items.map((item,index)=>{
        const byIndex=itemValues[index]&&typeof itemValues[index]==="object"?itemValues[index] as Record<string,unknown>:{};
        const matching=itemValues.find(value=>value&&typeof value==="object"&&String((value as Record<string,unknown>).id||"")===item.id);
        const candidate=matching&&typeof matching==="object"?matching as Record<string,unknown>:byIndex;
        return {
          ...item,
          hook:safeRevision(item.hook,candidate.hook),
          concept:safeRevision(item.concept,candidate.concept),
          caption:safeRevision(item.caption,candidate.caption),
          cta:safeRevision(item.cta,candidate.cta),
        };
      }),
    };
  }catch(error){
    console.error("HAY Armenian marketing editorial pass failed",error);
    return baseline;
  }
}
