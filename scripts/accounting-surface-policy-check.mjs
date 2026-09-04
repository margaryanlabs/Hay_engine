import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = "app/api";
const forbidden = [
  { name: "checkUsageAllowance", pattern: /\bcheckUsageAllowance\s*\(/ },
  { name: "recordUsage", pattern: /\brecordUsage\s*\(/ },
];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walk(path));
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry)) files.push(path);
  }
  return files;
}

const files = walk(API_ROOT);
const violations = [];
for (const path of files) {
  const source = readFileSync(path, "utf8");
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) violations.push({ path: relative(".", path), legacyCall: rule.name });
  }
}

assert.deepEqual(violations,[],`API routes must use the centralized reservation/request-slot layers instead of legacy check/record accounting. Violations: ${JSON.stringify(violations)}`);

console.log(JSON.stringify({accountingSurfacePolicy:"passed",scannedApiFiles:files.length,forbiddenLegacyCalls:forbidden.map(item=>item.name),violations,rule:"app/api cannot call checkUsageAllowance() or recordUsage() directly"},null,2));
