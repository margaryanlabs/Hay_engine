import { NextResponse } from "next/server";
import { planEnforcementEnabled } from "@/lib/commercial/entitlements";
import { atomicUsageMigrationsReady } from "@/lib/commercial/usage-reservations";
import { developerApiEnabled, developerApiHourlyLimit, developerApiMaxTextChars, developerApiMigrationReady } from "@/lib/developer/api-keys";
import { correctionFlywheelReady } from "@/lib/hay/correction-store";
import { pronunciationRegistryReady } from "@/lib/hay/pronunciation-store";
import { getConnectorReadiness } from "@/lib/marketing/connectors";
import { isPublishWorkerConfigured } from "@/lib/publish/client";
import { isOpenAITranscriptionConfigured } from "@/lib/providers/openai-transcription";
import { isPexelsConfigured } from "@/lib/providers/pexels";
import { isVeoConfigured } from "@/lib/providers/veo";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

function environmentName() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

function operatorAllowlist() {
  return new Set(
    String(process.env.HAY_OPERATOR_EMAILS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.includes("@")),
  );
}

async function operatorAuthorized() {
  const allowed = operatorAllowlist();
  if (!allowed.size || !isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error) return false;
    const email = String(data?.claims?.email || "").trim().toLowerCase();
    return Boolean(email && allowed.has(email));
  } catch {
    return false;
  }
}

function protectedResponse() {
  return NextResponse.json(
    {
      service: "HAY Engine",
      environment: environmentName(),
      protected: true,
      detailed: false,
      error: "operator_auth_required",
    },
    {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET() {
  // `next start`, Vercel Preview and Vercel Production all run with NODE_ENV=production.
  // Detailed deployment diagnostics expose provider/migration/worker readiness, so they are
  // intentionally unavailable to unauthenticated public traffic in every deployed build.
  if (process.env.NODE_ENV === "production" && !(await operatorAuthorized())) {
    return protectedResponse();
  }

  const supabase = isSupabaseConfigured();
  const admin = isSupabaseAdminConfigured();
  const providers = {
    strategy: Boolean(process.env.OPENAI_API_KEY),
    image: Boolean(process.env.OPENAI_API_KEY),
    stock: isPexelsConfigured(),
    voice: Boolean(process.env.ELEVENLABS_API_KEY && (process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID_MALE || process.env.ELEVENLABS_VOICE_ID_FEMALE)) || Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
    video: isVeoConfigured(),
    transcription: isOpenAITranscriptionConfigured(),
    translation: Boolean(process.env.OPENAI_API_KEY),
  };
  const languageApi = {
    normalize: true,
    pronounce: true,
    captions: true,
    transcribe: providers.transcription,
    transcriptCorrection: Boolean(process.env.OPENAI_API_KEY),
    translate: providers.translation,
    unauthenticatedProviderAccess: process.env.HAY_ALLOW_UNAUTHENTICATED_LANGUAGE_API === "true",
  };
  const workers = {
    render: Boolean(process.env.RENDER_WORKER_URL && process.env.RENDER_WORKER_SECRET),
    publish: isPublishWorkerConfigured(),
  };
  const social = Object.fromEntries((["instagram", "tiktok", "youtube", "facebook"] as const).map((platform) => {
    const readiness = getConnectorReadiness(platform);
    return [platform, { configured: readiness.configured, missing: readiness.missing, appReviewRequired: readiness.appReviewRequired }];
  }));

  let commercialMigration = false;
  if (admin) {
    try {
      const check = await createAdminClient().from("account_entitlements").select("owner_id", { head: true, count: "exact" }).limit(1);
      commercialMigration = !check.error;
    } catch {
      // Detailed setup diagnostics report the blocker below.
    }
  }
  const atomicUsageMigration = admin ? await atomicUsageMigrationsReady() : false;
  const developerMigration = admin ? await developerApiMigrationReady() : false;
  const pronunciationRegistry = admin ? await pronunciationRegistryReady() : false;
  const correctionFlywheel = admin ? await correctionFlywheelReady() : false;
  const reviewerAllowlist = String(process.env.HAY_LANGUAGE_REVIEWER_EMAILS || "").split(",").some((item) => item.trim().includes("@"));
  const developerEnabled = developerApiEnabled();
  const hourlyRequestLimit = developerApiHourlyLimit();
  const maxTextChars = developerApiMaxTextChars();
  const developerRateLimitReady = hourlyRequestLimit > 0;
  const checkout = {
    creator: Boolean(process.env.HAY_CHECKOUT_CREATOR_URL),
    growth: Boolean(process.env.HAY_CHECKOUT_GROWTH_URL),
    business: Boolean(process.env.HAY_CHECKOUT_BUSINESS_URL),
    agency: Boolean(process.env.HAY_CHECKOUT_AGENCY_URL),
  };
  const billingSync = Boolean(process.env.HAY_BILLING_SYNC_SECRET) && admin;
  const commercialReady = supabase && admin && commercialMigration && atomicUsageMigration && billingSync && checkout.creator && checkout.growth && checkout.business;
  const developerApiReady = supabase && admin && developerMigration && developerEnabled && developerRateLimitReady;
  const coreReady = providers.strategy && supabase && admin;
  const marketingReady = coreReady && workers.publish;

  return NextResponse.json(
    {
      service: "HAY Engine",
      environment: environmentName(),
      protected: true,
      detailed: true,
      coreReady,
      marketingReady,
      commercialReady,
      developerApiReady,
      persistence: { supabase, admin },
      providers,
      creatorMedia: { stock: { provider: "pexels", configured: providers.stock, portraitFirst: true, maxSearchesPerProject: 3, attributionPreserved: true } },
      languageApi,
      languageData: {
        pronunciationRegistry,
        correctionFlywheel,
        reviewerAllowlist,
        migrations: { pronunciation: "008_language_registry.sql", corrections: "009_language_corrections_and_dataset_registry.sql" },
        fallback: "curated-core",
        precedence: ["business", "account", "hay-reviewed-system", "curated-core"],
        correctionConsent: { privateByDefault: true, productImprovementRequiredForReuse: true, benchmarkSeparate: true, modelTrainingSeparate: true, withdrawalSupported: true },
        audit: "append-only-snapshots",
        datasetProvenance: true,
      },
      developerApi: {
        enabled: developerEnabled,
        migration: developerMigration,
        requiredMigration: "012_atomic_developer_api_requests.sql",
        version: "v1",
        keyPrefix: "hay_live_",
        hashedAtRest: true,
        metering: true,
        hourlyRequestLimit,
        maxTextChars,
        rateLimitReady: developerRateLimitReady,
      },
      workers,
      social,
      commercial: {
        migration: commercialMigration,
        atomicUsageMigration,
        requiredMigrations: ["007_commercial_core.sql","010_atomic_usage_reservations.sql","011_atomic_usage_resize.sql"],
        planEnforcement: planEnforcementEnabled(),
        billingSync,
        checkout,
      },
      blockers: [
        ...(!supabase ? ["dedicated_supabase_required"] : []),
        ...(!providers.strategy ? ["openai_key_required_for_ai_strategy"] : []),
        ...(!workers.publish ? ["publish_worker_required_for_automatic_posting"] : []),
        ...(supabase && !commercialMigration ? ["commercial_migration_007_required"] : []),
        ...(commercialMigration && !atomicUsageMigration ? ["atomic_usage_migrations_010_011_required"] : []),
        ...(admin && !pronunciationRegistry ? ["language_registry_migration_008_required"] : []),
        ...(admin && !correctionFlywheel ? ["language_correction_migration_009_required"] : []),
        ...(correctionFlywheel && !reviewerAllowlist ? ["language_reviewer_allowlist_required"] : []),
        ...(admin && !developerMigration ? ["developer_api_migration_012_required"] : []),
        ...(developerMigration && !developerEnabled ? ["developer_api_disabled"] : []),
        ...(developerEnabled && !developerRateLimitReady ? ["developer_api_hourly_rate_limit_required"] : []),
        ...(commercialMigration && !billingSync ? ["billing_sync_secret_required"] : []),
        ...(commercialMigration && !atomicUsageMigration && planEnforcementEnabled() ? ["plan_enforcement_requires_atomic_usage_migrations"] : []),
        ...(commercialMigration && !planEnforcementEnabled() ? ["plan_enforcement_disabled"] : []),
        ...(!checkout.creator || !checkout.growth || !checkout.business ? ["paid_checkout_links_required"] : []),
        ...(!providers.transcription ? ["openai_key_required_for_transcription"] : []),
      ],
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
