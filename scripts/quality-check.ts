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

if(report.failedCases>0||protectedFailures>0){
  process.exitCode=1;
}
