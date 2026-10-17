"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { supabasePublicConfig } from "../config";
import type {
  AuthenticationAdapter,
  AuthenticationEvent,
  AuthenticationResult,
} from "../gateway";
import type { AuthenticationCommand } from "../operations";
import { createAuthServiceFetch } from "../service-availability";
import { postAuthenticationCommand } from "./operation-client";

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

export function createSupabaseAuthenticationAdapter(
  getClient: () => Pick<BrowserClient, "auth"> | null = authClient,
  request: (
    command: AuthenticationCommand,
  ) => Promise<AuthenticationResult> = postAuthenticationCommand,
): AuthenticationAdapter {
  async function execute(command: AuthenticationCommand) {
    const result = await request(command);
    if (
      typeof window !== "undefined" &&
      ["success", "recovery-required", "password-updated"].includes(
        result.status,
      )
    ) {
      window.dispatchEvent(new Event("movx-auth-session"));
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("movx-auth-session");
        channel.postMessage("changed");
        channel.close();
      }
    }
    return result;
  }
  return {
    execute,
    registerWithPassword: (email, password) =>
      execute({ action: "register", email, password }),
    signInWithPassword: (email, password) =>
      execute({ action: "sign-in", email, password }),
    signOut: () => execute({ action: "sign-out" }),
    subscribe(listener: (event: AuthenticationEvent) => void) {
      const client = getClient();
      const changed = () => listener("session-changed");
      const subscription = client?.auth.onAuthStateChange(
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
            changed();
        },
      );
      const channel =
        typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
          ? new BroadcastChannel("movx-auth-session")
          : null;
      if (channel) channel.onmessage = changed;
      if (typeof window !== "undefined") {
        window.addEventListener("movx-auth-session", changed);
        window.addEventListener("focus", changed);
      }
      return () => {
        subscription?.data.subscription.unsubscribe();
        channel?.close();
        if (typeof window !== "undefined") {
          window.removeEventListener("movx-auth-session", changed);
          window.removeEventListener("focus", changed);
        }
      };
    },
  };
}
export const supabaseAuthenticationAdapter =
  createSupabaseAuthenticationAdapter();
