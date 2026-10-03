import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { createAuthServiceFetch } from "@/auth/service-availability";

export async function refreshAuthSession(request: NextRequest) {
  const config = supabasePublicConfig();
  if (!config) return NextResponse.next({ request });

  try {
    let response = NextResponse.next({ request });
    const client = createServerClient(config.url, config.publishableKey, {
      global: { fetch: createAuthServiceFetch(config.url) },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    });

    await client.auth.getClaims();
    return response;
  } catch {
    // Authentication must fail closed, but public browsing remains available
    // while the local Auth service is offline.
    return NextResponse.next({ request });
  }
}
