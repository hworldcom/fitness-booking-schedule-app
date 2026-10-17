"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { supabasePublicConfig } from "../config";
import { normalizeEmail } from "../email-otp";
import type { AuthenticationAdapter, AuthenticationResult } from "../gateway";
import { createAuthServiceFetch } from "../service-availability";

type BrowserClient = ReturnType<typeof createBrowserClient>;
let client: BrowserClient | null | undefined;

function authClient() {
  if (client !== undefined) return client;
  const config = supabasePublicConfig();
  client = config
    ? createBrowserClient(config.url, config.publishableKey, {
        global: { fetch: createAuthServiceFetch(config.url) },
        isSingleton: false,
      })
    : null;
  return client;
}

export function supabaseAuthenticationFailure(
  error: unknown,
  operation:
    "request-code" | "verify-code" | "register" | "password" | "sign-out",
): AuthenticationResult {
  const failure =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const code = typeof failure.code === "string" ? failure.code : "";
  if (
    failure.status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    // This SDK error does not expose a verified Retry-After value.
    return { status: "rate-limited", retryAfterSeconds: null };
  }
  if (operation === "register" && code === "weak_password")
    return { status: "invalid", message: "password-unsafe" };
  // Unknown and duplicate addresses receive exactly the same acknowledgement.
  if (
    (operation === "register" &&
      ["user_already_exists", "email_exists"].includes(code)) ||
    (operation === "request-code" &&
      ["user_not_found", "signup_disabled", "otp_disabled"].includes(code))
  ) {
    return { status: "requested" };
  }
  if (typeof failure.status === "number" && failure.status >= 500)
    return { status: "unavailable" };
  if (
    operation === "verify-code" &&
    ["otp_expired", "validation_failed"].includes(code)
  )
    return { status: "invalid-proof" };
  if (
    operation === "password" &&
    ["invalid_credentials", "email_not_confirmed", "user_banned"].includes(code)
  )
    return { status: "invalid-credentials" };
  return { status: "unavailable" };
}

export function createSupabaseAuthenticationAdapter(
  getClient: () => Pick<BrowserClient, "auth"> | null = authClient,
): AuthenticationAdapter {
  return {
    async requestEmailCode(email, options) {
      const client = getClient();
      if (!client) return { status: "unavailable" };
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: options.createAccount === true },
      });
      return error
        ? supabaseAuthenticationFailure(error, "request-code")
        : { status: "requested" };
    },
    async verifyEmailCode(email, token) {
      const client = getClient();
      if (!client) return { status: "unavailable" };
      const { data, error } = await client.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) return supabaseAuthenticationFailure(error, "verify-code");
      return data.session && data.user
        ? { status: "success", email: normalizeEmail(data.user.email) }
        : { status: "invalid-proof" };
    },
    async registerWithPassword(email, password) {
      const client = getClient();
      const config = supabasePublicConfig();
      if (!client || !config) return { status: "unavailable" };
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: new URL("/auth/confirm", config.siteUrl).toString(),
        },
      });
      if (error) return supabaseAuthenticationFailure(error, "register");
      // An auto-confirming environment does not satisfy the signup contract.
      if (data.session) {
        await client.auth.signOut({ scope: "local" });
        return { status: "unavailable" };
      }
      return { status: "requested" };
    },
    async signInWithPassword(email, password) {
      const client = getClient();
      if (!client) return { status: "unavailable" };
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return supabaseAuthenticationFailure(error, "password");
      return data.session && data.user
        ? { status: "success", email: normalizeEmail(data.user.email) }
        : { status: "invalid-credentials" };
    },
    async signOut() {
      const client = getClient();
      if (!client) return { status: "unavailable" };
      const { error } = await client.auth.signOut({ scope: "local" });
      return error
        ? supabaseAuthenticationFailure(error, "sign-out")
        : { status: "success", email: null };
    },
    subscribe(listener) {
      const client = getClient();
      if (!client) return () => {};
      const { data } = client.auth.onAuthStateChange(
        (event: AuthChangeEvent) => {
          if (event === "SIGNED_OUT") listener("signed-out");
          else if (
            [
              "SIGNED_IN",
              "TOKEN_REFRESHED",
              "USER_UPDATED",
              "PASSWORD_RECOVERY",
            ].includes(event)
          )
            listener("session-changed");
        },
      );
      return () => data.subscription.unsubscribe();
    },
  };
}

export const supabaseAuthenticationAdapter =
  createSupabaseAuthenticationAdapter();
