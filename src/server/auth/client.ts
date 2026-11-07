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

export async function serverAuthClient(options?: { googlePkce?: boolean }) {
  const config = supabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    global: { fetch: createServerAuthFetch(config.url) },
    cookies: {
      getAll() {
        const values = cookieStore.getAll();
        if (!options?.googlePkce) return values;
        // Isolate Google from an outstanding confirmation/recovery verifier.
        return values
          .filter(
            ({ name }) =>
              !/^(?!.*-google-code-verifier).*?-code-verifier(?:\.\d+)?$/.test(
                name,
              ),
          )
          .map(({ name, value }) => ({
            name: name.replace(
              /-google-code-verifier(?=\.|$)/,
              "-code-verifier",
            ),
            value,
          }));
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            const verifier =
              options?.googlePkce && /-code-verifier(?:\.\d+)?$/.test(name);
            cookieStore.set(
              verifier
                ? name.replace(
                    /-code-verifier(?=\.|$)/,
                    "-google-code-verifier",
                  )
                : name,
              value,
              verifier
                ? {
                    ...cookieOptions,
                    httpOnly: true,
                    secure: config.siteUrl.startsWith("https:"),
                    sameSite: "lax",
                    maxAge: cookieOptions.maxAge === 0 ? 0 : 600,
                  }
                : cookieOptions,
            );
          });
        } catch {
          // Server Components cannot write cookies. The request proxy owns
          // refresh writes before rendering begins.
        }
      },
    },
  });
}
