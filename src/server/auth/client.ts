import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/auth/config";
import { createAuthServiceFetch } from "@/auth/service-availability";

export function createServerAuthFetch(url: string): typeof fetch {
  const transport = createAuthServiceFetch(url);
  return (input, init) =>
    transport(input, {
      ...init,
      signal: AbortSignal.any([
        AbortSignal.timeout(15_000),
        ...(init?.signal ? [init.signal] : []),
      ]),
    });
}

export async function serverAuthClient() {
  const config = supabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    global: { fetch: createServerAuthFetch(config.url) },
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
