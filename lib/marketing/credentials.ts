import "server-only";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export type OAuthCredential = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  accountId?: string;
  tokenType?: string;
  providerData?: Record<string, unknown>;
};

export async function storeCredential(connectionId: string, credential: OAuthCredential) {
  if (!isSupabaseAdminConfigured()) throw new Error("supabase_admin_unconfigured");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("hay_store_oauth_secret", {
    p_connection_id: connectionId,
    p_secret: JSON.stringify(credential),
  });
  if (error) throw error;
  return data as string;
}

export async function readCredential(connectionId: string): Promise<OAuthCredential | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("hay_get_oauth_secret", { p_connection_id: connectionId });
  if (error) throw error;
  if (!data) return null;
  return JSON.parse(String(data)) as OAuthCredential;
}
