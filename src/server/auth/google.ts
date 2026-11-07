import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { supabasePublicConfig, type SupabasePublicConfig } from "@/auth/config";
import type { AuthenticationCommand } from "@/auth/operations";
import { safeReturnTo } from "@/auth/return-to";
import {
  currentApplicationAuthPurpose,
  grantApplicationAuthSession,
  revokeApplicationAuthSessions,
  type AuthContinuation,
} from "@/server/db/auth/repository";
import { createServerAuthFetch, serverAuthClient } from "./client";
import { verifiedProviderContext } from "./session";
import {
  authContinuation,
  authenticationDestination,
  withAuthContinuation,
} from "./continuation";

export const GOOGLE_FLOW_COOKIE = "movx-google-flow";
const FLOW_LIFETIME_MS = 600_000;
type GoogleCommand = Extract<AuthenticationCommand, { action: "start-google" }>;
type GoogleFlow = AuthContinuation & {
  id: string;
  startedAt: number;
  previousSessionId: string | null;
};

/** Public settings prove provider availability, never credentials or a successful login. */
export async function googleProviderAvailable(
  config: SupabasePublicConfig | null = supabasePublicConfig(),
  enabled = process.env.MOVX_GOOGLE_AUTH_ENABLED === "true",
  transport: typeof fetch = fetch,
): Promise<boolean> {
  if (!enabled || !config) return false;
  try {
    const response = await transport(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.publishableKey },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    const value: unknown = await response.json();
    return (
      response.ok &&
      !!value &&
      typeof value === "object" &&
      "external" in value &&
      !!value.external &&
      typeof value.external === "object" &&
      "google" in value.external &&
      value.external.google === true
    );
  } catch {
    return false;
  }
}

const defaults = {
  config: supabasePublicConfig,
  available: (config: SupabasePublicConfig) =>
    googleProviderAvailable(
      config,
      undefined,
      createServerAuthFetch(config.url),
    ),
  store: cookies,
  client: () => serverAuthClient({ googlePkce: true }),
  verified: verifiedProviderContext,
  purpose: currentApplicationAuthPurpose,
  grant: grantApplicationAuthSession,
  revoke: revokeApplicationAuthSessions,
  destination: authenticationDestination,
  now: Date.now,
  random: () => randomBytes(32).toString("hex"),
};

function flowFromCookie(
  value: string | undefined,
  site: string,
  now: number,
): GoogleFlow | null {
  if (!value || value.length > 3800) return null;
  try {
    const flow: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (!flow || typeof flow !== "object") return null;
    const input = flow as GoogleFlow;
    if (
      !/^[0-9a-f]{64}$/.test(input.id) ||
      !Number.isSafeInteger(input.startedAt) ||
      input.startedAt > now ||
      now - input.startedAt > FLOW_LIFETIME_MS ||
      (input.previousSessionId !== null &&
        !/^[0-9a-f-]{36}$/.test(input.previousSessionId)) ||
      typeof input.returnTo !== "string" ||
      input.returnTo !== safeReturnTo(input.returnTo, site) ||
      (input.intent !== null &&
        input.intent !== "client" &&
        input.intent !== "coach")
    )
      return null;
    return input;
  } catch {
    return null;
  }
}

function authorizeUrl(
  value: string | null,
  config: SupabasePublicConfig,
  callback: URL,
) {
  if (!value) return null;
  try {
    const url = new URL(value),
      expected = new URL(`${config.url}/auth/v1/authorize`);
    if (
      url.origin !== expected.origin ||
      url.pathname !== expected.pathname ||
      url.username ||
      url.password ||
      url.hash ||
      url.searchParams.get("provider") !== "google" ||
      url.searchParams.get("redirect_to") !== callback.toString() ||
      url.searchParams.get("code_challenge_method") !== "s256" ||
      !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("code_challenge") ?? "")
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Dependencies are replaceable for deterministic proof/error tests; runtime uses managed Auth. */
export function createGoogleAuthentication(
  overrides: Partial<typeof defaults> = {},
) {
  const deps = { ...defaults, ...overrides };
  async function clear() {
    const store = await deps.store();
    store.delete(GOOGLE_FLOW_COOKIE);
    for (const { name } of store.getAll())
      if (/-google-code-verifier(?:\.\d+)?$/.test(name)) store.delete(name);
  }
  const failed = (
    context: AuthContinuation,
    notice: "google-cancelled" | "google-failed" | "google-unavailable",
  ) => withAuthContinuation("/sign-in", context) + "&notice=" + notice;
  const home: AuthContinuation = { returnTo: "/", intent: null };
  return {
    async start(command: GoogleCommand): Promise<string> {
      const config = deps.config();
      if (!config) return failed(home, "google-unavailable");
      const requested = authContinuation(command, config.siteUrl);
      // Normalized Unicode paths can grow after percent encoding; keep the cookie bounded.
      const context = {
        ...requested,
        returnTo: requested.returnTo.length <= 2048 ? requested.returnTo : "/",
      };
      try {
        const previous = await deps.verified();
        if (previous.session.status === "unavailable")
          return failed(context, "google-unavailable");
        const previousSessionId =
          previous.session.status === "signed-in"
            ? previous.authSessionId
            : null;
        if (
          previous.session.status === "signed-in" &&
          previousSessionId &&
          (await deps.purpose(previous.session.subject, previousSessionId)) ===
            "recovery"
        )
          return "/reset-password";
        if (!(await deps.available(config)))
          return failed(context, "google-unavailable");
        const client = await deps.client();
        if (!client) return failed(context, "google-unavailable");
        const flow: GoogleFlow = {
          ...context,
          id: deps.random(),
          startedAt: deps.now(),
          previousSessionId,
        };
        const callback = new URL("/auth/callback", config.siteUrl);
        callback.searchParams.set("flow", flow.id);
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: callback.toString(),
            scopes: "openid email profile",
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
          },
        });
        const location = !error
          ? authorizeUrl(data.url, config, callback)
          : null;
        if (!location) {
          await clear();
          return failed(context, "google-unavailable");
        }
        (await deps.store()).set(
          GOOGLE_FLOW_COOKIE,
          Buffer.from(JSON.stringify(flow)).toString("base64url"),
          {
            httpOnly: true,
            secure: config.siteUrl.startsWith("https:"),
            sameSite: "lax",
            path: "/",
            maxAge: FLOW_LIFETIME_MS / 1000,
          },
        );
        return location;
      } catch {
        await clear();
        return failed(context, "google-unavailable");
      }
    },
    async callback(params: URLSearchParams): Promise<string> {
      const config = deps.config();
      if (!config) return failed(home, "google-unavailable");
      const flow = flowFromCookie(
        (await deps.store()).get(GOOGLE_FLOW_COOKIE)?.value,
        config.siteUrl,
        deps.now(),
      );
      // A stray callback must not consume another tab's pending flow or its verifier.
      if (
        !flow ||
        params.getAll("flow").length !== 1 ||
        params.get("flow") !== flow.id
      )
        return failed(home, "google-failed");
      let exchanged = false;
      let client: Awaited<ReturnType<typeof serverAuthClient>> = null;
      try {
        const previous = await deps.verified();
        const previousSessionId =
          previous.session.status === "signed-in"
            ? previous.authSessionId
            : null;
        if (
          previous.session.status === "signed-in" &&
          previousSessionId &&
          (await deps.purpose(previous.session.subject, previousSessionId)) ===
            "recovery"
        )
          return "/reset-password";
        if (previous.session.status === "unavailable")
          return failed(flow, "google-unavailable");
        if (previousSessionId !== flow.previousSessionId)
          return failed(flow, "google-failed");
        if (params.has("error"))
          return failed(
            flow,
            params.get("error") === "access_denied"
              ? "google-cancelled"
              : "google-failed",
          );
        if (
          params.getAll("code").length !== 1 ||
          !/^[A-Za-z0-9_-]{16,512}$/.test(params.get("code") ?? "")
        )
          return failed(flow, "google-failed");
        if (!(await deps.available(config)))
          return failed(flow, "google-unavailable");
        client = await deps.client();
        if (!client) return failed(flow, "google-unavailable");
        const { data, error } = await client.auth.exchangeCodeForSession(
          params.get("code")!,
        );
        if (error) return failed(flow, "google-failed");
        exchanged = true;
        const current = await deps.verified(client);
        if (
          ("redirectType" in data && data.redirectType === "recovery") ||
          !data.user?.identities?.some(
            (identity) => identity.provider === "google",
          ) ||
          current.session.status !== "signed-in" ||
          !current.authSessionId ||
          data.user.id !== current.session.subject ||
          current.authSessionId === previousSessionId ||
          !(await deps.grant(
            current.session.subject,
            current.authSessionId,
            "ordinary",
            flow,
          ))
        ) {
          await client.auth.signOut({ scope: "local" });
          return failed(flow, "google-failed");
        }
        if (previous.session.status === "signed-in" && previousSessionId)
          await deps.revoke(previous.session.subject, previousSessionId);
        return await deps.destination(flow);
      } catch {
        if (exchanged && client)
          await client.auth.signOut({ scope: "local" }).catch(() => {});
        return failed(flow, "google-unavailable");
      } finally {
        await clear();
      }
    },
  };
}
