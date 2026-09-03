import {
  ARMENIAN_QUALITY_BENCHMARK,
  evaluateArmenianQualityCase,
  type ArmenianQualityCase,
} from "./quality-benchmark";
import { ARMENIAN_BUSINESS_QUALITY_PACK } from "./quality-business-pack";
import { ARMENIAN_COMMERCE_QUALITY_PACK } from "./quality-commerce-pack";

function applyQualityPolicy(test: ArmenianQualityCase): ArmenianQualityCase {
  if (test.id === "sp-001") {
    return {
      ...test,
      mustInclude: ["Բիթքոյնը", "հարյուր տասը հազար դոլար"],
      note: "Bitcoin Armenian suffix and compact USD amount must both sound native.",
    };
  }
  if (test.id === "sp-022") {
    return {
      ...test,
      mustInclude: ["Բիթքոյնը", "հարյուր տասնհինգ հազար հինգ հարյուր դոլար"],
      note: "Decimal K amounts must preserve their exact value instead of being rounded for speech.",
    };
  }
  return test;
}

export const ARMENIAN_QUALITY_SUITE = [
  ...ARMENIAN_QUALITY_BENCHMARK,
  ...ARMENIAN_BUSINESS_QUALITY_PACK,
  ...ARMENIAN_COMMERCE_QUALITY_PACK,
].map(applyQualityPolicy);

export function runArmenianQualityBenchmark() {
  const results = ARMENIAN_QUALITY_SUITE.map(evaluateArmenianQualityCase);
  const assertions = results.reduce((sum, item) => sum + item.assertions, 0);
  const passedAssertions = results.reduce((sum, item) => sum + item.passedAssertions, 0);
  const passedCases = results.filter((item) => item.passed).length;
  const byDomain = Object.fromEntries(
    [...new Set(results.map((item) => item.domain))].map((domain) => {
      const group = results.filter((item) => item.domain === domain);
      return [domain, { passed: group.filter((item) => item.passed).length, total: group.length }];
    }),
  );
  return {
    version: "hay-quality-v3-commerce",
    cases: results.length,
    passedCases,
    failedCases: results.length - passedCases,
    assertions,
    passedAssertions,
    score: assertions ? Math.round((passedAssertions / assertions) * 1000) / 10 : 0,
    byDomain,
    results,
  };
}
