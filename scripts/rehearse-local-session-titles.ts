import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";
import { localConnectionRehearsal } from "./lib/local-connection-rehearsal";
import { messageCommandRecord } from "@/server/db/messages/repository";
import type { MessageThread } from "@/domain/private-messages";

const expect = baseExpect.configure({ timeout: 30000 });
const fixture = await localConnectionRehearsal("DEV0248");
const {
  base,
  person,
  work,
  approveCoach,
  booking,
  requestFixture,
  cleanup,
  database,
} = fixture;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let phase = "setup";
try {
  await cleanup();
  if (!process.argv.includes("--cleanup")) {
    const coach = await person("DEV0248 Coach"),
      athlete = await person("DEV0248 Athlete");
    await approveCoach(coach);
    const one = await booking(coach, athlete),
      two = await booking(coach, athlete);
    await requestFixture(coach, athlete, one.slotId, "accepted", one.bookingId);
    await requestFixture(coach, athlete, two.slotId, "accepted", two.bookingId);
    const [{ id: conversationId }] =
      await database`select id from app.message_conversations where coach_profile_id=${coach.actor.profileId}::uuid and athlete_profile_id=${athlete.actor.profileId}::uuid`;
    const command = (
      who: typeof coach,
      action: Parameters<typeof messageCommandRecord>[1]["action"],
      args: Record<string, unknown>,
    ) => work(who, (tx) => messageCommandRecord(tx, { action, args }));
    const thread = (await command(athlete, "thread", {
      conversationId,
    })) as MessageThread;
    const first = thread.contexts.find((c) => c.bookingId === one.bookingId)!;
    const second = thread.contexts.find((c) => c.bookingId === two.bookingId)!;
    await command(coach, "send", {
      conversationId,
      contextId: first.id,
      body: "First session coordination",
      submissionId: randomUUID(),
    });
    await command(coach, "send", {
      conversationId,
      contextId: second.id,
      body: "Second session coordination",
      submissionId: randomUUID(),
    });
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const contexts = await Promise.all(
      [coach, athlete].map(async (p) => {
        const ctx = await browser!.newContext({
          viewport: { width: 1440, height: 1000 },
        });
        await ctx.addCookies(p.cookies.map((v) => ({ ...v, url: base })));
        return ctx;
      }),
    );
    const [cp, ap] = await Promise.all(contexts.map((c) => c.newPage()));
    const errors: string[] = [];
    for (const p of [cp, ap]) p.on("pageerror", (e) => errors.push(e.message));
    const open = async (page: typeof cp) => {
      await page.goto(`${base}/messages?conversation=${conversationId}`);
      await expect(
        page.getByLabel("Show messages", { exact: true }),
      ).toBeVisible();
    };
    await open(cp);
    await open(ap);
    const details = (page: typeof cp) =>
      page.getByRole("complementary", { name: "Session details" });
    const openDetails = async (page: typeof cp) => {
      await page
        .locator(".mailbox-session-card")
        .first()
        .getByRole("button", { name: "Details", exact: true })
        .click();
    };
    phase = "shared title, keyboard save and counterpart refresh";
    await openDetails(cp);
    await openDetails(ap);
    await details(cp)
      .getByRole("button", { name: "Add title", exact: true })
      .click();
    await details(cp)
      .getByLabel("Session title", { exact: true })
      .fill("Footwork and defence");
    await details(cp)
      .getByLabel("Session title", { exact: true })
      .press("Enter");
    await expect(
      details(cp).getByRole("button", { name: "Edit title", exact: true }),
    ).toBeVisible();
    await ap.bringToFront();
    await ap.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(details(ap)).toContainText("Footwork and defence");
    console.log("Passed: " + phase);
    phase = "concurrent edit conflict preserves draft";
    await details(cp)
      .getByRole("button", { name: "Edit title", exact: true })
      .click();
    await details(cp)
      .getByLabel("Session title", { exact: true })
      .fill("Coach draft must survive");
    await details(ap)
      .getByRole("button", { name: "Edit title", exact: true })
      .click();
    await details(ap)
      .getByLabel("Session title", { exact: true })
      .fill("Athlete shared title");
    await details(ap)
      .getByRole("button", { name: "Save title", exact: true })
      .click();
    await expect(
      details(ap).getByRole("button", { name: "Edit title", exact: true }),
    ).toBeVisible();
    await details(cp)
      .getByRole("button", { name: "Save title", exact: true })
      .click();
    await expect(details(cp).getByRole("alert")).toContainText(
      "session changed",
    );
    await expect(
      details(cp).getByLabel("Session title", { exact: true }),
    ).toHaveValue("Coach draft must survive");
    await details(cp)
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    console.log("Passed: " + phase);
    phase = "title clear and explicit save failure";
    await details(ap)
      .getByRole("button", { name: "Edit title", exact: true })
      .click();
    await details(ap).getByLabel("Session title", { exact: true }).fill("");
    await details(ap)
      .getByRole("button", { name: "Save title", exact: true })
      .click();
    await expect(
      details(ap).getByRole("button", { name: "Add title", exact: true }),
    ).toBeVisible();
    await details(ap)
      .getByRole("button", { name: "Add title", exact: true })
      .click();
    await details(ap)
      .getByLabel("Session title", { exact: true })
      .fill("Footwork and defence");
    await ap.route("**/api/messages", async (route) => {
      if (route.request().postDataJSON()?.action === "session-title")
        await route.fulfill({ status: 503, json: { status: "unavailable" } });
      else await route.continue();
    });
    await details(ap)
      .getByRole("button", { name: "Save title", exact: true })
      .click();
    await expect(details(ap).getByRole("alert")).toContainText(
      "could not be saved",
    );
    await expect(
      details(ap).getByLabel("Session title", { exact: true }),
    ).toHaveValue("Footwork and defence");
    await ap.unroute("**/api/messages");
    await details(ap)
      .getByRole("button", { name: "Save title", exact: true })
      .click();
    await expect(
      details(ap).getByRole("button", { name: "Edit title", exact: true }),
    ).toBeVisible();
    await details(ap)
      .getByRole("button", { name: "Close session details" })
      .click();
    console.log("Passed: " + phase);
    phase =
      "session filter, draft safety, unavailable recovery and unread isolation";
    await ap
      .locator(".mailbox-session-card")
      .first()
      .getByRole("button", { name: "Show messages for this session" })
      .click();
    await expect(ap.getByLabel("Show messages", { exact: true })).toHaveValue(
      first.id,
    );
    await expect(
      ap.getByText("First session coordination", { exact: true }),
    ).toBeVisible();
    await expect(
      ap.getByText("Second session coordination", { exact: true }),
    ).toHaveCount(0);
    await expect(ap.locator(".mailbox-selected-session")).toContainText(
      "Footwork and defence",
    );
    const body = ap.getByLabel("Message to DEV0248 Coach");
    await body.fill("Draft stays with first session");
    await ap
      .getByLabel("Show messages", { exact: true })
      .selectOption(second.id);
    await expect(ap.getByLabel("Show messages", { exact: true })).toHaveValue(
      first.id,
    );
    await expect(body).toHaveValue("Draft stays with first session");
    await body.fill("");
    phase = "uncertain filtered send retains its exact context and submission";
    let lost = false;
    await ap.route("**/api/messages", async (route) => {
      if (!lost && route.request().postDataJSON()?.action === "send") {
        lost = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await body.fill("One saved message for the selected session");
    await ap.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      ap.getByRole("button", { name: "Retry same message", exact: true }),
    ).toBeVisible();
    await expect(
      ap.getByLabel("Show messages", { exact: true }),
    ).toBeDisabled();
    await expect(body).toHaveValue(
      "One saved message for the selected session",
    );
    await ap.unroute("**/api/messages");
    await ap
      .getByRole("button", { name: "Retry same message", exact: true })
      .click();
    await expect(body).toHaveValue("");
    const [copies] =
      await database`select count(*)::int n,min(context_id::text) context from app.message_entries where conversation_id=${conversationId}::uuid and body='One saved message for the selected session'`;
    assert.equal(copies.n, 1);
    assert.equal(copies.context, first.id);
    console.log("Passed: " + phase);
    phase = "filtered arrival, failure recovery and unread isolation";
    const before = (await command(athlete, "thread", {
      conversationId,
    })) as MessageThread;
    await command(coach, "send", {
      conversationId,
      contextId: second.id,
      body: "Hidden incoming session message",
      submissionId: randomUUID(),
    });
    await ap.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      ap.getByText("Hidden incoming session message", { exact: true }),
    ).toHaveCount(0);
    const after = (await command(athlete, "thread", {
      conversationId,
    })) as MessageThread;
    assert.equal(after.readThrough, before.readThrough);
    assert.equal(after.conversation.unread, true);
    await ap.route("**/api/messages?conversationId=**", (route) =>
      route.abort("failed"),
    );
    await ap.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      ap.getByRole("alert").filter({ hasText: "Messages are unavailable" }),
    ).toBeVisible();
    await ap.unroute("**/api/messages?conversationId=**");
    await ap
      .getByRole("button", { name: "Refresh conversation", exact: true })
      .click();
    await expect(
      ap.getByRole("alert").filter({ hasText: "Messages are unavailable" }),
    ).toHaveCount(0);
    await ap.getByRole("button", { name: "All messages", exact: true }).click();
    await expect(
      ap.getByText("Hidden incoming session message", { exact: true }),
    ).toBeVisible();
    console.log("Passed: " + phase);
    phase = "both booking surfaces, mobile and desktop";
    const folder = "test-results/session-titles-rehearsal";
    await mkdir(folder, { recursive: true });
    await ap
      .getByLabel("Show messages", { exact: true })
      .selectOption(first.id);
    await expect(
      ap.getByText("First session coordination", { exact: true }),
    ).toBeVisible();
    await expect(
      ap.getByText("Loading session messages…", { exact: true }),
    ).toHaveCount(0);
    await ap.evaluate(() => window.scrollTo(0, 0));
    await ap.screenshot({ path: `${folder}/desktop.png`, fullPage: true });
    for (const page of [cp, ap]) {
      await page.setViewportSize({ width: 375, height: 812 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.getByLabel("Show messages", { exact: true }).focus();
      await page.keyboard.press("Tab");
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await ap.screenshot({ path: `${folder}/mobile.png`, fullPage: true });
    await ap.goto(base + "/sessions");
    await cp.goto(base + "/coach?view=bookings");
    for (const [page, id] of [
      [ap, `athlete-booking-${one.bookingId}`],
      [cp, `coach-booking-${one.bookingId}`],
    ] as const) {
      const card = page.locator(`[id="${id}"]`);
      await expect(card).toContainText("Footwork and defence");
      await expect(
        card.getByRole("button", { name: "Edit title", exact: true }),
      ).toBeVisible();
      await card
        .getByRole("button", { name: "Edit title", exact: true })
        .click();
      await card
        .getByLabel("Session title", { exact: true })
        .fill("Mobile keyboard draft");
      await page.keyboard.press("Tab");
      await card.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(card).toContainText("Footwork and defence");
    }
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
