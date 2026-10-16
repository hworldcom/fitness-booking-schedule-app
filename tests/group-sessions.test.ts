import assert from "node:assert/strict";
import test from "node:test";
import {
  parseGroupSessionCommand,
  parseGroupSessionResult,
  parsePublicGroupQuery,
} from "@/domain/group-sessions";

const id = "9a237000-0000-4000-8000-000000000001";
const locationId = "9a237000-0000-4000-8000-000000000002";
const draft = {
  id,
  expectedRevision: null,
  title: "Group boxing",
  description: "Practise boxing footwork together.",
  discipline: "Boxing",
  intendedLevel: "All levels",
  locationId,
  startsAt: "2030-04-12T16:00:00Z",
  endsAt: "2030-04-12T17:30:00Z",
  decisionDeadlineAt: "2030-04-11T16:00:00Z",
  minimumParticipants: 2,
  maximumParticipants: 6,
  priceCents: 1500,
};
const session = {
  id,
  slug: "group-" + id.replaceAll("-", ""),
  title: "Group boxing",
  description: "Practise together",
  discipline: "Boxing",
  intendedLevel: "All levels",
  venue: {
    id: locationId,
    name: "Example gym",
    label: "Berlin, Example Street",
    kind: "gym",
    latitude: 52.5,
    longitude: 13.4,
  },
  startsAt: "2030-04-12T16:00:00+00:00",
  endsAt: "2030-04-12T17:30:00+00:00",
  decisionDeadlineAt: "2030-04-11T16:00:00+00:00",
  minimumParticipants: 2,
  maximumParticipants: 6,
  priceCents: 1500,
  currency: "EUR",
  status: "open",
  displayStatus: "open",
  revision: 1,
  createdAt: "2030-04-01T10:00:00+00:00",
  updatedAt: "2030-04-01T10:00:00+00:00",
  publishedAt: "2030-04-01T10:00:00+00:00",
  confirmedAt: null,
  closedAt: null,
  coach: {
    slug: "example-coach",
    name: "Example Coach",
    trustKind: "verified",
  },
  participantCount: 1,
  canJoin: true,
  canConfirm: false,
  canCancel: false,
  canEdit: false,
};

test("group commands accept Free and fixed euro cents without actor injection or payment tracking", () => {
  for (const priceCents of [0, 1500, 2147483647])
    assert.ok(
      parseGroupSessionCommand({
        action: "save-draft",
        args: { ...draft, priceCents },
      }),
    );
  for (const action of ["settle", "refund", "mark-paid"])
    assert.equal(parseGroupSessionCommand({ action, args: { id } }), null);
  for (const extra of [
    { coachId: id },
    { runId: id },
    { currency: "USD" },
    { status: "open" },
  ])
    assert.equal(
      parseGroupSessionCommand({
        action: "save-draft",
        args: { ...draft, ...extra },
      }),
      null,
    );
  assert.equal(
    parseGroupSessionCommand({
      action: "join",
      args: { id, registrationId: locationId, athleteId: id },
    }),
    null,
  );
});
test("publication requires an exact draft revision and bounded owner-only results", () => {
  assert.deepEqual(
    parseGroupSessionCommand({
      action: "publish",
      args: { id, expectedRevision: 1 },
    }),
    { action: "publish", args: { id, expectedRevision: 1 } },
  );
  for (const args of [
    { id },
    { id, expectedRevision: 0 },
    { id, expectedRevision: 1, coachId: id },
    { id, expectedRevision: 1, status: "open" },
  ])
    assert.equal(parseGroupSessionCommand({ action: "publish", args }), null);
  const result = { outcome: "published", reason: null, session };
  assert.equal(parseGroupSessionResult("publish", result).outcome, "published");
  assert.throws(() =>
    parseGroupSessionResult("publish", {
      ...result,
      reason: "schedule-conflict",
    }),
  );
  assert.throws(() =>
    parseGroupSessionResult("publish", { ...result, athleteIds: [id] }),
  );
});
test("group command validation rejects ambiguous numeric shapes, forged pages and invalid intervals before auth", () => {
  for (const change of [
    { priceCents: -1 },
    { priceCents: 1.5 },
    { priceCents: "15" },
    { priceCents: 2147483648 },
    { maximumParticipants: 101 },
    { minimumParticipants: 0 },
    { minimumParticipants: 7 },
    { maximumParticipants: 2.5 },
    { startsAt: "infinity" },
    { startsAt: "2030-02-30T10:00:00Z" },
    { endsAt: draft.startsAt },
    { decisionDeadlineAt: draft.startsAt },
    { expectedRevision: 0 },
    { title: "   " },
  ])
    assert.equal(
      parseGroupSessionCommand({
        action: "save-draft",
        args: { ...draft, ...change },
      }),
      null,
    );
  assert.equal(
    parseGroupSessionCommand({
      action: "roster",
      args: { id, after: { at: "yesterday", id } },
    }),
    null,
  );
  assert.equal(
    parseGroupSessionCommand({ action: "owner-list", args: { limit: 10000 } }),
    null,
  );
  assert.equal(
    parsePublicGroupQuery({ action: "list", args: { runId: id } }),
    null,
  );
  assert.equal(
    parsePublicGroupQuery({
      action: "list",
      args: { location: "x".repeat(161) },
    }),
    null,
  );
  assert.equal(
    parsePublicGroupQuery({
      action: "detail",
      args: { slug: "../../private" },
    }),
    null,
  );
});
test("keyset cursors preserve database microseconds across server parsing", () => {
  const after = { at: "2030-04-01T10:00:00.123456+00:00", id };
  assert.deepEqual(
    parseGroupSessionCommand({ action: "owner-list", args: { after } })?.args,
    { after },
  );
  const page = parseGroupSessionResult("owner-list", {
    items: Array.from({ length: 20 }, () => session),
    nextCursor: after,
  });
  assert.deepEqual(page.nextCursor, after);
});
test("public and private group projections reject participant identity and raw database fields", () => {
  const parsed = parseGroupSessionResult("public-list", {
    items: [session],
    nextCursor: null,
  });
  assert.equal(parsed.items[0].startsAt, "2030-04-12T16:00:00.000Z");
  assert.equal(parsed.items[0].priceCents, 1500);
  for (const extra of [
    { participantEmails: ["private@example.test"] },
    { coach_profile_id: id },
    { registrations: [{ athleteId: id }] },
  ])
    assert.throws(() =>
      parseGroupSessionResult("public-detail", {
        session: { ...session, ...extra },
      }),
    );
  assert.throws(() =>
    parseGroupSessionResult("public-detail", {
      session: {
        ...session,
        coach: { ...session.coach, avatarStoragePath: "private/object" },
      },
    }),
  );
  assert.throws(() =>
    parseGroupSessionResult("public-list", {
      items: Array.from({ length: 21 }, () => session),
      nextCursor: null,
    }),
  );
  assert.throws(() =>
    parseGroupSessionResult("public-list", {
      items: [session],
      nextCursor: { at: draft.startsAt, id },
    }),
  );
  assert.throws(() =>
    parseGroupSessionResult("public-detail", {
      session: { ...session, participantCount: 7 },
    }),
  );
});
test("roster and own terminal attempts stay bounded and distinct from an active reservation", () => {
  const registration = {
    id: locationId,
    status: "withdrawn",
    createdAt: session.createdAt,
    resolvedAt: session.updatedAt,
    canWithdraw: false,
  };
  const recovered = parseGroupSessionResult("join", {
    outcome: "unavailable",
    session,
    registration,
  });
  assert.equal(recovered.outcome, "unavailable");
  assert.equal(recovered.registration?.status, "withdrawn");
  const roster = {
    id: locationId,
    name: "Participant",
    initials: "P",
    status: "active",
    createdAt: session.createdAt,
    resolvedAt: null,
  };
  assert.equal(
    parseGroupSessionResult("roster", { items: [roster], nextCursor: null })
      .items[0].name,
    "Participant",
  );
  assert.throws(() =>
    parseGroupSessionResult("roster", {
      items: [{ ...roster, email: "private@example.test" }],
      nextCursor: null,
    }),
  );
});
