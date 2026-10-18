import "server-only";
import { supabasePublicConfig } from "@/auth/config";

export function isSameApplicationOrigin(request: Request): boolean {
  const config = supabasePublicConfig();
  return config !== null && request.headers.get("origin") === config.siteUrl;
}
