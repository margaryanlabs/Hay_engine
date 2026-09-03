import { NextResponse } from "next/server";
import { planEnforcementEnabled } from "@/lib/commercial/entitlements";
import { getConnectorReadiness } from "@/lib/marketing/connectors";
import { isPublishWorkerConfigured } from "@/lib/publish/client";
import { isOpenAITranscriptionConfigured } from "@/lib/providers/openai-transcription";
import { isVeoConfigured } from "@/lib/providers/veo";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = isSupabaseConfigured();
  const admin = isSupabaseAdminConfigured();
  const providers = {
    strategy: Boolean(process.env.OPENAI_API_KEY),
    image: Boolean(process.env.OPENAI_API_KEY),
    voice: Boolean(process.env.ELEVENLABS_API_KEY && (process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID_MALE || process.env.ELEVENLABS_VOICE_ID_FEMALE)) || Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
    video: isVeoConfigured(),
    transcription: isOpenAITranscriptionConfigured(),
    translation: Boolean(process.env.OPENAI_API_KEY),
  };
  const languageApi = {
    normalize:true,
    pronounce:true,
    captions:true,
    transcribe:providers.transcription,
    transcriptCorrection:Boolean(process.env.OPENAI_API_KEY),
    translate:providers.translation,
    unauthenticatedProviderAccess:process.env.HAY_ALLOW_UNAUTHENTICATED_LANGUAGE_API === "true",
  };
  const workers = {
    render: Boolean(process.env.RENDER_WORKER_URL && process.env.RENDER_WORKER_SECRET),
    publish: isPublishWorkerConfigured(),
  };
  const social = Object.fromEntries((["instagram", "tiktok", "youtube", "facebook"] as const).map(platform => {
    const readiness = getConnectorReadiness(platform);
    return [platform, { configured: readiness.configured, missing: readiness.missing, appReviewRequired: readiness.appReviewRequired }];
  }));

  let commercialMigration=false;
  if(admin){
    try{
      const check=await createAdminClient().from("account_entitlements").select("owner_id",{head:true,count:"exact"}).limit(1);
      commercialMigration=!check.error;
    }catch{/* setup endpoint reports the blocker below */}
  }
  const checkout={
    creator:Boolean(process.env.HAY_CHECKOUT_CREATOR_URL),
    growth:Boolean(process.env.HAY_CHECKOUT_GROWTH_URL),
    business:Boolean(process.env.HAY_CHECKOUT_BUSINESS_URL),
    agency:Boolean(process.env.HAY_CHECKOUT_AGENCY_URL),
  };
  const billingSync=Boolean(process.env.HAY_BILLING_SYNC_SECRET)&&admin;
  const commercialReady=supabase&&admin&&commercialMigration&&billingSync&&checkout.creator&&checkout.growth&&checkout.business;
  const coreReady = providers.strategy && supabase && admin;
  const marketingReady = coreReady && workers.publish;

  return NextResponse.json({
    service: "HAY Engine",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    mode: supabase ? "persistent" : "demo",
    coreReady,
    marketingReady,
    commercialReady,
    persistence: { supabase, admin },
    providers,
    languageApi,
    workers,
    social,
    commercial:{
      migration:commercialMigration,
      planEnforcement:planEnforcementEnabled(),
      billingSync,
      checkout,
    },
    blockers: [
      ...(!supabase ? ["dedicated_supabase_required"] : []),
      ...(!providers.strategy ? ["openai_key_required_for_ai_strategy"] : []),
      ...(!workers.publish ? ["publish_worker_required_for_automatic_posting"] : []),
      ...(supabase&&!commercialMigration ? ["commercial_migration_007_required"] : []),
      ...(commercialMigration&&!billingSync ? ["billing_sync_secret_required"] : []),
      ...(commercialMigration&&!planEnforcementEnabled() ? ["plan_enforcement_disabled"] : []),
      ...(!checkout.creator||!checkout.growth||!checkout.business ? ["paid_checkout_links_required"] : []),
      ...(!providers.transcription ? ["openai_key_required_for_transcription"] : []),
    ],
  });
}
