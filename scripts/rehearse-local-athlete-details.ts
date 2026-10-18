import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";
import sharp from "sharp";
import { localConnectionRehearsal } from "./lib/local-connection-rehearsal";
import { completeDirectPrivateBookingRecord } from "@/server/db/coaches/booking-repository";
import { PROFILE_IMAGE_DIMENSION } from "@/profile-images/contracts";

const expect = baseExpect.configure({ timeout: 30000 });
const fixture = await localConnectionRehearsal("DEV0250");
const {
  base,
  database,
  person,
  work,
  approveCoach,
  booking,
  send,
  decide,
  cleanup,
  cookieHeader,
} = fixture;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let phase = "setup";
try {
  await cleanup();
  if (!process.argv.includes("--cleanup")) {
    const coach = await person("DEV0250 Coach"),
      athlete = await person("DEV0250 Athlete"),
      other = await person("DEV0250 Other");
    await approveCoach(coach);
    const completed = await booking(coach, athlete),
      upcoming = await booking(coach, athlete);
    await database`update app.coach_private_bookings set created_at=statement_timestamp()-interval '3 hours',scheduled_start_at=statement_timestamp()-interval '2 hours',scheduled_end_at=statement_timestamp()-interval '1 hour',early_return_until=statement_timestamp()-interval '2 hours',hold_expires_at=statement_timestamp()-interval '119 minutes' where id=${completed.bookingId}::uuid`;
    await work(coach, (tx) =>
      completeDirectPrivateBookingRecord(tx, completed.bookingId),
    );
    const request = await send(coach, upcoming.bookingId);
    const accepted = await decide(athlete, request.id, "accept");
    const image = await sharp(
      await readFile("public/images/coaches/daniel-park.webp"),
    )
      .resize(PROFILE_IMAGE_DIMENSION, PROFILE_IMAGE_DIMENSION)
      .webp()
      .toBuffer();
    const upload = await fetch(base + "/api/profile/avatar", {
      method: "POST",
      headers: {
        origin: base,
        "content-type": "image/webp",
        cookie: cookieHeader(athlete),
      },
      body: new Uint8Array(image),
    });
    assert.equal(upload.status, 200);
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const contexts = await Promise.all(
      [coach, athlete, other].map(async (p) => {
        const context = await browser!.newContext({
          viewport: { width: 1440, height: 1000 },
        });
        await context.addCookies(p.cookies.map((c) => ({ ...c, url: base })));
        return context;
      }),
    );
    const [cp, ap, op] = await Promise.all(contexts.map((c) => c.newPage()));
    const errors: string[] = [];
    cp.on("pageerror", (e) => errors.push(e.message));
    const href = `/coach/athletes/${accepted.pairId}`;
    const cards = () => cp.locator("#client-bookings .coach-client-card");
    phase = "mixed booking statuses load the same actual private image";
    await cp.goto(base + "/coach?view=bookings");
    await expect(cards()).toHaveCount(2);
    await expect.poll(() => cards().locator("img").count()).toBe(2);
    await expect
      .poll(() =>
        cards()
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    const urls = await cards()
      .locator("img")
      .evaluateAll((images) => images.map((img) => img.getAttribute("src")));
    assert.equal(new Set(urls).size, 1);
    assert.ok(
      urls[0]?.startsWith(`/api/connections/${accepted.id}/athlete-avatar`),
    );
    await expect(
      cards().getByRole("link", {
        name: "View DEV0250 Athlete’s athlete details",
      }),
    ).toHaveCount(2);
    console.log("Passed: " + phase);
    phase = "photo/name, My athletes and message navigation";
    await cards()
      .first()
      .getByRole("link", { name: "View DEV0250 Athlete’s athlete details" })
      .locator(".avatar")
      .click();
    await expect(cp).toHaveURL(base + href);
    await expect(
      cp.getByRole("heading", {
        name: "DEV0250 Athlete",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await expect(cards()).toHaveCount(2);
    await expect(
      cp.getByRole("link", { name: "Message athlete", exact: true }),
    ).toHaveAttribute("href", `/messages?pair=${accepted.pairId}`);
    await cp
      .getByRole("link", { name: "Message athlete", exact: true })
      .click();
    await expect(
      cp.getByRole("heading", {
        name: "DEV0250 Athlete",
        exact: true,
        level: 2,
      }),
    ).toBeVisible();
    await cp.goto(base + "/coach/athletes");
    await cp
      .locator("#my-athletes")
      .getByRole("link", { name: "View DEV0250 Athlete’s athlete details" })
      .click();
    await expect(cp).toHaveURL(base + href);
    console.log("Passed: " + phase);
    phase = "guest, unrelated and athlete-side denial";
    for (const p of [ap, op]) {
      await p.goto(base + href);
      await expect(
        p.getByRole("heading", { name: "DEV0250 Athlete", exact: true }),
      ).toHaveCount(0);
      await expect(p.locator(".private-athlete-detail")).toHaveCount(0);
    }
    const guest = await browser.newContext();
    const gp = await guest.newPage();
    await gp.goto(base + href);
    await expect(gp).toHaveURL(new RegExp("/sign-in\\?returnTo="));
    await guest.close();
    await op.goto(base + "/coach/athletes/not-an-id");
    await expect(op.locator(".private-athlete-detail")).toHaveCount(0);
    console.log("Passed: " + phase);
    phase = "desktop/mobile, keyboard and image failure fallback";
    const evidence = "test-results/athlete-details-rehearsal";
    await mkdir(evidence, { recursive: true });
    await cp.screenshot({ path: evidence + "/desktop.png", fullPage: true });
    await cp.setViewportSize({ width: 375, height: 812 });
    assert.equal(
      await cp.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const back = cp.getByRole("link", {
      name: "Back to My athletes",
      exact: true,
    });
    await back.focus();
    await cp.keyboard.press("Enter");
    await expect(cp).toHaveURL(base + "/coach/athletes");
    await cp
      .locator("#my-athletes")
      .getByRole("link", { name: "View DEV0250 Athlete’s athlete details" })
      .click();
    await expect(
      cp.getByRole("heading", {
        name: "DEV0250 Athlete",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await cp.evaluate(() => window.scrollTo(0, 0));
    await cp.screenshot({ path: evidence + "/mobile.png", fullPage: true });
    await cp.route("**/api/connections/*/athlete-avatar?*", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await cp.reload();
    await expect(cards().locator("img")).toHaveCount(0);
    await expect(cards().first().locator(".avatar")).toHaveText("DA");
    await expect(
      cards()
        .first()
        .getByRole("link", { name: "View DEV0250 Athlete’s athlete details" }),
    ).toBeVisible();
    await cp.unroute("**/api/connections/*/athlete-avatar?*");
    console.log("Passed: " + phase);
    phase =
      "removal revokes private detail/media and preserves confirmed-booking permission";
    await decide(athlete, accepted.id, "disconnect");
    await cp.reload();
    await expect(cp.locator(".private-athlete-detail")).toHaveCount(0);
    assert.equal((await cp.request.get(base + urls[0]!)).status(), 404);
    await cp.goto(base + "/coach?view=bookings");
    const endedCard = cp.locator(`[id="coach-booking-${completed.bookingId}"]`),
      futureCard = cp.locator(`[id="coach-booking-${upcoming.bookingId}"]`);
    await expect(
      endedCard.getByRole("link", {
        name: "View DEV0250 Athlete’s athlete details",
      }),
    ).toHaveCount(0);
    await expect(endedCard.locator("img")).toHaveCount(0);
    await expect.poll(() => futureCard.locator("img").count()).toBe(1);
    await expect(futureCard.locator("img")).toHaveAttribute(
      "src",
      new RegExp(`/api/coach/bookings/${upcoming.bookingId}/client-avatar`),
    );
    const fresh = await send(coach, upcoming.bookingId);
    const restored = await decide(athlete, fresh.id, "accept");
    assert.equal(restored.pairId, accepted.pairId);
    await cp.goto(base + href);
    await expect(
      cp.getByRole("heading", {
        name: "DEV0250 Athlete",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await expect(cards()).toHaveCount(2);
    assert.deepEqual(errors, []);
    console.log("Passed: " + phase);
  }
} catch (e) {
  console.error("Failed phase: " + phase);
  throw e;
} finally {
  await browser?.close();
  await cleanup();
  await database.end({ timeout: 1 });
}
