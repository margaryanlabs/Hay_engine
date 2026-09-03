export type BenchmarkDomain="hospitality"|"retail"|"real-estate"|"finance-tech"|"creator"|"support"|"tourism"|"automotive"|"healthcare"|"education";
export type BenchmarkTask="marketing-copy"|"rewrite"|"support"|"pronunciation"|"code-switch";

export type NativeBenchmarkCase={
  id:string;
  domain:BenchmarkDomain;
  task:BenchmarkTask;
  prompt:string;
  constraints:string[];
  protectedValues:string[];
};

export type BenchmarkCandidateInput={
  providerId:string;
  text:string;
};

export type BlindedCandidate={
  id:string;
  text:string;
};

export type BlindedBenchmarkCase={
  caseId:string;
  domain:BenchmarkDomain;
  task:BenchmarkTask;
  prompt:string;
  constraints:string[];
  protectedValues:string[];
  candidates:BlindedCandidate[];
};

export type BenchmarkRubricScore={
  naturalness:number;
  grammar:number;
  meaning:number;
  localAuthenticity:number;
  codeSwitch:number;
  brandSafety:number;
};

export const NATIVE_BENCHMARK_VERSION="hay-native-2026.09-v1";

export const NATIVE_BENCHMARK_RUBRIC=[
  {key:"naturalness",label:"Naturalness",description:"Would a native speaker in Armenia naturally say/write this?"},
  {key:"grammar",label:"Grammar",description:"Correct Armenian grammar, morphology and punctuation."},
  {key:"meaning",label:"Meaning",description:"Preserves the source meaning, offer and factual intent."},
  {key:"localAuthenticity",label:"Local authenticity",description:"Feels locally Armenian rather than translated or bureaucratic."},
  {key:"codeSwitch",label:"Code-switch",description:"Brands, product words and HY/EN/RU mixing feel natural and correctly inflected."},
  {key:"brandSafety",label:"Brand safety",description:"No invented claims, awkward slang or tone-breaking wording."},
] as const;

export const NATIVE_BENCHMARK_CASES:NativeBenchmarkCase[]=[
  {id:"nb-001",domain:"hospitality",task:"marketing-copy",prompt:"Գրիր 15 վայրկյանանոց Reel hook Երևանի ժամանակակից հայկական ռեստորանի համար։ Առաջարկը՝ ընթրիք երկուսի համար՝ 18,900 ֏։",constraints:["contemporary Eastern Armenian","short spoken hook","no fake urgency"],protectedValues:["18,900 ֏"]},
  {id:"nb-002",domain:"hospitality",task:"support",prompt:"Պատասխանիր հաճախորդին, ով հարցնում է՝ կարելի՞ է այսօր ժամը 20:30-ին սեղան ամրագրել 4 հոգու համար։",constraints:["warm","concise","do not claim availability if unknown"],protectedValues:["20:30","4"]},
  {id:"nb-003",domain:"retail",task:"marketing-copy",prompt:"Instagram caption հայկական skincare բրենդի համար։ Գինը՝ 14,900 ֏, զեղչը՝ 12.5% մինչև կիրակի։",constraints:["natural commerce Armenian","clear CTA","no exaggerated claims"],protectedValues:["14,900 ֏","12.5%"]},
  {id:"nb-004",domain:"retail",task:"code-switch",prompt:"Գրիր բնական հայերեն Story text՝ օգտագործելով Instagram, DM և delivery բառերը այնպես, ինչպես իրականում կասեն Հայաստանում։",constraints:["keep natural code-switch","do not transliterate everything"],protectedValues:["Instagram","DM","delivery"]},
  {id:"nb-005",domain:"real-estate",task:"marketing-copy",prompt:"Luxury apartment Reel intro Կենտրոնում՝ 182 m², $690,000։ Մի գրիր կեղծ ներդրումային խոստումներ։",constraints:["premium","natural Eastern Armenian","no ROI promises"],protectedValues:["182 m²","$690,000"]},
  {id:"nb-006",domain:"finance-tech",task:"rewrite",prompt:"Բնականացրու՝ «Ներկայումս VETO-ն իրականացնում է շուկայի բազմաշերտ վերլուծություն և տրամադրում է որոշումների աջակցություն»։",constraints:["less bureaucratic","preserve VETO","do not overclaim"],protectedValues:["VETO"]},
  {id:"nb-007",domain:"finance-tech",task:"code-switch",prompt:"Բացատրիր funding rate, liquidity և stop loss-ը բնական հայերենով trader-ին՝ առանց անտեղի թարգմանելու տերմինները։",constraints:["trader-native code-switch","clear","no investment advice"],protectedValues:["funding rate","liquidity","stop loss"]},
  {id:"nb-008",domain:"creator",task:"marketing-copy",prompt:"TikTok hook հայ creator-ի համար՝ «AI-ը քո փոխարեն ամբողջ content plan-ը չի մտածի, եթե բիզնեսը չի հասկանում» գաղափարով։",constraints:["spoken","Yerevan-natural but not caricature","keep AI and content plan natural"],protectedValues:["AI","content plan"]},
  {id:"nb-009",domain:"creator",task:"rewrite",prompt:"Դարձրու բնական խոսակցական՝ «Եթե ցանկանում եք ստանալ հավելյալ տեղեկատվություն, կարող եք ուղարկել մեզ անձնական հաղորդագրություն»։",constraints:["simple","direct","brand-safe"],protectedValues:[]},
  {id:"nb-010",domain:"automotive",task:"marketing-copy",prompt:"Գրիր marketplace listing intro՝ 2024 BMW X5, 31,500 km, VIN verified, գինը $72,000։",constraints:["clear commerce copy","keep car terms natural","no invented condition claims"],protectedValues:["2024","BMW X5","31,500 km","VIN","$72,000"]},
  {id:"nb-011",domain:"healthcare",task:"support",prompt:"Ատամնաբուժարանի պատասխանը հաճախորդին՝ «իմպլանտը ցավո՞տ է»։ Մի տուր անհատական բժշկական երաշխիք։",constraints:["reassuring but not absolute","natural Armenian","encourage consultation"],protectedValues:[]},
  {id:"nb-012",domain:"education",task:"marketing-copy",prompt:"English course caption՝ IELTS 7+ խմբի համար, ամսական 49,000 ֏։ Մի խոստացիր երաշխավորված score։",constraints:["natural HY/EN code-switch","no guaranteed outcome"],protectedValues:["IELTS 7+","49,000 ֏"]},
  {id:"nb-013",domain:"tourism",task:"marketing-copy",prompt:"Գրիր 20 վայրկյանանոց narration Դիլիջանի weekend getaway-ի համար՝ առանց cliché «Հայաստանի Շվեյցարիա» ձևակերպման։",constraints:["specific","sensory","natural Eastern Armenian"],protectedValues:[]},
  {id:"nb-014",domain:"support",task:"support",prompt:"Հաճախորդը բարկացած է, որովհետև delivery-ն 45 րոպե ուշացել է։ Պատասխանիր բնական հայերենով՝ առանց պատճառ հորինելու։",constraints:["acknowledge delay","do not invent cause","give next action"],protectedValues:["45"]},
  {id:"nb-015",domain:"finance-tech",task:"pronunciation",prompt:"Տուր speech-safe տարբերակը՝ «OpenAI API-ն աշխատում է HAY-ում, իսկ BTC-ն հիմա $115.5K է»։",constraints:["Armenian speech form","exact financial value","natural suffixes"],protectedValues:["OpenAI","API","HAY","BTC","$115.5K"]},
  {id:"nb-016",domain:"retail",task:"pronunciation",prompt:"Տուր speech-safe տարբերակը՝ «Instagram-ում promo-ն մինչև 19:30 է, գինը՝ 24,500 AMD»։",constraints:["natural brand suffix","exact time and price"],protectedValues:["Instagram","19:30","24,500 AMD"]},
];

function seedHash(value:string){let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}return hash>>>0;}
function shuffled<T>(items:T[],seed:string){const copy=[...items];let state=seedHash(seed)||1;for(let i=copy.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}

export function blindCandidates(caseId:string,reviewSessionId:string,candidates:BenchmarkCandidateInput[]){
  const normalized=candidates.filter(item=>item.providerId.trim()&&item.text.trim()).map(item=>({providerId:item.providerId.trim(),text:item.text.trim()}));
  const ordered=shuffled(normalized,`${NATIVE_BENCHMARK_VERSION}:${caseId}:${reviewSessionId}`);
  const labels="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return {
    candidates:ordered.map((item,index)=>({id:labels[index]||`C${index+1}`,text:item.text})),
    reveal:Object.fromEntries(ordered.map((item,index)=>[labels[index]||`C${index+1}`,item.providerId])),
  };
}

export function averageRubric(score:BenchmarkRubricScore){
  const values=Object.values(score).map(Number).filter(Number.isFinite);
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
}
