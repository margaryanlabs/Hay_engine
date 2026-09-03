import { correctionReusePolicy } from "../lib/hay/correction-policy";
import { normalizeForSpeech } from "../lib/hay/normalize";
import { protectedValueReport } from "../lib/hay/protected-values";
import { runArmenianQualityBenchmark } from "../lib/hay/quality-suite";

const report=runArmenianQualityBenchmark();
console.log(`HAY Armenian Quality ${report.version}`);
console.log(`Score: ${report.score}/100 · ${report.passedCases}/${report.cases} cases · ${report.passedAssertions}/${report.assertions} assertions`);

for(const result of report.results.filter(item=>!item.passed)){
  console.error(`FAIL ${result.id} [${result.domain}/${result.kind}]`);
  console.error(`  output: ${result.output}`);
  for(const failure of result.failures) console.error(`  - ${failure}`);
}

const protectedCases=[
  {
    id:"pv-001",
    source:"Instagram-ում գինը 14,900 ֏ է, զեղչը՝ 12.5%։",
    candidate:"Instagram-ում այսօր գինը 14,900 ֏ է, իսկ զեղչը՝ 12.5%։",
  },
  {
    id:"pv-002",
    source:"OpenAI API-ի demo-ն՝ $115.5K, տես https://hay.am/demo",
    candidate:"OpenAI API-ի demo-ն արժե $115.5K, մանրամասները՝ https://hay.am/demo",
  },
  {
    id:"pv-003",
    source:"TikTok + YouTube campaign — 2,500 AMD",
    candidate:"TikTok + YouTube campaign-ի արժեքը՝ 2,500 AMD",
  },
] as const;
let protectedFailures=0;
for(const test of protectedCases){
  const value=protectedValueReport(test.source,test.candidate);
  if(!value.passed){
    protectedFailures+=1;
    console.error(`FAIL ${test.id} [protected-values] missing: ${value.missing.join(", ")}`);
  }
}
console.log(`Protected-value guard: ${protectedCases.length-protectedFailures}/${protectedCases.length} cases`);

const runtimePronunciationCases=[
  {id:"pr-rt-001",source:"Acme Pro-ը նոր առաջարկ ունի։",overrides:{"Acme Pro":"Աքմե Փրո"},mustInclude:"Աքմե Փրո"},
  {id:"pr-rt-002",source:"Ակմե այսօր բաց է։",overrides:{"Ակմե":"Աքմե"},mustInclude:"Աքմե այսօր"},
  {id:"pr-rt-003",source:"Instagram live այսօր։",overrides:{"Instagram":"Ինստա Թեստ"},mustInclude:"Ինստա Թեստ"},
] as const;
let runtimePronunciationFailures=0;
for(const test of runtimePronunciationCases){
  const output=normalizeForSpeech(test.source,"hy","eastern",test.overrides).spokenText;
  if(!output.includes(test.mustInclude)){
    runtimePronunciationFailures+=1;
    console.error(`FAIL ${test.id} [runtime-pronunciation] expected ${test.mustInclude}; output: ${output}`);
  }
}
console.log(`Runtime pronunciation layer: ${runtimePronunciationCases.length-runtimePronunciationFailures}/${runtimePronunciationCases.length} cases`);

const correctionPolicyCases=[
  {id:"cp-001",consent:{productImprovement:false,benchmark:false,modelTraining:false,withdrawn:false},expect:{review:false,promote:false,benchmark:false,training:false}},
  {id:"cp-002",consent:{productImprovement:false,benchmark:true,modelTraining:true,withdrawn:false},expect:{review:false,promote:false,benchmark:false,training:false}},
  {id:"cp-003",consent:{productImprovement:true,benchmark:false,modelTraining:false,withdrawn:false},expect:{review:true,promote:true,benchmark:false,training:false}},
  {id:"cp-004",consent:{productImprovement:true,benchmark:true,modelTraining:true,withdrawn:false},expect:{review:true,promote:true,benchmark:true,training:true}},
  {id:"cp-005",consent:{productImprovement:true,benchmark:true,modelTraining:true,withdrawn:true},expect:{review:false,promote:false,benchmark:false,training:false}},
] as const;
let correctionPolicyFailures=0;
for(const test of correctionPolicyCases){
  const policy=correctionReusePolicy(test.consent);
  const passed=policy.canStorePrivately&&policy.canEnterReviewQueue===test.expect.review&&policy.canPromoteToReviewedData===test.expect.promote&&policy.canUseInBenchmark===test.expect.benchmark&&policy.canUseForModelTraining===test.expect.training;
  if(!passed){correctionPolicyFailures+=1;console.error(`FAIL ${test.id} [correction-consent-policy] ${JSON.stringify(policy)}`);}
}
console.log(`Correction consent policy: ${correctionPolicyCases.length-correctionPolicyFailures}/${correctionPolicyCases.length} cases`);

if(report.failedCases>0||protectedFailures>0||runtimePronunciationFailures>0||correctionPolicyFailures>0){
  process.exitCode=1;
}
