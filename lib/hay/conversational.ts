import OpenAI from "openai";

export type ArmenianSpeechStyle = "standard" | "natural" | "yerevan";

const naturalPairs: Array<[RegExp,string]> = [
  [/\bներկայումս\b/giu,"հիմա"],
  [/\bայժմ\b/giu,"հիմա"],
  [/\bայնուհետև\b/giu,"հետո"],
  [/\bցանկանում եք\b/giu,"ուզում եք"],
  [/\bցանկանում ես\b/giu,"ուզում ես"],
  [/\bցանկանում եմ\b/giu,"ուզում եմ"],
  [/\bանհրաժեշտ է\b/giu,"պետք է"],
  [/\bհնարավորություն ունեք\b/giu,"կարող եք"],
  [/\bհնարավորություն ունես\b/giu,"կարող ես"],
  [/\bիրականացնել\b/giu,"անել"],
  [/\bիրականացնում ենք\b/giu,"անում ենք"],
  [/\bհանդիսանում է\b/giu,"է"],
  [/\bտվյալ դեպքում\b/giu,"էս դեպքում"],
];

const yerevanPairs: Array<[RegExp,string]> = [
  [/\bայս մեկը\b/giu,"էս մեկը"],
  [/\bայդ մեկը\b/giu,"էդ մեկը"],
  [/\bայսպես\b/giu,"էսպես"],
  [/\bայդպես\b/giu,"էդպես"],
  [/\bայո\b/giu,"հա"],
];

function ruleBased(text:string, style:ArmenianSpeechStyle){
  let result=text.trim().replace(/\s+/g," ");
  if(style==="standard") return result;
  for(const [pattern,value] of naturalPairs) result=result.replace(pattern,value);
  if(style==="yerevan") for(const [pattern,value] of yerevanPairs) result=result.replace(pattern,value);
  return result.replace(/\s+([,։.!?])/g,"$1").trim();
}

export async function naturalizeArmenianText(text:string, style:ArmenianSpeechStyle="natural"){
  const fallback=ruleBased(text,style);
  if(style==="standard" || !process.env.OPENAI_API_KEY) return { text:fallback, generatedBy:"rules" as const, style };
  try{
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const mode=style==="yerevan"
      ? "modern casual Yerevan Eastern Armenian. It may use mild everyday forms such as էս/էդ/հա when genuinely natural, but never forced slang."
      : "natural contemporary Eastern Armenian spoken by an educated person in Armenia. Prefer հիմա, ուզում եմ/եք, պետք է and simple spoken syntax when appropriate, but keep it brand-safe and grammatically correct.";
    const response=await client.responses.create({
      model:process.env.OPENAI_MARKETING_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-luna",
      reasoning:{effort:"low"},
      input:`Rewrite the Armenian text for speech in ${mode}\n\nRules:\n- Preserve meaning, facts, names, prices, CTA and brand terms exactly.\n- Do not translate Armenian into another language.\n- Do not invent slang or Russian loanwords.\n- Do not make spelling deliberately incorrect.\n- Keep code-switched international brand/product words if they are natural in Armenia.\n- Return only the rewritten Armenian text.\n\nTEXT:\n${text}`,
    });
    const value=response.output_text.trim();
    return { text:value||fallback, generatedBy:"openai" as const, style };
  }catch(error){
    console.error("Armenian conversational naturalization failed",error);
    return { text:fallback, generatedBy:"rules" as const, style };
  }
}
