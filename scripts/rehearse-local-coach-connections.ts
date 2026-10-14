import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import postgres from "postgres";
import sharp from "sharp";
import {
  assertLoopbackSupabaseTargets,
  parseLocalSupabaseStatus,
} from "./lib/local-coach-accounts";
import { localDevelopmentEnvironment } from "./lib/local-development";
import type { AuthorizedActor } from "../src/server/authorization/contracts";

// Private CLI values stay in memory; this script can only use the repository's
// loopback Auth/Storage/PostgreSQL and newly tagged local .test identities.
const status = parseLocalSupabaseStatus(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  }).toString(),
);
assertLoopbackSupabaseTargets(status);
Object.assign(process.env, localDevelopmentEnvironment(status));
const base = "http://localhost:3100";
const evidence = "test-results/coach-connections-rehearsal";
const auth = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const database = postgres(status.databaseUrl, {
  max: 1,
  prepare: false,
  ssl: false,
  onnotice: () => {},
});
const { withActorDatabaseContext } =
  await import("../src/server/db/authorization/repository");
const { enrollApplicationProfile } =
  await import("../src/server/db/identity/repository");
const { submitOwnedCoachApplicationRecord } =
  await import("../src/server/db/coaches/application-repository");
const { upsertOwnedCoachProfileRecord } =
  await import("../src/server/db/coaches/repository");
const {
  sendConnectionRecord,
  decideConnectionRecord,
  bookingConnectionContextRecord,
  connectionHistoryRecord,
} = await import("../src/server/db/connections/repository");
const { cancelDirectPrivateBookingRecord } =
  await import("../src/server/db/coaches/booking-repository");
type Person = {
  id: string;
  actor: AuthorizedActor;
  cookies: { name: string; value: string }[];
  name: string;
};
const people: Person[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let phase = "setup";
let offset = 4;
const work = <T>(
  person: Person,
  fn: Parameters<typeof withActorDatabaseContext<T>>[1],
) => withActorDatabaseContext(person.actor, fn);

async function person(name: string): Promise<Person> {
  const email = `dev0222-connections-${randomUUID()}@users.movx.test`,
    password = randomUUID();
  const result = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { movx_test_ticket: "DEV0222", temporary: true },
  });
  if (result.error || !result.data.user)
    throw new Error("Cannot create a local connection rehearsal identity.");
  const id = result.data.user.id;
  // Track the exact account immediately so failures before enrolment can clean it.
  const entry = {
    id,
    actor: null as unknown as AuthorizedActor,
    cookies: [],
    name,
  } as Person;
  people.push(entry);
  const enrolled = await enrollApplicationProfile(id, name);
  assert.ok(enrolled);
  entry.actor = {
    authUserId: id,
    profileId: enrolled.profileId,
    runId: enrolled.runId,
    runRole: "member",
  };
  const client = createServerClient(status.apiUrl, status.publishableKey, {
    cookies: {
      getAll: () => entry.cookies,
      setAll: (values) => {
        entry.cookies = values.map(({ name, value }) => ({ name, value }));
      },
    },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error)
    throw new Error(
      "Cannot authenticate a local connection rehearsal identity.",
    );
  return entry;
}
async function booking(coach: Person, athlete: Person) {
  const slotId = randomUUID(),
    bookingId = randomUUID();
  const start = new Date(
    Math.ceil((Date.now() + offset * 3600000) / 900000) * 900000,
  ).toISOString();
  offset += 2;
  await database.begin(async (tx) => {
    await tx`insert into app.coach_availability_slots(id,run_id,profile_id,starts_at,ends_at,coach_timezone,status,location_kind,selected_gym_id,gym_name,public_location_label,latitude,longitude,location_source,location_provider,location_confirmed_at,coach_training_location_id,training_location_name)
      select ${slotId}::uuid,l.run_id,l.profile_id,${start}::timestamptz,${start}::timestamptz+interval '1 hour',l.timezone,'booked',l.location_kind,l.selected_gym_id,g.name,l.public_location_label,l.latitude,l.longitude,l.location_source,l.location_provider,l.location_confirmed_at,l.id,l.public_name
      from app.coach_training_locations l left join app.gyms g on g.id=l.selected_gym_id and g.run_id=l.run_id where l.profile_id=${coach.actor.profileId}::uuid and l.is_primary and l.status='active'`;
    await tx`insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,credit_projection_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at)
      values(${bookingId}::uuid,${coach.actor.runId}::uuid,${slotId}::uuid,${coach.actor.profileId}::uuid,${athlete.actor.profileId}::uuid,null,'confirmed',${start}::timestamptz,${start}::timestamptz+interval '1 hour',${start}::timestamptz,${start}::timestamptz)`;
  });
  return { slotId, bookingId };
}
async function requestFixture(
  coach: Person,
  athlete: Person,
  slotId: string,
  requestStatus: string,
  bookingId: string | null = null,
) {
  const id = randomUUID();
  const decider =
    requestStatus === "withdrawn"
      ? athlete.actor.profileId
      : requestStatus === "expired"
        ? null
        : coach.actor.profileId;
  await database`insert into app.coach_booking_requests(id,run_id,slot_id,coach_profile_id,client_profile_id,status,scheduled_start_at,scheduled_end_at,coach_timezone,coach_training_location_id,training_location_name,location_kind,gym_name,public_location_label,created_at,decision_deadline_at,decided_by_profile_id,decided_at,accepted_booking_id)
    select ${id}::uuid,s.run_id,s.id,s.profile_id,${athlete.actor.profileId}::uuid,${requestStatus},s.starts_at,s.ends_at,s.coach_timezone,s.coach_training_location_id,s.training_location_name,s.location_kind,s.gym_name,s.public_location_label,
      case when ${requestStatus}='expired' then statement_timestamp()-interval '13 hours' else date_trunc('second',statement_timestamp())-interval '2 minutes'+interval '123456 microseconds' end,
      case when ${requestStatus}='expired' then statement_timestamp()-interval '1 hour' else least(s.starts_at,statement_timestamp()+interval '12 hours') end,
      ${decider}::uuid,statement_timestamp(),${bookingId}::uuid from app.coach_availability_slots s where s.id=${slotId}::uuid`;
  return id;
}
async function send(person: Person, bookingId: string) {
  return work(person, async (tx) => {
    const current = await bookingConnectionContextRecord(tx, bookingId);
    return sendConnectionRecord(
      tx,
      bookingId,
      randomUUID(),
      current.connection?.id ?? null,
    );
  });
}
async function decide(
  person: Person,
  id: string,
  action: "accept" | "decline" | "withdraw" | "disconnect",
) {
  return work(person, (tx) => decideConnectionRecord(tx, id, action));
}
function cookieHeader(person: Person) {
  return person.cookies.map(({ name, value }) => name + "=" + value).join("; ");
}
async function cleanup() {
  const owned = await database<
    {
      id: string;
      profile_id: string | null;
      avatar_storage_path: string | null;
    }[]
  >`select u.id,p.id as profile_id,p.avatar_storage_path from auth.users u left join app.profiles p on p.auth_user_id=u.id
    where u.raw_app_meta_data->>'movx_test_ticket'='DEV0222' and u.raw_app_meta_data->>'temporary'='true' and u.email like 'dev0222-connections-%@users.movx.test'`;
  for (const row of owned)
    if (row.avatar_storage_path) {
      assert.ok(
        row.profile_id &&
          row.avatar_storage_path.startsWith(row.profile_id + "/"),
      );
      const removed = await auth.storage
        .from("account-avatars")
        .remove([row.avatar_storage_path]);
      if (removed.error)
        throw new Error("Cannot remove an exact local rehearsal image.");
    }
  const ids = owned.flatMap((row) => (row.profile_id ? [row.profile_id] : []));
  if (ids.length)
    await database.begin(async (tx) => {
      await tx`update app.coach_profiles set visibility='hidden' where profile_id=any(${ids}::uuid[]) and visibility='visible'`;
      await tx`delete from app.coach_athlete_connection_attempts where pair_id in(select id from app.coach_athlete_connection_pairs where coach_profile_id=any(${ids}::uuid[]) or athlete_profile_id=any(${ids}::uuid[]))`;
      await tx`delete from app.coach_athlete_connection_pairs where coach_profile_id=any(${ids}::uuid[]) or athlete_profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.coach_booking_requests where coach_profile_id=any(${ids}::uuid[]) or client_profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.coach_private_bookings where coach_profile_id=any(${ids}::uuid[]) or client_profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.coach_availability_slots where profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.coach_availability_rules where profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.coach_training_locations where profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.coach_profile_disciplines where profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.coach_profiles where profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.coach_application_review_events where profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.coach_applications where profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.demo_run_participants where profile_id=any(${ids}::uuid[])`;
      await tx`delete from app.profiles where id=any(${ids}::uuid[])`;
    });
  for (const row of owned) {
    const deleted = await auth.auth.admin.deleteUser(row.id);
    if (deleted.error)
      throw new Error("Cannot remove an exact local rehearsal account.");
  }
}
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
    await work(coach, submitOwnedCoachApplicationRecord);
    await work(coach, (tx) =>
      upsertOwnedCoachProfileRecord(tx, {
        displayName: coach.name,
        bio: "An isolated local test coach for private connection consent and retained history validation.",
        disciplines: ["Boxing"],
        timezone: "Europe/Berlin",
        visibility: "hidden",
        selectedGymId: "40000000-0000-4000-8000-000000000001",
        independentLocation: null,
      }),
    );
    await database`select app.review_coach_application(${coach.actor.profileId}::uuid,'pending','approved','Local-only DEV0222 coach UI rehearsal.','local-test','movx-identity-application-v1')`;
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
