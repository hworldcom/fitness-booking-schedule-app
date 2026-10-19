import "server-only";
import { supabasePublicConfig } from "@/auth/config";

/** Reuse Auth's validated canonical site origin without exposing provider configuration. */
export function publicSiteOrigin() {
  return supabasePublicConfig()?.siteUrl ?? null;
}
