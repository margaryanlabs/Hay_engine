import OpenAI from "openai";

export type ArmenianSpeechStyle = "standard" | "natural" | "yerevan";

const naturalPairs: Array<[RegExp,string]> = [
  [/(?<!\p{L})ներկայումս(?!\p{L})/giu,"հիմա"],
  [/(?<!\p{L})այժմ(?!\p{L})/giu,"հիմա"],
  [/(?<!\p{L})այնուհետև(?!\p{L})/giu,"հետո"],
  [/(?<!\p{L})ցանկանում եք(?!\p{L})/giu,"ուզում եք"],
  [/(?<!\p{L})ցանկանում ես(?!\p{L})/giu,"ուզում ես"],
  [/(?<!\p{L})ցանկանում եմ(?!\p{L})/giu,"ուզում եմ"],
  [/(?<!\p{L})անհրաժեշտ է(?!\p{L})/giu,"պետք է"],
  [/(?<!\p{L})հնարավորություն ունեք(?!\p{L})/giu,"կարող եք"],
  [/(?<!\p{L})հնարավորություն ունես(?!\p{L})/giu,"կարող ես"],
  [/(?<!\p{L})իրականացնել(?!\p{L})/giu,"անել"],
  [/(?<!\p{L})իրականացնում է(?!\p{L})/giu,"անում է"],
  [/(?<!\p{L})իրականացնում ենք(?!\p{L})/giu,"անում ենք"],
  [/(?<!\p{L})հանդիսանում է(?!\p{L})/giu,"է"],
  [/(?<!\p{L})տվյալ դեպքում(?!\p{L})/giu,"այս դեպքում"],
  [/(?<!\p{L})սկսած այս պահից(?!\p{L})/giu,"այս պահից"],
  [/(?<!\p{L})կատարել պատվեր(?!\p{L})/giu,"պատվիրել"],
  [/(?<!\p{L})կատարել վճարում(?!\p{L})/giu,"վճարել"],
  [/(?<!\p{L})կատարել ընտրություն(?!\p{L})/giu,"ընտրել"],
  [/(?<!\p{L})ձեռք բերել(?!\p{L})/giu,"գնել"],
];

const yerevanPairs: Array<[RegExp,string]> = [
  [/(?<!\p{L})այս մեկը(?!\p{L})/giu,"էս մեկը"],
  [/(?<!\p{L})այդ մեկը(?!\p{L})/giu,"էդ մեկը"],
  [/(?<!\p{L})այսպես(?!\p{L})/giu,"էսպես"],
  [/(?<!\p{L})այդպես(?!\p{L})/giu,"էդպես"],
  [/(?<!\p{L})այս դեպքում(?!\p{L})/giu,"էս դեպքում"],
  [/(?<!\p{L})այդ դեպքում(?!\p{L})/giu,"էդ դեպքում"],
  [/(?<!\p{L})այս պահին(?!\p{L})/giu,"էս պահին"],
  [/(?<!\p{L})այդ պահին(?!\p{L})/giu,"էդ պահին"],
  [/(?<!\p{L})այո(?!\p{L})/giu,"հա"],
];

export function ruleBasedNaturalizeArmenian(text:string, style:ArmenianSpeechStyle){
  let result=text.trim().replace(/\s+/g," ");
  if(style==="standard") return result;
  for(const [pattern,value] of naturalPairs) result=result.replace(pattern,value);
  if(style==="yerevan") for(const [pattern,value] of yerevanPairs) result=result.replace(pattern,value);
  return result.replace(/\s+([,։.!?])/g,"$1").trim();
}

export async function naturalizeArmenianText(text:string, style:ArmenianSpeechStyle="natural"){
  const fallback=ruleBasedNaturalizeArmenian(text,style);
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
