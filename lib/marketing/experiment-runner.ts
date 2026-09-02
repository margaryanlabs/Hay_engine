import "server-only";
import OpenAI from "openai";

export type ExperimentVariable="hook";
export type ExperimentRun={
  id:string;
  campaignId:string;
  variable:ExperimentVariable;
  primaryMetric:string;
  controlContentId:string;
  variantContentId:string;
  controlHook:string;
  variantHook:string;
  scheduledFor:string;
  holdConstant:string[];
  status:"draft"|"running"|"measured";
  createdAt:string;
};

type SourceContent={id:string;platform:string;format:string;language:string;objective:string;hook:string;concept:string;caption:string;cta:string;hashtags:string[];asset_brief:string;scheduled_for?:string|null};

const DAY=24*60*60*1000;
const YEREVAN_OFFSET="+04:00";

function clean(value:unknown,max=500){return String(value||"").trim().slice(0,max);}
function localFallbackHook(language:string,hook:string){
  const base=hook.trim();
  if(language==="hy")return `Մինչև որոշելը՝ տես սա․ ${base}`.slice(0,220);
  if(language==="ru")return `Прежде чем решать — посмотрите на это: ${base}`.slice(0,220);
  return `Before you decide, look at this: ${base}`.slice(0,220);
}

export async function generateControlledHookVariant(source:SourceContent,campaign:{name?:unknown;objective?:unknown;offer?:unknown;audience?:unknown}){
  const fallback=localFallbackHook(source.language,source.hook);
  if(!process.env.OPENAI_API_KEY)return fallback;
  try{
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const response=await client.responses.create({
      model:process.env.OPENAI_MARKETING_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna",
      reasoning:{effort:"low"},
      input:`You are HAY Experiment Runner. Create ONE controlled alternative social-media hook. Change only the opening hook. Keep campaign offer, audience, format, CTA intent, factual claims and content concept constant. Do not add discounts, urgency, proof, numbers or claims that are not already present. If language is hy, write native natural Eastern Armenian, not translated Armenian. Return ONLY the hook text, no quotes, no explanation.\n\nCAMPAIGN: ${JSON.stringify({name:clean(campaign.name),objective:clean(campaign.objective),offer:clean(campaign.offer,1000),audience:clean(campaign.audience,700)})}\nSOURCE: ${JSON.stringify({language:source.language,platform:source.platform,format:source.format,objective:source.objective,hook:source.hook,concept:source.concept,cta:source.cta})}`,
    });
    const next=clean(response.output_text,220);
    return next&&next.toLocaleLowerCase("hy-AM")!==source.hook.trim().toLocaleLowerCase("hy-AM")?next:fallback;
  }catch(error){
    console.error("Experiment hook generation failed",error);
    return fallback;
  }
}

export function comparableExperimentWindow(sourceScheduled:string|undefined|null,campaignEnd:string,now=new Date()){
  const end=Date.parse(`${campaignEnd}T23:59:59${YEREVAN_OFFSET}`);
  if(!Number.isFinite(end))return null;
  const minimum=now.getTime()+90*60*1000;
  const source=sourceScheduled?Date.parse(sourceScheduled):Number.NaN;
  const anchor=Number.isFinite(source)?source:minimum;
  const candidates=[anchor+7*DAY,anchor+DAY,minimum+DAY].filter(time=>time>=minimum&&time<=end);
  if(!candidates.length)return null;
  return new Date(candidates[0]).toISOString();
}

export function createExperimentRun(args:{campaignId:string;primaryMetric:string;source:SourceContent;variantContentId:string;variantHook:string;scheduledFor:string}):ExperimentRun{
  return {
    id:`experiment-${crypto.randomUUID()}`,
    campaignId:args.campaignId,
    variable:"hook",
    primaryMetric:clean(args.primaryMetric,40)||"reach",
    controlContentId:args.source.id,
    variantContentId:args.variantContentId,
    controlHook:args.source.hook,
    variantHook:args.variantHook,
    scheduledFor:args.scheduledFor,
    holdConstant:["offer","audience segment","campaign phase","platform","format","objective","CTA intent","creative brief","publish time-of-day as closely as practical"],
    status:"draft",
    createdAt:new Date().toISOString(),
  };
}
