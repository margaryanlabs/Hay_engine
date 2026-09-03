import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PLAN_URL_ENV = {
  creator: "HAY_CHECKOUT_CREATOR_URL",
  growth: "HAY_CHECKOUT_GROWTH_URL",
  business: "HAY_CHECKOUT_BUSINESS_URL",
  agency: "HAY_CHECKOUT_AGENCY_URL",
} as const;

type PaidPlan = keyof typeof PLAN_URL_ENV;

function safeCheckoutUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "persistence_required" }, { status: 503 });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const plan = String(body.plan || "") as PaidPlan;
  if (!(plan in PLAN_URL_ENV)) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const checkoutUrl = safeCheckoutUrl(process.env[PLAN_URL_ENV[plan]]);
  if (!checkoutUrl) {
    return NextResponse.json({
      error: "checkout_not_configured",
      plan,
      message: `Configure ${PLAN_URL_ENV[plan]} with the hosted checkout URL from your billing provider.`,
    }, { status: 503 });
  }

  const url = new URL(checkoutUrl);
  // These are harmless correlation hints. The billing webhook must still verify its own signed payload.
  url.searchParams.set("client_reference_id", String(userId));
  url.searchParams.set("metadata[hay_plan]", plan);
  return NextResponse.json({ checkoutUrl: url.toString(), plan });
}
