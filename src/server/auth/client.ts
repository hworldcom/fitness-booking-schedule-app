import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/auth/config";
import { createAuthServiceFetch } from "@/auth/service-availability";

export async function serverAuthClient() {
  const config = supabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    global: { fetch: createAuthServiceFetch(config.url) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The request proxy owns
          // refresh writes before rendering begins.
        }
      },
    },
  });
}
