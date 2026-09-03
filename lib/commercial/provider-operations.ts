import "server-only";

import { getCommercialContext, type UsageMeter } from "@/lib/commercial/entitlements";
import { createClient } from "@/lib/supabase/server";

export type ProviderOperationAccessReason =
  | "unauthorized"
  | "operation_not_owned"
  | "operation_ownership_check_failed";

export async function checkOwnedProviderOperation(input: {
  meter: UsageMeter;
  source: string;
  operationName: string;
}) {
  const context = await getCommercialContext();

  // Local development or an explicitly enabled demo may poll without persistent identity.
  // Production/preview deployments without Supabase fail closed through the same provider
  // access policy used by generation routes.
  if (!context.configured) {
    if (context.allowUnauthenticatedProviderAccess) {
      return { allowed: true as const, demo: true, context };
    }
    return { allowed: false as const, reason: "unauthorized" as const, context };
  }

  if (!context.authenticated || !("userId" in context) || !context.userId) {
    return { allowed: false as const, reason: "unauthorized" as const, context };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usage_events")
    .select("id")
    .eq("owner_id", context.userId)
    .eq("meter", input.meter)
    .eq("source", input.source)
    .contains("metadata", { operationName: input.operationName })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Provider operation ownership lookup failed", error.message);
    return { allowed: false as const, reason: "operation_ownership_check_failed" as const, context };
  }
  if (!data?.id) {
    return { allowed: false as const, reason: "operation_not_owned" as const, context };
  }

  return { allowed: true as const, demo: false, userId: context.userId, context };
}
