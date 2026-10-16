// DEV0253 editor and DEV0255 public schedule proof using actual hosted-dev Auth/SQL.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
import { availabilityRehearsal } from "./lib/hosted-availability-rehearsal.mjs";

const h = await availabilityRehearsal(process.argv.slice(2));
const expect = baseExpect.configure({ timeout: 30000 });
let success = false,
  phase = "preflight";
try {
  await h.preflight();
  if (["--check", "--cleanup"].includes(h.args[2])) success = true;
  else if (h.args[3] === "--scenario") await inactiveVenueScenario();
  else await run();
} catch (error) {
  console.error(
    "Hosted availability failed during " +
      phase +
      ": " +
      h.redact(error.message),
  );
  console.error(
    h.redact(
      error.stack
        ?.split("\n")
        .filter(
          (line) =>
            line.includes("scripts/rehearse-hosted-coach-availability") ||
            line.includes("scripts/lib/hosted-availability-rehearsal"),
        )
        .slice(0, 4)
        .join("\n") ?? "",
    ),
  );
  process.exitCode = 1;
} finally {
  await h.finish(success);
}

async function run() {
  phase = "production build and real Auth fixtures";
  await h.start();
  const owner = await h.person("Owner", true),
    other = await h.person("Other", true),
    athlete = await h.person("Athlete"),
    competitor = await h.person("Competitor"),
    applicant = await h.person("Applicant", true);
  const ownerBrowser = await h.open(owner),
    athleteBrowser = await h.open(athlete),
    guest = await h.open();
  const page = ownerBrowser.page,
    client = athleteBrowser.page;
  const errors = [];
  for (const p of [page, client, guest.page])
    p.on("pageerror", (error) => errors.push(error.message));
  const [clock] =
    await h.runtime`select (clock_timestamp() at time zone 'Europe/Berlin')::date::text today`;
  const today = clock.today,
    plus = (n) =>
      new Date(Date.parse(today + "T12:00:00Z") + n * 86400000)
        .toISOString()
        .slice(0, 10),
    target = plus(3);
  const getPolicy = async () =>
    h.asActor(
      owner,
      async (tx) =>
        (
          await tx`select app.owned_effective_coach_availability(${today}::date,${plus(30)}::date) value`
        )[0].value,
    );
  const byDate = async (date) =>
    h.ownerQuery(
      `select id,status,to_char(starts_at at time zone 'Europe/Berlin','HH24:MI') as "hour",coach_training_location_id venue from app.coach_availability_slots where profile_id=${h.uuid(owner.profileId)} and (starts_at at time zone 'Europe/Berlin')::date=${h.literal(date)}::date order by starts_at,id;`,
    );
  const availability = (date) =>
    h.base +
    "/coach?view=schedule&section=availability" +
    (date ? "&date=" + date : "");
  const profile = (date) =>
    h.base + "/coaches/" + owner.slug + "?date=" + date + "#private-schedule";
  const editor = () =>
    page.getByRole("region", { name: "Availability editor", exact: true });
  const dialog = () => page.getByRole("dialog");
  async function openEditor(date) {
    await page.goto(availability(date), { waitUntil: "domcontentloaded" });
    await expect(editor()).toBeVisible();
    await expect(editor()).toHaveAttribute("aria-busy", "false");
    await page.waitForFunction(() => {
      const button = document.querySelector(".availability-editor button");
      return (
        button &&
        Object.keys(button).some((key) => key.startsWith("__reactProps$"))
      );
    });
  }
  async function dateEditor(date) {
    await openEditor(date);
    await page
      .getByRole("button", { name: "Date overrides", exact: true })
      .click();
  }
  async function review() {
    const began = Date.now();
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    await expect(
      dialog().getByRole("heading", {
        name: "Review availability changes",
        exact: true,
      }),
    ).toBeVisible({ timeout: 90000 });
    console.log(
      `Review completed in ${((Date.now() - began) / 1000).toFixed(1)} seconds.`,
    );
  }
  async function save() {
    await review();
    await dialog()
      .getByRole("button", { name: "Save availability", exact: true })
      .click();
    await expect(
      page.getByText("Availability saved.", { exact: false }),
    ).toBeVisible({ timeout: 90000 });
  }
  async function publicDate(date, p = client) {
    await p.goto(profile(date).split("#")[0], {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await expect(p.locator("#private-schedule")).toBeVisible();
    await p.waitForFunction(() => {
      const button = document.querySelector("#private-schedule button");
      return (
        button &&
        Object.keys(button).some((key) => key.startsWith("__reactProps$"))
      );
    });
  }
  const rows = (p) => p.locator("li[data-slot-id]");
  async function request(p, id) {
    const began = Date.now();
    await p.waitForFunction((id) => {
      const button = document.querySelector(`li[data-slot-id="${id}"] button`);
      return (
        button &&
        Object.keys(button).some((key) => key.startsWith("__reactProps$"))
      );
    }, id);
    await p
      .locator(`li[data-slot-id="${id}"]`)
      .getByRole("button", { name: "Request session", exact: true })
      .click();
    await expect(p.getByText("Request saved.", { exact: true })).toBeVisible({
      timeout: 90000,
    });
    console.log(
      `Real request completed in ${((Date.now() - began) / 1000).toFixed(1)} seconds.`,
    );
  }
  const session = await ownerBrowser.context.request.get(
    h.base + "/api/auth/session",
  );
  assert.equal((await session.json()).status, "signed-in");
  const venueB = await h.asActor(
    owner,
    async (tx) =>
      (
        await tx`select app.create_owned_coach_training_location('DEV0253 Riverside deck — long training venue',null,'Temporary Berlin venue for this exact rehearsal',52.5,13.4,'manual',null) id`
      )[0].id,
  );
  h.record(
    "real hosted OTP sessions, approved coaches, separate athlete accounts and two venues",
  );
  phase = "weekly ranges and deliberate copy";
  await openEditor();
  await page
    .getByRole("switch", { name: "Monday available", exact: true })
    .check();
  await page
    .getByLabel("Monday range 1 end", { exact: true })
    .selectOption("15:00");
  await page
    .getByRole("region", { name: "Monday", exact: true })
    .getByRole("button", { name: "Add range", exact: true })
    .click();
  await page
    .getByLabel("Monday range 2 start", { exact: true })
    .selectOption("16:00");
  await page
    .getByLabel("Monday range 2 end", { exact: true })
    .selectOption("18:00");
  await page
    .getByLabel("Monday range 2 venue", { exact: true })
    .selectOption(venueB);
  await page
    .getByRole("button", { name: "Copy Monday hours", exact: true })
    .click();
  for (const day of [
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ])
    await dialog()
      .getByRole("checkbox", { name: new RegExp(day) })
      .check();
  await dialog()
    .getByRole("button", { name: "Replace selected days", exact: true })
    .click();
  await save();
  const weekly = await getPolicy();
  assert.equal(weekly.revision, 1);
  assert.equal(weekly.weeklyHours.length, 56);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await expect(
    page.getByLabel("Monday range 2 venue", { exact: true }),
  ).toHaveValue(venueB);
  h.record(
    "DEV0253: complete two-venue week copied deliberately, saved once and reloaded from SQL",
  );
  phase = "retained booking, group and competing pending requests";
  const initial = await byDate(target),
    find = (hour) =>
      initial.find((s) => s.status === "open" && s.hour === hour);
  const booked = find("10:00"),
    pending = find("11:00");
  assert.ok(booked && pending);
  await publicDate(target);
  await request(client, booked.id);
  const [bookReq] = await h.ownerQuery(
    `select id from app.coach_booking_requests where slot_id=${h.uuid(booked.id)} and client_profile_id=${h.uuid(athlete.profileId)};`,
  );
  const booking = await h.asActor(
    owner,
    async (tx) =>
      (
        await tx`select * from app.accept_coach_booking_request(${bookReq.id}::uuid)`
      )[0].booking_id,
  );
  assert.ok(booking);
  await assert.rejects(
    h.asActor(
      competitor,
      (tx) => tx`select app.create_coach_booking_request(${booked.id}::uuid)`,
    ),
  );
  await publicDate(target);
  await request(client, pending.id);
  const competitorBrowser = await h.open(competitor);
  await publicDate(target, competitorBrowser.page);
  await request(competitorBrowser.page, pending.id);
  const groupId = randomUUID();
  const [groupTime] =
    await h.runtime`select (${target + " 15:00"}::text::timestamp at time zone 'Europe/Berlin')::text starts`;
  const starts = Date.parse(groupTime.starts);
  assert.equal(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(starts)),
    "15:00",
  );
  const publication = await h.asActor(owner, async (tx) => {
    const [draft] =
      await tx`select app.group_session_command('save-draft',${tx.json({ id: groupId, expectedRevision: null, title: "DEV0253 retained group", description: "Exact temporary availability rehearsal.", discipline: "Boxing", intendedLevel: "All levels", locationId: venueB, startsAt: new Date(starts).toISOString(), endsAt: new Date(starts + 3600000).toISOString(), decisionDeadlineAt: new Date(starts - 3600000).toISOString(), minimumParticipants: 1, maximumParticipants: 5, priceCents: 0 })}) result`;
    assert.equal(draft.result.outcome, "saved");
    return (
      await tx`select app.publish_group_session(${groupId}::uuid,1) result`
    )[0].result;
  });
  assert.equal(
    publication.outcome,
    "published",
    publication.reason ?? publication.outcome,
  );
  await dateEditor(target);
  await page.getByRole("radio", { name: /Custom hours/ }).check();
  await page
    .getByRole("button", { name: "Remove Date override range 2", exact: true })
    .click();
  await page
    .getByLabel("Date override range 1 start", { exact: true })
    .selectOption("09:00");
  await page
    .getByLabel("Date override range 1 end", { exact: true })
    .selectOption("18:00");
  await page
    .getByLabel("Date override range 1 venue", { exact: true })
    .selectOption(venueB);
  await review();
  await expect(
    dialog().getByText("2 pending requests", { exact: true }),
  ).toBeVisible();
  const warning = dialog().getByRole("link", {
    name: "View group session in a new tab",
    exact: true,
  });
  await expect(warning).toHaveAttribute("href", "/coach/events/" + groupId);
  const popupPromise = ownerBrowser.context.waitForEvent("page");
  await warning.click();
  const popup = await popupPromise;
  await expect(
    popup.getByRole("heading", { name: "DEV0253 retained group", exact: true }),
  ).toBeVisible();
  assert.equal(await popup.evaluate(() => window.opener), null);
  await popup.close();
  const [before] = await h.ownerQuery(
    `select count(*)::int n from app.coach_booking_requests where slot_id=${h.uuid(pending.id)} and status='pending';`,
  );
  assert.equal(before.n, 2, "Preview does not close requests.");
  await expect(
    dialog().getByRole("link", {
      name: "View private session in a new tab",
      exact: true,
    }),
  ).toHaveAttribute("href", `/coach?view=bookings#coach-booking-${booking}`);
  await dialog()
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(
    page.getByText("Availability saved.", { exact: false }),
  ).toBeVisible();
  const closed = await h.ownerQuery(
    `select r.id,r.status,(select count(*)::int from app.message_entries m where m.event_key='request:'||r.id||':occurrence-closed') cards from app.coach_booking_requests r where slot_id=${h.uuid(pending.id)};`,
  );
  assert.equal(closed.length, 2);
  assert.ok(
    closed.every((r) => r.status === "occurrence-closed" && r.cards === 1),
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await expect(page.getByRole("radio", { name: /Custom hours/ })).toBeChecked();
  await expect(
    page.getByLabel("Date override range 1 venue", { exact: true }),
  ).toHaveValue(venueB);
  const custom = await byDate(target);
  assert.ok(
    custom
      .filter((s) => s.status === "open")
      .every((s) => s.venue === venueB && !["10:00", "15:00"].includes(s.hour)),
  );
  await publicDate(target);
  const publicHtml = await client.content();
  for (const person of [competitor, other]) {
    assert.ok(!publicHtml.includes(person.email));
    assert.ok(!publicHtml.includes(person.profileId));
    assert.ok(
      !publicHtml.includes(
        "DEV0253 " + h.runId.slice(0, 8) + " " + person.label,
      ),
    );
  }
  assert.equal(
    await client.locator(`li[data-slot-id="${pending.id}"]`).count(),
    0,
  );
  await assert.rejects(
    h.asActor(
      athlete,
      (tx) => tx`select app.create_coach_booking_request(${pending.id}::uuid)`,
    ),
    {
      code: "P0001",
      message: "coach booking request occurrence is unavailable",
    },
  );
  h.record(
    "DEV0253/DEV0255: real whole-date venue replacement retains original booking/group, closes two pending requests/cards atomically and removes stale public IDs",
  );
  phase = "day off, cancellation and fresh restoration";
  await dateEditor(target);
  await page.getByRole("radio", { name: /All day unavailable/ }).check();
  await save();
  await publicDate(target);
  await expect(client.getByText(/No open hours on this date/)).toBeVisible();
  await client
    .getByRole("button", { name: "Cancel booking", exact: true })
    .click();
  await expect(
    client.getByText("Booking cancelled.", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  assert.equal(
    (await byDate(target)).filter((s) => s.status === "open").length,
    0,
    "Cancellation cannot reopen day-off capacity.",
  );
  await dateEditor(target);
  await page.getByRole("radio", { name: /Use normal week/ }).check();
  await save();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await expect(
    page.getByText("No exceptions this month", { exact: true }),
  ).toBeVisible();
  const restored = (await byDate(target)).find(
    (s) => s.status === "open" && s.hour === "11:00",
  );
  assert.ok(restored && restored.id !== pending.id);
  await publicDate(target);
  await request(client, restored.id);
  const [attempts] = await h.ownerQuery(
    `select count(*)::int n from app.coach_booking_requests where client_profile_id=${h.uuid(athlete.profileId)} and slot_id in(${h.uuid(pending.id)},${h.uuid(restored.id)});`,
  );
  assert.equal(attempts.n, 2);
  h.record(
    "DEV0253/DEV0255: day off survives reload/cancellation, restoration uses a fresh occurrence and leaves original request history terminal",
  );
  phase = "manual closure survives override restoration";
  const manuallyClosed = (await byDate(plus(4))).find(
    (s) => s.hour === "12:00" && s.status === "open",
  );
  assert.ok(manuallyClosed);
  await h.asActor(
    owner,
    (tx) =>
      tx`select app.close_coach_booking_request_occurrence(${manuallyClosed.id}::uuid)`,
  );
  await dateEditor(plus(4));
  await page.getByRole("radio", { name: /All day unavailable/ }).check();
  await save();
  await page.getByRole("radio", { name: /Use normal week/ }).check();
  await save();
  assert.equal(
    (await byDate(plus(4))).filter(
      (s) => s.hour === "12:00" && s.status === "open",
    ).length,
    0,
  );
  await publicDate(plus(4));
  assert.equal(
    await client.locator(`li[data-slot-id="${manuallyClosed.id}"]`).count(),
    0,
  );
  h.record(
    "DEV0253/DEV0255: manually closed time stays closed after day-off removal and public synchronization",
  );
  phase = "uncertain save, stale revision and unavailable transport";
  await dateEditor(plus(6));
  await page.getByRole("radio", { name: /All day unavailable/ }).check();
  let captured,
    intercepted = false;
  await page.route("**/coach?**", async (route) => {
    let payload;
    try {
      payload = JSON.parse(route.request().postData() ?? "null");
    } catch {}
    if (
      !intercepted &&
      route.request().method() === "POST" &&
      Array.isArray(payload) &&
      payload[2] === false &&
      payload[0]?.kind === "dates"
    ) {
      captured = payload[0];
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await review();
  await dialog()
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(dialog().getByRole("alert")).toHaveText(
    /The save response was interrupted/,
  );
  assert.ok(
    intercepted && captured,
    "Real committed save response was interrupted.",
  );
  await page.unroute("**/coach?**");
  const revision = (await getPolicy()).revision;
  await dialog()
    .getByRole("button", { name: "Retry same save", exact: true })
    .click();
  await expect(
    page.getByText("Availability saved.", { exact: false }),
  ).toBeVisible();
  assert.equal((await getPolicy()).revision, revision);
  const receipt = await h.asActor(
    owner,
    async (tx) =>
      (
        await tx`select app.save_owned_effective_coach_availability(${tx.json(captured)}) result`
      )[0].result,
  );
  assert.equal(receipt.outcome, "saved");
  const altered = await h.asActor(
    owner,
    async (tx) =>
      (
        await tx`select app.save_owned_effective_coach_availability(${tx.json({ ...captured, dates: [{ date: plus(7), mode: "unavailable", hours: [] }] })}) result`
      )[0].result,
  );
  assert.equal(altered.outcome, "conflict");
  await openEditor();
  await page
    .getByLabel("Monday range 1 end", { exact: true })
    .selectOption("14:00");
  await h.asActor(
    owner,
    async (tx) =>
      tx`select app.save_owned_effective_coach_availability(${tx.json({ operationId: randomUUID(), expectedRevision: revision, kind: "dates", dates: [{ date: plus(8), mode: "unavailable", hours: [] }] })})`,
  );
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await expect(
    page.getByText(/Availability changed elsewhere\. Your draft is unchanged/),
  ).toBeVisible();
  await expect(
    page.getByLabel("Monday range 1 end", { exact: true }),
  ).toHaveValue("14:00");
  h.record(
    "DEV0253: real committed-but-interrupted save recovers one receipt/revision; altered replay and stale baseline preserve the draft",
  );
  phase = "inactive venue and unavailable preview preserve draft";
  const venueC = await h.asActor(
    owner,
    async (tx) =>
      (
        await tx`select app.create_owned_coach_training_location('DEV0253 temporary removable venue',null,'Temporary Berlin venue',52.51,13.41,'manual',null) id`
      )[0].id,
  );
  await openEditor();
  await page
    .getByLabel("Monday range 1 venue", { exact: true })
    .selectOption(venueC);
  const [venueCState] = await h.ownerQuery(
    `select to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where id=${h.uuid(venueC)};`,
  );
  await h.asActor(
    owner,
    (tx) =>
      tx`select app.deactivate_owned_coach_training_location(${venueC}::uuid,${venueCState.stamp}::text::timestamptz,null,null)`,
  );
  const beforeInvalid = (await getPolicy()).revision;
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await expect(
    page.getByText(
      "These hours could not be saved. Review the dates and current venues; your draft is still here.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Monday range 1 venue", { exact: true }),
  ).toHaveValue(venueC);
  assert.equal((await getPolicy()).revision, beforeInvalid);
  await exerciseInactiveVenueRace(owner, page, await raceVenue(owner));
  await openEditor();
  await page
    .getByLabel("Monday range 1 end", { exact: true })
    .selectOption("14:00");
  await page.route("**/coach?**", async (route) => {
    let payload;
    try {
      payload = JSON.parse(route.request().postData() ?? "null");
    } catch {}
    if (
      route.request().method() === "POST" &&
      Array.isArray(payload) &&
      payload[2] === true
    )
      await route.abort("failed");
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await expect(page.getByText(/The review could not be loaded/)).toBeVisible();
  await expect(
    page.getByLabel("Monday range 1 end", { exact: true }),
  ).toHaveValue("14:00");
  assert.equal((await getPolicy()).revision, beforeInvalid);
  await page.unroute("**/coach?**");
  h.record(
    "DEV0253: inactive venue and interrupted preview retain the unsaved draft without changing SQL revision",
  );
  phase = "public thirty dates and sign-in return";
  await h.probePublicBoundaries(owner, athlete);
  // Remove only unused occurrences of this new coach, then let the public
  // projection recreate the horizon without an intervening coach visit.
  await h.ownerQuery(
    `begin;delete from app.coach_availability_slots where profile_id=${h.uuid(owner.profileId)} and (starts_at at time zone 'Europe/Berlin')::date=${h.literal(plus(29))}::date;commit;select true prepared;`,
  );
  await publicDate(today, guest.page);
  const reached = new Set();
  for (let n = 0; n < 5; n++) {
    const urls = await guest.page
      .getByRole("navigation", { name: "Private session dates", exact: true })
      .getByRole("link")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
    for (const url of urls)
      reached.add(new URL(url, h.base).searchParams.get("date"));
    if (n < 4) {
      const next = guest.page.getByRole("link", {
        name: "Next dates",
        exact: true,
      });
      const href = await next.getAttribute("href");
      await next.click();
      await expect(guest.page).toHaveURL(new URL(href, h.base).href, {
        timeout: 90000,
      });
      await expect(
        guest.page
          .getByRole("navigation", {
            name: "Private session dates",
            exact: true,
          })
          .locator('[aria-current="date"]'),
      ).toHaveAttribute("href", href, { timeout: 90000 });
    }
  }
  assert.equal(reached.size, 30);
  assert.ok(reached.has(plus(29)));
  assert.ok(!reached.has(plus(30)));
  h.record(
    "DEV0255: real public navigation reaches exactly thirty local dates",
  );
  await publicDate(plus(29), guest.page);
  assert.equal(await rows(guest.page).count(), 8);
  assert.ok(
    (await rows(guest.page).allTextContents()).some((text) =>
      text.includes("DEV0253 Riverside deck — long training venue"),
    ),
  );
  const returnLink = guest.page
    .getByRole("link", { name: "Sign in to request", exact: true })
    .first();
  const signIn = await returnLink.getAttribute("href");
  const returnTo = new URL(signIn, h.base).searchParams.get("returnTo");
  assert.equal(
    returnTo,
    "/coaches/" + owner.slug + "?date=" + plus(29) + "#private-schedule",
  );
  await returnLink.click();
  await expect(guest.page).toHaveURL(/\/sign-in\?/);
  await guest.context.addCookies(
    athlete.cookies.map((c) => ({ ...c, url: h.base })),
  );
  await guest.page.goto(h.base + returnTo);
  assert.equal(
    await guest.page.getByText("Requested", { exact: true }).count(),
    0,
    "Sign-in return never submits automatically.",
  );
  const lastId = await rows(guest.page).first().getAttribute("data-slot-id");
  await request(guest.page, lastId);
  await guest.page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await expect(
    guest.page
      .locator(`li[data-slot-id="${lastId}"]`)
      .getByText("Requested", { exact: true }),
  ).toBeVisible();
  h.record(
    "DEV0255: final-day request saved through the real action and remained requested after reload",
  );
  const [lastAttempt] = await h.ownerQuery(
    `select id from app.coach_booking_requests where slot_id=${h.uuid(lastId)} and client_profile_id=${h.uuid(athlete.profileId)};`,
  );
  await guest.page
    .locator(`li[data-slot-id="${lastId}"]`)
    .getByRole("button", { name: "Withdraw request", exact: true })
    .click();
  const savedWithdrawal = guest.page.getByText("Request withdrawn.", {
    exact: true,
  });
  const unavailableWithdrawal = guest.page.getByText(
    "MovX could not verify the result. Refresh to check your requests and bookings before trying again.",
    { exact: true },
  );
  await expect
    .poll(
      async () =>
        (await savedWithdrawal.isVisible())
          ? "saved"
          : (await unavailableWithdrawal.isVisible())
            ? "unverified"
            : "waiting",
      { timeout: 90000 },
    )
    .not.toBe("waiting");
  if (await unavailableWithdrawal.isVisible()) {
    console.log(
      "OBSERVED unavailable withdrawal; checking authoritative state before one explicit retry.",
    );
    const refreshResponse = guest.page.waitForResponse(
      (response) =>
        response.request().isNavigationRequest() &&
        response.request().method() === "GET",
    );
    await guest.page
      .getByRole("button", { name: "Refresh available times", exact: true })
      .click();
    assert.equal((await refreshResponse).status(), 200);
    const [current] = await h.ownerQuery(
      `select status from app.coach_booking_requests where id=${h.uuid(lastAttempt.id)};`,
    );
    if (current.status === "pending") {
      await guest.page.waitForFunction((id) => {
        const button = document.querySelector(
          `li[data-slot-id="${id}"] button`,
        );
        return (
          button &&
          Object.keys(button).some((key) => key.startsWith("__reactProps$"))
        );
      }, lastId);
      await guest.page
        .locator(`li[data-slot-id="${lastId}"]`)
        .getByRole("button", { name: "Withdraw request", exact: true })
        .click();
      await expect(savedWithdrawal).toBeVisible({ timeout: 90000 });
    } else assert.equal(current.status, "withdrawn");
  }
  const [withdrawn] = await h.ownerQuery(
    `select count(*)::int n,min(status) status,min(id::text) id from app.coach_booking_requests where slot_id=${h.uuid(lastId)} and client_profile_id=${h.uuid(athlete.profileId)};`,
  );
  assert.equal(withdrawn.n, 1);
  assert.equal(withdrawn.id, lastAttempt.id);
  assert.equal(withdrawn.status, "withdrawn");
  await publicDate(plus(30), guest.page);
  await expect(
    guest.page.getByText(/outside the current 30-day request window/),
  ).toBeVisible();
  assert.equal(await rows(guest.page).count(), 0);
  const native = await h.open(null, false);
  await native.page.goto(profile(today));
  await native.page
    .getByRole("link", { name: "Next dates", exact: true })
    .click();
  await native.page.waitForLoadState("networkidle");
  await native.page.getByLabel("Choose a date", { exact: true }).fill(plus(29));
  await native.page
    .getByRole("button", { name: "Show times", exact: true })
    .click();
  assert.equal(await rows(native.page).count(), 8);
  await native.context.close();
  for (const invalidId of [randomUUID()])
    await assert.rejects(
      h.asActor(
        athlete,
        (tx) => tx`select app.create_coach_booking_request(${invalidId}::uuid)`,
      ),
    );
  const [edges] =
    await h.runtime`select app.availability_in_horizon('2026-11-23 22:00+01','2026-11-23 23:00+01','2026-10-25 00:00+02') autumn_last, app.availability_in_horizon('2026-11-24 00:00+01','2026-11-24 01:00+01','2026-10-25 00:00+02') autumn_outside,app.availability_in_horizon('2026-04-26 22:00+02','2026-04-26 23:00+02','2026-03-28 00:00+01') spring_last,app.availability_in_horizon('2026-04-27 00:00+02','2026-04-27 01:00+02','2026-03-28 00:00+01') spring_outside`;
  assert.deepEqual(
    { ...edges },
    {
      autumn_last: true,
      autumn_outside: false,
      spring_last: true,
      spring_outside: false,
    },
  );
  h.record(
    "DEV0255: all 30 public dates, real final-day request/reload/withdraw, safe sign-in return, native guest navigation and DB DST boundaries",
  );
  phase = "responsive public/editor and access checks";
  for (const width of [1440, 375, 430]) {
    await page.setViewportSize({ width, height: 1000 });
    await openEditor();
    await page.screenshot({
      path: path.join(h.output, "availability-" + width + ".png"),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await client.setViewportSize({ width, height: 1000 });
    await publicDate(plus(29));
    await client.screenshot({
      path: path.join(h.output, "public-" + width + ".png"),
      fullPage: true,
    });
    assert.ok(
      await client.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const dateLink = client.getByRole("link", { name: "Today", exact: true });
    await dateLink.focus();
    await client.keyboard.press("Enter");
    await expect(
      client
        .getByRole("navigation", { name: "Private session dates" })
        .locator('[aria-current="date"]'),
    ).toBeVisible();
  }
  for (const p of [athlete, applicant]) {
    const denied = await h.open(p);
    await denied.page.goto(availability());
    assert.equal(
      await denied.page
        .getByRole("region", { name: "Availability editor", exact: true })
        .count(),
      0,
    );
    await denied.context.close();
  }
  const otherBrowser = await h.open(other);
  await otherBrowser.page.goto(availability());
  await expect(
    otherBrowser.page.getByRole("switch", {
      name: "Monday available",
      exact: true,
    }),
  ).not.toBeChecked();
  await otherBrowser.context.close();
  await h.ownerQuery(
    `begin;select app.review_coach_application(${h.uuid(owner.profileId)},'approved','suspended','Temporary rehearsal account only.','dev0253-live','movx-identity-application-v1');commit;select true changed;`,
  );
  await page.goto(availability());
  assert.equal(await editor().count(), 0);
  assert.deepEqual(errors, []);
  h.record(
    "DEV0253/DEV0255: actual desktop/375/430, keyboard and athlete/applicant/suspended editor denial",
  );
  success = true;
}

async function raceVenue(owner) {
  return h.asActor(
    owner,
    async (tx) =>
      (
        await tx`select app.create_owned_coach_training_location('DEV0253 venue race',null,'Temporary Berlin race venue',52.52,13.42,'manual',null) id`
      )[0].id,
  );
}
async function inactiveVenueScenario() {
  phase = "inactive venue after review";
  await h.start();
  const owner = await h.person("Owner", true),
    venue = await raceVenue(owner);
  const { page } = await h.open(owner);
  const before = await exerciseInactiveVenueRace(owner, page, venue);
  assert.deepEqual(before, { revision: 0, receipts: 0 });
  success = true;
}
async function exerciseInactiveVenueRace(owner, page, venue) {
  await page.goto(h.base + "/coach?view=schedule&section=availability", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("region", { name: "Availability editor", exact: true }),
  ).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".availability-editor button")].some((el) =>
      Object.keys(el).some((key) => key.startsWith("__reactProps$")),
    ),
  );
  await page
    .getByRole("switch", { name: "Monday available", exact: true })
    .check();
  await page
    .getByLabel("Monday range 1 venue", { exact: true })
    .selectOption(venue);
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "Review availability changes",
      exact: true,
    }),
  ).toBeVisible({ timeout: 90000 });
  const [state] = await h.ownerQuery(
    `select to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where id=${h.uuid(venue)};`,
  );
  await h.asActor(
    owner,
    (tx) =>
      tx`select app.deactivate_owned_coach_training_location(${venue}::uuid,${state.stamp}::text::timestamptz,null,null)`,
  );
  const [before] = await h.ownerQuery(
    `select coalesce((select revision from app.coach_availability_policies where profile_id=${h.uuid(owner.profileId)}),0) revision,(select count(*)::int from app.coach_availability_operations where profile_id=${h.uuid(owner.profileId)}) receipts;`,
  );
  await dialog
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(
    page.getByText(
      "These hours could not be saved. Review the dates and current venues; your draft is still here.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Monday range 1 venue", { exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Monday range 1 venue", { exact: true }),
  ).toHaveValue(venue);
  assert.equal(
    await page
      .getByRole("button", { name: "Retry same save", exact: true })
      .count(),
    0,
  );
  const [saved] = await h.ownerQuery(
    `select coalesce((select revision from app.coach_availability_policies where profile_id=${h.uuid(owner.profileId)}),0) revision,(select count(*)::int from app.coach_availability_operations where profile_id=${h.uuid(owner.profileId)}) receipts;`,
  );
  assert.deepEqual(saved, before);
  h.record(
    "DEV0253: venue deactivated after review returns invalid, keeps the editable draft and adds no revision or receipt",
  );
  return before;
}
