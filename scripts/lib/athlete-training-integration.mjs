// MOV-126: actual routes/Auth/SQL, only in the owned disposable media QA stack.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });

export async function rehearseAthleteTraining({
  base,
  database,
  person,
  stranger,
  output,
  pass,
}) {
  assert.equal(base, "http://localhost:3169");
  const athlete = await person("QA Training"),
    page = athlete.page;
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(day + "T12:00:00Z"));
  const routineUrl = base + `/sessions/routine?date=${day}&timezone=UTC`;
  const calendarUrl = base + `/sessions/calendar?date=${day}&timezone=UTC`;
  const canonical = () =>
    database`select (select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.id)::text,'[]')) from app.coach_private_bookings b) bookings,(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from app.coach_group_registrations r) registrations`;
  const sourceBefore = await canonical();
  async function scope(target) {
    const actor = await (
      await target.request.get(base + "/api/auth/actor")
    ).json();
    assert.equal(actor.status, "authorized");
    return `${actor.demoRun.slug}:${actor.profile.slug}`;
  }
  async function command(target, value, selectedScope) {
    return target.evaluate(
      async ({ command, scope }) => {
        const r = await fetch("/api/training", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command, scope }),
        });
        return {
          http: r.status,
          body: await r.json(),
          cache: r.headers.get("cache-control"),
        };
      },
      { command: value, scope: selectedScope ?? (await scope(target)) },
    );
  }
  const read = async (target = page) => {
    const r = await command(target, {
      action: "list",
      args: {
        from: day,
        through: new Date(Date.parse(day + "T12:00:00Z") + 14 * 86400000)
          .toISOString()
          .slice(0, 10),
        timezone: "UTC",
      },
    });
    assert.equal(r.http, 200);
    assert.equal(r.body.status, "ready");
    assert.match(r.cache, /private.*no-store/);
    return r.body.value;
  };
  const card = (title) =>
    page
      .locator(".routine-workout")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  const calendarCard = (title) =>
    page.getByRole("button", { name: `Edit workout: ${title}`, exact: true });
  const dialog = page.getByRole("dialog");
  await page.goto(routineUrl);
  await expect(page.locator(".routine-day")).toHaveCount(7);
  await page
    .getByRole("button", { name: `Add ${weekday} workout`, exact: true })
    .click();
  await expect(page.getByLabel("Planned minutes")).toHaveValue("60");
  await expect(
    page.getByRole("checkbox", { name: "Repeat weekly" }),
  ).toBeChecked();
  await page.getByLabel("Activity", { exact: true }).fill("QA weekly routine");
  await page.getByLabel("Time", { exact: true }).fill("19:00");
  await dialog
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(card("QA weekly routine")).toBeVisible();
  let listed = await read(),
    item = listed.items.find((i) => i.title === "QA weekly routine");
  const invalidAttendance = await command(page, {
    action: "attendance",
    args: {
      commandId: randomUUID(),
      key: item.key,
      revision: item.revision,
      attendance: "attended",
    },
  });
  assert.equal(invalidAttendance.http, 400);
  assert.equal(invalidAttendance.body.status, "invalid");
  assert.ok(item.seriesId);
  assert.equal(item.planRevision, 1);
  assert.equal(Date.parse(item.endsAt) - Date.parse(item.startsAt), 3600000);
  const original = { ...item };
  await card("QA weekly routine")
    .getByRole("button", { name: "Edit routine", exact: true })
    .click();
  await page.getByLabel("Activity", { exact: true }).fill("QA revised routine");
  await page.getByLabel("Planned minutes").fill("45");
  await dialog
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(card("QA revised routine")).toBeVisible();
  await card("QA revised routine")
    .getByRole("button", { name: "Edit routine", exact: true })
    .click();
  await expect(page.getByLabel("Planned minutes")).toHaveValue("45");
  await page.getByLabel("Planned minutes").fill("50");
  await dialog
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    card("QA revised routine").getByRole("button", {
      name: "Edit routine",
      exact: true,
    }),
  ).toBeEnabled();
  const twiceEditedRoutine = (await read()).items.find(
    (i) => i.seriesId === original.seriesId,
  );
  assert.equal(twiceEditedRoutine.planRevision, 3);
  assert.equal(
    Date.parse(twiceEditedRoutine.endsAt) -
      Date.parse(twiceEditedRoutine.startsAt),
    50 * 60000,
  );
  const conflict = await command(page, {
    action: "stop",
    args: { commandId: randomUUID(), seriesId: item.seriesId, planRevision: 1 },
  });
  assert.equal(conflict.http, 409);
  assert.equal(conflict.body.status, "conflict");
  assert.equal(
    (
      await command(stranger.page, {
        action: "stop",
        args: {
          commandId: randomUUID(),
          seriesId: item.seriesId,
          planRevision: 2,
        },
      })
    ).http,
    409,
  );
  assert.equal(
    (
      await command(
        stranger.page,
        { action: "list", args: { from: day, through: day, timezone: "UTC" } },
        await scope(page),
      )
    ).http,
    403,
  );
  assert.equal(
    JSON.stringify(await read(stranger.page)).includes("QA revised routine"),
    false,
  );
  pass(
    "real routine default60, persisted reload/series revision and cross-member/scope isolation",
  );

  await card("QA revised routine")
    .getByRole("link", { name: "View in Calendar", exact: true })
    .click();
  const agenda = page.locator(".training-agenda-item").filter({
    has: page.getByRole("heading", {
      name: "QA revised routine",
      exact: true,
    }),
  });
  await agenda
    .getByRole("button", { name: "Edit workout / log", exact: true })
    .click();
  await page
    .getByLabel("Activity", { exact: true })
    .fill("QA occurrence exception");
  await page.getByText("Optional workout details", { exact: true }).click();
  await page
    .getByLabel("Personal notes", { exact: true })
    .fill("Private routine annotation");
  await dialog
    .getByRole("button", { name: "Save training", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Private routine annotation", { exact: true }),
  ).toBeVisible();

  await page.goto(routineUrl);
  await page
    .getByRole("button", { name: `Add ${weekday} workout`, exact: true })
    .click();
  await page.getByLabel("Activity", { exact: true }).fill("QA one-off workout");
  await page.getByLabel("Time", { exact: true }).fill("17:00");
  await page.getByRole("checkbox", { name: "Repeat weekly" }).uncheck();
  await dialog
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const oneOff = (await read()).items.find(
    (i) => i.title === "QA one-off workout",
  );
  await card("QA one-off workout")
    .getByRole("link", { name: "View in Calendar", exact: true })
    .click();
  await calendarCard("QA one-off workout").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Activity", { exact: true })).toHaveValue(
    "QA one-off workout",
  );
  await page.keyboard.press("Escape");
  await expect(calendarCard("QA one-off workout")).toBeFocused();
  await calendarCard("QA one-off workout").click();
  await page.getByLabel("Activity", { exact: true }).fill("QA revised one-off");
  await page.getByLabel("Time", { exact: true }).fill("16:30");
  await page.getByLabel("Planned minutes").fill("75");
  await dialog
    .getByRole("button", { name: "Save training", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(calendarCard("QA revised one-off")).toBeEnabled();
  const dayIndex = (new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7;
  const targetIndex = dayIndex === 0 ? 1 : 0;
  const targetDay = new Date(
    Date.parse(day + "T12:00:00Z") + (targetIndex - dayIndex) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  let releaseNavigation;
  const delayedNavigation = new Promise(
    (resolve) => (releaseNavigation = resolve),
  );
  let navigationHeld = false;
  let heldNavigation;
  await page.route("**/sessions/calendar?**", async (route) => {
    const request = route.request();
    if (
      new URL(request.url()).searchParams.get("date") === targetDay &&
      request.headers().rsc === "1" &&
      !navigationHeld
    ) {
      navigationHeld = true;
      heldNavigation = (async () => {
        const response = await route.fetch();
        await delayedNavigation;
        await route.fulfill({ response });
      })();
      // The main journey awaits this promise so failures reach its cleanup.
      await heldNavigation.catch(() => {});
    } else await route.continue();
  });
  await page.locator(".training-day-heading").nth(targetIndex).click();
  await expect.poll(() => navigationHeld).toBe(true);
  await calendarCard("QA revised one-off").click();
  await expect(page.getByLabel("Planned minutes")).toHaveValue("75");
  await page.getByLabel("Planned minutes").fill("80");
  const navigationResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).searchParams.get("date") === targetDay &&
      response.request().headers().rsc === "1",
  );
  releaseNavigation();
  await heldNavigation;
  await navigationResponse;
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Save training", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(calendarCard("QA revised one-off")).toBeEnabled();
  await page.unroute("**/sessions/calendar?**");
  const twiceEditedOneOff = (await read()).items.find(
    (i) => i.key === oneOff.key,
  );
  assert.equal(twiceEditedOneOff.revision, oneOff.revision + 2);
  await page.reload();
  await expect(calendarCard("QA revised one-off")).toBeVisible();
  const oneOffAfter = (await read()).items.filter((i) => i.key === oneOff.key);
  assert.equal(oneOffAfter.length, 1);
  assert.equal(oneOffAfter[0].attendance, "planned");
  assert.equal(oneOffAfter[0].revision, oneOff.revision + 2);
  assert.equal(
    Date.parse(oneOffAfter[0].endsAt) - Date.parse(oneOffAfter[0].startsAt),
    80 * 60000,
  );
  const staleEdit = {
    action: "save",
    args: {
      commandId: randomUUID(),
      key: oneOff.key,
      revision: oneOff.revision,
      title: "Stale edit",
      date: day,
      time: "16:30",
      timezone: "UTC",
      minutes: 75,
    },
  };
  assert.equal((await command(page, staleEdit)).http, 409);
  assert.equal((await command(stranger.page, staleEdit)).http, 409);
  await page.goto(routineUrl);
  await card("QA revised one-off")
    .getByRole("button", { name: "Cancel workout", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Keep workout", exact: true })
    .click();
  await expect(card("QA revised one-off")).toBeVisible();
  await card("QA revised one-off")
    .getByRole("button", { name: "Cancel workout", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Cancel workout", exact: true })
    .click();
  await expect(card("QA revised one-off")).toHaveCount(0);
  pass(
    "consecutive one-off edits survive a delayed real day-navigation response and persist the same key; stale/foreign-owner edits fail closed; keyboard cancel restores focus",
  );
  const deleteButton = card("QA occurrence exception").getByRole("button", {
    name: "Delete routine",
    exact: true,
  });
  await deleteButton.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toContainText("All future repeats will stop");
  await page.keyboard.press("Escape");
  await expect(deleteButton).toBeFocused();
  assert.equal(
    (await read()).items.some(
      (i) => i.seriesId === original.seriesId && i.attendance === "planned",
    ),
    true,
  );
  let lost;
  await page.route("**/api/training", async (route) => {
    const body = route.request().postDataJSON();
    if (body.command.action === "stop" && !lost) {
      lost = body.command;
      const response = await route.fetch();
      assert.equal(
        response.status(),
        200,
        "The real SQL stop must commit before its response is lost",
      );
      await route.abort("failed");
    } else await route.continue();
  });
  await deleteButton.click();
  await dialog
    .getByRole("button", { name: "Delete routine", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Delete routine", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Retry last save", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.unroute("**/api/training");
  await expect(card("QA occurrence exception")).toHaveCount(0);
  listed = await read();
  assert.equal(
    listed.items.some(
      (i) => i.seriesId === original.seriesId && i.attendance === "planned",
    ),
    false,
  );
  const exception = listed.items.find((i) => i.key === original.key);
  assert.equal(exception.attendance, "cancelled");
  assert.equal(exception.notes, "Private routine annotation");
  assert.equal(exception.planRevision, 4);
  const [retry] =
    await database`select count(*)::int count from app.athlete_training_commands where profile_id=${athlete.profileId}::uuid and command_id=${lost.args.commandId}::uuid`;
  assert.equal(retry.count, 1);
  await page.reload();
  await expect(card("QA occurrence exception")).toHaveCount(0);
  pass(
    "real one-off confirmation/cancel, routine confirmation/Escape and committed-response-loss exact retry preserve exception notes",
  );

  await page.goto(calendarUrl);
  await expect(
    page.getByText("Private routine annotation", { exact: true }),
  ).toBeVisible();
  const reminder = page.getByRole("checkbox", {
    name: "Email me before training",
  });
  await reminder.click();
  await expect(reminder).toBeChecked();
  await expect(reminder).toBeEnabled();
  await page.reload();
  await expect(reminder).toBeChecked();
  await reminder.click();
  await expect(reminder).not.toBeChecked();
  await expect(reminder).toBeEnabled();
  await page.getByRole("button", { name: "Log workout", exact: true }).click();
  const past = new Date(Date.now() - 7200000);
  await page.getByLabel("Activity", { exact: true }).fill("QA completed walk");
  await page
    .getByLabel("Date", { exact: true })
    .fill(past.toISOString().slice(0, 10));
  await page
    .getByLabel("Time", { exact: true })
    .fill(past.toISOString().slice(11, 16));
  await page.getByLabel("Planned minutes").fill("30");
  await page.getByText("Optional workout details", { exact: true }).click();
  await page
    .getByLabel("Personal notes", { exact: true })
    .fill("Private completed log");
  await dialog
    .getByRole("button", { name: "Save completed workout", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.goto(
    base +
      `/sessions/calendar?date=${past.toISOString().slice(0, 10)}&timezone=UTC`,
  );
  await expect(
    page.getByText("Private completed log", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".training-count strong").first()).toHaveText("1");
  await page.reload();
  await expect(
    page.getByText("You confirmed attendance", { exact: false }),
  ).toBeVisible();
  const completedCalendarUrl =
    base +
    `/sessions/calendar?date=${past.toISOString().slice(0, 10)}&timezone=UTC`;
  const logRead = () =>
    command(page, {
      action: "list",
      args: {
        from: past.toISOString().slice(0, 10),
        through: past.toISOString().slice(0, 10),
        timezone: "UTC",
      },
    });
  const logBefore = (await logRead()).body.value.items.find(
    (i) => i.title === "QA completed walk",
  );
  await calendarCard("QA completed walk").click();
  await expect(
    page.getByRole("textbox", { name: "Personal notes", exact: true }),
  ).toHaveValue("Private completed log");
  await page.getByLabel("Activity", { exact: true }).fill("QA corrected walk");
  await page.getByLabel("Planned minutes").fill("45");
  await page.getByLabel("Actual minutes", { exact: true }).fill("40");
  await page
    .getByRole("combobox", { name: "How did it feel?", exact: true })
    .selectOption("Easy");
  let lostLogEdit;
  const logAttempts = [];
  await page.route("**/api/training", async (route) => {
    const body = route.request().postDataJSON();
    if (
      body.command.action === "save" &&
      body.command.args.key === logBefore.key
    ) {
      logAttempts.push(body.command);
      if (!lostLogEdit) {
        lostLogEdit = body.command;
        assert.equal((await route.fetch()).status(), 200);
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  await dialog
    .getByRole("button", { name: "Save training", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Retry last save", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.unroute("**/api/training");
  assert.equal(logAttempts.length, 2);
  assert.deepEqual(logAttempts[0], logAttempts[1]);
  const correctedLogs = (await logRead()).body.value.items.filter(
    (i) => i.key === logBefore.key,
  );
  assert.equal(correctedLogs.length, 1);
  assert.equal(correctedLogs[0].revision, logBefore.revision + 1);
  assert.equal(correctedLogs[0].attendance, "attended");
  assert.equal(correctedLogs[0].notes, "Private completed log");
  assert.equal(correctedLogs[0].actualMinutes, 40);
  assert.equal(correctedLogs[0].intensity, "Easy");
  const [logRetry] =
    await database`select count(*)::int count from app.athlete_training_commands where profile_id=${athlete.profileId}::uuid and command_id=${lostLogEdit.args.commandId}::uuid`;
  assert.equal(logRetry.count, 1);
  const secondLogEdits = [];
  let failedRead = false;
  await page.route("**/api/training", async (route) => {
    const { command: next } = route.request().postDataJSON();
    if (next.action === "save") secondLogEdits.push(next);
    if (next.action === "list" && !failedRead) {
      failedRead = true;
      await route.fulfill({ status: 503, json: { status: "unavailable" } });
    } else await route.continue();
  });
  await calendarCard("QA corrected walk").click();
  await expect(page.getByLabel("Planned minutes")).toHaveValue("45");
  await page.getByLabel("Planned minutes").fill("50");
  await dialog
    .getByRole("button", { name: "Save training", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(calendarCard("QA corrected walk")).toBeEnabled();
  await expect(page.locator(".training-error")).toHaveCount(0);
  await page.unroute("**/api/training");
  assert.equal(failedRead, true);
  assert.equal(secondLogEdits.length, 1);
  assert.equal(secondLogEdits[0].args.revision, logBefore.revision + 1);
  const twiceEditedLog = (await logRead()).body.value.items.find(
    (i) => i.key === logBefore.key,
  );
  assert.equal(twiceEditedLog.revision, logBefore.revision + 2);
  assert.equal(twiceEditedLog.attendance, "attended");
  assert.equal(twiceEditedLog.notes, "Private completed log");
  await calendarCard("QA corrected walk").click();
  await expect(page.getByLabel("Planned minutes")).toHaveValue("50");
  await page.keyboard.press("Escape");
  pass(
    "consecutive routine, one-off and completed-log edits need no page reload; current SQL revisions advance and a transient post-save read recovers without repeating the mutation",
  );
  await page.reload();
  await expect(calendarCard("QA corrected walk")).toBeVisible();
  await expect(page.locator(".training-count strong").first()).toHaveText("1");
  pass(
    "direct completed-log edit preserves attendance/private details and persists once after a genuinely committed lost response and exact retry",
  );
  assert.equal(
    JSON.stringify(await read(stranger.page)).includes("Private"),
    false,
  );
  assert.deepEqual(await canonical(), sourceBefore);
  pass(
    "real completed log/reload/self-attendance count, private notes and reminder opt-in/out persist without canonical changes",
  );

  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 812 });
    for (const [active, url] of [
      ["Plan routine", routineUrl],
      ["Calendar", calendarUrl],
      ["Private sessions", base + "/sessions"],
      ["Group sessions", base + "/sessions/groups"],
    ]) {
      await page.goto(url);
      const nav = page.getByRole("navigation", {
        name: "Session type",
        exact: true,
      });
      await expect(nav.getByRole("link")).toHaveCount(2);
      await expect(nav.locator('[aria-current="page"]')).toHaveText(active);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${active} overflow ${width}`,
      );
    }
    await page.goto(routineUrl);
    await page.screenshot({
      path: path.join(output, `athlete-routine-${width}.png`),
      fullPage: true,
    });
    for (const view of ["week", "month"]) {
      await page.goto(completedCalendarUrl + `&view=${view}`);
      const edit = calendarCard("QA corrected walk");
      await expect(edit.getByText("Edit", { exact: true })).toBeVisible();
      await edit.focus();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel("Activity", { exact: true })).toHaveValue(
        "QA corrected walk",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page.screenshot({
        path: path.join(output, `workout-edit-${view}-${width}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(edit).toBeFocused();
    }
  }
  const guest = await page.context().browser().newContext();
  try {
    const r = await guest.request.get(routineUrl, { maxRedirects: 0 });
    assert.equal(r.status(), 307);
    assert.match(r.headers().location, /returnTo=%2Fsessions%2Froutine/);
  } finally {
    await guest.close();
  }
  pass(
    "actual athlete planning/booking section current state and no overflow at1440/375/320; guest routine sign-in return preserved",
  );
  await athlete.context.close();
}
