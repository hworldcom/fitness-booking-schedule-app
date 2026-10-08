import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CoachAvailabilityActionState } from "@/app/coach/actions";
import type {
  CoachAccessProjection,
  CoachProjection,
  OwnedCoachAvailabilityRule,
  OwnedCoachAvailabilitySlot,
} from "@/domain/coaches";
import { CoachAvailabilityPanel } from "@/features/coaches/coach-availability-panel";
import { CoachApplicationGate } from "@/features/coaches/coach-application-gate";
import { CoachWorkspaceNavigation } from "@/features/coaches/coach-workspace-navigation";
import { resolveCoachWorkspaceView } from "@/features/coaches/coach-workspace-view";

const COACH: CoachProjection = Object.freeze({
  profileId: "10000000-0000-4000-8000-000000000001",
  slug: "schedule-coach",
  displayName: "Schedule Coach",
  bio: "Private coaching with deliberate practice and clear feedback for every session.",
  serviceMode: "private-training",
  timezone: "Europe/Berlin",
  selectedGymId: null,
  gymName: null,
  location: Object.freeze({
    kind: "independent",
    label: "Tempelhofer Feld — main entrance",
    latitude: 52.473086,
    longitude: 13.403665,
    source: "manual",
    provider: null,
    confirmedAt: "2026-10-04T09:00:00.000Z",
  }),
  visibility: "visible",
  recordSource: "user",
  trustKind: "verified",
  portraitUrl: null,
  disciplines: Object.freeze(["Boxing"] as const),
});

const RULES: readonly OwnedCoachAvailabilityRule[] = Object.freeze([
  Object.freeze({
    id: "70000000-0000-4000-8000-000000000001",
    isoWeekday: 1,
    localStartTime: "09:00",
    coachTimezone: "Europe/Berlin",
  }),
  Object.freeze({
    id: "70000000-0000-4000-8000-000000000002",
    isoWeekday: 1,
    localStartTime: "10:00",
    coachTimezone: "Europe/Berlin",
  }),
]);

const SUSPENDED_ACCESS: CoachAccessProjection = Object.freeze({
  status: "suspended",
  submittedAt: "2026-10-01T10:00:00.000Z",
  decisionReason: null,
  verificationPolicyVersion: "movx-identity-application-v1",
});

const BOOKED_SLOT: OwnedCoachAvailabilitySlot = Object.freeze({
  id: "80000000-0000-4000-8000-000000000001",
  startsAt: "2026-10-09T08:00:00.000Z",
  endsAt: "2026-10-09T09:00:00.000Z",
  coachTimezone: "Europe/Berlin",
  location: Object.freeze({
    kind: "independent",
    selectedGymId: null,
    gymName: null,
    label: "Tempelhofer Feld — main entrance",
    latitude: 52.473086,
    longitude: 13.403665,
    source: "manual",
    provider: null,
    confirmedAt: "2026-10-08T09:00:00.000Z",
  }),
  status: "booked",
  recurrenceRuleId: RULES[0].id,
  recurrenceLocalDate: "2026-10-09",
});

async function idleAction(): Promise<CoachAvailabilityActionState> {
  return Object.freeze({
    status: "idle",
    message: "",
    errors: Object.freeze([]),
  });
}

test("coach views share Profile-first navigation with one selected destination", () => {
  for (const active of ["profile", "schedule", "bookings"] as const) {
    const html = renderToStaticMarkup(
      createElement(CoachWorkspaceNavigation, { active }),
    );
    const profileIndex = html.indexOf('href="/profile/coach"');
    const scheduleIndex = html.indexOf('href="/coach"');
    const bookingsIndex = html.indexOf('href="/coach?view=bookings"');

    assert.ok(profileIndex >= 0);
    assert.ok(profileIndex < scheduleIndex);
    assert.ok(scheduleIndex < bookingsIndex);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(
      html,
      new RegExp(
        `aria-current="page" class="active" href="${
          active === "profile"
            ? "/profile/coach"
            : active === "schedule"
              ? "/coach"
              : "/coach\\?view=bookings"
        }"`,
      ),
    );
    assert.doesNotMatch(html, /> Availability</);
  }
});

test("coach working week renders one keyboard-operable one-hour control per cell", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: COACH,
      rules: RULES,
      slots: [],
      view: "schedule",
      ownerDisplayName: "Schedule Coach",
      saveRuleSetAction: idleAction,
    }),
  );

  assert.match(html, /Set your working week/);
  assert.match(html, /Your working week/);
  assert.match(html, /Europe\/Berlin/);
  assert.match(html, /Tempelhofer Feld/);
  assert.match(html, /2 selected hours/);
  assert.match(html, /Remove Monday 09:00–10:00/);
  assert.match(html, /Remove Monday 10:00–11:00/);
  assert.match(html, /Add Sunday 22:00–23:00/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Save schedule/);
  assert.match(html, /Your displayed working week is saved/);
  assert.equal((html.match(/<form/g) ?? []).length, 1);
  assert.equal((html.match(/<button/g) ?? []).length, 23 * 7 + 1);
  assert.equal((html.match(/type="button"/g) ?? []).length, 23 * 7);
  assert.match(html, /type="submit"[^>]*disabled/);
  assert.doesNotMatch(html, /datetime-local/);
  assert.doesNotMatch(html, /Publish slot/);
  assert.ok(
    html.indexOf('class="coach-workspace-nav"') <
      html.indexOf('class="coach-workspace-header"'),
  );
  assert.match(html, /aria-current="page" class="active" href="\/coach"/);
  assert.match(html, /href="\/coach\?view=bookings"/);
});

test("Schedule keeps occupied status without rendering private booking detail", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: COACH,
      rules: RULES,
      slots: [BOOKED_SLOT],
      view: "schedule",
      bookingContent: createElement(
        "section",
        { id: "client-bookings" },
        createElement("h2", null, "Private sessions"),
        createElement("span", null, "Booking Client"),
        createElement("img", {
          src: "/api/coach/bookings/example/client-avatar",
          alt: "Booking Client's profile picture",
        }),
      ),
      ownerDisplayName: "Schedule Coach",
      saveRuleSetAction: idleAction,
    }),
  );

  assert.match(html, /Dated class times/);
  assert.match(html, /booked/);
  assert.match(html, /Reserved hour/);
  assert.doesNotMatch(html, /Private sessions/);
  assert.doesNotMatch(html, /Booking Client/);
  assert.doesNotMatch(html, /client-avatar/);
});

test("Bookings renders booking detail without the Schedule editor or occurrence list", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: COACH,
      rules: RULES,
      slots: [BOOKED_SLOT],
      view: "bookings",
      bookingContent: createElement(
        "section",
        { id: "client-bookings" },
        createElement("h2", null, "Private sessions"),
        createElement("span", null, "Booking Client"),
        createElement("img", {
          src: "/api/coach/bookings/example/client-avatar",
          alt: "Booking Client's profile picture",
        }),
      ),
      ownerDisplayName: "Schedule Coach",
      saveRuleSetAction: idleAction,
    }),
  );

  assert.match(html, /Review your bookings/);
  assert.match(html, /Private sessions/);
  assert.match(html, /Booking Client/);
  assert.match(html, /client-avatar/);
  assert.match(
    html,
    /aria-current="page" class="active" href="\/coach\?view=bookings"/,
  );
  assert.doesNotMatch(html, /Your working week/);
  assert.doesNotMatch(html, /Dated class times/);
  assert.doesNotMatch(html, /Save schedule/);
  assert.ok(
    html.indexOf('class="coach-workspace-nav"') <
      html.indexOf('class="coach-workspace-header"'),
  );
});

test("coach workspace view accepts only the single Bookings query value", () => {
  assert.equal(resolveCoachWorkspaceView(undefined), "schedule");
  assert.equal(resolveCoachWorkspaceView("schedule"), "schedule");
  assert.equal(resolveCoachWorkspaceView("bookings"), "bookings");
  assert.equal(resolveCoachWorkspaceView("unknown"), "schedule");
  assert.equal(resolveCoachWorkspaceView(["bookings"]), "schedule");
});

test("suspended coaches reach existing sessions only through Bookings", () => {
  const scheduleHtml = renderToStaticMarkup(
    createElement(CoachApplicationGate, { access: SUSPENDED_ACCESS }),
  );
  const bookingsHtml = renderToStaticMarkup(
    createElement(CoachApplicationGate, {
      access: SUSPENDED_ACCESS,
      existingBookings: createElement(
        "section",
        null,
        "Suspended booking history",
      ),
    }),
  );

  assert.match(scheduleHtml, /href="\/coach\?view=bookings"/);
  assert.match(scheduleHtml, /View bookings/);
  assert.doesNotMatch(scheduleHtml, /Suspended booking history/);
  assert.match(bookingsHtml, /Suspended booking history/);
  assert.doesNotMatch(bookingsHtml, /View bookings/);
});

test("hidden coach profile keeps the recurring editor unavailable", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: { ...COACH, visibility: "hidden" },
      rules: RULES,
      slots: [],
      view: "schedule",
      ownerDisplayName: "Schedule Coach",
      saveRuleSetAction: idleAction,
    }),
  );

  assert.match(html, /Publish your profile before offering times/);
  assert.doesNotMatch(html, /Your working week/);
  assert.equal((html.match(/<button/g) ?? []).length, 0);
});
