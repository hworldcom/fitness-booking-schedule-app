import "server-only";
import { randomUUID } from "node:crypto";
import {
  CALENDAR_SETTINGS_PATH,
  type CalendarCommand,
} from "@/calendar/connection";
import type {
  CalendarDatabaseResult,
  CalendarRecord,
} from "@/server/db/google-calendar/repository";
import type { CalendarConfig } from "./config";
import { digest, seal, secret, unseal } from "./crypto";
import { CalendarProviderError, type GoogleCalendarProvider } from "./provider";
import {
  authorizationProof,
  readAuthorizationProof,
  type CalendarSyncIntent,
  type CalendarSyncOutcome,
} from "./setup-intent";

export type CalendarContext = Readonly<{
  profileId: string;
  runId: string;
  subject: string;
  sessionId: string;
}>;
export type CalendarCallbackFailure = Readonly<{
  phase:
    | "context"
    | "callback-claim"
    | "code-exchange"
    | "session-check"
    | "identity"
    | "offline-access"
    | "credential-save"
    | "token-refresh"
    | "calendar-setup"
    | "booking-sync";
  reason:
    | "calendar-permission-missing"
    | "authorization"
    | "missing"
    | "unavailable"
    | "signed-out"
    | "forbidden"
    | "conflict";
}>;
export class CalendarServiceError extends Error {
  constructor(
    public readonly status:
      | "signed-out"
      | "forbidden"
      | "unavailable"
      | "conflict"
      | "delete-uncertain",
  ) {
    super("Calendar connection unavailable.");
  }
}
type Dependencies = {
  config: CalendarConfig | null;
  provider: GoogleCalendarProvider | null;
  context(): Promise<CalendarContext>;
  reportFailure?(failure: CalendarCallbackFailure): void;
  bookingSync?: {
    prepare(
      context: CalendarContext,
      generation: string,
    ): Promise<string | null>;
    enable(
      context: CalendarContext,
      generation: string,
      intent: CalendarSyncIntent,
    ): Promise<CalendarSyncOutcome>;
  };
  command(
    context: CalendarContext,
    action: string,
    generation: string | null,
    input: Record<string, unknown>,
  ): Promise<CalendarDatabaseResult>;
  cookie: {
    read(): Promise<string | null>;
    write(value: string | null): Promise<void>;
  };
};
export function calendarConnectionService(deps: Dependencies) {
  const config = deps.config,
    provider = deps.provider;
  const notice = (message: string) =>
    `${CALENDAR_SETTINGS_PATH}&calendar=${message}`;
  const aad = (ctx: CalendarContext, purpose: string) =>
    `movx-calendar:v1:${ctx.runId}:${ctx.profileId}:${purpose}`;
  async function command(
    ctx: CalendarContext,
    action: string,
    generation: string | null,
    input: Record<string, unknown> = {},
  ) {
    const r = await deps.command(ctx, action, generation, input);
    if (r.kind !== "ok")
      throw new CalendarServiceError(
        r.kind === "conflict" ? "conflict" : "unavailable",
      );
    return r;
  }
  async function finish(
    ctx: CalendarContext,
    record: CalendarRecord,
    state: string,
    verified = false,
  ) {
    await command(ctx, "finish", record.generation, {
      operationId: record.operation_id,
      state,
      verified,
    });
  }
  async function provision(
    ctx: CalendarContext,
    record: CalendarRecord,
    accessToken: string,
    options: { recoverId?: string; replace?: boolean } = {},
  ) {
    if (!provider) throw new CalendarServiceError("unavailable");
    const claimed = await deps.command(ctx, "bootstrap", record.generation, {
      operationId: record.operation_id,
      ...options,
    });
    if (claimed.kind === "recovery-required") {
      await finish(ctx, record, "recovery-required");
      return "recovery-required";
    }
    if (claimed.kind !== "ok") throw new CalendarServiceError("conflict");
    try {
      let id: string;
      if (claimed.mode === "create")
        id = await provider.createCalendar(accessToken);
      else
        id = await provider.calendar(
          accessToken,
          options.recoverId ?? claimed.calendarId ?? "",
          async () => {
            await command(ctx, "heartbeat", record.generation, {
              operationId: record.operation_id,
            });
          },
        );
      if (claimed.mode === "create" || claimed.mode === "recover") {
        await command(ctx, "record-calendar", record.generation, {
          operationId: record.operation_id,
          calendarId: id,
          sub: record.google_sub,
          clientHash: record.client_hash,
        });
      }
      await finish(ctx, record, "connected", true);
      return "connected";
    } catch (error) {
      // Creation was marked uncertain BEFORE the request. Never auto-retry it.
      if (
        claimed.mode !== "create" &&
        error instanceof CalendarProviderError &&
        error.kind === "unavailable"
      ) {
        await finish(
          ctx,
          record,
          record.previous_state === "connected"
            ? "connected"
            : "recovery-required",
        );
        throw new CalendarServiceError("unavailable");
      }
      const state =
        error instanceof CalendarProviderError && error.kind === "authorization"
          ? "reconnect-required"
          : "recovery-required";
      await finish(ctx, record, state);
      return state;
    }
  }
  return {
    async start(generation: string, syncBookings = false) {
      if (!config || !provider) return notice("unavailable");
      try {
        const ctx = await deps.context();
        const version = syncBookings
          ? await deps.bookingSync?.prepare(ctx, generation)
          : undefined;
        if (syncBookings && !version) return notice("sync-unavailable");
        const sync = version ? { version, commandId: randomUUID() } : undefined;
        const state = secret(),
          browser = secret(),
          verifier = secret();
        await command(ctx, "begin", generation, {
          stateHash: digest(state),
          browserHash: digest(browser),
          sessionId: ctx.sessionId,
          verifier: seal(
            authorizationProof(verifier, sync),
            aad(ctx, "pkce"),
            config.keys,
          ),
        });
        await deps.cookie.write(browser);
        return provider.authorize(state, verifier);
      } catch {
        return notice("unavailable");
      }
    },
    async callback(params: URLSearchParams) {
      const browser = await deps.cookie.read();
      await deps.cookie.write(null);
      if (
        !config ||
        !provider ||
        !browser ||
        !/^[\w-]{43}$/.test(browser) ||
        [...params.keys()].some((k) => params.getAll(k).length !== 1) ||
        !/^[\w-]{43}$/.test(params.get("state") ?? "")
      )
        return notice("unavailable");
      let ctx: CalendarContext | undefined, record: CalendarRecord | undefined;
      let credentialChanged = false;
      let phase: CalendarCallbackFailure["phase"] = "context";
      try {
        ctx = await deps.context();
        phase = "callback-claim";
        const result = await command(ctx, "claim-callback", null, {
          stateHash: digest(params.get("state")!),
          browserHash: digest(browser),
          sessionId: ctx.sessionId,
          operationId: randomUUID(),
        });
        record = result.record;
        if (!record || !result.verifier)
          throw new CalendarServiceError("unavailable");
        if (params.has("error")) {
          await finish(ctx, record, record.previous_state);
          return notice("denied");
        }
        const code = params.get("code");
        if (!code || code.length > 4096)
          throw new CalendarServiceError("unavailable");
        phase = "code-exchange";
        const proof = readAuthorizationProof(
          unseal(result.verifier, aad(ctx, "pkce"), config.keys),
        );
        const tokens = await provider.exchange(code, proof.verifier);
        phase = "session-check";
        await command(ctx, "heartbeat", record.generation, {
          operationId: record.operation_id,
        });
        phase = "identity";
        const identity = await provider.identity(tokens.accessToken);
        if (
          record.previous_state !== "disconnected" &&
          record.google_sub &&
          record.google_sub !== identity.sub
        ) {
          await finish(ctx, record, record.previous_state);
          return notice("account-mismatch");
        }
        phase = "offline-access";
        let refreshToken = tokens.refreshToken;
        if (
          !refreshToken &&
          record.google_sub === identity.sub &&
          record.client_hash === config.clientHash &&
          record.credential_ciphertext
        ) {
          refreshToken = unseal(
            record.credential_ciphertext,
            aad(ctx, "refresh"),
            config.keys,
          );
        }
        if (!refreshToken) throw new CalendarServiceError("unavailable");
        phase = "credential-save";
        const saved = await command(ctx, "credentials", record.generation, {
          operationId: record.operation_id,
          sub: identity.sub,
          email: identity.email,
          clientHash: config.clientHash,
          credential: seal(refreshToken, aad(ctx, "refresh"), config.keys),
        });
        if (!saved.record) throw new CalendarServiceError("unavailable");
        record = saved.record;
        credentialChanged = true;
        // Prove refresh credentials work before claiming Connected.
        phase = "token-refresh";
        const refreshed = await provider.refresh(refreshToken);
        if (refreshed.refreshToken) {
          phase = "credential-save";
          await command(ctx, "credentials", record.generation, {
            operationId: record.operation_id,
            sub: identity.sub,
            email: identity.email,
            clientHash: config.clientHash,
            credential: seal(
              refreshed.refreshToken,
              aad(ctx, "refresh"),
              config.keys,
            ),
          });
        }
        phase = "calendar-setup";
        const state = await provision(ctx, record, refreshed.accessToken);
        if (state !== "connected" || !proof.sync) return notice(state);
        phase = "booking-sync";
        try {
          const outcome = await deps.bookingSync?.enable(
            ctx,
            record.generation,
            proof.sync,
          );
          return notice(
            outcome === "enabled"
              ? "connected-sync-enabled"
              : outcome === "changed"
                ? "sync-settings-changed"
                : "sync-setup-incomplete",
          );
        } catch (error) {
          if (
            error instanceof CalendarServiceError &&
            (error.status === "signed-out" || error.status === "forbidden")
          )
            throw error;
          // The connection is ready. An uncertain opt-in is read back by the
          // existing controls; never undo readiness or blindly retry it here.
          try {
            deps.reportFailure?.({ phase, reason: "unavailable" });
          } catch {
            /* Diagnostic failures cannot change setup authority or outcome. */
          }
          return notice("sync-setup-incomplete");
        }
      } catch (error) {
        if (ctx && record) {
          try {
            await finish(
              ctx,
              record,
              credentialChanged ? "reconnect-required" : record.previous_state,
            );
          } catch {
            /* A newer generation owns the result. */
          }
        }
        try {
          deps.reportFailure?.({
            phase,
            reason:
              error instanceof CalendarProviderError
                ? (error.reason ?? error.kind)
                : error instanceof CalendarServiceError
                  ? error.status === "delete-uncertain"
                    ? "unavailable"
                    : error.status
                  : "unavailable",
          });
        } catch {
          /* Diagnostics cannot block callback cleanup or safe recovery. */
        }
        return notice(
          error instanceof CalendarProviderError &&
            error.reason === "calendar-permission-missing"
            ? "permission-required"
            : "unavailable",
        );
      }
    },
    async run(input: CalendarCommand) {
      const ctx = await deps.context();
      if (input.action === "disconnect") {
        await command(ctx, "disconnect", input.generation);
        await deps.cookie.write(null);
        return;
      }
      if (!config || !provider) throw new CalendarServiceError("unavailable");
      if (input.action === "delete") {
        const claimed = await command(ctx, "delete-claim", input.generation, {
          operationId: input.commandId,
          clientHash: config.clientHash,
        });
        const record = claimed.record;
        if (!record) throw new CalendarServiceError("unavailable");
        try {
          if (
            record.client_hash !== config.clientHash ||
            !record.credential_ciphertext ||
            !claimed.calendarId
          )
            throw new CalendarServiceError("unavailable");
          const refreshToken = unseal(
            record.credential_ciphertext,
            aad(ctx, "refresh"),
            config.keys,
          );
          const tokens = await provider.refresh(refreshToken);
          // Check access only to the pinned app-created target. Never rename a
          // calendar as a side effect of preparing its deletion.
          await provider.calendar(
            tokens.accessToken,
            claimed.calendarId,
            async () => {
              await command(ctx, "heartbeat", record.generation, {
                operationId: record.operation_id,
              });
            },
            false,
          );
          await command(ctx, "delete-dispatch", record.generation, {
            operationId: record.operation_id,
          });
          await provider.deleteCalendar(tokens.accessToken, claimed.calendarId);
          await command(ctx, "delete-confirm", record.generation, {
            operationId: record.operation_id,
          });
          await deps.cookie.write(null);
          return;
        } catch {
          try {
            await command(ctx, "delete-fail", record.generation, {
              operationId: record.operation_id,
            });
          } catch {
            /* Keep the durable target retired; never change a newer connection. */
          }
          throw new CalendarServiceError("delete-uncertain");
        }
      }
      const claimed = await command(ctx, "claim-check", input.generation, {
        operationId: input.commandId ?? randomUUID(),
      });
      const record = claimed.record;
      if (!record) throw new CalendarServiceError("unavailable");
      try {
        if (
          record.client_hash !== config.clientHash ||
          !record.credential_ciphertext
        ) {
          await finish(ctx, record, "reconnect-required");
          return;
        }
        const refreshToken = unseal(
          record.credential_ciphertext,
          aad(ctx, "refresh"),
          config.keys,
        );
        const tokens = await provider.refresh(refreshToken);
        await command(ctx, "credentials", record.generation, {
          operationId: record.operation_id,
          sub: record.google_sub,
          email: record.google_email,
          clientHash: config.clientHash,
          credential: seal(
            tokens.refreshToken ?? refreshToken,
            aad(ctx, "refresh"),
            config.keys,
          ),
        });
        await provision(
          ctx,
          record,
          tokens.accessToken,
          input.action === "recover"
            ? { recoverId: input.calendarId }
            : input.action === "replace"
              ? { replace: true }
              : {},
        );
      } catch (error) {
        try {
          await finish(
            ctx,
            record,
            error instanceof CalendarProviderError &&
              error.kind === "unavailable"
              ? record.previous_state
              : "reconnect-required",
          );
        } catch {
          /* Preserve a newer generation. */
        }
        if (error instanceof CalendarServiceError) throw error;
        if (
          error instanceof CalendarProviderError &&
          error.kind === "unavailable"
        )
          throw new CalendarServiceError("unavailable");
        if (!(error instanceof CalendarProviderError))
          throw new CalendarServiceError("unavailable");
      }
    },
  };
}
