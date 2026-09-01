import "./server.mjs";
import { collectDueMetrics } from "./metrics.mjs";

const METRICS_POLL_MS = Math.max(15 * 60_000, Number(process.env.METRICS_POLL_MS || 60 * 60_000));
setInterval(() => void collectDueMetrics(), METRICS_POLL_MS).unref();
setTimeout(() => void collectDueMetrics(), 15_000).unref();
