import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CoachAccessProjection, CoachProjection } from "@/domain/coaches";
import { CoachAvailabilityPanel } from "@/features/coaches/coach-availability-panel";
import { CoachApplicationGate } from "@/features/coaches/coach-application-gate";
import { CoachProfilePreview } from "@/features/coaches/coach-profile-preview";
import { CoachWorkspaceHeader } from "@/features/coaches/coach-workspace-header";
import { COACH_WORKSPACE_DESTINATIONS } from "@/features/coaches/coach-workspace-navigation";
import { WorkspaceNavigationItems } from "@/components/workspace-navigation";
import { resolveCoachWorkspaceView } from "@/features/coaches/coach-workspace-view";

const COACH: CoachProjection = Object.freeze({
  profileId: "10000000-0000-4000-8000-000000000001",
  slug: "schedule-coach",
  displayName: "Schedule Coach",
  bio: "Private coaching with deliberate practice and clear feedback for every session.",
  serviceMode: "private-training",
  timezone: "Europe/Berlin",
  primaryLocationId: "60000000-0000-4000-8000-000000000001",
  locations: Object.freeze([
    Object.freeze({
      id: "60000000-0000-4000-8000-000000000001",
      publicName: "Tempelhofer Feld",
      timezone: "Europe/Berlin",
      selectedGymId: null,
      gymName: null,
      location: Object.freeze({
        kind: "independent" as const,
        label: "Tempelhofer Feld — main entrance",
        latitude: 52.473086,
        longitude: 13.403665,
        source: "manual" as const,
        provider: null,
        confirmedAt: "2026-10-04T09:00:00.000Z",
      }),
      status: "active" as const,
      isPrimary: true,
      sortOrder: 1,
      deactivatedAt: null,
      recordSource: "user" as const,
      updatedAt: "2026-10-04T09:00:00.000Z",
    }),
    Object.freeze({
      id: "60000000-0000-4000-8000-000000000002",
      publicName: "Riverside strength deck",
      timezone: "Europe/Berlin",
      selectedGymId: null,
      gymName: null,
      location: Object.freeze({
        kind: "independent" as const,
        label: "Maybachufer 1, 12047 Berlin, Germany",
        latitude: 52.49345,
        longitude: 13.42842,
        source: "manual" as const,
        provider: null,
        confirmedAt: "2026-10-05T09:00:00.000Z",
      }),
      status: "active" as const,
      isPrimary: false,
      sortOrder: 2,
      deactivatedAt: null,
      recordSource: "user" as const,
      updatedAt: "2026-10-05T09:00:00.000Z",
    }),
  ]),
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

const SUSPENDED_ACCESS: CoachAccessProjection = Object.freeze({
  status: "suspended",
  submittedAt: "2026-10-01T10:00:00.000Z",
  decisionReason: null,
  verificationPolicyVersion: "movx-identity-application-v1",
});

test("scheduling views keep Schedule, Bookings and Events without the independent Profile", () => {
  for (const active of ["schedule", "bookings", "events"] as const) {
    const html = renderToStaticMarkup(
      createElement(WorkspaceNavigationItems, {
        navigation: COACH_WORKSPACE_DESTINATIONS,
        pathname: active === "events" ? "/coach/events" : "/coach",
        viewValues: active === "bookings" ? ["bookings"] : [],
      }),
    );
    const scheduleIndex = html.indexOf('href="/coach"');
    const bookingsIndex = html.indexOf('href="/coach?view=bookings"');
    const eventsIndex = html.indexOf('href="/coach/events"');

    assert.ok(scheduleIndex >= 0);
    assert.doesNotMatch(html, /href="\/profile\/coach"/);
    assert.ok(scheduleIndex < bookingsIndex);
    assert.ok(bookingsIndex < eventsIndex);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(
      html,
      new RegExp(
        `aria-current="page" href="${
          active === "schedule"
            ? "/coach"
            : active === "bookings"
              ? "/coach\\?view=bookings"
              : "/coach/events"
        }"`,
      ),
    );
    assert.doesNotMatch(html, /> Availability</);
  }
});

test("coach workspace heading and profile preview use current bounded coach data", () => {
  const header = renderToStaticMarkup(
    createElement(CoachWorkspaceHeader, {
      coach: COACH,
      ownerDisplayName: "Schedule Coach",
    }),
  );
  assert.match(header, /Run your coaching week/);
  assert.match(header, /Welcome, Schedule Coach/);
  assert.match(header, /Profile published/);
  assert.match(header, /href="\/coaches\/schedule-coach"/);

  const preview = renderToStaticMarkup(
    createElement(CoachProfilePreview, {
      coach: COACH,
      publicationAllowed: true,
    }),
  );
  assert.match(preview, /PUBLIC PREVIEW/);
  assert.match(preview, /Published/);
  assert.match(preview, />SC<\/span>/);
  assert.match(preview, /Schedule Coach/);
  assert.match(preview, /Private coaching with deliberate practice/);
  assert.match(preview, /Tempelhofer Feld/);
  assert.match(preview, /Other active places/);
  assert.match(preview, /<dd>1<\/dd>/);

  const draft = renderToStaticMarkup(
    createElement(CoachProfilePreview, {
      coach: Object.freeze({ ...COACH, visibility: "hidden" as const }),
      publicationAllowed: false,
    }),
  );
  assert.match(draft, /PRIVATE DRAFT PREVIEW/);
  assert.match(draft, /Not public/);
  assert.doesNotMatch(draft, /Published/);
});

test("Schedule mounts its editor inside the shared coach frame", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: COACH,
      view: "schedule",
      ownerDisplayName: "Schedule Coach",
      scheduleContent: createElement(
        "section",
        { "aria-label": "Availability editor" },
        "Weekly hours and date overrides",
      ),
    }),
  );
  assert.match(html, /Weekly hours and date overrides/);
  assert.doesNotMatch(html, /coach-workspace-nav|aria-label="Coach workspace"/);
  assert.ok(
    html.indexOf('class="coach-workspace-header"') <
      html.indexOf("Weekly hours and date overrides"),
  );
});

test("Schedule does not mount private booking detail", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: COACH,
      view: "schedule",
      bookingContent: createElement(
        "section",
        { id: "client-bookings" },
        createElement("h2", null, "Booked sessions"),
        createElement("span", null, "Booking Client"),
        createElement("img", {
          src: "/api/coach/bookings/example/client-avatar",
          alt: "Booking Client's profile picture",
        }),
      ),
      ownerDisplayName: "Schedule Coach",
      scheduleContent: createElement(
        "section",
        null,
        "Weekly hours and date overrides",
      ),
    }),
  );

  assert.match(html, /Weekly hours and date overrides/);
  assert.doesNotMatch(html, /Booked sessions/);
  assert.doesNotMatch(html, /Booking Client/);
  assert.doesNotMatch(html, /client-avatar/);
});

test("Bookings renders booking detail without the Schedule editor or occurrence list", () => {
  const html = renderToStaticMarkup(
    createElement(CoachAvailabilityPanel, {
      coach: COACH,
      view: "bookings",
      bookingContent: createElement(
        "section",
        { id: "client-bookings" },
        createElement("h2", null, "Booked sessions"),
        createElement("span", null, "Booking Client"),
        createElement("img", {
          src: "/api/coach/bookings/example/client-avatar",
          alt: "Booking Client's profile picture",
        }),
      ),
      ownerDisplayName: "Schedule Coach",
      scheduleContent: createElement(
        "section",
        null,
        "Weekly hours and date overrides",
      ),
    }),
  );

  assert.match(html, /Run your coaching week/);
  assert.match(html, /Booked sessions/);
  assert.match(html, /Booking Client/);
  assert.match(html, /client-avatar/);
  assert.doesNotMatch(html, /coach-workspace-nav|aria-label="Coach workspace"/);
  assert.doesNotMatch(html, /Weekly hours and date overrides/);
  assert.doesNotMatch(html, /Dated class times/);
  assert.doesNotMatch(html, /Save schedule/);
  assert.ok(
    html.indexOf('class="coach-workspace-header"') <
      html.indexOf("Booked sessions"),
  );
});

test("coach workspace view accepts only the single Bookings query value", () => {
  assert.equal(resolveCoachWorkspaceView(undefined), "schedule");
  assert.equal(resolveCoachWorkspaceView("schedule"), "schedule");
  assert.equal(resolveCoachWorkspaceView("bookings"), "bookings");
  assert.equal(resolveCoachWorkspaceView("unknown"), "schedule");
  assert.equal(resolveCoachWorkspaceView(["bookings"]), "schedule");
});

test("suspended gate preserves the Bookings shortcut and bounded existing-history content", () => {
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
      view: "schedule",
      ownerDisplayName: "Schedule Coach",
      scheduleContent: createElement(
        "section",
        null,
        "Weekly hours and date overrides",
      ),
    }),
  );

  assert.match(html, /Publish your profile before offering times/);
  assert.doesNotMatch(html, /Weekly hours and date overrides/);
  assert.equal((html.match(/<button/g) ?? []).length, 0);
});

test("coach Profile has its own title and workspace return while preserving publication details", () => {
  const html = renderToStaticMarkup(
    createElement(CoachWorkspaceHeader, {
      coach: COACH,
      ownerDisplayName: "Schedule Coach",
      view: "profile",
    }),
  );
  assert.match(html, /<h1>Profile\.<\/h1>/);
  assert.match(html, /href="\/coach"/);
  assert.match(html, /Profile published/);
  assert.match(html, /href="\/coaches\/schedule-coach"/);
  assert.doesNotMatch(html, /Run your coaching week|coach-workspace-nav/);
});

test("applicant Profile returns to personal Profile without a scheduling-workspace action", () => {
  const html = renderToStaticMarkup(
    createElement(CoachWorkspaceHeader, {
      coach: null,
      ownerDisplayName: "Applicant",
      view: "profile",
      profileReturnHref: "/profile",
    }),
  );
  assert.match(html, /href="\/profile"/);
  assert.match(html, /Personal profile/);
  assert.doesNotMatch(html, /href="\/coach"|View public profile/);
});
