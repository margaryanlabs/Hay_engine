import OpenAI from "openai";
import { applyArmenianMarketingEditorialPass } from "@/lib/hay/marketing-editor";
import { applyBaselineSchedule } from "./scheduler";
import type { BusinessProfile, CompetitorInput, ContentFormat, ContentItem, MarketingPlan, SocialPlatform } from "./types";
import type { MarketingPerformanceContext } from "./performance";

const localeCopy = {
  hy: { strategy:"Կառուցել ճանաչելիություն, վստահություն և վաճառք՝ հայկական բնական լեզվով, ոչ թե բառացի թարգմանված կոնտենտով։", positioning:"Տեղական կոնտեքստը հասկանալով՝ բրենդը դարձնել պարզ, հիշվող և հետևողական։", promise:"Ամեն հրապարակում պետք է ունենա մեկ հստակ պատճառ՝ դիտելու, վստահելու կամ գործելու համար։", audience:["հիմնական գնորդներ","նոր հետաքրքրված լսարան","կրկնվող հաճախորդներ"], pillars:["ապացույց և վստահություն","պրոդուկտ/ծառայություն","մարդիկ և պատմություն","օգտակար գիտելիք","առաջարկ և CTA"], voice:["բնական","կարճ","վստահ","ոչ կաղապարային"] },
  en: { strategy:"Build reach, trust and conversion with a consistent brand system rather than random posting.", positioning:"Make the business unmistakable through local context, proof and a repeatable creative language.", promise:"Every post earns attention, builds trust or moves the audience toward an action.", audience:["core buyers","new discovery audience","returning customers"], pillars:["proof and trust","product/service","people and story","useful expertise","offer and CTA"], voice:["clear","human","confident","specific"] },
  ru: { strategy:"Строить охват, доверие и продажи системой контента, а не случайными публикациями.", positioning:"Сделать бизнес узнаваемым через локальный контекст, доказательства и единый креативный язык.", promise:"Каждый материал должен либо зацепить, либо укрепить доверие, либо привести к действию.", audience:["основные покупатели","новая аудитория","повторные клиенты"], pillars:["доверие и доказательства","продукт/услуга","люди и история","польза","оффер и CTA"], voice:["естественный","короткий","уверенный","конкретный"] },
} as const;

const formats: ReadonlyArray<readonly [SocialPlatform, ContentFormat]> = [["instagram","reel"],["instagram","carousel"],["tiktok","short"],["instagram","story"],["youtube","short"],["facebook","post"],["instagram","reel"]];
const platforms: SocialPlatform[] = ["instagram","tiktok","youtube","facebook","linkedin"];
const contentFormats: ContentFormat[] = ["reel","story","carousel","post","short","video"];
const objectives: ContentItem["objective"][] = ["reach","trust","conversion","retention","community"];

function demoPlan(business: BusinessProfile, competitors: CompetitorInput[], horizonDays = 7): MarketingPlan {
  const t = localeCopy[business.primaryLanguage];
  const items: ContentItem[] = Array.from({ length: Math.max(7,horizonDays) }, (_,index) => {
    const [platform,format] = formats[index % formats.length];
    const day=(index%horizonDays)+1;
    const category=business.category||"business";
    const hooks=business.primaryLanguage==="hy"?["Ինչո՞ւ են մարդիկ ընտրում հենց մեզ","Մի բան, որ հաճախ սխալ են հասկանում","15 վայրկյանում ցույց տանք իրական տարբերությունը","Հաճախորդի ճանապարհը՝ մինչև և հետո"]:business.primaryLanguage==="ru"?["Почему клиенты выбирают нас","Что в этой нише обычно понимают неправильно","Показываем реальную разницу за 15 секунд","Путь клиента: до и после"]:["Why customers choose us","What people usually misunderstand","The real difference in 15 seconds","Customer journey: before and after"];
    const objective: ContentItem["objective"] = index%3===0?"reach":index%3===1?"trust":"conversion";
    return { id:`content-${index+1}`,day,platform,format,language:business.primaryLanguage,objective,hook:hooks[index%hooks.length],concept:`${business.name}: ${category} content built around ${t.pillars[index%t.pillars.length]}.`,caption:`${hooks[index%hooks.length]}. ${business.offer||business.description}`.trim(),cta:business.primaryLanguage==="hy"?"Գրիր մեզ՝ մանրամասների համար։":business.primaryLanguage==="ru"?"Напишите нам, чтобы узнать детали.":"Message us for details.",hashtags:[business.name.replace(/\s+/g,""),category.replace(/\s+/g,""),"Armenia"].filter(Boolean).map(tag=>`#${tag}`),assetBrief:`Vertical ${format}, premium local ${category} visual language, authentic Armenia context, no fake UI, no baked-in text; HAY Engine overlays typography separately.`,status:"idea" };
  });
  return { id:crypto.randomUUID(),createdAt:new Date().toISOString(),horizonDays,business,brand:{positioning:t.positioning,promise:t.promise,audience:business.audience?[business.audience,...t.audience]:[...t.audience],differentiators:[business.offer||business.description||business.category,`Local ${business.location||"Armenia"} context`,"Armenian-first content intelligence"].filter(Boolean),contentPillars:[...t.pillars],voice:business.tone?[business.tone,...t.voice]:[...t.voice],risks:["generic AI wording","inconsistent visual identity","publishing without approval or account permissions"]},competitors:competitors.map(item=>({name:item.name,strength:"Consistent category visibility",gap:"Likely opportunity for more distinctive Armenian-first storytelling and proof-led content",opportunity:`Own a sharper point of view than ${item.name} and test stronger hooks, formats and offers.`})),strategySummary:t.strategy,items,generatedBy:"hay-demo" };
}

function parseJson(raw:string):unknown { return JSON.parse(raw.replace(/^```json\s*/i,"").replace(/```$/i,"").trim()); }
function stringValue(value:unknown,fallback:string){return typeof value==="string"&&value.trim()?value.trim():fallback;}
function stringArray(value:unknown,fallback:string[]){return Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim())).map(item=>item.trim()):fallback;}

function normalizeAiItem(value:unknown,index:number,fallback:ContentItem,business:BusinessProfile):ContentItem{
  if(!value||typeof value!=="object")return fallback;
  const item=value as Record<string,unknown>;
  const platform=platforms.includes(item.platform as SocialPlatform)?item.platform as SocialPlatform:fallback.platform;
  const format=contentFormats.includes(item.format as ContentFormat)?item.format as ContentFormat:fallback.format;
  const objective=objectives.includes(item.objective as ContentItem["objective"])?item.objective as ContentItem["objective"]:fallback.objective;
  return { ...fallback,id:`content-${index+1}`,day:Number.isFinite(Number(item.day))?Math.max(1,Math.round(Number(item.day))):fallback.day,platform,format,language:business.primaryLanguage,objective,hook:stringValue(item.hook,fallback.hook),concept:stringValue(item.concept,fallback.concept),caption:stringValue(item.caption,fallback.caption),cta:stringValue(item.cta,fallback.cta),hashtags:stringArray(item.hashtags,fallback.hashtags),assetBrief:stringValue(item.assetBrief,fallback.assetBrief),status:"idea" };
}

async function finalizePlan(plan:MarketingPlan){
  const edited=await applyArmenianMarketingEditorialPass(plan);
  return applyBaselineSchedule(edited);
}

export async function buildMarketingPlan(business:BusinessProfile,competitors:CompetitorInput[]=[],horizonDays=7,performance:MarketingPerformanceContext|null=null):Promise<MarketingPlan>{
  const fallback=demoPlan(business,competitors,horizonDays);
  if(!process.env.OPENAI_API_KEY)return finalizePlan(fallback);
  try{
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const performanceInstruction=performance?`\n\nMEASURED PERFORMANCE FROM PREVIOUS PUBLISHED CONTENT:\n${JSON.stringify(performance)}\nUse this evidence to reinforce winning platforms/formats/hooks while still reserving roughly 20-30% of the plan for controlled experiments. Do not confuse correlation with causation and do not invent missing metrics.`:"\n\nMEASURED PERFORMANCE: none yet. Treat the first plan as a deliberate baseline with varied hooks and formats so HAY can learn.";
    const response=await client.responses.create({model:process.env.OPENAI_MARKETING_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna",reasoning:{effort:"low"},input:`You are HAY Marketing OS, an Armenian-first senior strategist, SMM lead and creative director.\n\nBuild a ${horizonDays}-day executable social content plan. Armenian must be native, idiomatic Eastern Armenian when language is hy, not a literal translation. Avoid fake performance claims. Differentiate strategy, content pillars, hooks and conversion assets.\n\nBUSINESS:\n${JSON.stringify(business)}\n\nCOMPETITORS SUPPLIED BY USER:\n${JSON.stringify(competitors)}${performanceInstruction}\n\nReturn ONLY valid JSON with this shape:\n{"brand":{"positioning":"","promise":"","audience":[""],"differentiators":[""],"contentPillars":[""],"voice":[""],"risks":[""]},"competitors":[{"name":"","strength":"","gap":"","opportunity":""}],"strategySummary":"","items":[{"day":1,"platform":"instagram","format":"reel","objective":"reach","hook":"","concept":"","caption":"","cta":"","hashtags":["#"],"assetBrief":""}]}\nUse platforms instagram, tiktok, youtube, facebook. Use formats reel, story, carousel, post, short, video. Include at least ${Math.max(horizonDays,7)} content items.`});
    const parsed=parseJson(response.output_text);
    if(!parsed||typeof parsed!=="object")return finalizePlan(fallback);
    const root=parsed as Record<string,unknown>;
    const aiBrand=root.brand&&typeof root.brand==="object"?root.brand as Record<string,unknown>:{};
    const brand={positioning:stringValue(aiBrand.positioning,fallback.brand.positioning),promise:stringValue(aiBrand.promise,fallback.brand.promise),audience:stringArray(aiBrand.audience,fallback.brand.audience),differentiators:stringArray(aiBrand.differentiators,fallback.brand.differentiators),contentPillars:stringArray(aiBrand.contentPillars,fallback.brand.contentPillars),voice:stringArray(aiBrand.voice,fallback.brand.voice),risks:stringArray(aiBrand.risks,fallback.brand.risks)};
    const aiItems=Array.isArray(root.items)?root.items:[];
    const generated={...fallback,brand,strategySummary:stringValue(root.strategySummary,fallback.strategySummary),items:aiItems.length?aiItems.map((item,index)=>normalizeAiItem(item,index,fallback.items[index%fallback.items.length],business)):fallback.items,generatedBy:"openai" as const};
    return finalizePlan(generated);
  }catch(error){console.error("Marketing plan generation failed",error);return finalizePlan(fallback);}
}
