import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/auth/config";
import { normalizeEmail } from "@/auth/email";
import type { AuthenticationResult } from "@/auth/gateway";
import type { AuthenticationCommand } from "@/auth/operations";
import { isSignInPassword, validateNewPassword } from "@/auth/password";
import {
  beginEmailAuthFlow,
  consumeEmailAuthFlow,
  readRecoveryEmailAuthFlow,
  consumeRecoveryEmailAuthFlow,
  currentApplicationAuthPurpose,
  currentApplicationAuthContinuation,
  grantApplicationAuthSession,
  readEmailAuthFlow,
  revokeApplicationAuthSessions,
  withPasswordMutation,
  recordPasswordMethod,
  type EmailAuthPurpose,
} from "@/server/db/auth/repository";
import { serverAuthClient, createServerAuthFetch } from "./client";
import { verifiedProviderContext } from "./session";
import { acceptRecoveryProof } from "./recovery";
import { authenticationProviderFailure as failure } from "./provider-failure";
import {
  authContinuation as continuation,
  withAuthContinuation as withContinuation,
  authenticationDestination as destination,
} from "./continuation";

const FLOW_COOKIE = "movx-auth-flow";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

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

async function acceptPortableRecovery(
  command: Extract<AuthenticationCommand, { action: "confirm-email" }>,
  previous: Awaited<ReturnType<typeof verifiedProviderContext>>,
): Promise<AuthenticationResult> {
  const config = supabasePublicConfig();
  if (!config) return { status: "unavailable" };
  return acceptRecoveryProof(command, previous.session, {
    read: readRecoveryEmailAuthFlow,
    consume: consumeRecoveryEmailAuthFlow,
    async verify(tokenHash) {
      // Never replace browser cookies while inspecting an untrusted proof.
      const isolated = createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch: createServerAuthFetch(config.url) },
      });
      const proof = await isolated.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });
      if (proof.error) return failure(proof.error, "proof");
      const context = await verifiedProviderContext(isolated);
      const session = proof.data.session;
      if (
        context.session.status !== "signed-in" ||
        !context.authSessionId ||
        !session
      ) {
        await isolated.auth.signOut({ scope: "local" });
        return {
          status:
            context.session.status === "unavailable"
              ? "unavailable"
              : "invalid-proof",
        };
      }
      const subject = context.session.subject,
        email = context.session.email,
        sessionId = context.authSessionId;
      return {
        status: "verified",
        subject,
        email,
        sessionId,
        async publish() {
          const browserClient = await serverAuthClient();
          if (!browserClient) return false;
          const adopted = await browserClient.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          return (
            !adopted.error &&
            adopted.data.user?.id === subject &&
            normalizeEmail(adopted.data.user.email) === email
          );
        },
        async discard() {
          await isolated.auth.signOut({ scope: "local" });
        },
      };
    },
    grant: (proof, flow) =>
      grantApplicationAuthSession(
        proof.subject,
        proof.sessionId,
        "recovery",
        flow,
      ),
    revoke: (proof) =>
      revokeApplicationAuthSessions(proof.subject, proof.sessionId),
    async retirePrevious(proof) {
      const store = await cookies();
      if (store.get(FLOW_COOKIE)?.value.startsWith(command.flow + "."))
        store.delete(FLOW_COOKIE);
      if (
        previous.session.status === "signed-in" &&
        previous.authSessionId &&
        previous.authSessionId !== proof.sessionId
      )
        await revokeApplicationAuthSessions(
          previous.session.subject,
          previous.authSessionId,
        );
    },
  });
}

async function acceptProof(
  command: Extract<AuthenticationCommand, { action: "confirm-email" }>,
  previous: Awaited<ReturnType<typeof verifiedProviderContext>>,
): Promise<AuthenticationResult> {
  if (command.type === "recovery")
    return acceptPortableRecovery(command, previous);
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
      case "start-google":
        // Google uses a same-origin navigation POST, never the JSON credential API.
        return { status: "forbidden" };
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
