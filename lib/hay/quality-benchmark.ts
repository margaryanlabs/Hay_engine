import { ruleBasedNaturalizeArmenian, type ArmenianSpeechStyle } from "./conversational";
import { normalizeForSpeech } from "./normalize";

export type ArmenianQualityDomain =
  | "hospitality"
  | "beauty"
  | "real-estate"
  | "retail"
  | "finance-tech"
  | "creator"
  | "support"
  | "general";

export type ArmenianQualityCase = {
  id: string;
  domain: ArmenianQualityDomain;
  kind: "naturalization" | "speech";
  style?: ArmenianSpeechStyle;
  input: string;
  mustInclude?: string[];
  mustExclude?: string[];
  preserve?: string[];
  note: string;
};

const naturalizationCases: ArmenianQualityCase[] = [
  {id:"nat-001",domain:"hospitality",kind:"naturalization",style:"natural",input:"Ներկայումս կարող եք կատարել պատվեր մեր կայքում։",mustInclude:["հիմա","պատվիրել"],mustExclude:["Ներկայումս","կատարել պատվեր"],note:"Restaurant CTA should sound current and direct."},
  {id:"nat-002",domain:"hospitality",kind:"naturalization",style:"natural",input:"Եթե ցանկանում եք ամրագրել սեղան, անհրաժեշտ է ընտրել ժամը։",mustInclude:["ուզում եք","պետք է"],mustExclude:["ցանկանում եք","անհրաժեշտ է"],note:"Reservation copy should avoid bureaucratic phrasing."},
  {id:"nat-003",domain:"hospitality",kind:"naturalization",style:"yerevan",input:"Այս դեպքում կարող եք ընտրել երկրորդ տարբերակը։",mustInclude:["էս դեպքում"],mustExclude:["Այս դեպքում"],note:"Yerevan mode can use mild everyday demonstratives."},
  {id:"nat-004",domain:"hospitality",kind:"naturalization",style:"standard",input:"Ներկայումս ռեստորանը բաց է մինչև ժամը 23։",mustInclude:["Ներկայումս"],preserve:["23"],note:"Standard mode must preserve formal Armenian."},
  {id:"nat-005",domain:"beauty",kind:"naturalization",style:"natural",input:"Ցանկանում եք ձեռք բերել մաշկի խնամքի նոր հավաքածուն։",mustInclude:["ուզում եք","գնել"],mustExclude:["Ցանկանում եք","ձեռք բերել"],note:"Beauty commerce copy should be simple and spoken."},
  {id:"nat-006",domain:"beauty",kind:"naturalization",style:"natural",input:"Այնուհետև կարող եք կատարել ընտրություն երեք երանգներից։",mustInclude:["հետո","ընտրել"],mustExclude:["Այնուհետև","կատարել ընտրություն"],note:"Product selection language should be concise."},
  {id:"nat-007",domain:"beauty",kind:"naturalization",style:"yerevan",input:"Այո, այս մեկը հարմար է ամենօրյա օգտագործման համար։",mustInclude:["հա","էս մեկը"],mustExclude:["Այո","այս մեկը"],note:"Casual creator-style beauty speech."},
  {id:"nat-008",domain:"real-estate",kind:"naturalization",style:"natural",input:"Ներկայումս բնակարանը հանդիսանում է լավագույն առաջարկներից մեկը։",mustInclude:["հիմա","է"],mustExclude:["Ներկայումս","հանդիսանում է"],note:"Real-estate narration should avoid officialese."},
  {id:"nat-009",domain:"real-estate",kind:"naturalization",style:"natural",input:"Եթե ցանկանում եք տեսնել բնակարանը, հնարավորություն ունեք ամրագրել դիտում։",mustInclude:["ուզում եք","կարող եք"],mustExclude:["ցանկանում եք","հնարավորություն ունեք"],note:"Property viewing CTA."},
  {id:"nat-010",domain:"real-estate",kind:"naturalization",style:"yerevan",input:"Այս պահին այդ մեկը արդեն ամրագրված է։",mustInclude:["էս պահին","էդ մեկը"],note:"Mild Yerevan spoken forms."},
  {id:"nat-011",domain:"retail",kind:"naturalization",style:"natural",input:"Սկսած այս պահից կարող եք կատարել վճարում նաև քարտով։",mustInclude:["այս պահից","վճարել"],mustExclude:["Սկսած այս պահից","կատարել վճարում"],note:"Checkout copy should be action-oriented."},
  {id:"nat-012",domain:"retail",kind:"naturalization",style:"natural",input:"Ցանկանում եմ ձեռք բերել այս ապրանքը այսօր։",mustInclude:["ուզում եմ","գնել"],mustExclude:["Ցանկանում եմ","ձեռք բերել"],note:"First-person shopping phrase."},
  {id:"nat-013",domain:"retail",kind:"naturalization",style:"yerevan",input:"Այդ դեպքում այս մեկը կարող եք վերցնել այսօր։",mustInclude:["էդ դեպքում","էս մեկը"],note:"Retail conversational mode."},
  {id:"nat-014",domain:"finance-tech",kind:"naturalization",style:"natural",input:"Ներկայումս VETO-ն իրականացնում է շուկայի բազմաշերտ վերլուծություն։",mustInclude:["հիմա","անում է"],preserve:["VETO"],mustExclude:["Ներկայումս","իրականացնում է"],note:"Keep product brand while simplifying Armenian."},
  {id:"nat-015",domain:"finance-tech",kind:"naturalization",style:"natural",input:"Եթե ցանկանում եք օգտագործել API-ն, անհրաժեշտ է ստեղծել բանալի։",mustInclude:["ուզում եք","պետք է"],preserve:["API"],note:"Developer copy can still sound natural."},
  {id:"nat-016",domain:"finance-tech",kind:"naturalization",style:"standard",input:"OpenAI API-ն ներկայումս ակտիվ է։",mustInclude:["ներկայումս"],preserve:["OpenAI","API"],note:"Standard mode must not rewrite brand terms."},
  {id:"nat-017",domain:"creator",kind:"naturalization",style:"natural",input:"Այժմ ցանկանում եմ ցույց տալ, թե ինչպես է աշխատում HAY-ը։",mustInclude:["հիմա","ուզում եմ"],preserve:["HAY"],note:"Creator intro should sound spoken."},
  {id:"nat-018",domain:"creator",kind:"naturalization",style:"yerevan",input:"Այո, այսպես կարող եք ամբողջ Reel-ը հավաքել մեկ տեղում։",mustInclude:["հա","էսպես"],preserve:["Reel"],note:"Yerevan creator voice with code-switching preserved."},
  {id:"nat-019",domain:"creator",kind:"naturalization",style:"natural",input:"Այնուհետև իրականացնում ենք վերջնական հրապարակումը։",mustInclude:["հետո","անում ենք"],mustExclude:["Այնուհետև","իրականացնում ենք"],note:"Workflow narration."},
  {id:"nat-020",domain:"support",kind:"naturalization",style:"natural",input:"Տվյալ դեպքում անհրաժեշտ է կրկին փորձել։",mustInclude:["այս դեպքում","պետք է"],mustExclude:["Տվյալ դեպքում","անհրաժեշտ է"],note:"Support instructions should be clear."},
  {id:"nat-021",domain:"support",kind:"naturalization",style:"yerevan",input:"Այս դեպքում այո, կարող եք նորից փորձել։",mustInclude:["էս դեպքում","հա"],note:"Casual support response without slang overload."},
  {id:"nat-022",domain:"support",kind:"naturalization",style:"natural",input:"Եթե ցանկանում ես փոխել գաղտնաբառը, հնարավորություն ունես դա անել կարգավորումներում։",mustInclude:["ուզում ես","կարող ես"],note:"Second-person support copy."},
  {id:"nat-023",domain:"general",kind:"naturalization",style:"natural",input:"Ներկայումս անհրաժեշտ է իրականացնել երկու քայլ։",mustInclude:["հիմա","պետք է","անել"],note:"General simplification stack."},
  {id:"nat-024",domain:"general",kind:"naturalization",style:"yerevan",input:"Այդ պահին այսպես անելն ավելի ճիշտ է։",mustInclude:["էդ պահին","էսպես"],note:"Yerevan demonstratives in context."},
  {id:"nat-025",domain:"general",kind:"naturalization",style:"standard",input:"Եթե ցանկանում եք շարունակել, անհրաժեշտ է հաստատել։",mustInclude:["ցանկանում եք","անհրաժեշտ է"],note:"Standard is a no-op baseline."},
];

const speechCases: ArmenianQualityCase[] = [
  {id:"sp-001",domain:"finance-tech",kind:"speech",input:"BTC-ն $110K է։",mustInclude:["Բիթքոյն","հարյուր տասը հազար դոլար"],mustExclude:["BTC","$110K"],note:"Bitcoin and compact USD amount pronunciation."},
  {id:"sp-002",domain:"finance-tech",kind:"speech",input:"ETH-ը 3500 USD է։",mustInclude:["Իթերիում","երեք հազար հինգ հարյուր","դոլար"],note:"Ethereum, number and currency pronunciation."},
  {id:"sp-003",domain:"finance-tech",kind:"speech",input:"USDT funding rate-ը 12% է։",mustInclude:["Յու Էս Դի Թի","ֆանդինգ ռեյթ","տասներկու","տոկոս"],note:"Crypto code-switch stack."},
  {id:"sp-004",domain:"finance-tech",kind:"speech",input:"OpenAI API-ն հասանելի է։",mustInclude:["Օփեն Էյ Այ","Էյ Փի Այ"],note:"Brand plus acronym pronunciation."},
  {id:"sp-005",domain:"finance-tech",kind:"speech",input:"AI SaaS հարթակը ունի API։",mustInclude:["Էյ Այ","Սաս","Էյ Փի Այ"],note:"Common technology terms."},
  {id:"sp-006",domain:"finance-tech",kind:"speech",input:"Շուկան bullish է, բայց liquidity-ն ցածր է։",mustInclude:["բուլիշ","լիքվիդիթի"],note:"Trading English terms should be pronounceable."},
  {id:"sp-007",domain:"finance-tech",kind:"speech",input:"Stop loss-ը 5% է, take profit-ը՝ 15%։",mustInclude:["ստոփ լոս","հինգ","տոկոս","թեյք փրոֆիթ","տասնհինգ"],note:"Trading execution terms and percentages."},
  {id:"sp-008",domain:"finance-tech",kind:"speech",input:"Breakout-ից առաջ positioning-ը փոխվեց։",mustInclude:["բրեյքաութ","փոզիշնինգ"],note:"Market-structure code switch."},
  {id:"sp-009",domain:"finance-tech",kind:"speech",input:"Macro տվյալները ազդեցին BTC-ի վրա։",mustInclude:["մակրո","Բիթքոյն"],note:"Macro plus BTC."},
  {id:"sp-010",domain:"creator",kind:"speech",input:"Instagram-ում Reel-ը հավաքում ենք AI-ով։",mustInclude:["Ինստագրամ","Էյ Այ"],note:"Social creator terminology."},
  {id:"sp-011",domain:"creator",kind:"speech",input:"TikTok և YouTube հրապարակումները պատրաստ են։",mustInclude:["ՏիկՏոկ","ՅուԹյուբ"],note:"Social platform names."},
  {id:"sp-012",domain:"retail",kind:"speech",input:"Գինը 14900 AMD է։",mustInclude:["տասնչորս հազար ինը հարյուր","դրամ"],note:"Armenian dram price pronunciation."},
  {id:"sp-013",domain:"retail",kind:"speech",input:"Արժեքը $29 է ամսական։",mustInclude:["քսանինը դոլար"],note:"Simple USD subscription price."},
  {id:"sp-014",domain:"real-estate",kind:"speech",input:"Բնակարանը 125000 USD է։",mustInclude:["հարյուր քսանհինգ հազար","դոլար"],note:"Real-estate price pronunciation."},
  {id:"sp-015",domain:"hospitality",kind:"speech",input:"Սեղանը նախատեսված է 8 անձի համար։",mustInclude:["ութ"],mustExclude:[" 8 "],note:"Simple number normalization."},
  {id:"sp-016",domain:"beauty",kind:"speech",input:"Զեղչը 20% է մինչև 18-ը։",mustInclude:["քսան","տոկոս","տասնութ"],note:"Retail discount and date-like number."},
  {id:"sp-017",domain:"general",kind:"speech",input:"URL-ը ուղարկեք API-ին։",mustInclude:["Յու Ար Էլ","Էյ Փի Այ"],note:"Developer acronym pair."},
  {id:"sp-018",domain:"general",kind:"speech",input:"SEO արդյունքը աճել է 30%։",mustInclude:["Էս Ի Օ","երեսուն","տոկոս"],note:"Marketing acronym and percentage."},
  {id:"sp-019",domain:"finance-tech",kind:"speech",input:"VETO-ն ասում է WAIT, երբ BTC-ն bearish է։",mustInclude:["Վետո","Բիթքոյն","բեարիշ"],note:"Product brand, trading state and asset."},
  {id:"sp-020",domain:"general",kind:"speech",input:"2026 թվականին ունենք 3 լեզու։",mustInclude:["երկու հազար քսանվեց","երեք"],note:"Year and small integer normalization."},
  {id:"sp-021",domain:"retail",kind:"speech",input:"$1M շրջանառությունը անցել է։",mustInclude:["մեկ միլիոն դոլար"],note:"Million-dollar compact amount."},
  {id:"sp-022",domain:"finance-tech",kind:"speech",input:"BTC-ն $115.5K մակարդակում է։",mustInclude:["Բիթքոյն","հարյուր տասնվեց հազար դոլար"],note:"Decimal compact amount follows current rounded speech policy."},
  {id:"sp-023",domain:"general",kind:"speech",input:"ChatGPT և OpenAI գործիքները միացված են։",mustInclude:["Չաթ Ջի Փի Թի","Օփեն Էյ Այ"],note:"AI brand pronunciation pair."},
  {id:"sp-024",domain:"finance-tech",kind:"speech",input:"Funding-ը բարձր է, macro-ն՝ թույլ։",mustInclude:["ֆանդինգ","մակրո"],note:"Mixed Armenian-English finance sentence."},
  {id:"sp-025",domain:"general",kind:"speech",input:"API տարբերակը 2 է, URL-ը՝ 1։",mustInclude:["Էյ Փի Այ","երկու","Յու Ար Էլ","մեկ"],note:"Acronyms and digits in one sentence."},
];

export const ARMENIAN_QUALITY_BENCHMARK: ArmenianQualityCase[] = [...naturalizationCases,...speechCases];

function includesInsensitive(text:string,fragment:string){
  return text.toLocaleLowerCase("hy-AM").includes(fragment.toLocaleLowerCase("hy-AM"));
}

export type ArmenianQualityResult = {
  id: string;
  domain: ArmenianQualityDomain;
  kind: ArmenianQualityCase["kind"];
  output: string;
  passed: boolean;
  assertions: number;
  passedAssertions: number;
  failures: string[];
};

export function evaluateArmenianQualityCase(test:ArmenianQualityCase):ArmenianQualityResult{
  const output=test.kind==="naturalization"
    ? ruleBasedNaturalizeArmenian(test.input,test.style||"natural")
    : normalizeForSpeech(test.input,"hy","eastern").spokenText;
  const failures:string[]=[];
  let assertions=0;
  let passedAssertions=0;
  const check=(condition:boolean,message:string)=>{ assertions++; if(condition) passedAssertions++; else failures.push(message); };

  for(const value of test.mustInclude||[]) check(includesInsensitive(output,value),`missing: ${value}`);
  for(const value of test.mustExclude||[]) check(!includesInsensitive(output,value),`should exclude: ${value}`);
  for(const value of test.preserve||[]) check(includesInsensitive(output,value),`did not preserve: ${value}`);
  check(output.trim().length>0,"empty output");

  return {id:test.id,domain:test.domain,kind:test.kind,output,passed:failures.length===0,assertions,passedAssertions,failures};
}

export function runArmenianQualityBenchmark(){
  const results=ARMENIAN_QUALITY_BENCHMARK.map(evaluateArmenianQualityCase);
  const assertions=results.reduce((sum,item)=>sum+item.assertions,0);
  const passedAssertions=results.reduce((sum,item)=>sum+item.passedAssertions,0);
  const passedCases=results.filter(item=>item.passed).length;
  const byDomain=Object.fromEntries([...new Set(results.map(item=>item.domain))].map(domain=>{
    const group=results.filter(item=>item.domain===domain);
    return [domain,{passed:group.filter(item=>item.passed).length,total:group.length}];
  }));
  return {
    version:"hay-quality-v1",
    cases:results.length,
    passedCases,
    failedCases:results.length-passedCases,
    assertions,
    passedAssertions,
    score:assertions?Math.round((passedAssertions/assertions)*1000)/10:0,
    byDomain,
    results,
  };
}
