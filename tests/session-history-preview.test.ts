import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  historyPreviewBookings,
  historyPreviewStatus,
  historyPreviewView,
  historyPreviewHref,
} from "@/features/profile/session-history-preview-model";
import { SessionHistoryPreviewContent } from "@/features/profile/session-history-preview";
import {
  historyBookings,
  historyReferenceTime,
  historyRequest,
} from "./fixtures/session-history-data";

test("preview sections only admit finite local destinations", () => {
  for (const input of [
    undefined,
    "past",
    "",
    "https://example.org",
    ["past", "requests"],
    "__proto__",
  ])
    assert.equal(
      historyPreviewHref(historyPreviewView(input)),
      "/sessions/preview?view=past",
    );
  assert.equal(historyPreviewView("requests"), "requests");
  assert.equal(historyPreviewView("upcoming"), "upcoming");
});

test("previous history remains newest-first, future cancellations retained and completion never inferred", () => {
  const groups = historyPreviewBookings(historyBookings, historyReferenceTime);
  assert.deepEqual(
    groups.upcoming.map((x) => x.title),
    ["Practice 5", "Practice 3"],
  );
  assert.deepEqual(
    groups.past.map((x) => x.title),
    ["Practice 4", "Practice 1", "Practice 2"],
  );
  assert.equal(historyPreviewStatus(historyBookings[2]), "Confirmed");
  assert.equal(historyPreviewStatus(historyBookings[0]), "Completed");
  assert.equal(historyPreviewStatus(historyBookings[3]), "Cancelled by coach");
});

const render = (
  view: "past" | "upcoming" | "requests",
  bookings = historyBookings,
  next = false,
) =>
  renderToStaticMarkup(
    createElement(SessionHistoryPreviewContent, {
      view,
      bookings,
      referenceTime: historyReferenceTime,
      requests: {
        items: [historyRequest],
        nextCursor: next
          ? { id: historyRequest.id, createdAt: historyRequest.createdAt }
          : null,
      },
    }),
  );

test("past cards prominently open the original session with a safe section return and exclude request noise", () => {
  const html = render("past");
  assert.match(html, /Session &amp; notes/);
  assert.ok(
    html.includes(`/sessions/preview/${historyBookings[2].id}?view=past`),
  );
  assert.doesNotMatch(
    html,
    /Request-only Coach|Practice 3|Practice 5|actor-scoped|[0-9]+ notes/,
  );
  assert.match(html, /previous and cancelled sessions/);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
});

test("upcoming and requests remain separate and paged requests never claim a complete total", () => {
  assert.doesNotMatch(render("upcoming"), /Practice 1|Request-only Coach/);
  const html = render("requests", historyBookings, true);
  assert.match(html, /Request-only Coach/);
  assert.doesNotMatch(html, /Practice 1|Session &amp; notes/);
  assert.match(html, /Showing the 1 most recent requests/);
  assert.match(html, /Open all request history/);
});

test("empty history and legacy sessions remain truthful without inventing note records", () => {
  assert.match(render("past", []), /Your training story starts here/);
  assert.match(render("upcoming", []), /No upcoming private sessions/);
  const legacy = [{ ...historyBookings[2], hasSessionDetails: undefined }];
  const html = render("past", legacy);
  assert.match(html, /older session has no detailed session record/);
  assert.doesNotMatch(html, /class="button dark history-preview-open"/);
});
