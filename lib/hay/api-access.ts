import "server-only";
import { getCommercialContext } from "@/lib/commercial/entitlements";

export async function checkLanguageProviderAccess() {
  const context = await getCommercialContext();
  if (!context.configured) {
    const allowed = process.env.NODE_ENV !== "production" || process.env.HAY_ALLOW_UNAUTHENTICATED_LANGUAGE_API === "true";
    return { allowed, reason: allowed ? null : "language_api_requires_account", context };
  }
  if (!context.authenticated) return { allowed:false, reason:"unauthorized", context };
  if (context.enforcementEnabled && context.migrationReady && !["active","trialing"].includes(context.status)) {
    return { allowed:false, reason:"subscription_inactive", context };
  }
  return { allowed:true, reason:null, context };
}
