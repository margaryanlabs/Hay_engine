import { buildMarketingPlan } from "./planner";
import type { BusinessProfile, CompetitorInput, MarketingPlan, SocialConnection } from "./types";

export type AutopilotMode = "copilot" | "approval" | "autopublish";

type AutopilotJob = {
  contentItemId: string;
  platform: string;
  action: "create_asset" | "request_approval" | "publish";
  status: "queued" | "blocked";
  reason?: string;
};

export type AutopilotRun = {
  id: string;
  createdAt: string;
  mode: AutopilotMode;
  status: "planned" | "blocked" | "ready";
  plan: MarketingPlan;
  stages: Array<{
    id: "analyze" | "strategy" | "create" | "approve" | "publish" | "learn";
    status: "ready" | "blocked" | "queued";
    reason?: string;
  }>;
  jobs: AutopilotJob[];
};

export async function createAutopilotRun(args: {
  business: BusinessProfile;
  competitors?: CompetitorInput[];
  connections?: SocialConnection[];
  mode?: AutopilotMode;
  horizonDays?: number;
}): Promise<AutopilotRun> {
  const mode = args.mode ?? "approval";
  const plan = await buildMarketingPlan(args.business, args.competitors ?? [], args.horizonDays ?? 7);
  const connections = args.connections ?? [];
  const connected = new Map(connections.filter((item) => item.status === "connected").map((item) => [item.platform, item]));
  const publishBlocked = mode === "autopublish" && plan.items.some((item) => !connected.has(item.platform));

  const jobs: AutopilotJob[] = plan.items.flatMap((item) => {
    const base: AutopilotJob[] = [
      { contentItemId: item.id, platform: item.platform, action: "create_asset", status: "queued" },
    ];
    if (mode !== "autopublish") {
      base.push({ contentItemId: item.id, platform: item.platform, action: "request_approval", status: "queued" });
    }
    const connection = connected.get(item.platform);
    base.push({
      contentItemId: item.id,
      platform: item.platform,
      action: "publish",
      status: connection ? "queued" : "blocked",
      ...(connection ? {} : { reason: "social_account_not_connected" }),
    });
    return base;
  });

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode,
    status: publishBlocked ? "blocked" : "ready",
    plan,
    stages: [
      { id: "analyze", status: "ready" },
      { id: "strategy", status: "ready" },
      { id: "create", status: "queued" },
      { id: "approve", status: mode === "copilot" || mode === "approval" ? "queued" : "ready" },
      { id: "publish", status: publishBlocked ? "blocked" : "queued", reason: publishBlocked ? "Connect every required social account before autopublish." : undefined },
      { id: "learn", status: "queued" },
    ],
    jobs,
  };
}
