import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  parseEventFilters,
  eventPageHref,
  eventIdFromSlug,
  eventPrice,
  eventStatus,
  eventDate,
  eventIssueMessage,
  groupHistoryCursor,
  groupHistoryHref,
  parseParticipationForm,
  registrationStatus,
} from "@/features/events/event-contract";
import { EventCard, EventTerms } from "@/features/events/event-ui";
import type { GroupSession } from "@/domain/group-sessions";

const id = "10000000-0000-4000-8000-000000000001";
const after = { at: "2026-10-17T10:00:00.123456+00:00", id };
const event: GroupSession = {
  id,
  slug: "group-" + id.replaceAll("-", ""),
  title: "Footwork <script>literal</script>",
  description: "Practice together.",
  discipline: "Boxing",
  intendedLevel: "All levels",
  venue: {
    id: randomUUID(),
    name: "Training room",
    label: "Berlin",
    kind: "independent",
    latitude: 52.5,
    longitude: 13.4,
  },
  startsAt: "2026-10-17T10:00:00.000Z",
  endsAt: "2026-10-17T11:00:00.000Z",
  decisionDeadlineAt: "2026-10-17T09:00:00.000Z",
  minimumParticipants: 2,
  maximumParticipants: 8,
  participantCount: 2,
  priceCents: 1550,
  currency: "EUR",
  status: "open",
  displayStatus: "open",
  revision: 1,
  createdAt: "2026-10-16T10:00:00Z",
  updatedAt: "2026-10-16T10:00:00Z",
  publishedAt: "2026-10-16T10:00:00Z",
  confirmedAt: null,
  closedAt: null,
  coach: { name: "Test Coach", slug: "test-coach", trustKind: "demo" },
  canJoin: true,
  canConfirm: false,
  canCancel: false,
  canEdit: false,
};
test("event GET filters and page links preserve exact cursor precision, literal place text and discipline", () => {
  const filters = parseEventFilters({
    discipline: "Boxing",
    location: "  A&B / Berlin  ",
    afterAt: after.at,
    afterId: id,
  });
  assert.ok(filters);
  assert.equal(filters.location, "A&B / Berlin");
  assert.equal(filters.after?.at, after.at);
  const href = eventPageHref(filters, after);
  const parsed = Object.fromEntries(
    new URL(href, "http://localhost").searchParams,
  );
  assert.deepEqual(parseEventFilters(parsed), filters);
  assert.equal(
    new URL(eventPageHref(filters, null), "http://localhost").searchParams.has(
      "afterId",
    ),
    false,
  );
  assert.deepEqual(parseEventFilters({}), {
    discipline: null,
    location: "",
    after: null,
  });
});
test("ambiguous, forged and oversized event filters do not silently change the search", () => {
  for (const query of [
    { discipline: ["Boxing", "Judo"] },
    { discipline: "unknown" },
    { location: "x".repeat(161) },
    { runId: id },
    { afterAt: after.at },
    { afterId: id },
    { afterAt: "invalid", afterId: id },
    { afterAt: after.at, afterId: "bad" },
  ])
    assert.equal(parseEventFilters(query), null);
  assert.equal(groupHistoryCursor({ afterId: id }), false);
  assert.equal(groupHistoryCursor({ actor: id }), false);
  assert.deepEqual(
    groupHistoryCursor(
      Object.fromEntries(
        new URL(groupHistoryHref(after), "http://localhost").searchParams,
      ),
    ),
    after,
  );
});
test("event slugs cannot become arbitrary private identifiers or nested return destinations", () => {
  assert.equal(eventIdFromSlug(event.slug), id);
  for (const slug of [
    "../coach",
    event.slug + "/other",
    "group-" + "0".repeat(32),
    id,
  ])
    assert.equal(eventIdFromSlug(slug), null);
});
test("only explicit coach confirmation gets confirmed copy; price is per-person EUR with no payment claim", () => {
  assert.equal(eventStatus(event), "Waiting for coach confirmation");
  assert.equal(
    eventStatus({ displayStatus: "confirmed" }),
    "Confirmed by coach",
  );
  assert.equal(eventStatus({ displayStatus: "ended" }), "Ended");
  assert.equal(eventPrice(0), "Free");
  assert.equal(eventPrice(1550), "€15.50 per person");
  assert.match(eventDate("2026-01-17T09:00:00Z"), /10:00/);
  assert.equal(
    registrationStatus({
      id,
      status: "withdrawn",
      createdAt: after.at,
      resolvedAt: after.at,
      canWithdraw: false,
    }),
    "You withdrew",
  );
});
test("participant forms bind one exact account and attempt, reject duplicate fields and owner actions", () => {
  const form = new FormData();
  form.set("intent", "join");
  form.set("sessionId", id);
  form.set("registrationId", randomUUID());
  form.set("actorScope", [id, randomUUID(), randomUUID()].join(":"));
  assert.equal(parseParticipationForm(form)?.command.action, "join");
  form.set("intent", "withdraw");
  assert.equal(parseParticipationForm(form)?.command.args.id, id);
  form.append("intent", "join");
  assert.equal(parseParticipationForm(form), null);
  form.set("intent", "publish");
  assert.equal(parseParticipationForm(form), null);
  form.set("intent", "join");
  form.set("actorScope", "different-user");
  assert.equal(parseParticipationForm(form), null);
});
test("public event presentation escapes titles and exposes aggregate capacity without participant metadata", () => {
  const html = renderToStaticMarkup(
    createElement(EventCard, {
      session: {
        ...event,
        secretRoster: [
          { email: "private@example.test", id: "secret-registration" },
        ],
      } as GroupSession,
    }),
  );
  assert.ok(html.includes("&lt;script&gt;literal&lt;/script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("2 / 8 seats reserved"));
  assert.ok(html.includes("Pay at session"));
  assert.ok(!html.includes("private@example.test"));
  assert.ok(!html.includes("secret-registration"));
  const terms = renderToStaticMarkup(
    createElement(EventTerms, { session: event }),
  );
  assert.ok(terms.includes("Europe/Berlin"));
  assert.ok(terms.includes("Minimum 2 participants"));
  assert.ok(!terms.includes("paid successfully"));
});

test("registration issue URLs cannot invent success or reflect arbitrary text", () => {
  for (const issue of [
    "joined",
    "withdrawn",
    "<script>reserved</script>",
    ["conflict"],
    null,
  ])
    assert.equal(eventIssueMessage(issue), null);
  assert.match(
    eventIssueMessage("unavailable")!,
    /could not verify the outcome/,
  );
  assert.match(eventIssueMessage("actor-changed")!, /changed no registration/);
});
