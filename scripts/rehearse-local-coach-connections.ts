import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { localConnectionRehearsal } from "./lib/local-connection-rehearsal";

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
} = await localConnectionRehearsal("DEV0222");
const evidence = "test-results/coach-connections-rehearsal";
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let phase = "setup";

async function historyIds(page: Page, attemptId: string) {
  const card = page.locator(
    `.coach-connection-card[data-connection-id="${attemptId}"]`,
  );
  await card
    .getByRole("button", { name: "View shared history", exact: true })
    .click();
  await expect(card.locator("[data-history-id]").first()).toBeVisible();
  await expect(
    card.getByRole("button", { name: "View shared history", exact: true }),
  ).toBeEnabled();
  while (
    await card
      .getByRole("button", { name: "Load older shared history" })
      .count()
  ) {
    const count = await card.locator("[data-history-id]").count();
    await card
      .getByRole("button", { name: "Load older shared history" })
      .click();
    await expect
      .poll(() => card.locator("[data-history-id]").count())
      .toBeGreaterThan(count);
    await expect(
      card.getByRole("button", { name: "View shared history", exact: true }),
    ).toBeEnabled();
    await expect(card.locator("[data-history-id]").nth(count)).toBeFocused();
  }
  return card.locator("[data-history-id]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute("data-history-id"),
      requestId: node.getAttribute("data-request-id"),
      bookingId: node.getAttribute("data-booking-id"),
      text: node.textContent,
    })),
  );
}

try {
  await cleanup();
  if (!process.argv.includes("--cleanup")) {
    phase = "prepare private, tagged Auth and history fixtures";
    const coach = await person("DEV0222 Coach"),
      athlete = await person("DEV0222 Amina"),
      other = await person("DEV0222 Bao"),
      cancelledOnly = await person("DEV0222 Cancelled");
    await approveCoach(coach);
    const main = await booking(coach, athlete),
      otherBooking = await booking(coach, other),
      cancelled = await booking(coach, cancelledOnly);
    await work(cancelledOnly, (tx) =>
      cancelDirectPrivateBookingRecord(tx, cancelled.bookingId),
    );
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
    for (const terminal of ["expired", "not-selected", "occurrence-closed"])
      wanted.add(await requestFixture(coach, athlete, main.slotId, terminal));
    const historicalCancellation = await booking(coach, athlete);
    wanted.add(
      await requestFixture(
        coach,
        athlete,
        historicalCancellation.slotId,
        "accepted",
        historicalCancellation.bookingId,
      ),
    );
    await work(athlete, (tx) =>
      cancelDirectPrivateBookingRecord(tx, historicalCancellation.bookingId),
    );
    const completed = await booking(coach, athlete);
    wanted.add(completed.bookingId);
    await database`update app.coach_private_bookings set status='completed',created_at=statement_timestamp()-interval '3 hours',scheduled_start_at=statement_timestamp()-interval '2 hours',scheduled_end_at=statement_timestamp()-interval '1 hour',early_return_until=statement_timestamp()-interval '2 hours',hold_expires_at=statement_timestamp()-interval '119 minutes',completed_at=statement_timestamp() where id=${completed.bookingId}::uuid`;
    const image = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 40, g: 95, b: 50 },
      },
    })
      .webp()
      .toBuffer();
    const uploaded = await fetch(base + "/api/profile/avatar", {
      method: "POST",
      headers: {
        origin: base,
        cookie: cookieHeader(athlete),
        "content-type": "image/webp",
      },
      body: image,
    });
    assert.equal(uploaded.status, 200);
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1040 },
    });
    await context.addCookies(
      coach.cookies.map((cookie) => ({
        ...cookie,
        url: base,
        sameSite: "Lax" as const,
      })),
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await mkdir(evidence, { recursive: true });
    phase = "coach sends, withdraws, and receives explicit athlete consent";
    await page.goto(base + "/coach?view=bookings");
    await expect(
      page.getByRole("heading", { name: "My athletes", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#my-athletes")).toContainText(
      "No connected athletes yet",
    );
    const mainCard = page.locator(`#coach-booking-${main.bookingId}`);
    await mainCard
      .getByRole("button", { name: "Connection options", exact: true })
      .click();
    const sendBodies: string[][] = [];
    page.on("request", (request) => {
      const body = request.postData();
      if (request.method() === "POST" && body?.includes("operationId")) {
        sendBodies.push(
          body.match(
            /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
          ) ?? [],
        );
      }
    });
    await page.route("**/coach?view=bookings", async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    await mainCard
      .getByRole("button", { name: "Send connection request", exact: true })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toContainText(
      "could not verify",
    );
    await page.unroute("**/coach?view=bookings");
    await mainCard
      .getByRole("button", { name: "Send connection request", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Connection request pending acceptance." }),
    ).toBeVisible();
    assert.equal(sendBodies.length, 2);
    assert.ok(sendBodies[0].length >= 2);
    assert.deepEqual(
      sendBodies[1],
      sendBodies[0],
      "A network retry must keep the same connection operation UUID.",
    );
    const first = (
      await work(coach, (tx) =>
        bookingConnectionContextRecord(tx, main.bookingId),
      )
    ).connection!;
    await page
      .locator(`.coach-connection-card[data-connection-id="${first.id}"]`)
      .getByRole("button", { name: "Withdraw request" })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toHaveText(
      "Connection request withdrawn.",
    );
    await mainCard
      .getByRole("button", { name: "Connection options", exact: true })
      .click();
    await mainCard
      .getByRole("button", { name: "Request reconnection" })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toHaveText(
      "Connection request pending acceptance.",
    );
    const pending = (
      await work(coach, (tx) =>
        bookingConnectionContextRecord(tx, main.bookingId),
      )
    ).connection!;
    await decide(athlete, pending.id, "accept");
    await page
      .getByRole("button", { name: "Refresh connections", exact: true })
      .click();
    await expect(
      page.locator(
        `[aria-label="My athletes"] .coach-connection-card[data-connection-id="${pending.id}"]`,
      ),
    ).toBeVisible();
    await expect(
      page.locator(`[data-connection-id="${pending.id}"] .avatar img`),
    ).toBeVisible();
    const original = await historyIds(page, pending.id);
    assert.deepEqual(new Set(original.map((row) => row.id)), wanted);
    assert.equal(original.length, wanted.size);
    assert.equal(
      original.filter((row) => row.bookingId === main.bookingId).length,
      1,
    );
    await page.screenshot({
      path: evidence + "/desktop-history.png",
      fullPage: true,
    });
    await page
      .getByRole("heading", { name: "My athletes", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: evidence + "/desktop-viewport.png" });

    phase = "either-side disconnect and fresh history recovery";
    let acceptedCard = page.locator(
      `.coach-connection-card[data-connection-id="${pending.id}"]`,
    );
    await acceptedCard
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    await expect(
      acceptedCard.getByRole("button", { name: "Stay connected" }),
    ).toBeFocused();
    await acceptedCard
      .getByRole("button", { name: "Confirm disconnect" })
      .click();
    await expect(
      page.locator(`[aria-label="My athletes"] .coach-connection-card`),
    ).toHaveCount(0);
    await expect(page.locator(".coach-connection-history")).toHaveCount(0);
    await expect(page.locator(".coach-connection-feedback")).toHaveText(
      "Disconnected. Shared history is retained.",
    );
    await expect(page.locator(".coach-connection-feedback")).toBeFocused();
    await mainCard
      .getByRole("button", { name: "Connection options", exact: true })
      .click();
    await expect(
      mainCard.getByRole("button", { name: "Request reconnection" }),
    ).toBeEnabled();
    const inbound = await send(athlete, main.bookingId);
    await mainCard
      .getByRole("button", { name: "Request reconnection" })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toHaveText(
      "Connection request pending acceptance.",
    );
    await expect(
      page.locator(`[aria-label="My athletes"] .coach-connection-card`),
    ).toHaveCount(0);
    await page
      .locator(`.coach-connection-card[data-connection-id="${inbound.id}"]`)
      .getByRole("button", { name: "Accept connection" })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toHaveText(
      "Connected.",
    );
    const recovered = await historyIds(page, inbound.id);
    assert.deepEqual(recovered, original);
    await decide(athlete, inbound.id, "disconnect");
    await page
      .getByRole("button", { name: "Refresh connections", exact: true })
      .click();
    await expect(page.locator(".coach-connection-history")).toHaveCount(0);
    const again = await send(athlete, main.bookingId);
    await page
      .getByRole("button", { name: "Refresh connections", exact: true })
      .click();
    await page
      .locator(`.coach-connection-card[data-connection-id="${again.id}"]`)
      .getByRole("button", { name: "Accept connection" })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toHaveText(
      "Connected.",
    );
    await page.reload();
    assert.deepEqual(await historyIds(page, again.id), original);

    phase =
      "conflicting cancellation, decline, media fallback and safe suspension";
    const declined = await send(other, otherBooking.bookingId);
    await page
      .getByRole("button", { name: "Refresh connections", exact: true })
      .click();
    const declineCard = page.locator(
      `.coach-connection-card[data-connection-id="${declined.id}"]`,
    );
    await declineCard
      .getByRole("button", { name: "Decline connection" })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toHaveText(
      "Connection request declined.",
    );
    const stale = await send(other, otherBooking.bookingId);
    await page
      .getByRole("button", { name: "Refresh connections", exact: true })
      .click();
    await expect(
      page
        .locator(`[data-connection-id="${stale.id}"]`)
        .getByRole("button", { name: "Accept connection" }),
    ).toBeEnabled();
    await work(other, (tx) =>
      cancelDirectPrivateBookingRecord(tx, otherBooking.bookingId),
    );
    await page
      .locator(`.coach-connection-card[data-connection-id="${stale.id}"]`)
      .getByRole("button", { name: "Accept connection" })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toContainText(
      "no longer qualifies",
    );
    await expect(
      page
        .locator(`[data-connection-id="${stale.id}"]`)
        .getByRole("button", { name: "Accept connection" }),
    ).toHaveCount(0);
    await expect(
      page.locator(
        `#coach-booking-${otherBooking.bookingId} .coach-booking-status`,
      ),
    ).toHaveText("cancelled");
    await page
      .locator(`[data-connection-id="${stale.id}"]`)
      .getByRole("button", { name: "Decline connection", exact: true })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toHaveText(
      "Connection request declined.",
    );
    assert.equal(
      (
        await work(coach, (tx) =>
          bookingConnectionContextRecord(tx, otherBooking.bookingId),
        )
      ).connection?.status,
      "declined",
    );
    const cancelledCard = page.locator(`#coach-booking-${cancelled.bookingId}`);
    await cancelledCard
      .getByRole("button", { name: "Connection options", exact: true })
      .click();
    await expect(
      cancelledCard.getByRole("button", { name: "Send connection request" }),
    ).toHaveCount(0);
    await page.route("**/api/connections/**/athlete-avatar**", (route) =>
      route.abort(),
    );
    await page.reload();
    acceptedCard = page.locator(
      `[aria-label="My athletes"] [data-connection-id="${again.id}"]`,
    );
    await expect(acceptedCard.locator(".avatar img")).toHaveCount(0);
    await expect(acceptedCard.locator(".avatar")).toHaveText("DA");
    await page.unroute("**/api/connections/**/athlete-avatar**");

    phase = "accepted list pagination, keyboard and mobile";
    for (let n = 0; n < 21; n++) {
      const additional = await person(
        `DEV0222 Athlete ${String(n + 1).padStart(2, "0")}`,
      );
      const b = await booking(coach, additional),
        p = await send(additional, b.bookingId);
      await decide(coach, p.id, "accept");
    }
    await page.reload();
    await expect(
      page.locator(`[aria-label="My athletes"] .coach-connection-card`),
    ).toHaveCount(20);
    await page.route("**/coach?view=bookings", async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    await page
      .getByRole("button", { name: "Load more athletes", exact: true })
      .click();
    await expect(page.locator(`[aria-label="My athletes"]`)).toContainText(
      "could not be verified",
    );
    await expect(
      page.locator(`[aria-label="My athletes"] .coach-connection-card`),
    ).toHaveCount(0);
    await page.unroute("**/coach?view=bookings");
    await page
      .getByRole("button", { name: "Retry my athletes", exact: true })
      .click();
    await expect(
      page.locator(`[aria-label="My athletes"] .coach-connection-card`),
    ).toHaveCount(20);
    await expect(
      page.getByRole("button", { name: "Load more athletes", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Load more athletes", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.locator(`[aria-label="My athletes"] .coach-connection-card`),
    ).toHaveCount(22);
    await expect(
      page.locator(`[aria-label="My athletes"] .coach-connection-card`).nth(20),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Load more athletes" }),
    ).toHaveCount(0);
    const ids = await page
      .locator(`[aria-label="My athletes"] .coach-connection-card`)
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-connection-id")),
      );
    assert.equal(new Set(ids).size, 22);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("link", { name: "My athletes", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My athletes", exact: true }),
    ).toBeVisible();
    const headingTop = await page
      .getByRole("heading", { name: "My athletes", exact: true })
      .evaluate((node) => node.getBoundingClientRect().top);
    assert.ok(headingTop >= 72, "The mobile shortcut clears the fixed header.");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: evidence + "/mobile-athletes.png",
      fullPage: true,
    });
    await page
      .getByRole("heading", { name: "My athletes", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: evidence + "/mobile-viewport.png" });
    await database`select app.review_coach_application(${coach.actor.profileId}::uuid,'approved','suspended','Local-only suspension check.','local-test','movx-identity-application-v1')`;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "New coaching activity is paused." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Accept connection" }),
    ).toHaveCount(0);
    await expect(
      page.locator(`[aria-label="My athletes"] .coach-connection-card`),
    ).toHaveCount(20);
    await page.getByRole("button", { name: "Load more athletes" }).click();
    assert.deepEqual(await historyIds(page, again.id), original);
    await page.screenshot({
      path: evidence + "/mobile-suspended-history.png",
      fullPage: true,
    });
    const strangerContext = await browser.newContext();
    await strangerContext.addCookies(
      other.cookies.map((cookie) => ({
        ...cookie,
        url: base,
        sameSite: "Lax" as const,
      })),
    );
    const strangerPage = await strangerContext.newPage();
    await strangerPage.goto(base + "/coach?view=bookings");
    await expect(
      strangerPage.getByRole("heading", { name: "My athletes", exact: true }),
    ).toHaveCount(0);
    await expect(strangerPage.locator("body")).not.toContainText(athlete.name);
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(base + "/coach?view=bookings");
    await expect(guestPage).toHaveURL(/\/sign-in\?/);
    await expect(
      guestPage.getByRole("heading", { name: "My athletes", exact: true }),
    ).toHaveCount(0);
    await strangerContext.close();
    await guestContext.close();
    assert.deepEqual(errors, []);
    const ownerHistory = await work(athlete, (tx) =>
      connectionHistoryRecord(tx, again.pairId, { pageSize: 50 }),
    );
    assert.equal(ownerHistory.items.length, wanted.size);
    console.log(
      "PASS: real coach UI consent/withdraw/decline, both-side reconnect with all original paged history, cancellation conflict, accepted pagination, avatar fallback, keyboard/mobile and suspended safe access.",
    );
  }
} catch (error) {
  console.error("Coach connection rehearsal failed during " + phase);
  throw error;
} finally {
  await browser?.close();
  try {
    await cleanup();
    console.log(
      "Removed only tagged DEV0222 rehearsal Auth, Storage, scheduling and connection fixtures.",
    );
  } finally {
    await database.end();
  }
}
