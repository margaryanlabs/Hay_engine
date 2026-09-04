import assert from "node:assert/strict";
import { EMPLOYEE_CALL_BENCHMARK,EMPLOYEE_CALL_BENCHMARK_VERSION,scoreEmployeeBenchmarkScenario } from "../lib/employee/call-benchmark";

assert.equal(EMPLOYEE_CALL_BENCHMARK_VERSION,"hay-employee-call-v1-2026-09-04","Frozen benchmark version changed unexpectedly");
assert.ok(EMPLOYEE_CALL_BENCHMARK.length>=12,"Employee call benchmark must keep broad Armenian business coverage");
const categories=new Set(EMPLOYEE_CALL_BENCHMARK.map(item=>item.category));
for(const required of ["appointment","money","identity","code_switch","correction","handoff","safety","order"]){
  assert.ok(categories.has(required as never),`Missing employee benchmark category: ${required}`);
}
assert.ok(EMPLOYEE_CALL_BENCHMARK.some(item=>item.id==="money-15000-not-50000"&&item.mustPreserve.includes("15000")&&item.forbiddenClaims.some(value=>value.includes("50000"))),"Benchmark must explicitly defend 15,000 AMD vs 50,000 AMD");
assert.ok(EMPLOYEE_CALL_BENCHMARK.some(item=>item.id==="prompt-injection"&&item.expectedAction===null),"Benchmark must include caller prompt injection resistance");
assert.ok(EMPLOYEE_CALL_BENCHMARK.some(item=>item.id==="interruption-change-request"&&item.forbiddenClaims.includes("ուրբաթ")),"Benchmark must include interruption/correction stale-value rejection");
assert.ok(EMPLOYEE_CALL_BENCHMARK.some(item=>item.id==="angry-human-handoff"&&item.expectedHandoff),"Benchmark must include explicit human handoff");

for(const scenario of EMPLOYEE_CALL_BENCHMARK){
  if(scenario.expectedAction)assert.equal(scenario.requiresConfirmation,true,`${scenario.id}: side effects must require caller confirmation in the frozen benchmark`);
  const perfectAction=scenario.expectedAction?{
    type:scenario.expectedAction,
    summaryHy:scenario.mustPreserve.join(" ")||"Հաստատվող գործողություն",
    payload:Object.fromEntries(scenario.mustPreserve.map((value,index)=>[`protected${index}`,value])),
    requiresConfirmation:scenario.requiresConfirmation,
  }:null;
  const perfect=scoreEmployeeBenchmarkScenario(scenario,{reply:scenario.mustPreserve.join(" "),action:perfectAction,shouldHandoff:scenario.expectedHandoff});
  assert.equal(perfect.passed,true,`${scenario.id}: scorer must accept a perfect observation`);
}

const money=EMPLOYEE_CALL_BENCHMARK.find(item=>item.id==="money-15000-not-50000")!;
const wrongMoney=scoreEmployeeBenchmarkScenario(money,{reply:"Ընդհանուր արժեքը 50 000 դրամ է։",action:{type:"take_order",summaryHy:"50 000 դրամ",payload:{amount:50000},requiresConfirmation:true},shouldHandoff:false});
assert.equal(wrongMoney.passed,false,"Benchmark must fail dangerous amount substitution");
assert.ok(wrongMoney.forbiddenFound.length>0,"Dangerous amount substitution must surface as a forbidden value");

const appointment=EMPLOYEE_CALL_BENCHMARK.find(item=>item.id==="appointment-name-phone")!;
const noConfirm=scoreEmployeeBenchmarkScenario(appointment,{reply:"Պատրաստ է",action:{type:"book_appointment",summaryHy:appointment.mustPreserve.join(" "),payload:{name:"Նարեկ Մկրտչյան",phone:"091 23 45 67",time:"4"},requiresConfirmation:false},shouldHandoff:false});
assert.equal(noConfirm.passed,false,"Benchmark must fail appointment actions that bypass caller confirmation");

console.log(JSON.stringify({
  employeeCallBenchmark:"passed",
  version:EMPLOYEE_CALL_BENCHMARK_VERSION,
  scenarios:EMPLOYEE_CALL_BENCHMARK.length,
  categories:[...categories],
  actionCorrectnessRequired:true,
  confirmationCorrectnessRequired:true,
  protectedValuesRequired:true,
  humanHandoffMeasured:true,
  rawAudioRequired:false,
},null,2));
