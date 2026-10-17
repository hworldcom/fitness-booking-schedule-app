import "server-only";

import { withDatabaseConnection } from "../client";

export type EmailAuthPurpose = "confirmation" | "login" | "recovery";
export type ApplicationAuthPurpose = "ordinary" | "recovery";
export type AuthContinuation = Readonly<{
  returnTo: string;
  intent: "client" | "coach" | null;
}>;
export type EmailAuthFlow = AuthContinuation &
  Readonly<{ emailHash: string; purpose: EmailAuthPurpose }>;

export function beginEmailAuthFlow(
  idHash: string,
  bindingHash: string,
  emailHash: string,
  purpose: Exclude<EmailAuthPurpose, "login">,
  continuation: AuthContinuation,
) {
  return withDatabaseConnection(async ({ queryClient }) => {
    const [row] = await queryClient<
      {
        result:
          | { status: "ready" }
          | { status: "rate-limited"; retryAfterSeconds: number }
          | { status: "invalid" };
      }[]
    >`
      select app.begin_email_auth_flow(${idHash}, ${bindingHash}, ${emailHash}, ${purpose}, ${continuation.intent}, ${continuation.returnTo}) as result`;
    return row.result;
  });
}

export function readEmailAuthFlow(idHash: string, bindingHash: string) {
  return withDatabaseConnection(async ({ queryClient }) => {
    const [row] = await queryClient<{ result: EmailAuthFlow | null }[]>`
      select app.read_email_auth_flow(${idHash}, ${bindingHash}) as result`;
    return row.result;
  });
}

export function consumeEmailAuthFlow(idHash: string, bindingHash: string) {
  return withDatabaseConnection(async ({ queryClient }) => {
    const [row] = await queryClient<{ result: boolean }[]>`
      select app.consume_email_auth_flow(${idHash}, ${bindingHash}) as result`;
    return row.result;
  });
}

export function grantApplicationAuthSession(
  subject: string,
  sessionId: string,
  purpose: ApplicationAuthPurpose,
  continuation: AuthContinuation = { returnTo: "/sessions", intent: null },
) {
  return withDatabaseConnection(async ({ queryClient }) => {
    const [row] = await queryClient<{ result: boolean }[]>`
      select app.grant_application_auth_session(${subject}::uuid, ${sessionId}::uuid, ${purpose}, ${continuation.returnTo}, ${continuation.intent}) as result`;
    return row.result;
  });
}

export function currentApplicationAuthContinuation(
  subject: string,
  sessionId: string,
) {
  return withDatabaseConnection(async ({ queryClient }) => {
    const [row] = await queryClient<{ result: AuthContinuation | null }[]>`
      select app.current_application_auth_continuation(${subject}::uuid, ${sessionId}::uuid) as result`;
    return row.result;
  });
}

export function currentApplicationAuthPurpose(
  subject: string,
  sessionId: string,
) {
  return withDatabaseConnection(async ({ queryClient }) => {
    const [row] = await queryClient<
      { result: ApplicationAuthPurpose | null }[]
    >`
      select app.current_application_auth_purpose(${subject}::uuid, ${sessionId}::uuid) as result`;
    return row.result;
  });
}

export function revokeApplicationAuthSessions(
  subject: string,
  sessionId: string | null = null,
) {
  return withDatabaseConnection(async ({ queryClient }) => {
    await queryClient`select app.revoke_application_auth_sessions(${subject}::uuid, ${sessionId}::uuid)`;
  });
}

export function accountHasPassword(subject: string) {
  return withDatabaseConnection(async ({ queryClient }) => {
    const [row] = await queryClient<
      { result: boolean | null }[]
    >`select app.account_has_password(${subject}::uuid) as result`;
    return row.result === true;
  });
}

export function recordPasswordMethod(subject: string) {
  return withDatabaseConnection(async ({ queryClient }) => {
    await queryClient`select app.record_password_method(${subject}::uuid)`;
  });
}

export function withPasswordMutation<T>(
  subject: string,
  work: (authority: {
    purpose(sessionId: string): Promise<ApplicationAuthPurpose | null>;
    hasPassword(): Promise<boolean>;
    revokeCredentials(changedAt: string): Promise<void>;
  }) => Promise<T>,
) {
  return withDatabaseConnection(({ queryClient }) =>
    queryClient.begin(async (transaction) => {
      await transaction
        .unsafe(
          "set local statement_timeout = '15s'; set local idle_in_transaction_session_timeout = '25s'",
        )
        .simple();
      await transaction`select pg_advisory_xact_lock(hashtextextended(${"movx.auth.password." + subject},0))`;
      return work({
        async purpose(sessionId) {
          const [row] = await transaction<
            { result: ApplicationAuthPurpose | null }[]
          >`select app.current_application_auth_purpose(${subject}::uuid,${sessionId}::uuid) as result`;
          return row.result;
        },
        async hasPassword() {
          const [row] = await transaction<
            { result: boolean }[]
          >`select app.account_has_password(${subject}::uuid) as result`;
          return row.result === true;
        },
        async revokeCredentials(changedAt) {
          await transaction`select app.revoke_auth_credentials(${subject}::uuid,${changedAt}::timestamptz)`;
          await transaction`select app.record_password_method(${subject}::uuid)`;
        },
      });
    }),
  );
}
