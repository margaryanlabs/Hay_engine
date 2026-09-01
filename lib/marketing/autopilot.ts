import { buildMarketingPlan } from "./planner";
import type { MarketingPerformanceContext } from "./performance";
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
  performance?: MarketingPerformanceContext | null;
}): Promise<AutopilotRun> {
  const mode = args.mode ?? "approval";
  const plan = await buildMarketingPlan(args.business, args.competitors ?? [], args.horizonDays ?? 7, args.performance ?? null);
  const connections = args.connections ?? [];
  const connected = new Map(connections.filter((item) => item.status === "connected").map((item) => [item.platform, item]));
  const missingConnection = plan.items.some((item) => !connected.has(item.platform));
  const tiktokNeedsHumanApproval = mode === "autopublish" && plan.items.some((item) => item.platform === "tiktok");
  const publishBlocked = mode === "autopublish" && (missingConnection || tiktokNeedsHumanApproval);

  const jobs: AutopilotJob[] = plan.items.flatMap((item) => {
    const base: AutopilotJob[] = [
      { contentItemId: item.id, platform: item.platform, action: "create_asset", status: "queued" },
    ];
    const explicitApprovalRequired = mode !== "autopublish" || item.platform === "tiktok";
    if (explicitApprovalRequired) {
      base.push({ contentItemId: item.id, platform: item.platform, action: "request_approval", status: "queued", ...(item.platform === "tiktok" ? { reason: "tiktok_requires_fresh_creator_options_and_explicit_post_consent" } : {}) });
    }
    const connection = connected.get(item.platform);
    const providerApprovalMissing = item.platform === "tiktok" && mode === "autopublish";
    base.push({
      contentItemId: item.id,
      platform: item.platform,
      action: "publish",
      status: connection && !providerApprovalMissing ? "queued" : "blocked",
      ...(!connection ? { reason: "social_account_not_connected" } : providerApprovalMissing ? { reason: "tiktok_explicit_publish_approval_required" } : {}),
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
      { id: "approve", status: mode === "copilot" || mode === "approval" || tiktokNeedsHumanApproval ? "queued" : "ready", reason: tiktokNeedsHumanApproval ? "TikTok always requires explicit user control before Direct Post." : undefined },
      { id: "publish", status: publishBlocked ? "blocked" : "queued", reason: publishBlocked ? (tiktokNeedsHumanApproval ? "TikTok items require one-tap approval; connect all other required accounts." : "Connect every required social account before autopublish.") : undefined },
      { id: "learn", status: "queued" },
    ],
    jobs,
  };
}
