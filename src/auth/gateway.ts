import { normalizeEmail } from "./email";
import type { AuthSessionSnapshot } from "./contracts";
import { isSignInPassword, validateNewPassword } from "./password";
import {
  parseAuthenticationCommand,
  type AuthenticationCommand,
} from "./operations";

export type AuthenticationResult =
  | Readonly<{ status: "success"; email: string | null; next?: string }>
  | Readonly<{ status: "requested"; next?: string }>
  | Readonly<{ status: "recovery-required" | "password-updated"; next: string }>
  | Readonly<{
      status: "invalid";
      message:
        | "email"
        | "input"
        | "password-too-short"
        | "password-too-long"
        | "password-invalid"
        | "password-unsafe";
    }>
  | Readonly<{
      status:
        "invalid-credentials" | "invalid-proof" | "unavailable" | "forbidden";
    }>
  | Readonly<{ status: "rate-limited"; retryAfterSeconds: number | null }>;

export type AuthenticationEvent = "signed-out" | "session-changed";

/** The adapter translates all vendor responses before crossing this boundary. */
export interface AuthenticationAdapter {
  execute(command: AuthenticationCommand): Promise<AuthenticationResult>;
  registerWithPassword(
    email: string,
    password: string,
  ): Promise<AuthenticationResult>;
  signInWithPassword(
    email: string,
    password: string,
  ): Promise<AuthenticationResult>;
  signOut(): Promise<AuthenticationResult>;
  subscribe(listener: (event: AuthenticationEvent) => void): () => void;
}

export interface AuthenticationGateway {
  execute(command: unknown): Promise<AuthenticationResult>;
  registerWithPassword(
    email: unknown,
    password: unknown,
  ): Promise<AuthenticationResult>;
  signInWithPassword(
    email: unknown,
    password: unknown,
  ): Promise<AuthenticationResult>;
  signOut(): Promise<AuthenticationResult>;
  subscribe(listener: (event: AuthenticationEvent) => void): () => void;
}

async function available(
  work: () => Promise<AuthenticationResult>,
): Promise<AuthenticationResult> {
  try {
    return await work();
  } catch {
    // SDK/transport errors may contain private request details; never return them.
    return { status: "unavailable" };
  }
}

export function createAuthenticationGateway(
  adapter: AuthenticationAdapter,
  readVerifiedSession: () => Promise<AuthSessionSnapshot>,
): AuthenticationGateway {
  async function verifySuccess(
    result: AuthenticationResult,
    email: string,
    invalidStatus: "invalid-proof" | "invalid-credentials",
  ): Promise<AuthenticationResult> {
    if (result.status !== "success") return result;
    if (result.email !== email) {
      await adapter.signOut();
      return { status: invalidStatus };
    }
    try {
      const session = await readVerifiedSession();
      if (session.status === "signed-in" && session.email === email)
        return result;
    } catch {
      // A browser SDK success alone never establishes application identity.
    }
    await adapter.signOut();
    return { status: "unavailable" };
  }
  return {
    execute(value) {
      const command = parseAuthenticationCommand(value);
      return command
        ? available(() => adapter.execute(command))
        : Promise.resolve({ status: "invalid", message: "input" });
    },
    async registerWithPassword(value, passwordValue) {
      const email = normalizeEmail(value);
      if (!email) return { status: "invalid", message: "email" };
      const password = validateNewPassword(passwordValue);
      if (!password.valid)
        return { status: "invalid", message: password.message };
      return available(() =>
        adapter.registerWithPassword(email, password.password),
      );
    },
    async signInWithPassword(value, password) {
      const email = normalizeEmail(value);
      if (!email || !isSignInPassword(password))
        return { status: "invalid-credentials" };
      return available(async () => {
        const result = await adapter.signInWithPassword(email, password);
        return verifySuccess(result, email, "invalid-credentials");
      });
    },
    signOut: () => available(() => adapter.signOut()),
    subscribe: (listener) => adapter.subscribe(listener),
  };
}

export function authenticationResultMessage(
  result: AuthenticationResult,
): string {
  if (result.status === "invalid") {
    switch (result.message) {
      case "email":
        return "Enter a valid email address.";
      case "input":
        return "Check the details and try again.";
      case "password-too-short":
        return "Use at least 8 characters for your password.";
      case "password-too-long":
        return "This password is too long. Use no more than 72 UTF-8 bytes; some characters use more than one byte.";
      case "password-invalid":
        return "Enter a valid password.";
      case "password-unsafe":
        return "This password isn’t safe to use. Choose a different one.";
    }
  }
  if (result.status === "invalid-credentials")
    return "The email or password is incorrect. Try again.";
  if (result.status === "invalid-proof")
    return "That link is invalid or expired. Request a fresh email and try again.";
  if (result.status === "rate-limited")
    return result.retryAfterSeconds === null
      ? "Too many attempts. Please wait before trying again."
      : `Please wait ${result.retryAfterSeconds} seconds before trying again.`;
  return "Sign-in is unavailable right now. Please try again shortly.";
}
