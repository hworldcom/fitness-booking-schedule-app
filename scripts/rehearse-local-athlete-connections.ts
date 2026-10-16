import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect as defaultExpect, type Page } from "@playwright/test";
import sharp from "sharp";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";

const {
  base,
  database,
  person,
  work,
  booking,
  requestFixture,
  send,
  decide,
  cookieHeader,
  cleanup,
  approveCoach,
  cancelDirectPrivateBookingRecord,
  bookingConnectionContextRecord,
  connectionHistoryRecord,
} = await localConnectionRehearsal("DEV0223");
const expect = defaultExpect.configure({ timeout: 15_000 });
const evidence = "test-results/athlete-connections-rehearsal";
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let phase = "setup";
const card = (page: Page, id: string) =>
  page.locator(`.coach-connection-card[data-connection-id="${id}"]`);
const feedback = (page: Page) => page.locator(".coach-connection-feedback");
const context = (actor: LocalPerson, bookingId: string) =>
  work(actor, (tx) => bookingConnectionContextRecord(tx, bookingId));
async function actorPage(actor: LocalPerson, route: string) {
  assert.ok(browser);
  const session = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  await session.addCookies(
    actor.cookies.map((cookie) => ({
      ...cookie,
      url: base,
      sameSite: "Lax" as const,
    })),
  );
  const page = await session.newPage();
  await page.goto(base + route);
  return { session, page };
}
async function refresh(page: Page) {
  await page
    .getByRole("button", { name: "Refresh connections", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Refresh connections", exact: true }),
  ).toBeEnabled();
}
async function sendThrough(page: Page, id: string, role: "athlete" | "coach") {
  const session = page.locator(`#${role}-booking-${id}`);
  const options = session.getByRole("button", {
    name: "Connection options",
    exact: true,
  });
  if (await options.count()) await options.click();
  else
    await session
      .getByRole("button", { name: "Refresh connection status", exact: true })
      .click();
  await session
    .getByRole("button", {
      name: /^(Send connection request|Request reconnection)$/,
    })
    .click();
  await expect(feedback(page)).toHaveText(
    "Connection request pending acceptance.",
  );
  await expect(
    page.getByRole("button", { name: "Refresh connections", exact: true }),
  ).toBeEnabled();
}
async function acceptThrough(page: Page, id: string) {
  await card(page, id)
    .getByRole("button", { name: "Accept connection", exact: true })
    .click();
  await expect(feedback(page)).toHaveText("Connected.");
  await expect(
    page.getByRole("button", { name: "Refresh connections", exact: true }),
  ).toBeEnabled();
}
async function disconnectThrough(page: Page, id: string) {
  await card(page, id)
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(
    card(page, id).getByRole("button", { name: "Stay connected" }),
  ).toBeFocused();
  await card(page, id).getByRole("button", { name: "Stay connected" }).click();
  await expect(
    card(page, id).getByRole("button", { name: "Disconnect", exact: true }),
  ).toBeFocused();
  await card(page, id)
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await card(page, id)
    .getByRole("button", { name: "Confirm disconnect" })
    .click();
  await expect(feedback(page)).toHaveText(
    "Disconnected. Shared history is retained.",
  );
  await expect(feedback(page)).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Refresh connections", exact: true }),
  ).toBeEnabled();
  await expect(
    card(page, id).getByRole("button", { name: "View shared history" }),
  ).toHaveCount(0);
}
async function revealAccepted(page: Page, id: string) {
  while ((await card(page, id).count()) === 0) {
    const count = await page
      .locator('[aria-label="My coaches"] .coach-connection-card')
      .count();
    await page
      .getByRole("button", { name: "Load more coaches", exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .locator('[aria-label="My coaches"] .coach-connection-card')
          .count(),
      )
      .toBeGreaterThan(count);
  }
}
async function history(page: Page, id: string) {
  const entry = card(page, id);
  await entry
    .getByRole("button", { name: "View shared history", exact: true })
    .click();
  await expect(entry.locator("[data-history-id]").first()).toBeVisible();
  await expect(
    entry.getByRole("button", { name: "View shared history", exact: true }),
  ).toBeEnabled();
  while (
    await entry
      .getByRole("button", { name: "Load older shared history" })
      .count()
  ) {
    const count = await entry.locator("[data-history-id]").count();
    await entry
      .getByRole("button", { name: "Load older shared history" })
      .click();
    await expect
      .poll(() => entry.locator("[data-history-id]").count())
      .toBeGreaterThan(count);
    await expect(
      entry.getByRole("button", { name: "View shared history", exact: true }),
    ).toBeEnabled();
    await expect(entry.locator("[data-history-id]").nth(count)).toBeFocused();
  }
  return entry.locator("[data-history-id]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute("data-history-id"),
      requestId: node.getAttribute("data-request-id"),
      bookingId: node.getAttribute("data-booking-id"),
      text: node.textContent?.replace(/View session/g, ""),
    })),
  );
}
async function completed(id: string) {
  await database`update app.coach_private_bookings set status='completed',created_at=statement_timestamp()-interval '3 hours',scheduled_start_at=statement_timestamp()-interval '2 hours',scheduled_end_at=statement_timestamp()-interval '1 hour',early_return_until=statement_timestamp()-interval '2 hours',hold_expires_at=statement_timestamp()-interval '119 minutes',completed_at=statement_timestamp() where id=${id}::uuid`;
}
try {
  await cleanup();
  if (!process.argv.includes("--cleanup")) {
    phase = "prepare tagged private accounts and complete retained history";
    console.log("Rehearsal: " + phase);
    const coach = await person("DEV0223 Coach"),
      athlete = await person("DEV0223 Amina"),
      coachB = await person("DEV0223 Coach B"),
      stranger = await person("DEV0223 Unrelated");
    await approveCoach(coach);
    await approveCoach(coachB);
    const main = await booking(coach, athlete);
    const wanted = new Set([
      await requestFixture(
        coach,
        athlete,
        main.slotId,
        "accepted",
        main.bookingId,
      ),
    ]);
    for (let n = 0; n < 24; n++)
      wanted.add(
        await requestFixture(
          coach,
          athlete,
          main.slotId,
          n % 2 ? "withdrawn" : "declined",
        ),
      );
    for (const status of ["expired", "not-selected", "occurrence-closed"])
      wanted.add(await requestFixture(coach, athlete, main.slotId, status));
    const cancelled = await booking(coach, athlete);
    wanted.add(
      await requestFixture(
        coach,
        athlete,
        cancelled.slotId,
        "accepted",
        cancelled.bookingId,
      ),
    );
    await work(athlete, (tx) =>
      cancelDirectPrivateBookingRecord(tx, cancelled.bookingId),
    );
    const oldCompleted = await booking(coach, athlete);
    await completed(oldCompleted.bookingId);
    wanted.add(oldCompleted.bookingId);
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const { page: athletePage } = await actorPage(athlete, "/sessions");
    const { page: coachPage } = await actorPage(coach, "/coach?view=bookings");
    const errors: string[] = [];
    athletePage.on("pageerror", (error) => errors.push(error.message));
    coachPage.on("pageerror", (error) => errors.push(error.message));
    await mkdir(evidence, { recursive: true });
    await expect(athletePage.locator("#my-coaches")).toContainText(
      "No connected coaches yet",
    );
    phase =
      "real athlete request, ambiguous retry, withdraw and explicit coach acceptance";
    console.log("Rehearsal: " + phase);
    const mainCard = athletePage.locator(`#athlete-booking-${main.bookingId}`);
    await mainCard
      .getByRole("button", { name: "Connection options", exact: true })
      .click();
    const bodies: string[][] = [];
    athletePage.on("request", (request) => {
      const body = request.postData();
      if (request.method() === "POST" && body?.includes("operationId"))
        bodies.push(
          body.match(
            /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
          ) ?? [],
        );
    });
    let aborted = false;
    await athletePage.route("**/sessions", async (route) => {
      if (!aborted && route.request().method() === "POST") {
        aborted = true;
        await route.abort();
      } else await route.continue();
    });
    await mainCard
      .getByRole("button", { name: "Send connection request" })
      .click();
    await expect(feedback(athletePage)).toContainText("could not verify");
    await athletePage.unroute("**/sessions");
    await mainCard
      .getByRole("button", { name: "Send connection request" })
      .click();
    await expect(feedback(athletePage)).toHaveText(
      "Connection request pending acceptance.",
    );
    await expect(
      athletePage.getByRole("button", {
        name: "Refresh connections",
        exact: true,
      }),
    ).toBeEnabled();
    assert.equal(bodies.length, 2);
    assert.deepEqual(
      bodies[0],
      bodies[1],
      "Retry must reuse the operation UUID.",
    );
    let first = (await context(athlete, main.bookingId)).connection;
    assert.ok(first);
    await expect(
      athletePage.locator('[aria-label="My coaches"] .coach-connection-card'),
    ).toHaveCount(0);
    await coachPage.reload();
    await expect(
      card(coachPage, first.id).getByRole("button", {
        name: "Accept connection",
      }),
    ).toBeEnabled();
    await card(athletePage, first.id)
      .getByRole("button", { name: "Withdraw request" })
      .click();
    await expect(feedback(athletePage)).toHaveText(
      "Connection request withdrawn.",
    );
    await expect(
      athletePage.getByRole("button", {
        name: "Refresh connections",
        exact: true,
      }),
    ).toBeEnabled();
    await sendThrough(athletePage, main.bookingId, "athlete");
    first = (await context(athlete, main.bookingId)).connection;
    assert.ok(first);
    await coachPage.reload();
    await acceptThrough(coachPage, first.id);
    await refresh(athletePage);
    const original = await history(athletePage, first.id);
    assert.equal(original.length, 30);
    assert.equal(new Set(original.map((row) => row.id)).size, 30);
    assert.deepEqual(new Set(original.map((row) => row.id)), wanted);
    assert.deepEqual(await history(coachPage, first.id), original);
    await expect(
      card(athletePage, first.id).getByRole("link", {
        name: "View coach and request a session",
      }),
    ).toHaveCount(0);
    await card(athletePage, first.id)
      .locator(`[data-booking-id="${main.bookingId}"]`)
      .getByRole("link", { name: "View session" })
      .click();
    await expect(athletePage).toHaveURL(
      new RegExp(`#athlete-booking-${main.bookingId}$`),
    );
    await expect(mainCard).toBeVisible();

    phase =
      "both web interfaces disconnect and recover every original history reference";
    console.log("Rehearsal: " + phase);
    await disconnectThrough(athletePage, first.id);
    await coachPage.reload();
    await expect(
      coachPage.locator('[aria-label="My athletes"] .coach-connection-card'),
    ).toHaveCount(0);
    await sendThrough(coachPage, main.bookingId, "coach");
    let next = (await context(coach, main.bookingId)).connection;
    assert.ok(next);
    assert.notEqual(next.id, first.id);
    await refresh(athletePage);
    await acceptThrough(athletePage, next.id);
    await refresh(coachPage);
    assert.deepEqual(await history(athletePage, next.id), original);
    assert.deepEqual(await history(coachPage, next.id), original);
    await disconnectThrough(coachPage, next.id);
    await athletePage.reload();
    await expect(
      athletePage.locator('[aria-label="My coaches"] .coach-connection-card'),
    ).toHaveCount(0);
    await sendThrough(athletePage, main.bookingId, "athlete");
    next = (await context(athlete, main.bookingId)).connection;
    assert.ok(next);
    await coachPage.reload();
    await acceptThrough(coachPage, next.id);
    await athletePage.reload();
    assert.deepEqual(await history(athletePage, next.id), original);

    phase = "public coach shortcut and cold-load portrait fallback";
    console.log("Rehearsal: " + phase);
    const image = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 65, g: 100, b: 150 },
      },
    })
      .webp()
      .toBuffer();
    const upload = await fetch(base + "/api/coach/portrait", {
      method: "POST",
      headers: {
        origin: base,
        cookie: cookieHeader(coach),
        "content-type": "image/webp",
      },
      body: image,
    });
    assert.equal(upload.status, 200);
    await database`update app.coach_profiles set visibility='visible' where profile_id=${coach.actor.profileId}::uuid`;
    await athletePage.reload();
    await expect(
      card(athletePage, next.id).locator(".avatar img"),
    ).toBeVisible();
    const profileLink = card(athletePage, next.id).getByRole("link", {
      name: "View coach and request a session",
    });
    const profileHref = await profileLink.getAttribute("href");
    assert.ok(profileHref?.startsWith("/coaches/"));
    await profileLink.click();
    await expect(athletePage).toHaveURL(new RegExp(profileHref + "$"), {
      timeout: 30_000,
    });
    await expect(
      athletePage.getByRole("heading", { name: coach.name, exact: true }),
    ).toBeVisible();
    await athletePage.route(
      "**/storage/v1/object/public/coach-portraits/**",
      (route) => route.abort(),
    );
    await athletePage.goto(base + "/sessions");
    await expect(card(athletePage, next.id).locator(".avatar img")).toHaveCount(
      0,
    );
    await expect(card(athletePage, next.id).locator(".avatar")).toHaveText(
      "DC",
    );
    await athletePage.unroute("**/storage/v1/object/public/coach-portraits/**");
    await athletePage.reload();
    await history(athletePage, next.id);
    await athletePage
      .getByRole("link", { name: "My coaches", exact: true })
      .click();
    await athletePage.screenshot({
      path: evidence + "/desktop-history.png",
      fullPage: true,
    });
    await athletePage.screenshot({ path: evidence + "/desktop-viewport.png" });
    await database`update app.coach_profiles set visibility='hidden' where profile_id=${coach.actor.profileId}::uuid`;

    phase =
      "athlete stale acceptance after real coach cancellation and crossed requests";
    console.log("Rehearsal: " + phase);
    const race = await booking(coachB, athlete);
    const pending = await send(coachB, race.bookingId);
    const { page: otherCoachPage } = await actorPage(
      coachB,
      "/coach?view=bookings",
    );
    await athletePage.reload();
    await expect(
      card(athletePage, pending.id).getByRole("button", {
        name: "Accept connection",
      }),
    ).toBeEnabled();
    await otherCoachPage
      .locator(`#coach-booking-${race.bookingId}`)
      .getByRole("button", { name: "Cancel session", exact: true })
      .click();
    await expect(otherCoachPage.locator(".coach-client-message")).toHaveText(
      "Booking cancelled.",
      { timeout: 30_000 },
    );
    await expect(
      otherCoachPage.locator(
        `#coach-booking-${race.bookingId} .coach-booking-status`,
      ),
    ).toHaveText("cancelled", { timeout: 30_000 });
    await card(athletePage, pending.id)
      .getByRole("button", { name: "Accept connection" })
      .click();
    await expect(feedback(athletePage)).toContainText("no longer qualifies");
    await expect(
      card(athletePage, pending.id).getByRole("button", {
        name: "Accept connection",
      }),
    ).toHaveCount(0);
    await expect(
      athletePage.locator(
        `#athlete-booking-${race.bookingId} .coach-booking-status`,
      ),
    ).toContainText("Cancelled");
    await card(athletePage, pending.id)
      .getByRole("button", { name: "Decline connection" })
      .click();
    await expect(feedback(athletePage)).toHaveText(
      "Connection request declined.",
    );
    assert.equal(
      (await context(athlete, race.bookingId)).connection?.status,
      "declined",
    );
    const crossedBooking = await booking(coachB, athlete);
    await athletePage.reload();
    await sendThrough(athletePage, crossedBooking.bookingId, "athlete");
    const crossed = (await context(athlete, crossedBooking.bookingId))
      .connection;
    assert.ok(crossed);
    const simultaneous = await send(coachB, crossedBooking.bookingId);
    assert.equal(simultaneous.id, crossed.id);
    assert.equal(simultaneous.status, "pending");
    await refresh(athletePage);
    await expect(
      card(athletePage, crossed.id).getByRole("button", {
        name: "Accept connection",
      }),
    ).toHaveCount(0);
    await otherCoachPage.reload();
    await acceptThrough(otherCoachPage, crossed.id);
    await athletePage.reload();
    await expect(
      athletePage.locator('[aria-label="My coaches"] .coach-connection-card'),
    ).toHaveCount(2);

    phase =
      "bounded coaches pagination, failed read retry, keyboard and mobile";
    console.log("Rehearsal: " + phase);
    for (let n = 0; n < 20; n++) {
      const additional = await person(
        `DEV0223 Coach ${String(n + 1).padStart(2, "0")}`,
      );
      await approveCoach(additional);
      const b = await booking(additional, athlete);
      const p = await send(athlete, b.bookingId);
      await decide(additional, p.id, "accept");
    }
    await athletePage.reload();
    await expect(
      athletePage.locator('[aria-label="My coaches"] .coach-connection-card'),
    ).toHaveCount(20);
    await athletePage.route("**/sessions", async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    await athletePage
      .getByRole("button", { name: "Load more coaches", exact: true })
      .click();
    await expect(
      athletePage.locator('[aria-label="My coaches"]'),
    ).toContainText("could not be verified");
    await expect(
      athletePage.locator('[aria-label="My coaches"] .coach-connection-card'),
    ).toHaveCount(0);
    await athletePage.unroute("**/sessions");
    await athletePage
      .getByRole("button", { name: "Retry my coaches", exact: true })
      .click();
    await expect(
      athletePage.locator('[aria-label="My coaches"] .coach-connection-card'),
    ).toHaveCount(20);
    const loadMore = athletePage.getByRole("button", {
      name: "Load more coaches",
      exact: true,
    });
    await expect(loadMore).toBeEnabled();
    await loadMore.focus();
    await athletePage.keyboard.press("Enter");
    await expect(
      athletePage.locator('[aria-label="My coaches"] .coach-connection-card'),
    ).toHaveCount(22);
    await expect(
      athletePage
        .locator('[aria-label="My coaches"] .coach-connection-card')
        .nth(20),
    ).toBeFocused();
    await expect(loadMore).toHaveCount(0);
    const ids = await athletePage
      .locator('[aria-label="My coaches"] .coach-connection-card')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-pair-id")),
      );
    assert.equal(new Set(ids).size, 22);
    await athletePage.setViewportSize({ width: 375, height: 812 });
    await athletePage
      .getByRole("link", { name: "My coaches", exact: true })
      .click();
    assert.ok(
      await athletePage
        .getByRole("heading", { name: "My coaches", exact: true })
        .evaluate((node) => node.getBoundingClientRect().top >= 72),
    );
    assert.ok(
      await athletePage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await expect(
      athletePage.getByRole("heading", { name: "My coaches", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await athletePage.screenshot({ path: evidence + "/mobile-viewport.png" });
    assert.deepEqual(await history(athletePage, next.id), original);
    await athletePage.screenshot({
      path: evidence + "/mobile-history.png",
      fullPage: true,
    });

    phase =
      "accepted cancellation survives, suspension and coach-as-athlete completed-only eligibility";
    console.log("Rehearsal: " + phase);
    await work(athlete, (tx) =>
      cancelDirectPrivateBookingRecord(tx, main.bookingId),
    );
    await athletePage.reload();
    await revealAccepted(athletePage, next.id);
    await expect(card(athletePage, next.id)).toContainText("Connected");
    const afterCancellation = await history(athletePage, next.id);
    assert.equal(afterCancellation.length, 30);
    assert.deepEqual(
      afterCancellation.map((row) => row.id),
      original.map((row) => row.id),
    );
    assert.ok(
      afterCancellation
        .find((row) => row.bookingId === main.bookingId)
        ?.text?.includes("Cancelled session"),
    );
    await database`select app.review_coach_application(${coach.actor.profileId}::uuid,'approved','suspended','Local-only suspension check.','local-test','movx-identity-application-v1')`;
    await athletePage.reload();
    await revealAccepted(athletePage, next.id);
    await expect(card(athletePage, next.id)).toContainText("Connected");
    await expect(
      card(athletePage, next.id).getByRole("link", {
        name: "View coach and request a session",
      }),
    ).toHaveCount(0);
    assert.equal((await history(athletePage, next.id)).length, 30);
    const training = await booking(coachB, coach);
    await completed(training.bookingId);
    const { page: coachAsAthlete } = await actorPage(coach, "/sessions");
    await expect(
      coachAsAthlete.locator(".client-session-coach-context"),
    ).toContainText("as an athlete");
    await sendThrough(coachAsAthlete, training.bookingId, "athlete");
    const trainingRequest = (await context(coach, training.bookingId))
      .connection;
    assert.ok(trainingRequest);
    await otherCoachPage.reload();
    await acceptThrough(otherCoachPage, trainingRequest.id);
    await coachAsAthlete.reload();
    await expect(card(coachAsAthlete, trainingRequest.id)).toContainText(
      coachB.name,
    );
    await expect(
      coachAsAthlete.locator(
        '[aria-label="My coaches"] .coach-connection-card',
      ),
    ).toHaveCount(1);
    await expect(coachAsAthlete.locator("body")).not.toContainText(
      athlete.name,
    );
    const onlyHistory = await history(coachAsAthlete, trainingRequest.id);
    assert.equal(onlyHistory.length, 1);
    assert.ok(onlyHistory[0].text?.includes("Completed session"));

    phase =
      "pending/cancelled-only qualification, suspended pending, guest and unrelated isolation";
    console.log("Rehearsal: " + phase);
    const noConfirmed = await booking(coachB, stranger);
    await work(stranger, (tx) =>
      cancelDirectPrivateBookingRecord(tx, noConfirmed.bookingId),
    );
    await requestFixture(coachB, stranger, noConfirmed.slotId, "pending");
    const { page: strangerPage } = await actorPage(stranger, "/sessions");
    await expect(
      strangerPage.locator('[aria-label="My coaches"] .coach-connection-card'),
    ).toHaveCount(0);
    await strangerPage
      .locator(`#athlete-booking-${noConfirmed.bookingId}`)
      .getByRole("button", { name: "Connection options", exact: true })
      .click();
    await expect(
      strangerPage.getByRole("button", { name: "Send connection request" }),
    ).toHaveCount(0);
    await expect(strangerPage.locator("body")).not.toContainText(athlete.name);
    const denied = await context(stranger, main.bookingId).then(
      () => false,
      () => true,
    );
    assert.equal(denied, true);
    const suspendedPendingBooking = await booking(coachB, stranger);
    const suspendedPending = await send(
      coachB,
      suspendedPendingBooking.bookingId,
    );
    await database`select app.review_coach_application(${coachB.actor.profileId}::uuid,'approved','suspended','Local-only suspension check.','local-test','movx-identity-application-v1')`;
    await strangerPage.reload();
    await expect(
      card(strangerPage, suspendedPending.id).getByRole("button", {
        name: "Accept connection",
      }),
    ).toHaveCount(0);
    await expect(
      card(strangerPage, suspendedPending.id).getByRole("button", {
        name: "Decline connection",
      }),
    ).toBeEnabled();
    await card(strangerPage, suspendedPending.id)
      .getByRole("button", { name: "Decline connection" })
      .click();
    await expect(feedback(strangerPage)).toHaveText(
      "Connection request declined.",
    );
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.goto(base + "/sessions");
    await expect(guestPage).toHaveURL(/\/sign-in\?/);
    await expect(
      guestPage.getByRole("heading", { name: "My coaches", exact: true }),
    ).toHaveCount(0);
    await guest.close();
    const retained = await work(athlete, (tx) =>
      connectionHistoryRecord(tx, next.pairId, { pageSize: 50 }),
    );
    assert.equal(retained.items.length, 30);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: both web interfaces explicitly consent, disconnect/reconnect and recover all 30 original history entries; athlete retry/conflict/paging/media, hidden/suspended and coach-as-athlete completed-only permissions, keyboard/mobile and unrelated isolation.",
    );
  }
} catch (error) {
  console.error("Athlete connection rehearsal failed during " + phase);
  throw error;
} finally {
  await browser?.close();
  try {
    await cleanup();
    console.log(
      "Removed only tagged DEV0223 rehearsal Auth, Storage, scheduling and connection fixtures.",
    );
  } finally {
    await database.end();
  }
}
