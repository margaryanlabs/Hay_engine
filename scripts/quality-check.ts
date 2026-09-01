import { runArmenianQualityBenchmark } from "../lib/hay/quality-benchmark";

const report=runArmenianQualityBenchmark();
console.log(`HAY Armenian Quality ${report.version}`);
console.log(`Score: ${report.score}/100 · ${report.passedCases}/${report.cases} cases · ${report.passedAssertions}/${report.assertions} assertions`);

for(const result of report.results.filter(item=>!item.passed)){
  console.error(`FAIL ${result.id} [${result.domain}/${result.kind}]`);
  console.error(`  output: ${result.output}`);
  for(const failure of result.failures) console.error(`  - ${failure}`);
}

if(report.failedCases>0){
  process.exitCode=1;
}
