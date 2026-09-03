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
  assert(health.status === "online", "/api/health must expose only public liveness status");
  assert(!("providers" in health), "/api/health must not expose provider readiness");
  assert(!("persistence" in health), "/api/health must not expose persistence readiness");
  assert(!("social" in health), "/api/health must not expose social connector readiness");

  const rootResponse = await fetchReady("/");
  assert(rootResponse.status === 200, "/ must return HTTP 200");

  const setupResponse = await fetch(`${baseUrl}/api/setup/status`, {
    signal: AbortSignal.timeout(2000),
    headers: { "user-agent": "hay-runtime-smoke" },
  });
  const setup = await setupResponse.json();
  assert(setupResponse.status === 403, "/api/setup/status must reject unauthenticated production traffic");
  assert(setup.service === "HAY Engine", "/api/setup/status returned an unexpected service");
  assert(setup.protected === true, "/api/setup/status must report protected=true");
  assert(setup.detailed === false, "/api/setup/status must not expose detailed diagnostics publicly");
  assert(!("blockers" in setup), "/api/setup/status public response must not expose blockers");
  assert(!("providers" in setup), "/api/setup/status public response must not expose providers");

  console.log(
    JSON.stringify(
      {
        smoke: "passed",
        health: { version: health.version, status: health.status },
        setup: { protected: setup.protected, detailed: setup.detailed, status: setupResponse.status },
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
