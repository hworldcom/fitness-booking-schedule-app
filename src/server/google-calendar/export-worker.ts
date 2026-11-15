import "server-only";
import { calendarId, calendarUuid } from "@/calendar/connection";
import { type CalendarConfig } from "./config";
import { seal, unseal } from "./crypto";
import {
  googleCalendarProvider,
  CalendarProviderError,
  type GoogleCalendarProvider,
} from "./provider";
import {
  calendarEventProvider,
  CalendarEventError,
  isExportTerms,
  type CalendarEventProvider,
  type EventMetadata,
  type ExportFailure,
  type ExportTerms,
} from "./events";
import { withCalendarExportWorker } from "@/server/db/google-calendar/export-worker";
import { parseCalendarExportConfig } from "./export-config";

export type ExportClaim = Readonly<{ id: string; leaseId: string }>;
export type ExportRepository = Readonly<{
  claim(): Promise<unknown>;
  command(
    claim: ExportClaim,
    action: "prepare" | "credential" | "checkpoint" | "dispatch" | "finish",
    input?: Record<string, unknown>,
  ): Promise<unknown>;
}>;
type PreparedExport = Readonly<{
  kind: "prepared";
  runId: string;
  profileId: string;
  calendarId: string;
  eventId: string;
  marker: string;
  credential: string;
  everDelivered: boolean;
  dispatched: boolean;
  desired: ExportTerms | { action: "delete" } | { action: "retain" };
}>;
function prepared(value: unknown): PreparedExport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as PreparedExport;
  return Object.keys(p).length === 10 &&
    p.kind === "prepared" &&
    calendarUuid(p.runId) &&
    calendarUuid(p.profileId) &&
    calendarId(p.calendarId) &&
    typeof p.eventId === "string" &&
    /^[a-v0-9]{5,1024}$/.test(p.eventId) &&
    calendarUuid(p.marker) &&
    typeof p.credential === "string" &&
    p.credential.length > 0 &&
    p.credential.length <= 16000 &&
    typeof p.everDelivered === "boolean" &&
    typeof p.dispatched === "boolean" &&
    !!p.desired &&
    (isExportTerms(p.desired) ||
      (Object.keys(p.desired).length === 1 &&
        ["delete", "retain"].includes(p.desired.action)))
    ? p
    : null;
}
function kind(value: unknown) {
  return value && typeof value === "object" && "kind" in value
    ? value.kind
    : null;
}
class StaleExport extends Error {
  constructor() {
    super("Calendar delivery changed.");
  }
}
export async function dispatchCalendarExports(
  repository: ExportRepository,
  config: CalendarConfig,
  connection: Pick<GoogleCalendarProvider, "refresh" | "calendar">,
  events: CalendarEventProvider,
  now: () => number = Date.now,
) {
  const result = {
    delivered: 0,
    retained: 0,
    failed: 0,
    stale: 0,
    progress: 0,
  };
  const started = now();
  for (
    let iteration = 0;
    iteration < 10 &&
    result.delivered + result.failed + result.stale < 3 &&
    now() - started < 40000;
    iteration++
  ) {
    const raw = await repository.claim();
    if (raw === null) break;
    if (kind(raw) === "progress") {
      result.progress++;
      continue;
    }
    const claim = raw as ExportClaim & { kind?: string };
    if (
      kind(raw) !== "claimed" ||
      !calendarUuid(claim.id) ||
      !calendarUuid(claim.leaseId)
    )
      throw Error("Invalid Calendar delivery claim.");
    const finish = async (outcome: string) =>
      repository.command(claim, "finish", { result: outcome });
    async function checkpoint(
      action: "checkpoint" | "dispatch" = "checkpoint",
    ) {
      if (kind(await repository.command(claim, action)) !== "ok")
        throw new StaleExport();
    }
    try {
      const rawPrepared = await repository.command(claim, "prepare");
      if (kind(rawPrepared) === "stale") throw new StaleExport();
      const p = prepared(rawPrepared);
      if (!p) throw Error("Invalid Calendar delivery preparation.");
      if (p.desired.action === "retain") {
        if (kind(await finish("retained")) === "ok") result.retained++;
        else result.stale++;
        continue;
      }
      const aad =
        "movx-calendar:v1:" + p.runId + ":" + p.profileId + ":refresh";
      let refresh: string;
      try {
        refresh = unseal(p.credential, aad, config.keys);
      } catch {
        throw new CalendarEventError("authorization-required");
      }
      await checkpoint();
      const token = await connection.refresh(refresh);
      if (
        kind(
          await repository.command(claim, "credential", {
            credential: seal(token.refreshToken ?? refresh, aad, config.keys),
          }),
        ) !== "ok"
      )
        throw new StaleExport();
      await checkpoint();
      let metadata: EventMetadata | null;
      try {
        metadata = await events.get(token.accessToken, p.calendarId, p.eventId);
      } catch (error) {
        if (!(error instanceof CalendarEventError) || error.kind !== "missing")
          throw error;
        metadata = null;
      }
      const tombstoned = metadata?.status === "cancelled";
      if (tombstoned) metadata = null;
      if (!metadata) {
        await checkpoint();
        try {
          await connection.calendar(
            token.accessToken,
            p.calendarId,
            checkpoint,
            false,
          );
        } catch (error) {
          if (
            error instanceof CalendarProviderError &&
            error.kind === "missing"
          )
            throw new CalendarEventError("calendar-missing");
          throw error;
        }
      } else if (metadata.marker !== p.marker || metadata.hasAttendees)
        throw new CalendarEventError("ownership-conflict");
      if (p.desired.action === "delete") {
        if (!metadata) {
          if (p.dispatched && !p.everDelivered && !tombstoned)
            throw new CalendarEventError("outcome-unknown");
        } else {
          await checkpoint("dispatch");
          await events.remove(
            token.accessToken,
            p.calendarId,
            p.eventId,
            metadata.etag,
          );
        }
        if (kind(await finish("deleted")) === "ok") result.delivered++;
        else result.stale++;
      } else {
        if (!metadata && (p.everDelivered || tombstoned))
          throw new CalendarEventError("event-missing");
        await checkpoint("dispatch");
        if (metadata)
          await events.update(
            token.accessToken,
            p.calendarId,
            p.eventId,
            p.marker,
            p.desired,
            metadata.etag,
          );
        else
          await events.create(
            token.accessToken,
            p.calendarId,
            p.eventId,
            p.marker,
            p.desired,
          );
        if (kind(await finish("upserted")) === "ok") result.delivered++;
        else result.stale++;
      }
    } catch (error) {
      if (error instanceof StaleExport) {
        await finish("retained");
        result.stale++;
        continue;
      }
      const category: ExportFailure =
        error instanceof CalendarEventError
          ? error.kind === "missing"
            ? "transient"
            : error.kind
          : error instanceof CalendarProviderError &&
              error.kind === "authorization"
            ? "authorization-required"
            : "transient";
      if (kind(await finish(category)) === "ok") result.failed++;
      else result.stale++;
    }
  }
  return result;
}
export function calendarExportAvailable(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return parseCalendarExportConfig(env) !== null;
}
export async function runCalendarExportWorker(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const parsed = parseCalendarExportConfig(env);
  if (!parsed) throw Error("Calendar export is unavailable.");
  const config = parsed.calendar;
  const deadline = AbortSignal.timeout(45000);
  const transport: typeof fetch = (url, init) =>
    fetch(url, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([deadline, init.signal])
        : deadline,
    });
  return withCalendarExportWorker(
    parsed.workerUrl,
    config.clientHash,
    (repository) =>
      dispatchCalendarExports(
        repository,
        config,
        googleCalendarProvider(config, transport),
        calendarEventProvider(config.siteUrl, transport),
      ),
  );
}
