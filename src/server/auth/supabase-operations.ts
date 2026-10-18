import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/auth/config";
import { normalizeEmail } from "@/auth/email";
import type { AuthenticationResult } from "@/auth/gateway";
import type { AuthenticationCommand } from "@/auth/operations";
import { isSignInPassword, validateNewPassword } from "@/auth/password";
import { safeReturnTo } from "@/auth/return-to";
import {
  beginEmailAuthFlow,
  consumeEmailAuthFlow,
  currentApplicationAuthPurpose,
  currentApplicationAuthContinuation,
  grantApplicationAuthSession,
  readEmailAuthFlow,
  revokeApplicationAuthSessions,
  withPasswordMutation,
  recordPasswordMethod,
  type AuthContinuation,
  type EmailAuthPurpose,
} from "@/server/db/auth/repository";
import { currentApplicationIdentity } from "@/server/identity/service";
import { currentActorSnapshot } from "@/server/authorization/service";
import { serverAuthClient, createServerAuthFetch } from "./client";
import { verifiedProviderContext, verifiedAuthSession } from "./session";

const FLOW_COOKIE = "movx-auth-flow";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function failure(
  error: unknown,
  operation: "request" | "password" | "proof" | "update",
): AuthenticationResult {
  const info =
    error && typeof error === "object"
      ? (error as { code?: string; status?: number })
      : {};
  if (
    info.status === 429 ||
    info.code === "over_email_send_rate_limit" ||
    info.code === "over_request_rate_limit"
  )
    return { status: "rate-limited", retryAfterSeconds: null };
  if (
    operation === "request" &&
    [
      "user_already_exists",
      "email_exists",
      "user_not_found",
      "signup_disabled",
      "otp_disabled",
    ].includes(info.code ?? "")
  )
    return { status: "requested", next: "/check-email" };
  if (info.status && info.status >= 500) return { status: "unavailable" };
  if (info.code === "weak_password")
    return { status: "invalid", message: "password-unsafe" };
  if (
    operation === "proof" &&
    [
      "otp_expired",
      "validation_failed",
      "flow_state_expired",
      "flow_state_not_found",
    ].includes(info.code ?? "")
  )
    return { status: "invalid-proof" };
  if (
    operation === "password" &&
    ["invalid_credentials", "email_not_confirmed", "user_banned"].includes(
      info.code ?? "",
    )
  )
    return { status: "invalid-credentials" };
  return { status: "unavailable" };
}

function continuation(
  command: { returnTo?: string; intent?: "client" | "coach" },
  site: string,
): AuthContinuation {
  return {
    returnTo: safeReturnTo(command.returnTo, site),
    intent: command.intent ?? null,
  };
}

function withContinuation(path: string, context: AuthContinuation) {
  const params = new URLSearchParams({ returnTo: context.returnTo });
  if (context.intent) params.set("intent", context.intent);
  return path + "?" + params;
}

async function destination(context: AuthContinuation) {
  const identity = await currentApplicationIdentity(
    await verifiedAuthSession(),
  );
  if (identity.status === "profile-required")
    return withContinuation("/complete-profile", context);
  if (identity.status !== "enrolled")
    return withContinuation("/complete-profile", context);
  if (context.intent === "coach") {
    const actor = await currentActorSnapshot();
    if (
      actor.status === "authorized" &&
      ["approved", "demo", "suspended"].includes(actor.coachAccessStatus)
    )
      return "/profile/coach";
    return withContinuation("/complete-profile", context);
  }
  return context.returnTo;
}

async function boundFlow(flowValue?: string) {
  const cookie = (await cookies()).get(FLOW_COOKIE)?.value;
  if (!cookie || !/^[0-9a-f]{64}\.[0-9a-f]{64}$/.test(cookie)) return null;
  const [id, binding] = cookie.split(".");
  if (flowValue !== undefined && flowValue !== id) return null;
  const idHash = hash(id),
    bindingHash = hash(binding);
  const flow = await readEmailAuthFlow(idHash, bindingHash);
  return flow ? { flow, idHash, bindingHash } : null;
}

async function requestEmail(
  command: Extract<AuthenticationCommand, { email: string }>,
  purpose: Exclude<EmailAuthPurpose, "login">,
): Promise<AuthenticationResult> {
  const config = supabasePublicConfig();
  const client = await serverAuthClient();
  if (!config || !client) return { status: "unavailable" };
  const email = normalizeEmail(command.email);
  if (!email) return { status: "invalid", message: "email" };
  if (command.action === "register") {
    const checked = validateNewPassword(command.password);
    if (!checked.valid) return { status: "invalid", message: checked.message };
  }
  const id = randomBytes(32).toString("hex"),
    binding = randomBytes(32).toString("hex");
  const result = await beginEmailAuthFlow(
    hash(id),
    hash(binding),
    hash(email),
    purpose,
    continuation(command, config.siteUrl),
  );
  if (result.status !== "ready")
    return result.status === "rate-limited"
      ? result
      : { status: "unavailable" };
  const store = await cookies();
  store.set(FLOW_COOKIE, id + "." + binding, {
    httpOnly: true,
    secure: config.siteUrl.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  const redirectTo = new URL("/auth/confirm", config.siteUrl);
  redirectTo.hash = new URLSearchParams({ flow: id }).toString();
  let error: unknown;
  if (command.action === "register") {
    const response = await client.auth.signUp({
      email,
      password: command.password,
      options: { emailRedirectTo: redirectTo.toString() },
    });
    error = response.error;
    if (
      !response.error &&
      !response.data.user?.email_confirmed_at &&
      response.data.user?.identities?.some(
        (identity) => identity.provider === "email",
      )
    )
      await recordPasswordMethod(response.data.user.id);

    if (response.data.session) {
      await client.auth.signOut({ scope: "local" });
      return { status: "unavailable" };
    }
  } else if (purpose === "confirmation") {
    error = (
      await client.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectTo.toString() },
      })
    ).error;
  } else {
    error = (
      await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo.toString(),
      })
    ).error;
  }
  return error
    ? failure(error, "request")
    : {
        status: "requested",
        next: "/check-email",
      };
}

async function acceptProof(
  command: Extract<AuthenticationCommand, { action: "confirm-email" }>,
  previous: Awaited<ReturnType<typeof verifiedProviderContext>>,
): Promise<AuthenticationResult> {
  const bound = await boundFlow(command.flow);
  if (!bound || bound.flow.purpose === "login")
    return { status: "invalid-proof" };
  const { flow, idHash, bindingHash } = bound;
  const expected = flow.purpose === "confirmation" ? "signup" : "recovery";
  if (command.type !== expected) return { status: "invalid-proof" };
  const client = await serverAuthClient();
  if (!client) return { status: "unavailable" };
  const verified = await client.auth.verifyOtp({
    token_hash: command.tokenHash,
    type: command.type,
  });
  if (verified.error) return failure(verified.error, "proof");
  const context = await verifiedProviderContext(client);
  if (
    context.session.status !== "signed-in" ||
    !context.authSessionId ||
    hash(context.session.email) !== flow.emailHash ||
    !(await consumeEmailAuthFlow(idHash, bindingHash))
  ) {
    await client.auth.signOut({ scope: "local" });
    return { status: "invalid-proof" };
  }
  const purpose = flow.purpose === "recovery" ? "recovery" : "ordinary";
  if (
    !(await grantApplicationAuthSession(
      context.session.subject,
      context.authSessionId,
      purpose,
      purpose === "recovery" ? flow : undefined,
    ))
  ) {
    await client.auth.signOut({ scope: "local" });
    return { status: "unavailable" };
  }
  await retirePreviousSession(previous, context);
  (await cookies()).delete(FLOW_COOKIE);
  return purpose === "recovery"
    ? { status: "recovery-required", next: "/reset-password" }
    : {
        status: "success",
        email: context.session.email,
        next: await destination(flow),
      };
}

async function signIn(
  command: Extract<AuthenticationCommand, { action: "register" | "sign-in" }>,
  previous: Awaited<ReturnType<typeof verifiedProviderContext>>,
): Promise<AuthenticationResult> {
  const client = await serverAuthClient(),
    config = supabasePublicConfig();
  const email = normalizeEmail(command.email);
  if (!email || !isSignInPassword(command.password))
    return { status: "invalid-credentials" };
  if (!client || !config) return { status: "unavailable" };
  const response = await client.auth.signInWithPassword({
    email,
    password: command.password,
  });
  if (response.error) return failure(response.error, "password");
  const context = await verifiedProviderContext(client);
  if (
    context.session.status !== "signed-in" ||
    context.session.email !== email ||
    !context.authSessionId ||
    !(await grantApplicationAuthSession(
      context.session.subject,
      context.authSessionId,
      "ordinary",
    ))
  ) {
    await client.auth.signOut({ scope: "local" });
    return { status: "invalid-credentials" };
  }
  await recordPasswordMethod(context.session.subject);
  await retirePreviousSession(previous, context);
  return {
    status: "success",
    email,
    next: await destination(continuation(command, config.siteUrl)),
  };
}

async function retirePreviousSession(
  previous: Awaited<ReturnType<typeof verifiedProviderContext>>,
  current: Awaited<ReturnType<typeof verifiedProviderContext>>,
) {
  if (
    previous.session.status === "signed-in" &&
    previous.authSessionId &&
    previous.authSessionId !== current.authSessionId
  )
    await revokeApplicationAuthSessions(
      previous.session.subject,
      previous.authSessionId,
    );
}

async function updatePassword(
  command: Extract<
    AuthenticationCommand,
    { action: "reset-password" | "change-password" }
  >,
): Promise<AuthenticationResult> {
  const checked = validateNewPassword(command.password);
  if (!checked.valid) return { status: "invalid", message: checked.message };
  const client = await serverAuthClient(),
    config = supabasePublicConfig();
  if (!client || !config) return { status: "unavailable" };
  const context = await verifiedProviderContext(client);
  if (context.session.status !== "signed-in" || !context.authSessionId)
    return { status: "invalid-proof" };
  const subject = context.session.subject,
    sessionId = context.authSessionId,
    email = context.session.email;
  const resume = (await currentApplicationAuthContinuation(
    subject,
    sessionId,
  )) ?? { returnTo: "/", intent: null };
  const reauth =
    command.action === "change-password"
      ? createClient(config.url, config.publishableKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
          global: { fetch: createServerAuthFetch(config.url) },
        })
      : null;
  const updatingClient = reauth ?? client;
  let changed = false;
  try {
    const result = await withPasswordMutation<AuthenticationResult>(
      subject,
      async (authority) => {
        if (
          (await authority.purpose(sessionId)) !==
          (command.action === "reset-password" ? "recovery" : "ordinary")
        )
          return { status: "invalid-proof" };
        if (command.action === "change-password" && reauth) {
          if (
            !isSignInPassword(command.currentPassword) ||
            !(await authority.hasPassword())
          )
            return { status: "invalid-credentials" };
          const verified = await reauth.auth.signInWithPassword({
            email,
            password: command.currentPassword,
          });
          if (verified.error) return failure(verified.error, "password");
          const user = await reauth.auth.getUser();
          if (user.error || user.data.user?.id !== subject)
            return { status: "invalid-credentials" };
        }
        const updated = await updatingClient.auth.updateUser({
          password: checked.password,
          ...(command.action === "change-password"
            ? { current_password: command.currentPassword }
            : {}),
        });
        if (updated.error) return failure(updated.error, "update");
        changed = true;
        const timestamp = updated.data.user?.updated_at;
        if (!timestamp || !Number.isFinite(Date.parse(timestamp)))
          throw new Error("Missing managed credential timestamp");
        await authority.revokeCredentials(timestamp);
        return {
          status: "password-updated",
          next:
            withContinuation("/sign-in", resume) + "&notice=password-updated",
        };
      },
    );
    if (!changed) return result;
    // Commit the registry fence before provider deletion cascades touch its rows.
    const revoked = await updatingClient.auth.signOut({ scope: "global" });
    return revoked.error ? { status: "unavailable" } : result;
  } catch {
    if (changed)
      await updatingClient.auth.signOut({ scope: "global" }).catch(() => {});
    return { status: "unavailable" };
  } finally {
    if (reauth) await reauth.auth.signOut({ scope: "local" }).catch(() => {});
    if (changed) {
      await client.auth.signOut({ scope: "local" }).catch(() => {});
      (await cookies()).delete(FLOW_COOKIE);
    }
  }
}

export async function runAuthenticationCommand(
  command: AuthenticationCommand,
): Promise<AuthenticationResult> {
  try {
    const context = await verifiedProviderContext();
    const purpose =
      context.session.status === "signed-in" && context.authSessionId
        ? await currentApplicationAuthPurpose(
            context.session.subject,
            context.authSessionId,
          )
        : null;
    if (
      purpose === "recovery" &&
      command.action !== "reset-password" &&
      command.action !== "sign-out"
    )
      return { status: "recovery-required", next: "/reset-password" };
    switch (command.action) {
      case "register":
        return requestEmail(command, "confirmation");
      case "resend-confirmation":
        return requestEmail(command, "confirmation");
      case "request-recovery":
        return requestEmail(command, "recovery");
      case "confirm-email":
        return acceptProof(command, context);
      case "sign-in":
        return signIn(command, context);
      case "reset-password":
      case "change-password":
        return updatePassword(command);
      case "sign-out": {
        const client = await serverAuthClient();
        if (!client) return { status: "unavailable" };
        if (context.session.status === "signed-in" && context.authSessionId)
          await revokeApplicationAuthSessions(
            context.session.subject,
            context.authSessionId,
          );
        const { error } = await client.auth.signOut({ scope: "local" });
        (await cookies()).delete(FLOW_COOKIE);
        return error
          ? { status: "unavailable" }
          : { status: "success", email: null };
      }
    }
  } catch {
    return { status: "unavailable" };
  }
}
