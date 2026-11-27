import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  coachAthleteHref,
  coachAthleteStatusLabel,
  isCoachAthleteCursor,
  isCoachAthleteFilter,
  mergeCoachAthletes,
  type CoachAthlete,
} from "@/domain/coach-athletes";
import {
  CoachAthleteRosterList,
  athleteSessionDate,
} from "@/features/coaches/athlete-roster-list";
const profile = "10000000-0000-4000-8000-000000000001",
  external = "20000000-0000-4000-8000-000000000001";
const contact: CoachAthlete = {
  key: `p:${profile}`,
  profileId: profile,
  externalClientId: null,
  name: "Same name",
  status: "unconnected",
  lastSessionAt: null,
  nextSessionAt: "2027-01-01T10:00:00Z",
  sortAt: "2026-11-27T10:00:00.123456+00:00",
  bookingId: profile,
  connection: null,
  canSend: true,
};
const unlinked: CoachAthlete = {
  ...contact,
  key: `e:${external}`,
  profileId: null,
  externalClientId: external,
  status: "external",
  bookingId: null,
  canSend: false,
};
test("roster identities and cursor precision distinguish same-name people from external contacts", () => {
  const rows = mergeCoachAthletes(
    [contact, unlinked],
    [{ ...contact, name: "Updated account name" }],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Updated account name");
  assert.equal(rows[1].name, "Same name");
  assert.equal(coachAthleteHref(contact), `/members/${profile}`);
  assert.equal(
    coachAthleteHref(unlinked),
    `/coach/athletes/external/${external}`,
  );
  assert.equal(
    isCoachAthleteCursor({ at: contact.sortAt, key: contact.key }),
    true,
  );
  for (const cursor of [
    { at: "invalid", key: contact.key },
    { at: contact.sortAt, key: "../../other" },
    { at: contact.sortAt, key: contact.key, owner: profile },
    null,
  ])
    assert.equal(isCoachAthleteCursor(cursor), false);
  assert.equal(isCoachAthleteFilter("external"), true);
  assert.equal(isCoachAthleteFilter(["all", "external"]), false);
});
test("registered and external rows expose only the appropriate connection or invitation action", () => {
  const render = (athletes: CoachAthlete[], mayInitiate = true) =>
    renderToStaticMarkup(
      createElement(CoachAthleteRosterList, {
        athletes,
        busy: false,
        mayInitiate,
        onConnect() {},
        onDecision() {},
      }),
    );
  const html = render([unlinked]);
  assert.match(html, /External athlete/);
  assert.match(html, /Invite/);
  assert.doesNotMatch(html, /Not connected|shared session|Connect<|Refresh/);
  assert.match(render([contact]), /Connect</);
  assert.doesNotMatch(render([contact], false), /Connect<|Invite/);
  assert.doesNotMatch(render([unlinked], false), />Invite</);
  const pending: CoachAthlete = {
    ...contact,
    status: "pending",
    canSend: false,
    connection: {
      id: profile,
      pairId: external,
      attemptNumber: 1,
      coachProfileId: external,
      athleteProfileId: profile,
      senderProfileId: profile,
      recipientProfileId: external,
      status: "pending",
      createdAt: contact.sortAt,
      updatedAt: contact.sortAt,
      decidedAt: null,
      removedAt: null,
      coachDisplayName: "Coach",
      athleteDisplayName: "Same name",
      coachSlug: "coach",
      coachPublic: true,
      coachPortraitUrl: null,
      athleteAvatarUrl: null,
      canAccept: true,
      canDecline: true,
      canWithdraw: false,
      canDisconnect: false,
    },
  };
  assert.equal(coachAthleteStatusLabel(pending), "Request received");
  assert.match(render([pending]), /View request/);
  assert.doesNotMatch(render([pending]), /Connect</);
  const connected: CoachAthlete = {
    ...pending,
    status: "connected",
    connection: {
      ...pending.connection!,
      status: "accepted",
      canDisconnect: true,
      canAccept: false,
      canDecline: false,
    },
  };
  assert.equal(coachAthleteHref(connected), `/coach/athletes/${external}`);
  assert.match(render([connected]), /Manage Same name/);
  assert.match(render([connected]), /Disconnect/);
});
test("last-session dates do not label a future-only or absent session as completed history", () => {
  assert.match(athleteSessionDate(contact), /^Next: 1 Jan 2027$/);
  assert.equal(
    athleteSessionDate({ ...contact, lastSessionAt: "2026-11-26T23:30:00Z" }),
    "27 Nov 2026",
  );
  assert.equal(
    athleteSessionDate({ ...contact, nextSessionAt: null }),
    "No sessions yet",
  );
});

test("a verified invitation link arriving on another page replaces its external row without merging names", () => {
  const separate = {
    ...unlinked,
    key: "e:30000000-0000-4000-8000-000000000001",
    externalClientId: "30000000-0000-4000-8000-000000000001",
  };
  const linked = { ...contact, externalClientId: unlinked.externalClientId };
  const rows = mergeCoachAthletes([unlinked, separate], [linked]);
  assert.deepEqual(
    rows.map((row) => row.key),
    [separate.key, linked.key],
  );
  assert.deepEqual(
    mergeCoachAthletes(rows, [unlinked]).map((row) => row.key),
    [separate.key, linked.key],
  );
});
