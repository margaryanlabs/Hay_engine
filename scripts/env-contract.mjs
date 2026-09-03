import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoots = [
  "app",
  "components",
  "lib",
  "scripts",
  "render-worker/src",
  "publish-worker/src",
];
const rootFiles = ["next.config.ts", "proxy.ts"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

// These are provided by Node, CI/Vercel, or are strictly local test controls rather than
// HAY deployment configuration. Everything else read from process.env must be documented
// in .env.example so deploy configuration cannot drift silently.
const platformEnv = new Set([
  "CI",
  "NODE_ENV",
  "PORT",
  "HOSTNAME",
  "HAY_SMOKE_PORT",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_TARGET_ENV",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_REGION",
  "VERCEL_DEPLOYMENT_ID",
  "VERCEL_PROJECT_ID",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL_GIT_REPO_SLUG",
  "VERCEL_GIT_REPO_OWNER",
]);

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(relativePath, output) {
  const absolute = path.join(root, relativePath);
  if (!(await exists(absolute))) return;
  const info = await stat(absolute);
  if (info.isFile()) {
    if (extensions.has(path.extname(absolute))) output.push(absolute);
    return;
  }

  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    if (["node_modules", ".next", ".quality-build", "out"].includes(entry.name)) continue;
    await collectFiles(path.join(relativePath, entry.name), output);
  }
}

function collectEnvReferences(source, names) {
  for (const regex of [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  ]) {
    let match;
    while ((match = regex.exec(source))) names.add(match[1]);
  }

  const destructuring = /\{([^{}]+)\}\s*=\s*process\.env\b/g;
  let match;
  while ((match = destructuring.exec(source))) {
    for (const part of match[1].split(",")) {
      const candidate = part.trim().split(/[:=]/, 1)[0]?.trim();
      if (/^[A-Z][A-Z0-9_]*$/.test(candidate || "")) names.add(candidate);
    }
  }
}

const envExamplePath = path.join(root, ".env.example");
const envExample = await readFile(envExamplePath, "utf8");
const documented = new Set();
for (const line of envExample.split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
  if (match) documented.add(match[1]);
}

const files = [];
for (const sourceRoot of sourceRoots) await collectFiles(sourceRoot, files);
for (const rootFile of rootFiles) await collectFiles(rootFile, files);

const used = new Set();
for (const file of files) {
  collectEnvReferences(await readFile(file, "utf8"), used);
}

const undocumented = [...used]
  .filter((name) => !documented.has(name) && !platformEnv.has(name))
  .sort();

const documentedUsed = [...used].filter((name) => documented.has(name)).sort();
const platformUsed = [...used].filter((name) => platformEnv.has(name)).sort();

console.log(
  JSON.stringify(
    {
      contract: "hay-env-v1",
      scannedFiles: files.length,
      documentedUsed: documentedUsed.length,
      platformUsed,
      undocumented,
    },
    null,
    2,
  ),
);

if (undocumented.length > 0) {
  console.error(
    `Environment contract failed. Add these server/client variables to .env.example or explicitly classify a true platform variable: ${undocumented.join(", ")}`,
  );
  process.exit(1);
}
