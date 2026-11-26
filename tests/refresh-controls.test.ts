import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { subscribeToVisibleReturn } from "@/browser/visible-return";
import { GoogleCalendarConnectionView } from "@/features/account/google-calendar-connection";
import { GoogleCalendarExportView } from "@/features/account/google-calendar-export";
import type { CalendarResult } from "@/calendar/connection";
import type { CalendarExportResult } from "@/calendar/export";

test("visible return reads once for a focus/visibility pair, ignores hidden tabs and unsubscribes", () => {
  const document = Object.assign(new EventTarget(), {
    visibilityState: "hidden",
  });
  const window = new EventTarget();
  let time = 0;
  let reads = 0;
  const unsubscribe = subscribeToVisibleReturn(
    document,
    window,
    () => reads++,
    () => time,
  );
  assert.equal(reads, 0);
  window.dispatchEvent(new Event("focus"));
  assert.equal(reads, 0);
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
  assert.equal(reads, 1);
  time = 1000;
  window.dispatchEvent(new Event("focus"));
  assert.equal(reads, 2);
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(reads, 3);
  unsubscribe();
  time = 3000;
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
  assert.equal(reads, 3);
});

const generation = "11111111-1111-4111-8111-111111111111";
const connection = {
  state: "connected" as const,
  generation,
  email: "coach@example.test",
  calendarId: "movx@group.calendar.google.com",
  checkedAt: null,
};
const noop = () => {};

test("Google connection offers recovery only when needed and keeps explicit provider checks", () => {
  const render = (result: CalendarResult) =>
    renderToStaticMarkup(
      createElement(GoogleCalendarConnectionView, {
        result,
        onCommand: noop,
        onReload: noop,
      }),
    );
  const healthy = render({ status: "ready", enabled: true, connection });
  assert.doesNotMatch(
    healthy,
    /Reload connection status|Check connection status/,
  );
  assert.match(healthy, /Check connection</);
  assert.match(render({ status: "unavailable" }), /Try again/);
  assert.match(
    render({
      status: "ready",
      enabled: true,
      connection: { ...connection, state: "connecting" },
    }),
    /Check connection status/,
  );
});

const readyExport: CalendarExportResult = {
  status: "ready",
  available: true,
  connectionState: "connected",
  generation,
  export: {
    enabled: true,
    version: generation,
    backfillPending: false,
    pending: 0,
    failed: 0,
    missing: 0,
    issues: [],
    lastSyncedAt: null,
  },
};

test("booking sync hides healthy reloads and retains unavailable or exact-command recovery", () => {
  const render = (result: CalendarExportResult, pending = false) =>
    renderToStaticMarkup(
      createElement(GoogleCalendarExportView, {
        result,
        pending,
        onCommand: noop,
        onReload: noop,
        onRetry: noop,
      }),
    );
  assert.doesNotMatch(render(readyExport), /Reload booking sync|Try again/);
  assert.match(render({ status: "unavailable" }), /Try again/);
  const uncertain = render({ status: "unavailable" }, true);
  assert.match(uncertain, /Retry previous sync request/);
  assert.doesNotMatch(uncertain, /Try again/);
});
