import OpenAI from "openai";
import { cleanLanguageText, preservesProtectedTokens } from "./protected-values";
import type { Locale } from "./types";

export async function translateHayText(args:{text:string;source?:Locale|"auto";target:Locale}){
  const input=cleanLanguageText(args.text);
  const source=args.source||"auto";
  if(!input)return {text:"",configured:true,generatedBy:"identity" as const,source,target:args.target};
  if(source===args.target)return {text:input,configured:true,generatedBy:"identity" as const,source,target:args.target};
  if(!process.env.OPENAI_API_KEY)return {text:input,configured:false,generatedBy:"unconfigured" as const,source,target:args.target};

  const language=args.target==="hy"?"Armenian (contemporary Eastern Armenian as used naturally in Armenia)":args.target==="ru"?"Russian":"English";
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const response=await client.responses.create({
    model:process.env.OPENAI_TRANSLATE_MODEL||process.env.OPENAI_MARKETING_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna",
    reasoning:{effort:"low"},
    input:`Translate the text into ${language}.\n\nHAY translation rules:\n- Preserve the exact meaning and factual claims.\n- Preserve every number, price, percentage, URL, ticker and Latin-script brand/product/person token exactly.\n- Preserve natural brand names and code-switching instead of translating them mechanically.\n- When target is Armenian, write idiomatic modern Eastern Armenian, not Russian/English syntax in Armenian words and not bureaucratic officialese.\n- Do not add explanations, notes or quotation marks.\n- Return only the translation.\n\nSOURCE LANGUAGE: ${source}\nTARGET: ${args.target}\nTEXT:\n${input}`,
  });
  const candidate=cleanLanguageText(response.output_text||"");
  if(!candidate||!preservesProtectedTokens(input,candidate))return {text:input,configured:true,generatedBy:"rejected" as const,source,target:args.target,preservationFailed:true};
  return {text:candidate,configured:true,generatedBy:"openai" as const,source,target:args.target};
}
