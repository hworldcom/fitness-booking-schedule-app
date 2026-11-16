"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GoogleCalendarExport } from "./google-calendar-export";
import Link from "next/link";
import {
  calendarId,
  isCalendarResult,
  type CalendarCommand,
  type CalendarConnection,
  type CalendarResult,
} from "@/calendar/connection";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";

async function requestCalendar(
  input?: CalendarCommand,
  signal?: AbortSignal,
): Promise<CalendarResult> {
  try {
    const response = await fetch("/api/account/google-calendar", {
      method: input ? "POST" : "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: input ? { "content-type": "application/json" } : {},
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
        : AbortSignal.timeout(45000),
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
    const value: unknown = await response.json();
    return isCalendarResult(value) && (response.ok || value.status !== "ready")
      ? value
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
export function GoogleCalendarConnection({ notice }: { notice?: string } = {}) {
  const { actor } = useActor(),
    { session } = useAuthSession();
  if (actor.status !== "authorized" || session.status !== "signed-in")
    return (
      <p role="status">Verify your account to manage calendar connections.</p>
    );
  return (
    <CalendarConnectionControls
      key={`${session.subject}:${actor.demoRun.slug}:${actor.profile.slug}`}
      notice={notice}
    />
  );
}
function CalendarConnectionControls({ notice }: { notice?: string }) {
  const [result, setResult] = useState<CalendarResult | null>(null),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [actionNotice, setActionNotice] = useState<string | undefined>();
  const [syncAvailable, setSyncAvailable] = useState<boolean | null>(null);
  const lock = useRef(false),
    alive = useRef(true),
    mutation = useRef<AbortController | null>(null);
  const reloadConnection = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void requestCalendar(undefined, controller.signal).then((value) => {
      if (!controller.signal.aborted) setResult(value);
    });
    return () => {
      alive.current = false;
      controller.abort();
      mutation.current?.abort();
    };
  }, [reload]);
  async function run(input: CalendarCommand) {
    if (lock.current) return;
    lock.current = true;
    setActionNotice(undefined);
    setBusy(true);
    const controller = new AbortController();
    mutation.current = controller;
    const value = await requestCalendar(input, controller.signal);
    if (alive.current && !controller.signal.aborted) {
      setResult(value);
      if (
        input.action === "delete" &&
        value.status === "ready" &&
        value.connection.state === "disconnected"
      )
        setActionNotice("deleted");
      setBusy(false);
    }
    lock.current = false;
  }
  return (
    <GoogleCalendarConnectionView
      key={reload}
      result={result}
      notice={actionNotice ?? notice}
      busy={busy}
      syncAvailable={syncAvailable}
      onCommand={(input) => void run(input)}
      onReload={() => {
        setResult(null);
        setSyncAvailable(null);
        setReload((n) => n + 1);
      }}
      bookingSync={
        <GoogleCalendarExport
          connection={result}
          onConnectionChanged={reloadConnection}
          onAvailabilityChanged={setSyncAvailable}
        />
      }
    />
  );
}
const callbackNotices = {
  deleted: "Google calendar deleted. MovX is disconnected.",
  connected: "Google Calendar connected.",
  "connected-sync-enabled":
    "Google Calendar connected. Booking sync is on. Upcoming confirmed bookings will be added automatically.",
  "sync-unavailable":
    "Booking sync is unavailable right now. Reload its status before trying Connect & sync again.",
  "sync-settings-changed":
    "Your calendar or booking sync settings changed during setup. Your latest settings were kept. Review the status below.",
  "sync-setup-incomplete":
    "Booking sync setup could not be confirmed. Reload the connection and sync status before trying again.",
  denied:
    "Calendar permission was not granted. Any existing connection remains unchanged.",
  "permission-required":
    "Google Calendar permission was not granted. To connect, allow MovX to create and manage calendars created by MovX on Google’s permission screen. Your previous connection settings are unchanged.",
  unavailable:
    "The connection attempt could not be verified. Reload the connection status before trying again.",
  "account-mismatch":
    "Your existing calendar connection was not changed. To switch accounts, disconnect first, then connect again.",
  "reconnect-required":
    "Google authorization needs to be renewed. Reconnect your calendar.",
  "recovery-required":
    "Check Google Calendar and recover the existing MovX calendar or confirm a replacement below.",
};
const stateLabel = {
  disconnected: "Not connected",
  connecting: "Connection in progress",
  connected: "Connected",
  "reconnect-required": "Reconnect required",
  "recovery-required": "Calendar recovery required",
};
export function GoogleCalendarConnectionView({
  result,
  busy = false,
  onCommand,
  onReload,
  notice,
  bookingSync,
  syncAvailable = false,
}: {
  result: CalendarResult | null;
  busy?: boolean;
  onCommand(input: CalendarCommand): void;
  onReload(): void;
  notice?: string;
  bookingSync?: ReactNode;
  syncAvailable?: boolean | null;
}) {
  const [replacement, setReplacement] = useState(false),
    [id, setId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const accountWarning = useRef<HTMLDivElement>(null);
  const accountWarningId = useId();
  useEffect(() => {
    if (notice === "account-mismatch") {
      accountWarning.current?.scrollIntoView({ block: "center" });
      accountWarning.current?.focus({ preventScroll: true });
    }
  }, [notice]);
  const connection = result?.status === "ready" ? result.connection : null;
  return (
    <div className="calendar-connection">
      <h3>Google Calendar</h3>
      {notice === "account-mismatch" ? (
        <div
          className="auth-notice warning"
          role="alert"
          aria-labelledby={accountWarningId}
          tabIndex={-1}
          ref={accountWarning}
        >
          <strong id={accountWarningId}>
            Different Google account selected
          </strong>
          <p>{callbackNotices["account-mismatch"]}</p>
        </div>
      ) : notice && Object.hasOwn(callbackNotices, notice) ? (
        <p role="status">
          {callbackNotices[notice as keyof typeof callbackNotices]}
        </p>
      ) : null}
      <p>
        Connect your Google account to create a separate MovX calendar. Your
        connection stays available after you sign out.
      </p>
      <p>
        <Link href="/privacy#privacy-google-calendar">
          How MovX uses Google Calendar data
        </Link>
      </p>
      <div role="status" aria-live="polite">
        {busy
          ? "Updating your calendar connection…"
          : !result
            ? "Loading calendar connection…"
            : connection
              ? stateLabel[connection.state]
              : "We couldn’t verify your calendar connection. Reload its status before trying again."}
      </div>
      {result?.status === "delete-uncertain" && (
        <p role="alert">
          Google calendar deletion could not be confirmed. Reload the connection
          status and check Google Calendar before trying again.
        </p>
      )}
      {!connection ? (
        result && (
          <button type="button" className="button light" onClick={onReload}>
            Reload connection status
          </button>
        )
      ) : (
        <>
          {connection.email && (
            <p className="calendar-connection-email">
              Google account: {connection.email}
            </p>
          )}
          {connection.state === "disconnected" && connection.calendarId && (
            <p>
              To delete the retained Google calendar through MovX, reconnect its
              Google account first.
            </p>
          )}
          {connection.state === "connected" && (
            <p>Calendar: MovX. Your Google appointments stay unchanged.</p>
          )}
          {connection.checkedAt && (
            <p>
              Last checked:{" "}
              {new Date(connection.checkedAt).toLocaleString("en-GB", {
                timeZone: "Europe/Berlin",
              })}{" "}
              (Europe/Berlin)
            </p>
          )}
          {result?.status === "ready" && !result.enabled && (
            <p>
              Google Calendar connection is unavailable right now. You can still
              disconnect an existing connection.
            </p>
          )}
          <fieldset disabled={busy} className="calendar-connection-controls">
            <legend className="sr-only">
              Manage Google Calendar connection
            </legend>
            {result?.status === "ready" &&
              result.enabled &&
              connection.state !== "connecting" && (
                <form
                  method="post"
                  action="/auth/google-calendar/start"
                  onSubmit={() =>
                    setMessage("Opening Google to request your permission…")
                  }
                >
                  <p>
                    {connection.state === "disconnected" && syncAvailable
                      ? "Connect and automatically sync your upcoming confirmed bookings and future changes. "
                      : ""}
                    On Google’s permission screen, allow access to calendars
                    created by MovX to complete the connection.
                  </p>
                  <input
                    type="hidden"
                    name="generation"
                    value={connection.generation}
                  />
                  {connection.state === "disconnected" && syncAvailable && (
                    <input type="hidden" name="intent" value="sync" />
                  )}
                  <button
                    className="button dark"
                    type="submit"
                    disabled={
                      connection.state === "disconnected" &&
                      syncAvailable === null
                    }
                  >
                    {connection.state === "disconnected"
                      ? syncAvailable !== false
                        ? "Connect & sync Google Calendar"
                        : "Connect Google Calendar"
                      : "Reconnect Google Calendar"}
                  </button>
                  {connection.state === "disconnected" &&
                    syncAvailable === false && (
                      <p>
                        Connecting alone keeps booking sync off. Reload booking
                        sync below when delivery is available.
                      </p>
                    )}
                </form>
              )}
            {connection.state === "connecting" && (
              <p>
                A connection attempt is in progress. Complete the Google prompt,
                reload the status, or disconnect to cancel it.
              </p>
            )}
            <div className="calendar-connection-actions">
              <button type="button" className="button light" onClick={onReload}>
                Reload connection status
              </button>
              {result?.status === "ready" &&
                result.enabled &&
                connection.state !== "disconnected" &&
                connection.state !== "connecting" && (
                  <button
                    type="button"
                    className="button light"
                    onClick={() =>
                      onCommand({
                        action: "check",
                        generation: connection.generation,
                      })
                    }
                  >
                    Check connection
                  </button>
                )}
            </div>
            {connection.state === "recovery-required" &&
              result?.status === "ready" &&
              result.enabled && (
                <div className="calendar-connection-recovery">
                  <p>
                    An earlier attempt may have created a MovX calendar, or the
                    saved calendar is no longer accessible. Check{" "}
                    <a
                      href="https://calendar.google.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google Calendar
                    </a>{" "}
                    before continuing. Existing calendars are never deleted by
                    this recovery. A calendar that may still be deleted cannot
                    be recovered here. After a failed deletion, reconnect first,
                    then recover a different existing calendar or explicitly
                    create a replacement.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!calendarId(id.trim())) {
                        setMessage(
                          "Enter the existing MovX calendar’s Calendar ID.",
                        );
                        return;
                      }
                      onCommand({
                        action: "recover",
                        generation: connection.generation,
                        calendarId: id.trim(),
                      });
                    }}
                  >
                    <label>
                      Existing MovX calendar ID
                      <input
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        maxLength={1024}
                        required
                        autoComplete="off"
                      />
                    </label>
                    <p>
                      Find Calendar ID under that calendar’s Google settings →
                      Integrate calendar.
                    </p>
                    <button className="button light" type="submit">
                      Recover existing calendar
                    </button>
                  </form>
                  <label className="calendar-connection-confirm">
                    <input
                      type="checkbox"
                      checked={replacement}
                      onChange={(e) => setReplacement(e.target.checked)}
                    />
                    I checked Google Calendar and want to create a replacement.
                    An earlier calendar may remain.
                  </label>
                  <button
                    className="button light"
                    type="button"
                    disabled={!replacement}
                    onClick={() => {
                      setReplacement(false);
                      onCommand({
                        action: "replace",
                        generation: connection.generation,
                        commandId: crypto.randomUUID(),
                      });
                    }}
                  >
                    Create replacement calendar
                  </button>
                </div>
              )}
          </fieldset>
        </>
      )}
      {message && <p role="status">{message}</p>}
      <p>
        To use a different Google account, disconnect first and then connect
        again. Existing calendars remain with their Google owner.
      </p>
      {bookingSync}
      {connection && connection.state !== "disconnected" && (
        <DisconnectCalendar
          key={`${connection.generation}:${connection.calendarId}:${connection.state}:${result?.status === "ready" && result.enabled}`}
          connection={connection}
          busy={busy}
          deleteAvailable={
            result?.status === "ready" &&
            result.enabled &&
            !!connection.calendarId &&
            connection.state !== "connecting"
          }
          onCommand={(input) => {
            setMessage(null);
            onCommand(input);
          }}
        />
      )}
    </div>
  );
}

function DisconnectCalendar({
  connection,
  busy,
  deleteAvailable,
  onCommand,
}: {
  connection: CalendarConnection;
  busy: boolean;
  deleteAvailable: boolean;
  onCommand(input: CalendarCommand): void;
}) {
  const [choice, setChoice] = useState<"keep" | "delete">("keep");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const id = useId();
  const deleting = deleteAvailable && choice === "delete";
  return (
    <details className="calendar-disconnect">
      <summary>Disconnect calendar</summary>
      <fieldset disabled={busy} className="calendar-connection-controls">
        <legend className="sr-only">Disconnect options</legend>
        <div className="calendar-disconnect-options">
          <label className="calendar-disconnect-option">
            <input
              type="radio"
              name={id}
              checked={!deleting}
              aria-labelledby={`${id}-keep-title`}
              aria-describedby={`${id}-keep-description`}
              onChange={() => {
                setChoice("keep");
                setDeleteConfirmed(false);
              }}
            />
            <span>
              <strong id={`${id}-keep-title`}>Just disconnect</strong>
              <span id={`${id}-keep-description`}>
                Keep your MovX calendar and existing events in Google. They stop
                receiving booking updates.
              </span>
            </span>
          </label>
          <label className="calendar-disconnect-option">
            <input
              type="radio"
              name={id}
              checked={deleting}
              disabled={!deleteAvailable}
              aria-labelledby={`${id}-delete-title`}
              aria-describedby={`${id}-delete-description`}
              onChange={() => {
                setChoice("delete");
                setDeleteConfirmed(false);
              }}
            />
            <span>
              <strong id={`${id}-delete-title`}>
                Disconnect and delete calendar
              </strong>
              <span id={`${id}-delete-description`}>
                Permanently delete this MovX calendar and every event inside it.
                {!deleteAvailable &&
                  " Calendar deletion is currently unavailable."}
              </span>
            </span>
          </label>
        </div>
        <p>
          Disconnecting removes MovX’s saved Calendar access and turns booking
          sync off. Your MovX bookings and sign-in remain. A request already
          sent to Google may finish.
        </p>
        {deleting ? (
          <>
            <p>
              This permanently deletes this account’s dedicated Google calendar
              for this MovX environment and every event inside it, including
              events you added yourself. Other calendars and your MovX bookings
              remain. This cannot be undone.
            </p>
            <label className="calendar-connection-confirm">
              <input
                type="checkbox"
                checked={deleteConfirmed}
                onChange={(event) => setDeleteConfirmed(event.target.checked)}
              />
              I want to permanently delete this MovX calendar and all its
              events.
            </label>
            <button
              type="button"
              className="button calendar-disconnect-delete"
              disabled={!deleteConfirmed}
              onClick={() => {
                if (!deleteConfirmed) return;
                setDeleteConfirmed(false);
                onCommand({
                  action: "delete",
                  generation: connection.generation,
                  commandId: crypto.randomUUID(),
                });
              }}
            >
              Confirm disconnect and delete calendar
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button light"
            onClick={() =>
              onCommand({
                action: "disconnect",
                generation: connection.generation,
              })
            }
          >
            Confirm disconnect
          </button>
        )}
        <p>
          You can also remove permissions in your Google account’s third-party
          connections. Google may remove other permissions granted to MovX
          there.
        </p>
      </fieldset>
    </details>
  );
}
