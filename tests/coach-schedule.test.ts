import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CoachAvailabilityActionState } from "@/app/coach/actions";
import type {
  CoachProjection,
  OwnedCoachAvailabilityRule,
  OwnedCoachAvailabilitySlot,
} from "@/domain/coaches";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import { CoachAvailabilityPanel } from "@/features/coaches/coach-availability-panel";

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

const COACH_BOOKING: PrivateBookingProjection = Object.freeze({
  id: "90000000-0000-4000-8000-000000000001",
  slotId: BOOKED_SLOT.id,
  coachProfileId: COACH.profileId,
  coachDisplayName: COACH.displayName,
  coachSlug: COACH.slug,
  clientProfileId: "90000000-0000-4000-8000-000000000002",
  clientDisplayName: "Booking Client",
  status: "confirmed",
  scheduledStartAt: BOOKED_SLOT.startsAt,
  scheduledEndAt: BOOKED_SLOT.endsAt,
  coachTimezone: BOOKED_SLOT.coachTimezone,
  location: Object.freeze({
    kind: "independent",
    gymName: null,
    publicLabel: BOOKED_SLOT.location.label,
  }),
  cancelledBy: null,
  cancelledAt: null,
  completedAt: null,
  createdAt: "2026-10-08T10:00:00.000Z",
});

async function idleAction(): Promise<CoachAvailabilityActionState> {
  return Object.freeze({
    status: "idle",
    message: "",
    errors: Object.freeze([]),
  });
}

test("coach working week renders one keyboard-operable one-hour control per cell", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: COACH,
      rules: RULES,
      slots: [],
      bookings: [],
      ownerDisplayName: "Schedule Coach",
      mutateRuleAction: idleAction,
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
  assert.equal((html.match(/<form/g) ?? []).length, 1);
  assert.equal((html.match(/<button/g) ?? []).length, 23 * 7);
  assert.doesNotMatch(html, /datetime-local/);
  assert.doesNotMatch(html, /Publish slot/);
});

test("coach workspace surfaces the private booking and client beside its occurrence", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: COACH,
      rules: RULES,
      slots: [BOOKED_SLOT],
      bookings: [COACH_BOOKING],
      clientCards: createElement(
        "section",
        { id: "client-bookings" },
        "Private sessions for Booking Client",
      ),
      ownerDisplayName: "Schedule Coach",
      mutateRuleAction: idleAction,
    }),
  );

  assert.ok(
    html.indexOf("Private sessions") < html.indexOf("Your working week"),
  );
  assert.match(html, /Booked by/);
  assert.match(html, /Booking Client/);
});

test("hidden coach profile keeps the recurring editor unavailable", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: { ...COACH, visibility: "hidden" },
      rules: RULES,
      slots: [],
      bookings: [],
      ownerDisplayName: "Schedule Coach",
      mutateRuleAction: idleAction,
    }),
  );

  assert.match(html, /Publish your profile before offering times/);
  assert.doesNotMatch(html, /Your working week/);
  assert.equal((html.match(/<button/g) ?? []).length, 0);
});
