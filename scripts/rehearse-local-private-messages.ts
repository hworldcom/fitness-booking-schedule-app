import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";
import postgres from "postgres";
import { localConnectionRehearsal } from "./lib/local-connection-rehearsal";
import { localDateTimeValue } from "@/domain/coaches";
import { createOwnedCoachAvailabilityRecord } from "@/server/db/coaches/availability-repository";
import {
  createCoachBookingRequestRecord,
  acceptCoachBookingRequestRecord,
} from "@/server/db/coaches/booking-request-repository";
const expect = baseExpect.configure({ timeout: 30000 });
const fixture = await localConnectionRehearsal("DEV0247");
const { base, database, person, work, approveCoach, cleanup, cookieHeader } =
  fixture;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let phase = "setup";
const evidence = "test-results/private-messages-rehearsal";
try {
  await cleanup();
  if (!process.argv.includes("--cleanup")) {
    const coach = await person("DEV0247 Coach"),
      athlete = await person("DEV0247 Athlete"),
      stranger = await person("DEV0247 Stranger");
    await approveCoach(coach);
    await database`update app.coach_profiles set visibility='visible' where profile_id=${coach.actor.profileId}::uuid`;
    const [profile] =
      await database`select slug from app.profiles where id=${coach.actor.profileId}::uuid`;
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const contexts = await Promise.all(
      [coach, athlete, stranger].map(async (p) => {
        const context = await browser!.newContext({
          viewport: { width: 1440, height: 1000 },
        });
        await context.addCookies(p.cookies.map((v) => ({ ...v, url: base })));
        return context;
      }),
    );
    const coachPage = await contexts[0].newPage(),
      athletePage = await contexts[1].newPage();
    const errors: string[] = [];
    for (const page of [coachPage, athletePage])
      page.on("pageerror", (e) => errors.push(e.message));
    console.log("Completed phase: " + phase);
    phase = "receiving inbox open before any inquiry";
    await coachPage.bringToFront();
    await coachPage.goto(base + "/messages");
    await expect(
      coachPage.getByRole("heading", { name: "Your conversations start here" }),
    ).toBeVisible();
    console.log("Completed phase: " + phase);
    phase = "guest sign-in returns to composition and sends nothing";
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.goto(base + `/coaches/${profile.slug}`);
    await guestPage
      .getByRole("link", { name: "Message coach", exact: true })
      .click();
    await expect(guestPage).toHaveURL(/sign-in\?returnTo=/);
    await guest.close();
    console.log("Completed phase: " + phase);
    phase = "athlete pre-request inquiry and literal text";
    await athletePage.bringToFront();
    await athletePage.goto(base + `/coaches/${profile.slug}`);
    await athletePage
      .getByRole("link", { name: "Message coach", exact: true })
      .click();
    await athletePage
      .getByLabel("Your question")
      .fill("Can we practise footwork? <script>literal text</script>");
    await athletePage
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      athletePage.getByText(
        "Can we practise footwork? <script>literal text</script>",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(athletePage).toHaveURL(/conversation=/);
    const conversationId = new URL(athletePage.url()).searchParams.get(
      "conversation",
    );
    assert.ok(conversationId);
    console.log("Completed phase: " + phase);
    phase = "already-open receiving inbox refreshes on focus";
    await coachPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await coachPage.getByRole("button", { name: /DEV0247 Athlete/ }).click();
    await expect(
      coachPage.getByText(
        "Can we practise footwork? <script>literal text</script>",
        { exact: true },
      ),
    ).toBeVisible();
    console.log("Completed phase: " + phase);
    phase = "service reply and soft refresh preserve draft and focus";
    const body = coachPage.getByLabel("Message to DEV0247 Athlete");
    await body.fill("Yes, let’s start with balance.");
    await coachPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(body).toHaveValue("Yes, let’s start with balance.");
    await expect(body).toBeFocused();
    await coachPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      coachPage.getByText("Message sent.", { exact: true }),
    ).toBeVisible();
    await athletePage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      athletePage.getByText("Yes, let’s start with balance.", { exact: true }),
    ).toBeVisible();
    console.log("Completed phase: " + phase);
    phase = "30-second visible-page polling without a focus event";
    await coachPage.bringToFront();
    const readResponse = await fetch(
      `${base}/api/messages?conversationId=${conversationId}`,
      { headers: { cookie: cookieHeader(athlete) } },
    );
    const savedThread = (await readResponse.json()).value;
    const inquiryId = savedThread.contexts.find(
      (c: { kind: string }) => c.kind === "inquiry",
    ).id;
    const posted = await fetch(base + "/api/messages", {
      method: "POST",
      headers: {
        origin: base,
        "content-type": "application/json",
        cookie: cookieHeader(athlete),
      },
      body: JSON.stringify({
        action: "send",
        args: {
          conversationId,
          contextId: inquiryId,
          body: "Visible-page polling delivery",
          submissionId: randomUUID(),
        },
      }),
    });
    assert.equal(posted.status, 200);
    await expect(
      coachPage.getByText("Visible-page polling delivery", { exact: true }),
    ).toBeVisible({ timeout: 35000 });
    console.log("Completed phase: " + phase);
    phase = "hidden-page polling pauses and visibility restoration resumes";
    let hiddenReads = 0;
    const track = (request: { method: () => string; url: () => string }) => {
      if (request.method() === "GET" && request.url().includes("/api/messages"))
        hiddenReads++;
    };
    coachPage.on("request", track);
    await coachPage.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const beforeHidden = hiddenReads;
    await coachPage.waitForTimeout(31000);
    assert.equal(hiddenReads, beforeHidden);
    await coachPage.evaluate(() => {
      delete (document as unknown as { visibilityState?: string })
        .visibilityState;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => hiddenReads).toBeGreaterThan(beforeHidden);
    coachPage.off("request", track);
    console.log("Completed phase: " + phase);
    phase = "uncertain send preserves draft and retries one committed message";
    let lost = false;
    await coachPage.route("**/api/messages", async (route) => {
      const request = route.request();
      if (
        request.method() === "POST" &&
        request.postDataJSON()?.action === "send" &&
        !lost
      ) {
        lost = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await body.fill("One message despite a lost acknowledgement");
    await coachPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      coachPage.getByRole("button", {
        name: "Retry same message",
        exact: true,
      }),
    ).toBeVisible();
    await expect(body).toHaveValue(
      "One message despite a lost acknowledgement",
    );
    await coachPage
      .getByRole("button", { name: "Retry same message", exact: true })
      .click();
    await expect(body).toHaveValue("");
    await coachPage.unroute("**/api/messages");
    const [copies] =
      await database`select count(*) n from app.message_entries where conversation_id=${conversationId}::uuid and body='One message despite a lost acknowledgement'`;
    assert.equal(Number(copies.n), 1);
    console.log("Completed phase: " + phase);
    phase = "failed soft read is explicit and keeps the draft";
    await body.fill("Draft survives a temporary read failure");
    await coachPage.route("**/api/messages?conversationId=*", (route) =>
      route.abort("failed"),
    );
    await coachPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      coachPage
        .getByRole("alert")
        .filter({ hasText: "Messages are unavailable" }),
    ).toBeVisible();
    await expect(body).toHaveValue("Draft survives a temporary read failure");
    await coachPage.unroute("**/api/messages?conversationId=*");
    await coachPage
      .getByRole("button", { name: "Refresh conversation", exact: true })
      .click();
    await expect(
      coachPage
        .getByRole("alert")
        .filter({ hasText: "Messages are unavailable" }),
    ).toHaveCount(0);
    await body.fill("");
    console.log("Completed phase: " + phase);
    phase = "original request and acceptance cards";
    const slot = await work(coach, (tx) =>
      createOwnedCoachAvailabilityRecord(tx, {
        localStart: localDateTimeValue(
          new Date(Math.ceil((Date.now() + 48 * 3600000) / 900000) * 900000),
          "Europe/Berlin",
        ),
        durationMinutes: 60,
        refreshLocation: false,
      }),
    );
    const request = await work(athlete, (tx) =>
      createCoachBookingRequestRecord(tx, slot),
    );
    await coachPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      coachPage.getByText("Awaiting coach confirmation", { exact: true }),
    ).toBeVisible();
    await coachPage
      .getByRole("button", { name: "Details", exact: true })
      .click();
    await expect(
      coachPage.getByRole("complementary", { name: "Session details" }),
    ).toContainText("Decision deadline");
    const accepted = await work(coach, (tx) =>
      acceptCoachBookingRequestRecord(tx, request.requestId),
    );
    assert.ok(accepted.bookingId);
    await coachPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      coachPage.getByRole("complementary", { name: "Session details" }),
    ).toContainText("Confirmed");
    console.log("Completed phase: " + phase);
    phase = "general-message consent remains explicit in both browsers";
    await coachPage.getByLabel("Message context").selectOption("general");
    await body.fill("Can we share training ideas?");
    await coachPage
      .getByRole("button", { name: "Request messages", exact: true })
      .click();
    await expect(
      coachPage.getByText("Your message request is awaiting a decision", {
        exact: true,
      }),
    ).toBeVisible();
    await athletePage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await athletePage
      .getByRole("button", { name: "Accept messages", exact: true })
      .click();
    await expect(
      athletePage.getByRole("button", { name: "Accept messages", exact: true }),
    ).toHaveCount(0);
    await coachPage.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(body).toBeEnabled();
    const response = await fetch(
      `${base}/api/messages?conversationId=${conversationId}`,
      { headers: { cookie: cookieHeader(stranger) } },
    );
    assert.equal(response.status, 409);
    assert.equal(
      (
        await fetch(base + "/api/messages", {
          method: "POST",
          headers: {
            origin: "https://unrelated.invalid",
            "content-type": "application/json",
            cookie: cookieHeader(athlete),
          },
          body: JSON.stringify({
            action: "read",
            args: { conversationId, through: 1 },
          }),
        })
      ).status,
      403,
    );
    console.log("Completed phase: " + phase);
    phase = "mobile back, keyboard controls and details";
    await athletePage.setViewportSize({ width: 375, height: 812 });
    await athletePage
      .getByRole("button", { name: "Back", exact: true })
      .click();
    await athletePage.getByRole("button", { name: /DEV0247 Coach/ }).click();
    await expect(athletePage.getByLabel("Message context")).toBeVisible();
    assert.equal(
      await athletePage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await athletePage.keyboard.press("Tab");
    for (const page of [coachPage, athletePage]) {
      await page.setViewportSize({ width: 430, height: 932 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await expect(page.getByLabel("Message context")).toBeVisible();
    }
    await athletePage.setViewportSize({ width: 375, height: 812 });
    await mkdir(evidence, { recursive: true });
    await athletePage.screenshot({
      path: evidence + "/mobile.png",
      fullPage: true,
    });
    await coachPage.setViewportSize({ width: 375, height: 812 });
    assert.equal(
      await coachPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await expect(
      coachPage
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("link"),
    ).toHaveCount(5);
    await coachPage.setViewportSize({ width: 1440, height: 1000 });
    await coachPage.screenshot({
      path: evidence + "/desktop.png",
      fullPage: true,
    });
    console.log("Completed phase: " + phase);
    phase = "block UI retains history and requires explicit session context";
    await coachPage.getByRole("button", { name: "Block", exact: true }).click();
    await coachPage
      .getByRole("button", { name: "Confirm block", exact: true })
      .click();
    await expect(
      coachPage.getByText("Contact is blocked.", { exact: false }),
    ).toBeVisible();
    await expect(
      coachPage.getByLabel("Message to DEV0247 Athlete"),
    ).toBeDisabled();
    await coachPage.getByLabel("Message context").selectOption({
      label: (
        await coachPage
          .getByLabel("Message context")
          .locator("option")
          .allTextContents()
      ).find((v) => v.startsWith("Session ·"))!,
    });
    await expect(
      coachPage.getByLabel("Message to DEV0247 Athlete"),
    ).toBeEnabled();
    console.log("Completed phase: " + phase);
    phase = "real concurrent retries and block races";
    await coachPage
      .getByRole("button", { name: "Unblock", exact: true })
      .click();
    await expect(
      coachPage.getByRole("button", { name: "Block", exact: true }),
    ).toBeVisible();
    const pool = postgres(
      "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
      { max: 4, prepare: false, ssl: false, onnotice: () => {} },
    );
    const command = async (
      p: typeof athlete,
      action: string,
      args: Record<string, unknown>,
    ) =>
      pool.begin(async (tx) => {
        await tx.unsafe("set local role app_runtime");
        await tx`select set_config('app.current_auth_user_id',${p.actor.authUserId},true),set_config('app.current_profile_id',${p.actor.profileId},true),set_config('app.current_run_id',${p.actor.runId},true),set_config('app.current_run_role','member',true)`;
        return (
          await tx`select app.message_command(${action},${tx.json(args as postgres.JSONValue)}) value`
        )[0].value;
      });
    try {
      const submissionId = randomUUID();
      const raced = await Promise.all([
        command(athlete, "inquire", {
          coachId: coach.actor.profileId,
          submissionId,
          body: "Concurrent identical inquiry",
        }),
        command(athlete, "inquire", {
          coachId: coach.actor.profileId,
          submissionId,
          body: "Concurrent identical inquiry",
        }),
      ]);
      assert.equal(raced[0].entryId, raced[1].entryId);
      const thread = await command(athlete, "thread", { conversationId });
      const inquiry = thread.contexts.find(
        (c: { kind: string }) => c.kind === "inquiry",
      );
      const outcomes = await Promise.allSettled([
        command(coach, "block", { conversationId }),
        command(athlete, "send", {
          conversationId,
          contextId: inquiry.id,
          body: "Racing block",
          submissionId: randomUUID(),
        }),
      ]);
      assert.equal(outcomes[0].status, "fulfilled");
      if (outcomes[1].status === "rejected")
        assert.ok(!/deadlock/i.test(String(outcomes[1].reason)));
      await assert.rejects(
        command(athlete, "send", {
          conversationId,
          contextId: inquiry.id,
          body: "After block",
          submissionId: randomUUID(),
        }),
      );
    } finally {
      await pool.end();
    }
    console.log("Completed phase: " + phase);
    phase = "switching browser account clears private conversation and drafts";
    await contexts[1].clearCookies();
    await contexts[1].addCookies(
      stranger.cookies.map((cookie) => ({ ...cookie, url: base })),
    );
    await athletePage.goto(base + "/messages");
    await expect(
      athletePage.getByRole("heading", {
        name: "Your conversations start here",
      }),
    ).toBeVisible();
    await expect(
      athletePage.getByText(
        "Can we practise footwork? <script>literal text</script>",
        { exact: true },
      ),
    ).toHaveCount(0);
    assert.equal(
      await athletePage.evaluate(() =>
        [...Object.values(localStorage), ...Object.values(sessionStorage)].some(
          (value) =>
            String(value).includes("Draft survives a temporary read failure"),
        ),
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "DEV0247: two-account inquiry/reply, live focus/30-second/hidden refresh, actor switching, draft/focus/error recovery, lost-ack idempotency, explicit general consent, original request/booking cards, unrelated/origin denial, mobile layout, block UI and real retry/block concurrency passed.",
    );
  }
} catch (error) {
  console.error("Private-message rehearsal failed during: " + phase);
  throw error;
} finally {
  await browser?.close();
  await cleanup();
  await database.end();
}
