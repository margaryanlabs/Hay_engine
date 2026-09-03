import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.HAY_SMOKE_PORT || 3210);
const baseUrl = `http://127.0.0.1:${port}`;
const maxLogChars = 20000;
let serverLog = "";

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

function capture(chunk) {
  serverLog = `${serverLog}${chunk.toString()}`.slice(-maxLogChars);
}

server.stdout.on("data", capture);
server.stderr.on("data", capture);

async function fetchReady(path, attempts = 80) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Next server exited early with code ${server.exitCode}.\n${serverLog}`);
    }

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        signal: AbortSignal.timeout(2000),
        headers: { "user-agent": "hay-runtime-smoke" },
      });
      if (response.ok) return response;
      lastError = new Error(`${path} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${path}: ${String(lastError)}\n${serverLog}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    delay(2000),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

try {
  const healthResponse = await fetchReady("/api/health");
  const health = await healthResponse.json();
  assert(health.ok === true, "/api/health must report ok=true");
  assert(health.service === "HAY Engine", "/api/health returned an unexpected service");

  const rootResponse = await fetchReady("/");
  assert(rootResponse.status === 200, "/ must return HTTP 200");

  const setupResponse = await fetchReady("/api/setup/status");
  const setup = await setupResponse.json();
  assert(setup.service === "HAY Engine", "/api/setup/status returned an unexpected service");
  assert(Array.isArray(setup.blockers), "/api/setup/status must expose a blockers array");
  assert(typeof setup.mode === "string", "/api/setup/status must expose a mode");

  console.log(
    JSON.stringify(
      {
        smoke: "passed",
        health: { version: health.version, mode: health.mode },
        setup: {
          environment: setup.environment,
          mode: setup.mode,
          blockerCount: setup.blockers.length,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  if (serverLog) console.error("\nNext server log:\n", serverLog);
  process.exitCode = 1;
} finally {
  await stopServer();
}
