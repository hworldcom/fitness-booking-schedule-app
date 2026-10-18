import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium, expect as baseExpect } from "@playwright/test";
import postgres from "postgres";
import {
  parseLocalSupabaseStatus,
  assertLoopbackSupabaseTargets,
} from "./lib/local-coach-accounts";
import {
  localDevelopmentEnvironment,
  localDevelopmentProcessEnvironment,
} from "./lib/local-development";
import { withActorDatabaseContext } from "../src/server/db/authorization/repository";
import { upsertOwnedCoachProfileRecord } from "../src/server/db/coaches/repository";
import { submitOwnedCoachApplicationRecord } from "../src/server/db/coaches/application-repository";
import { saveOwnedEffectiveAvailabilityRecord } from "../src/server/db/coaches/effective-availability-repository";
import {
  sendConnectionRecord,
  decideConnectionRecord,
} from "../src/server/db/connections/repository";
import type { AuthorizedActor } from "../src/server/authorization/contracts";
const connection = process.env.DATABASE_TEST_URL;
assert.ok(connection && new URL(connection).pathname.startsWith("/dev0342_"));
const root = process.env.SESSION_TYPES_UI_ROOT;
assert.ok(root?.startsWith("/private/tmp/movx-dev0346-"));
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(connection).hostname) &&
    new URL(connection).port === "55322",
);
const base = "http://localhost:3113";
const tag = randomUUID().slice(0, 8);
const evidence = `work/dev0346/${tag}`;
await mkdir(evidence, { recursive: true });
const status = parseLocalSupabaseStatus(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  }).toString(),
);
assertLoopbackSupabaseTargets(status);
const runtime = new URL(connection);
runtime.username = "repx_runtime_login";
runtime.password = "postgres";
Object.assign(process.env, localDevelopmentEnvironment(status), {
  DATABASE_URL: runtime.toString(),
  NEXT_PUBLIC_SITE_URL: base,
});
const main = postgres(status.databaseUrl, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  }),
  db = postgres(connection, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
const auth = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ids: string[] = [];
const checks: string[] = [];
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const retained = () =>
  main`select c.profile_id,to_jsonb(c) coach,to_jsonb(p) profile from app.coach_profiles c join app.profiles p on p.id=c.profile_id where c.is_demo order by c.profile_id`;
const original = hash(await retained());
let server: ReturnType<typeof spawn> | undefined,
  browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let serverOutput = "";
async function person(name: string, coach = false) {
  const email = `dev0346-${randomUUID()}@users.movx.test`,
    password = randomUUID();
  const created = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { movx_test_ticket: "DEV0346", temporary: true },
  });
  assert.ifError(created.error);
  const id = created.data.user!.id;
  ids.push(id);
  const cookies: { name: string; value: string }[] = [];
  const signed = createServerClient(status.apiUrl, status.publishableKey, {
    cookies: {
      getAll: () => cookies,
      setAll: (values) => {
        for (const c of values) {
          const i = cookies.findIndex((v) => v.name === c.name);
          if (i >= 0) cookies.splice(i, 1);
          cookies.push({ name: c.name, value: c.value });
        }
      },
    },
  });
  const result = await signed.auth.signInWithPassword({ email, password });
  assert.ifError(result.error);
  assert.ok(result.data.session);
  // Mirror only these real, tagged Auth records into the disposable application DB.
  for (const table of ["users", "identities", "sessions"] as const) {
    const key = table === "users" ? "id" : "user_id";
    const rows = await main.unsafe(
      `select * from auth.${table} where ${key}=$1`,
      [id],
    );
    const columns =
      await main`select column_name from information_schema.columns where table_schema='auth' and table_name=${table} and is_generated='NEVER' order by ordinal_position`;
    const names = columns
      .map((c) => {
        assert.match(c.column_name, /^[a-z_]+$/);
        return '"' + c.column_name + '"';
      })
      .join(",");
    for (const row of rows)
      await db.unsafe(
        `insert into auth.${table}(${names}) select ${names} from jsonb_populate_record(null::auth.${table},$1::text::jsonb)`,
        [JSON.stringify(row)],
      );
  }
  const claims = JSON.parse(
    Buffer.from(
      result.data.session.access_token.split(".")[1],
      "base64url",
    ).toString(),
  );
  const [granted] =
    await db`select app.grant_application_auth_session(${id}::uuid,${claims.session_id}::uuid,'ordinary','/sessions',null) ok`;
  assert.equal(granted.ok, true);
  const [p] =
    await db`select * from app.enroll_application_identity(${id}::uuid,${name})`;
  const actor: AuthorizedActor = {
    authUserId: id,
    profileId: p.identity_profile_id,
    runId: p.identity_run_id,
    runRole: "member",
  };
  if (coach) {
    await withActorDatabaseContext(actor, submitOwnedCoachApplicationRecord);
    await withActorDatabaseContext(actor, (tx) =>
      upsertOwnedCoachProfileRecord(tx, {
        displayName: name,
        bio: "An isolated session type rehearsal coach for deliberate practice and feedback.",
        disciplines: ["Boxing"],
        timezone: "Europe/Berlin",
        visibility: "hidden",
        selectedGymId: "40000000-0000-4000-8000-000000000001",
        independentLocation: null,
      }),
    );
    await db`select app.review_coach_application(${actor.profileId}::uuid,'pending','approved','Isolated UI rehearsal.','database-test','movx-identity-application-v1')`;
    await db`update app.coach_profiles set visibility='visible' where profile_id=${actor.profileId}::uuid`;
  }
  return { id, actor, cookies, name };
}
try {
  console.log("Preparing isolated DEV0346 UI accounts and server.");
  const owner = await person(`Type Coach ${tag}`, true),
    athlete = await person(`Type Athlete ${tag}`);
  const [coach] =
    await db`select public_slug from app.coach_profiles where profile_id=${owner.actor.profileId}::uuid`;
  const [venue] =
    await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${owner.actor.profileId}::uuid and is_primary`;
  const [clock] =
    await db`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text target`;
  await withActorDatabaseContext(owner.actor, (tx) =>
    saveOwnedEffectiveAvailabilityRecord(tx, {
      kind: "dates",
      operationId: randomUUID(),
      expectedRevision: 0,
      dates: [
        {
          date: clock.target,
          mode: "custom",
          hours: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"].map(
            (localStartTime) => ({
              localStartTime,
              locationId: venue.id,
              locationUpdatedAt: venue.stamp,
            }),
          ),
        },
      ],
    }),
  );
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "localhost",
      "--port",
      "3113",
    ],
    {
      cwd: root,
      env: {
        ...localDevelopmentProcessEnvironment(status),
        DATABASE_URL: runtime.toString(),
        NEXT_PUBLIC_SITE_URL: base,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on("data", (b) => {
    serverOutput += b.toString();
  });
  server.stderr?.on("data", (b) => {
    serverOutput += b.toString();
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(
        base + "/api/coaches/" + coach.public_slug + "/session-types",
        { signal: AbortSignal.timeout(1000) },
      );
      const body = await r.json();
      if (
        r.ok &&
        body.catalog?.enabled &&
        server.exitCode === null &&
        serverOutput.includes("Ready")
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Isolated application did not start");
  for (const path of [
    "/coach/session-types",
    "/coach/bookings/new",
    "/coaches/" + coach.public_slug,
  ])
    await fetch(base + path, { signal: AbortSignal.timeout(180000) });
  browser = await chromium.launch({ headless: true });
  const expect = baseExpect.configure({ timeout: 60000 });
  const coachContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    athleteContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
  for (const [context, person] of [
    [coachContext, owner],
    [athleteContext, athlete],
  ] as const) {
    context.setDefaultNavigationTimeout(120000);
    await context.addCookies(person.cookies.map((c) => ({ ...c, url: base })));
  }
  const cp = await coachContext.newPage(),
    ap = await athleteContext.newPage();
  await cp.goto(base + "/coach/session-types");
  await expect(
    cp.getByRole("heading", { name: "Private session", exact: true }),
  ).toBeVisible();
  await cp
    .locator(".session-type-card")
    .filter({
      has: cp.getByRole("heading", { name: "Private session", exact: true }),
    })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await cp.getByLabel("Name", { exact: true }).fill("Private class 75 min");
  await cp.getByLabel("Duration", { exact: true }).selectOption("75");
  await cp.getByRole("button", { name: "Save type", exact: true }).click();
  await expect(cp.getByRole("status")).toHaveText("Saved.");
  checks.push("Owner edits default type to 75 minutes.");
  const catalog = await (
    await coachContext.request.get(base + "/api/coach/session-types")
  ).json();
  const privateType = catalog.types.find(
      (t: { format: string }) => t.format === "private",
    ),
    groupType = catalog.types.find(
      (t: { format: string }) => t.format === "group",
    );
  await cp.screenshot({
    path: evidence + "/types-desktop.png",
    fullPage: true,
  });
  await ap.goto(base + "/coaches/" + coach.public_slug);
  await ap
    .getByLabel("Session type", { exact: true })
    .selectOption(privateType.id);
  await ap.getByLabel("Venue", { exact: true }).selectOption(venue.id);
  await ap.getByLabel("Date", { exact: true }).fill(clock.target);
  await ap
    .getByRole("button", { name: "Show available times", exact: true })
    .click();
  await expect(ap.getByRole("radio").first()).toBeVisible();
  await ap.getByRole("radio").first().check();
  let lostOperation: string | null = null;
  await ap.route("**/api/session-bookings", async (route) => {
    lostOperation = route.request().postDataJSON().commandId;
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    await route.abort();
  });
  await ap
    .getByRole("button", { name: "Request session", exact: true })
    .click();
  await expect(
    ap.getByRole("button", { name: "Retry the same request", exact: true }),
  ).toBeVisible();
  await ap.unroute("**/api/session-bookings");
  await ap
    .getByRole("button", { name: "Retry the same request", exact: true })
    .click();
  assert.ok(lostOperation);

  await expect(
    ap.getByRole("status").filter({ hasText: "Request sent." }),
  ).toBeVisible();
  checks.push(
    "Athlete chooses type, venue, date and full 75-minute time, reviews and requests.",
  );
  await ap.screenshot({
    path: evidence + "/request-desktop.png",
    fullPage: true,
  });
  const [count] =
    await db`select count(*)::int count from app.coach_booking_requests where coach_profile_id=${owner.actor.profileId}::uuid and client_profile_id=${athlete.actor.profileId}::uuid`;
  assert.equal(count.count, 1);
  checks.push(
    "A lost successful response retries the original request without duplication.",
  );
  const [request] =
    await db`select id from app.coach_booking_requests where coach_profile_id=${owner.actor.profileId}::uuid and client_profile_id=${athlete.actor.profileId}::uuid and status='pending'`;
  // Exercise the existing real request decision action through its coach queue.
  await cp.goto(base + "/coach?view=bookings");
  const accept = cp
    .getByRole("button", { name: "Accept", exact: true })
    .first();
  if (await accept.count()) {
    await accept.click();
  } else {
    const response = await coachContext.request.post(
      base + "/api/session-bookings",
      { headers: { origin: base }, data: {} },
    );
    assert.equal(response.status(), 400);
    throw new Error("Coach acceptance control not found.");
  }
  await expect
    .poll(async () => {
      const [r] =
        await db`select status from app.coach_booking_requests where id=${request.id}::uuid`;
      return r.status;
    })
    .toBe("accepted");
  const [booking] =
    await db`select id from app.coach_private_bookings where coach_profile_id=${owner.actor.profileId}::uuid and client_profile_id=${athlete.actor.profileId}::uuid and status='confirmed'`;
  await ap.goto(base + "/sessions/" + booking.id);
  await expect(
    ap.getByRole("heading", { name: "Private class 75 min", exact: true }),
  ).toBeVisible();
  checks.push(
    "Coach accepts request; athlete sees the original confirmed booking and class terms.",
  );
  const sent = await withActorDatabaseContext(owner.actor, (tx) =>
    sendConnectionRecord(tx, booking.id, randomUUID(), null),
  );
  await withActorDatabaseContext(athlete.actor, (tx) =>
    decideConnectionRecord(tx, sent.id, "accept"),
  );
  await cp.goto(base + "/coach/bookings/new");
  await cp
    .getByLabel("Athlete", { exact: true })
    .selectOption(athlete.actor.profileId);
  await cp
    .getByLabel("Session type", { exact: true })
    .selectOption(privateType.id);
  await cp.getByLabel("Venue", { exact: true }).selectOption(venue.id);
  await cp
    .getByLabel("Start · Berlin time", { exact: true })
    .fill(clock.target + "T14:00");
  await cp.getByLabel("Duration", { exact: true }).selectOption("90");
  await cp.getByRole("button", { name: "Review session", exact: true }).click();
  await cp
    .getByRole("button", { name: "Confirm session", exact: true })
    .click();
  await expect(cp).toHaveURL(/\/sessions\//);
  const manualId = cp.url().split("/").at(-1)!;
  await cp
    .getByLabel("Start · Berlin time", { exact: true })
    .fill(clock.target + "T14:15");
  await cp.getByLabel("Duration", { exact: true }).selectOption("75");
  await cp.getByRole("button", { name: "Review change", exact: true }).click();
  await cp
    .getByRole("button", { name: "Save booking change", exact: true })
    .click();
  await expect(cp.getByRole("status")).toHaveText("Session saved.");
  await cp.reload();
  await expect(
    cp.getByText("Schedule changes (1)", { exact: true }),
  ).toBeVisible();
  assert.ok(manualId !== booking.id);
  checks.push(
    "Coach creates a 90-minute session for an accepted athlete, then changes that same booking to 75 minutes with retained history.",
  );
  await cp.screenshot({
    path: evidence + "/booking-change-desktop.png",
    fullPage: true,
  });
  await cp.goto(base + "/coach/events/new?draftId=" + randomUUID());
  await cp.locator('select[name="sessionTypeId"]').selectOption(groupType.id);
  await cp.locator('input[name="startsAt"]').fill(clock.target + "T20:00");
  await cp
    .getByRole("button", {
      name: "Use type defaults · review before saving",
      exact: true,
    })
    .click();
  await expect(cp.locator('input[name="title"]')).toHaveValue("Group session");
  await expect(cp.locator('input[name="endsAt"]')).toHaveValue(
    clock.target + "T21:00",
  );
  await cp.locator('select[name="discipline"]').selectOption("Boxing");
  await cp.locator('input[name="intendedLevel"]').fill("All levels");
  await cp.locator('select[name="locationId"]').selectOption(venue.id);
  await cp
    .locator('input[name="decisionDeadlineAt"]')
    .fill(clock.target + "T18:00");
  await cp.locator('input[name="minimumParticipants"]').fill("1");
  await cp.locator('input[name="maximumParticipants"]').fill("3");
  await cp.locator('input[name="price"]').fill("0");
  await cp
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await expect(
    cp.getByRole("button", { name: "Publish session", exact: true }),
  ).toBeVisible();
  const publishForm = cp.locator("form").filter({
    has: cp.getByRole("button", { name: "Publish session", exact: true }),
  });
  await publishForm.locator('input[name="acknowledge"]').check();
  await publishForm
    .getByRole("button", { name: "Publish session", exact: true })
    .click();
  await expect(
    cp.getByText("Published session", { exact: true }),
  ).toBeVisible();
  await ap.goto(base + "/events?sessionType=" + groupType.id);
  await expect(
    ap.getByRole("link", { name: "Group session", exact: true }),
  ).toHaveCount(1);
  checks.push(
    "Group type prefills a reviewed 60-minute draft; normal publication and public type filtering work.",
  );
  await cp.goto(
    base +
      "/coach?view=schedule&section=calendar&date=" +
      clock.target +
      "&calendarView=day",
  );
  await cp
    .getByRole("combobox", { name: "Session type", exact: true })
    .selectOption(groupType.id);
  await cp.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(cp).toHaveURL(new RegExp("sessionType=" + groupType.id));
  await expect(cp.locator(".coach-calendar-item").first()).toContainText(
    "Group session",
  );
  await cp.screenshot({
    path: evidence + "/calendar-type-desktop.png",
    fullPage: true,
  });
  checks.push(
    "Calendar filters by original type ID and keeps group status/venue labels.",
  );
  const denied = await athleteContext.request.post(
    base + "/api/coach/session-types",
    {
      headers: { origin: base },
      data: { commandId: randomUUID(), action: "defaults" },
    },
  );
  assert.equal(denied.status(), 403);
  const originDenied = await coachContext.request.post(
    base + "/api/coach/session-types",
    {
      headers: { origin: "https://invalid.example" },
      data: { commandId: randomUUID(), action: "defaults" },
    },
  );
  assert.equal(originDenied.status(), 400);
  await cp.goto(base + "/coach/session-types");
  await cp
    .locator(".session-type-card")
    .filter({
      has: cp.getByRole("heading", { name: privateType.name, exact: true }),
    })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await cp.getByLabel("Name", { exact: true }).fill("Unsaved reviewed change");
  const updated = await coachContext.request.post(
    base + "/api/coach/session-types",
    {
      headers: { origin: base },
      data: {
        commandId: randomUUID(),
        action: "save",
        id: privateType.id,
        expectedRevision: privateType.revision,
        format: privateType.format,
        name: privateType.name,
        description: privateType.description,
        color: privateType.color,
        durationMinutes: privateType.durationMinutes,
        defaultLocationId: privateType.defaultLocationId,
        bookable: privateType.bookable,
      },
    },
  );
  assert.equal(updated.status(), 200);
  await cp.getByRole("button", { name: "Save type", exact: true }).click();
  await expect(cp.getByRole("status")).toContainText("This type changed.");
  await expect(cp.getByLabel("Name", { exact: true })).toHaveValue(
    "Unsaved reviewed change",
  );
  cp.once("dialog", (dialog) => dialog.accept());
  await cp.getByRole("button", { name: "Reload catalog", exact: true }).click();
  await expect(
    cp.getByRole("heading", { name: privateType.name, exact: true }),
  ).toBeVisible();
  checks.push(
    "Wrong-role and cross-origin mutations fail; a stale owner save retains its draft and requires reload.",
  );

  for (const width of [375, 430]) {
    await cp.setViewportSize({ width, height: 900 });
    await cp.goto(base + "/coach/session-types");
    await expect(
      cp.getByRole("heading", { name: "Session types", exact: true }),
    ).toBeVisible();
    await expect(
      cp.getByRole("heading", { name: privateType.name, exact: true }),
    ).toBeVisible();
    assert.ok(
      await cp.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await cp.screenshot({
      path: `${evidence}/types-${width}.png`,
      fullPage: true,
    });
    await ap.setViewportSize({ width, height: 900 });
    await ap.goto(base + "/coaches/" + coach.public_slug);
    await ap
      .getByLabel("Session type", { exact: true })
      .selectOption(privateType.id);
    await ap.getByLabel("Venue", { exact: true }).selectOption(venue.id);
    await ap.getByLabel("Date", { exact: true }).fill(clock.target);
    await ap
      .getByRole("button", { name: "Show available times", exact: true })
      .click();
    await expect(ap.getByRole("radio").first()).toBeVisible();
    assert.ok(
      await ap.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    if (width === 375) {
      await ap.route("**/api/coaches/*/session-types?*", (route) =>
        route.abort(),
      );
      await ap
        .getByRole("button", { name: "Show available times", exact: true })
        .click();
      await expect(
        ap
          .getByRole("status")
          .filter({ hasText: "Available times couldn’t be verified." }),
      ).toBeVisible();
      await ap.unroute("**/api/coaches/*/session-types?*");
      await ap
        .getByRole("button", { name: "Show available times", exact: true })
        .click();
      await expect(ap.getByRole("radio").first()).toBeVisible();
      checks.push("An unavailable schedule recovers through explicit retry.");
    }
    await cp.goto(base + "/sessions/" + manualId);
    await expect(
      cp.getByRole("combobox", { name: "Duration", exact: true }),
    ).toHaveValue("75");
    assert.ok(
      await cp.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await cp.screenshot({
      path: `${evidence}/booking-${width}.png`,
      fullPage: true,
    });
    await cp.goto(
      base +
        "/coach?view=schedule&section=calendar&date=" +
        clock.target +
        "&calendarView=day&sessionType=" +
        groupType.id,
    );
    await expect(cp.locator(".coach-calendar-item").first()).toContainText(
      "Group session",
    );
    assert.ok(
      await cp.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await cp.screenshot({
      path: `${evidence}/calendar-${width}.png`,
      fullPage: true,
    });
    await ap.screenshot({
      path: `${evidence}/request-${width}.png`,
      fullPage: true,
    });
  }
  checks.push(
    "375px and 430px layouts: forms and available-time controls remain usable without horizontal overflow.",
  );
  await cp.goto(base + "/coach/session-types");
  for (const type of [privateType, groupType]) {
    const card = cp.locator(".session-type-card").filter({
      has: cp.getByRole("heading", { name: type.name, exact: true }),
    });
    await card.getByRole("button", { name: "Remove", exact: true }).focus();
    await cp.keyboard.press("Enter");
    await cp.getByRole("button", { name: "Remove type", exact: true }).click();
    await expect(cp.getByRole("status")).toHaveText("Saved.");
  }
  await cp.reload();
  await expect(
    cp.getByRole("button", { name: "Restore", exact: true }),
  ).toHaveCount(2);
  await expect(
    cp.getByRole("button", {
      name: "Add Private and Group defaults",
      exact: true,
    }),
  ).toHaveCount(0);
  await ap.goto(base + "/coaches/" + coach.public_slug);
  await expect(
    ap.getByText("This coach isn’t offering private classes right now.", {
      exact: true,
    }),
  ).toBeVisible();
  const restoredCard = cp.locator(".session-type-card").filter({
    has: cp.getByRole("heading", { name: privateType.name, exact: true }),
  });
  await restoredCard
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await expect(cp.getByRole("status")).toHaveText("Saved.");
  await ap.goto(base + "/coaches/" + coach.public_slug);
  await expect(
    ap.getByRole("combobox", { name: "Session type", exact: true }),
  ).toContainText(privateType.name);
  await restoredCard
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await cp.getByRole("button", { name: "Remove type", exact: true }).click();
  await expect(cp.getByRole("status")).toHaveText("Saved.");
  checks.push(
    "Explicit restoration reopens new selections without changing scheduled sessions.",
  );
  await ap.goto(base + "/sessions/" + booking.id);
  await expect(
    ap.getByRole("heading", { name: "Private class 75 min", exact: true }),
  ).toBeVisible();
  checks.push(
    "Keyboard removal of both defaults survives reload, stops new booking and preserves confirmed session details.",
  );
  await ap.goto(base + "/coach/session-types");
  await expect(ap.getByRole("status")).toContainText("coach access");
  await expect(
    ap.getByRole("heading", { name: "Private class 75 min", exact: true }),
  ).toHaveCount(0);
  checks.push("An athlete cannot read coach-owned type drafts.");
  assert.equal(hash(await retained()), original, "Retained demo data changed");
  checks.push("Retained main-database demo profiles unchanged.");
  await writeFile(
    evidence + "/results.json",
    JSON.stringify(
      {
        checks,
        temporaryAuthUsers: ids.length,
        disposableDatabase: new URL(connection).pathname,
        completed: true,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ checks: checks.length, evidence, passed: true }),
  );
} catch (error) {
  await writeFile(evidence + "/server.log", serverOutput);
  if (error instanceof Error)
    await writeFile(evidence + "/failure.txt", error.message.slice(0, 8000));
  try {
    const page = browser?.contexts()[0]?.pages().at(-1);
    await page?.screenshot({ path: evidence + "/failure.png", fullPage: true });
  } catch {}
  console.error(
    error instanceof Error
      ? error.message.split("\n")[0]
      : "UI rehearsal failed",
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) {
    if (server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise((resolve) => server!.once("exit", resolve));
    }
  }
  for (const id of ids) {
    const [u] =
      await main`select raw_app_meta_data->>'movx_test_ticket' ticket from auth.users where id=${id}::uuid`;
    assert.equal(u?.ticket, "DEV0346");
    const removed = await auth.auth.admin.deleteUser(id);
    assert.ifError(removed.error);
  }
  assert.equal(
    hash(await retained()),
    original,
    "Retained demo data changed during cleanup",
  );
  await main.end();
  await db.end();
}
