import type { Locale } from "@/lib/hay/types";

export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "facebook" | "linkedin";
export type ContentFormat = "reel" | "story" | "carousel" | "post" | "short" | "video";
export type ContentStatus = "idea" | "draft" | "approved" | "scheduled" | "published" | "failed";

export type BusinessProfile = {
  id?: string;
  name: string;
  category: string;
  description: string;
  website?: string;
  location?: string;
  primaryLanguage: Locale;
  goals: string[];
  audience?: string;
  offer?: string;
  tone?: string;
};

export type BrandIntelligence = {
  positioning: string;
  promise: string;
  audience: string[];
  differentiators: string[];
  contentPillars: string[];
  voice: string[];
  risks: string[];
};

export type CompetitorInput = {
  name: string;
  url?: string;
  handle?: string;
  platform?: SocialPlatform;
};

export type CompetitorSignal = {
  name: string;
  strength: string;
  gap: string;
  opportunity: string;
};

export type ContentItem = {
  id: string;
  day: number;
  platform: SocialPlatform;
  format: ContentFormat;
  language: Locale;
  objective: "reach" | "trust" | "conversion" | "retention" | "community";
  hook: string;
  concept: string;
  caption: string;
  cta: string;
  hashtags: string[];
  assetBrief: string;
  status: ContentStatus;
  publishAt?: string;
};

export type MarketingPlan = {
  id: string;
  createdAt: string;
  horizonDays: number;
  business: BusinessProfile;
  brand: BrandIntelligence;
  competitors: CompetitorSignal[];
  strategySummary: string;
  items: ContentItem[];
  generatedBy: "openai" | "hay-demo";
};

export type SocialConnection = {
  id?: string;
  platform: SocialPlatform;
  status: "disconnected" | "pending" | "connected" | "expired" | "error";
  accountName?: string;
  accountId?: string;
  permissions: string[];
  publishing: "direct" | "draft" | "manual";
};

export type PublishingJob = {
  id: string;
  businessId?: string;
  contentItemId: string;
  platform: SocialPlatform;
  status: "queued" | "processing" | "needs_auth" | "needs_approval" | "published" | "failed";
  scheduledFor?: string;
  createdAt: string;
  externalPostId?: string;
  error?: string;
};
