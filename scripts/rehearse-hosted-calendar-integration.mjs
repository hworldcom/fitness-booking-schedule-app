// DEV0256: one real fixture cohort across calendar, editor and public requests.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
import { runHostedAvailability } from "./rehearse-hosted-coach-availability.mjs";

const expect = baseExpect.configure({ timeout: 90000 });
await runHostedAvailability(process.argv.slice(2), {
  ticket: "DEV0256",
  onStage: calendarStage,
});

async function calendarStage(stage, c) {
  const {
    h,
    owner,
    athlete,
    competitor,
    target,
    today,
    plus,
    groupId,
    booking,
    pending,
    venueB,
  } = c;
  console.log("Integration checkpoint: " + stage);
  const { page, context } = await h.open(owner),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const calendar = page.getByRole("region", {
    name: "Coach calendar",
    exact: true,
  });
  const agenda = page.getByRole("region", {
    name: "Calendar agenda",
    exact: true,
  });
  const items = () => agenda.getByRole("button");
  const url = (date = target, view = "day", extra = "") =>
    `${h.base}/coach?view=schedule&section=calendar&date=${date}&calendarView=${view}${extra}`;
  async function read(date = target, view = "day", extra = "") {
    await page.goto(url(date, view, extra), {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await expect(calendar).toBeVisible();
    await expect(calendar).toHaveAttribute("aria-busy", "false");
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".coach-calendar button")].some((el) =>
        Object.keys(el).some((k) => k.startsWith("__reactProps$")),
      ),
    );
  }
  async function projection(date = target, history = false) {
    return h.asActor(
      owner,
      async (tx) =>
        (
          await tx`select app.owned_coach_calendar(${tx.json({ from: date, through: date, type: "all", venueId: null, history, after: null })}) result`
        )[0].result,
    );
  }
  const data = await projection();
  await read();
  await expect(items()).toHaveCount(data.items.length);
  const serialized = JSON.stringify(data);
  for (const person of [athlete, competitor]) {
    assert.ok(
      !serialized.includes(person.profileId) &&
        !serialized.includes(person.email),
      "Calendar projection excludes athlete identifiers.",
    );
    assert.ok(
      !(await calendar.innerText()).includes(
        h.ticket + " " + h.runId.slice(0, 8) + " " + person.label,
      ),
    );
  }
  const group = data.items.find(
    (i) => i.source === "group" && i.id === groupId,
  );
  assert.ok(group, "Original published group remains in the calendar.");
  const open = data.items.filter((i) => i.source === "availability");
  if (stage === "mixed") {
    assert.equal(data.items.length, 9);
    assert.equal(open.find((i) => i.id === pending.id)?.pendingCount, 2);
    assert.ok(
      data.items.some((i) => i.source === "booking" && i.id === booking),
    );
    await items().filter({ hasText: "2 pending" }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    const original = dialog.getByRole("link", {
      name: "View booking requests",
      exact: true,
    });
    await expect(original).toHaveAttribute(
      "href",
      `/coach?view=bookings&occurrence=${pending.id}#coach-occurrence-${pending.id}`,
    );
    await original.click();
    await expect(page.locator(`#coach-occurrence-${pending.id}`)).toBeVisible();
    await read();
    await items().filter({ hasText: "Private session" }).click();
    await expect(
      dialog.getByRole("link", { name: "View original booking", exact: true }),
    ).toHaveAttribute("href", `/coach?view=bookings#coach-booking-${booking}`);
    await dialog
      .getByRole("link", { name: "View original booking", exact: true })
      .click();
    await expect(page.locator(`#coach-booking-${booking}`)).toBeVisible();
    await read();
    await items().filter({ hasText: "DEV0253 retained group" }).click();
    await expect(
      dialog.getByRole("link", { name: "View group details", exact: true }),
    ).toHaveAttribute("href", "/coach/events/" + groupId);
    await dialog
      .getByRole("link", { name: "View group details", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "DEV0253 retained group",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(h.base + "/coach", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await expect(
      page
        .getByRole("navigation", { name: "Calendar views" })
        .getByRole("link", { name: "Week", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await read(target, "week");
    await expect(
      page
        .getByRole("navigation", { name: "Calendar views" })
        .getByRole("link", { name: "Week", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await read(target, "month");
    while (
      await page
        .getByRole("button", { name: "Load more calendar items", exact: true })
        .count()
    ) {
      await page
        .getByRole("button", { name: "Load more calendar items", exact: true })
        .click();
      await expect(calendar).toHaveAttribute("aria-busy", "false");
    }
    assert.equal(await page.locator(".coach-calendar-month-day").count(), 42);
    const label = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "short",
    }).format(new Date(target + "T12:00:00Z"));
    const cell = page.getByRole("region", { name: label, exact: true });
    assert.equal(await cell.locator(".coach-calendar-item").count(), 3);
    await cell.getByRole("link", { name: /Show all 9 items/ }).click();
    await expect(items()).toHaveCount(9);
    await read(target, "day", "&type=group");
    await expect(items()).toHaveCount(1);
    await read(target, "day", "&venue=" + venueB);
    await expect(items()).toHaveCount(3);
  } else if (stage === "custom") {
    assert.equal(open.length, 7);
    assert.ok(
      open.every((i) => i.locationId === venueB && i.pendingCount === 0),
    );
    assert.ok(!data.items.some((i) => i.id === pending.id));
    assert.ok(data.items.some((i) => i.id === booking));
  } else if (stage === "off") {
    assert.equal(open.length, 0);
    assert.equal(data.items.length, 1);
    const history = await projection(target, true);
    assert.ok(
      history.items.some((i) => i.id === booking && i.status === "cancelled"),
    );
    await read(target, "day", "&history=1");
    await expect(
      agenda.getByText("Private session · Cancelled", { exact: true }),
    ).toBeVisible();
  } else if (stage === "restored") {
    assert.equal(open.length, 8);
    assert.equal(open.find((i) => i.id === c.restored.id)?.pendingCount, 1);
    assert.ok(!data.items.some((i) => i.id === pending.id || i.id === booking));
  } else if (stage === "final") {
    for (const width of [1440, 375, 430]) {
      await page.setViewportSize({ width, height: 1000 });
      await read();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: path.join(h.output, "calendar-integrated-" + width + ".png"),
        fullPage: true,
      });
    }
    await page.route("**/coach?**", async (route) =>
      route.request().method() === "POST"
        ? route.abort("failed")
        : route.continue(),
    );
    await page
      .getByRole("button", { name: "Reload calendar", exact: true })
      .click();
    await expect(
      calendar
        .getByRole("alert")
        .filter({ hasText: "calendar could not be verified" }),
    ).toBeVisible();
    await expect(items()).toHaveCount(9);
    await page.unroute("**/coach?**");
    await page
      .getByRole("button", { name: "Reload calendar", exact: true })
      .click();
    await expect(calendar).toHaveAttribute("aria-busy", "false");
    const futureGroup = await draftGroup(
      c,
      plus(35),
      "DEV0256 beyond private horizon",
    );
    const published = await h.asActor(
      owner,
      async (tx) =>
        (
          await tx`select app.publish_group_session(${futureGroup}::uuid,1) result`
        )[0].result,
    );
    assert.equal(published.outcome, "published");
    const future = await projection(plus(35));
    assert.deepEqual(
      future.items.map((i) => [i.source, i.id]),
      [["group", futureGroup]],
    );
    await read(plus(35));
    await expect(items()).toHaveCount(1);
    await expect(
      agenda.getByText("DEV0256 beyond private horizon", { exact: true }),
    ).toBeVisible();
    const race = await draftGroup(c, plus(5), "DEV0256 concurrent group"),
      baseline = await c.getPolicy();
    const [venue] = await h.ownerQuery(
      `select to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where id=${h.uuid(venueB)};`,
    );
    const results = await Promise.allSettled([
      h.asActor(
        owner,
        async (tx) =>
          (
            await tx`select app.publish_group_session(${race}::uuid,1) result`
          )[0].result,
      ),
      h.asActor(
        owner,
        async (tx) =>
          (
            await tx`select app.save_owned_effective_coach_availability(${tx.json({ operationId: randomUUID(), expectedRevision: baseline.revision, kind: "dates", dates: [{ date: plus(5), mode: "custom", hours: [{ locationId: venueB, locationUpdatedAt: venue.stamp, localStartTime: "15:00" }] }] })}) result`
          )[0].result,
      ),
    ]);
    for (const result of results)
      assert.equal(
        result.status,
        "fulfilled",
        "Each concurrent operation must resolve through its actual authority.",
      );
    assert.equal(results[0].value.outcome, "published");
    assert.equal(results[1].value.outcome, "saved");
    const [overlap] = await h.ownerQuery(
      `select count(*)::int n from app.coach_availability_slots a join app.coach_group_sessions g on g.coach_profile_id=a.profile_id and a.starts_at<g.ends_at and g.starts_at<a.ends_at where a.profile_id=${h.uuid(owner.profileId)} and a.status='open' and g.id=${h.uuid(race)} and g.status in('open','confirmed');`,
    );
    assert.equal(overlap.n, 0);
    const final = await projection(plus(5));
    assert.deepEqual(
      final.items.map((i) => [i.source, i.id]),
      [["group", race]],
    );
    h.record(
      "DEV0256: independently published group beyond private horizon, real concurrent policy/group publication and zero overlapping open capacity",
    );
    assert.ok(today < plus(35));
  }
  assert.deepEqual(errors, []);
  await context.close();
  h.record(
    "DEV0256: integrated calendar checkpoint " +
      stage +
      " passed against the same editor/request/group cohort",
  );
}

async function draftGroup(c, date, title) {
  const { h, owner, venueB } = c,
    id = randomUUID();
  const [stamp] =
    await h.runtime`select (${date + " 15:00"}::text::timestamp at time zone 'Europe/Berlin')::text value`;
  const starts = Date.parse(stamp.value);
  const saved = await h.asActor(
    owner,
    async (tx) =>
      (
        await tx`select app.group_session_command('save-draft',${tx.json({ id, expectedRevision: null, title, description: "Exact tagged integrated rehearsal.", discipline: "Boxing", intendedLevel: "All levels", locationId: venueB, startsAt: new Date(starts).toISOString(), endsAt: new Date(starts + 3600000).toISOString(), decisionDeadlineAt: new Date(starts - 3600000).toISOString(), minimumParticipants: 1, maximumParticipants: 5, priceCents: 0 })}) result`
      )[0].result,
  );
  assert.equal(saved.outcome, "saved");
  return id;
}
