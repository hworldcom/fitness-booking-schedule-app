import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const siteUrl =
  process.env.COACH_REQUEST_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.COACH_REQUEST_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const databaseUrl =
  process.env.COACH_REQUEST_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const coachProfileId = "10000000-0000-4000-8000-000000000002";
const coachEmail = "daniel.park@coaches.movx.test";
const clientCount = 24;
const evidenceDirectory = "test-results/coach-request-rehearsal";
const rehearsalEmailPattern = "dev0189-client-%@users.movx.test";

function assertLocalDatabaseTarget() {
  const database = new URL(databaseUrl);
  if (
    !new Set(["postgres:", "postgresql:"]).has(database.protocol) ||
    !new Set(["localhost", "127.0.0.1"]).has(database.hostname) ||
    database.port !== "55322"
  ) {
    throw new Error(
      "Coach request rehearsal is restricted to loopback PostgreSQL on port 55322.",
    );
  }
}

assertLocalDatabaseTarget();
const database = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: false,
});

async function rehearsalAuthUserIds() {
  const rows = await database`
    select id::text
    from auth.users
    where email like ${rehearsalEmailPattern}
  `;
  return rows.map((row) => row.id);
}

async function cleanupRehearsalFixtures() {
  const authUserIds = await rehearsalAuthUserIds();
  if (authUserIds.length === 0) return;
  const profiles = await database`
    select id::text
    from app.profiles
    where auth_user_id in ${database(authUserIds)}
  `;
  const profileIds = profiles.map((profile) => profile.id);
  if (profileIds.length > 0) {
    const slotRows = await database`
      select distinct slot_id::text
      from app.coach_booking_requests
      where client_profile_id in ${database(profileIds)}
      union
      select distinct slot_id::text
      from app.coach_private_bookings
      where client_profile_id in ${database(profileIds)}
    `;
    const slotIds = slotRows.map((slot) => slot.slot_id);
    await database.begin(async (transaction) => {
      await transaction`
        select
          set_config('app.coach_booking_request_management', 'on', true),
          set_config('app.coach_booking_management', 'on', true),
          set_config('app.coach_availability_management', 'on', true)
      `;
      await transaction`
        delete from app.coach_booking_requests
        where client_profile_id in ${transaction(profileIds)}
      `;
      await transaction`
        delete from app.coach_private_bookings
        where client_profile_id in ${transaction(profileIds)}
          ${slotIds.length > 0 ? transaction`or slot_id in ${transaction(slotIds)}` : transaction``}
      `;
      if (slotIds.length > 0) {
        await transaction`
          delete from app.coach_availability_slots
          where id in ${transaction(slotIds)}
        `;
      }
      await transaction`
        delete from app.demo_run_participants
        where profile_id in ${transaction(profileIds)}
      `;
      await transaction`
        delete from app.profiles
        where id in ${transaction(profileIds)}
      `;
    });
  }
  await database`
    delete from auth.users
    where id in ${database(authUserIds)}
  `;
}

async function createClients() {
  const nonce = Date.now();
  const clients = [];
  for (let index = 0; index < clientCount; index += 1) {
    const displayName = `DEV0189 Client ${String(index + 1).padStart(2, "0")}`;
    const email = `dev0189-client-${nonce}-${index + 1}@users.movx.test`;
    const authUserId = randomUUID();
    await database`
      insert into auth.users (
        id,
        email,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      ) values (
        ${authUserId}::uuid,
        ${email},
        statement_timestamp(),
        jsonb_build_object('movx_dev0189_rehearsal', true),
        jsonb_build_object('display_name', ${displayName}::text),
        statement_timestamp(),
        statement_timestamp()
      )
    `;
    const [identity] = await database`
      select
        identity_profile_id::text as profile_id,
        identity_run_id::text as run_id,
        identity_role as role
      from app.enroll_application_identity(
        ${authUserId}::uuid,
        ${displayName}::text
      )
    `;
    assert.ok(identity);
    clients.push({
      authUserId,
      profileId: identity.profile_id,
      runId: identity.run_id,
      role: identity.role,
      displayName,
    });
  }
  return clients;
}

async function coachLocationSnapshot() {
  const [snapshot] = await database`
    select
      coach.run_id::text,
      coach.profile_id::text,
      coach.timezone,
      location.id::text as training_location_id,
      location.public_name as training_location_name,
      location.location_kind,
      location.selected_gym_id::text,
      gym.name as gym_name,
      location.public_location_label,
      location.latitude,
      location.longitude,
      location.location_source,
      location.location_provider,
      location.location_confirmed_at
    from app.coach_profiles as coach
    join app.coach_training_locations as location
      on location.run_id = coach.run_id
      and location.profile_id = coach.profile_id
      and location.status = 'active'
      and location.is_primary
    left join app.gyms as gym
      on gym.run_id = location.run_id
      and gym.id = location.selected_gym_id
    where coach.profile_id = ${coachProfileId}::uuid
      and coach.visibility = 'visible'
  `;
  assert.ok(snapshot, "Daniel Park needs one visible active primary location.");
  return snapshot;
}

async function availableStarts(runId) {
  const starts = [];
  const quarterHour = 15 * 60 * 1000;
  let candidate =
    Math.ceil((Date.now() + 36 * 60 * 60 * 1000) / quarterHour) * quarterHour;
  for (let attempt = 0; attempt < 200 && starts.length < 3; attempt += 1) {
    const start = new Date(candidate);
    const end = new Date(candidate + 60 * 60 * 1000);
    const [row] = await database`
      select not exists (
        select 1
        from app.coach_availability_slots
        where run_id = ${runId}::uuid
          and profile_id = ${coachProfileId}::uuid
          and status in ('open', 'held', 'booked')
          and tstzrange(starts_at, ends_at, '[)')
            && tstzrange(${start}, ${end}, '[)')
      ) as available
    `;
    if (row.available) starts.push(start);
    candidate += 2 * 60 * 60 * 1000;
  }
  assert.equal(starts.length, 3, "Three future rehearsal hours are required.");
  return starts;
}

async function createOccurrences(snapshot) {
  const starts = await availableStarts(snapshot.run_id);
  const slotIds = [];
  await database.begin(async (transaction) => {
    await transaction`
      select set_config('app.coach_availability_management', 'on', true)
    `;
    for (const start of starts) {
      const slotId = randomUUID();
      await transaction`
        insert into app.coach_availability_slots (
          id,
          run_id,
          profile_id,
          starts_at,
          ends_at,
          coach_timezone,
          status,
          location_kind,
          selected_gym_id,
          gym_name,
          public_location_label,
          latitude,
          longitude,
          location_source,
          location_provider,
          location_confirmed_at,
          coach_training_location_id,
          training_location_name
        ) values (
          ${slotId}::uuid,
          ${snapshot.run_id}::uuid,
          ${snapshot.profile_id}::uuid,
          ${start},
          ${new Date(start.getTime() + 60 * 60 * 1000)},
          ${snapshot.timezone},
          'open',
          ${snapshot.location_kind},
          ${snapshot.selected_gym_id}::uuid,
          ${snapshot.gym_name},
          ${snapshot.public_location_label},
          ${snapshot.latitude},
          ${snapshot.longitude},
          ${snapshot.location_source},
          ${snapshot.location_provider},
          ${snapshot.location_confirmed_at},
          ${snapshot.training_location_id}::uuid,
          ${snapshot.training_location_name}
        )
      `;
      slotIds.push(slotId);
    }
  });
  return slotIds;
}

async function createRequests(clients, slotIds) {
  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index];
    const slotId = slotIds[index % slotIds.length];
    await database.begin(async (transaction) => {
      await transaction`
        select
          set_config('app.current_auth_user_id', ${client.authUserId}, true),
          set_config('app.current_profile_id', ${client.profileId}, true),
          set_config('app.current_run_id', ${client.runId}, true),
          set_config('app.current_run_role', ${client.role}, true)
      `;
      const [request] = await transaction`
        select * from app.create_coach_booking_request(${slotId}::uuid)
      `;
      assert.equal(request.request_status, "pending");
    });
  }
}

async function mailboxMessageIds(email) {
  const response = await fetch(`${mailboxUrl}/api/v1/messages`);
  if (!response.ok) throw new Error("The local captured mailbox is offline.");
  const mailbox = await response.json();
  return new Set(
    (mailbox.messages ?? [])
      .filter((message) =>
        message.To?.some((recipient) => recipient.Address === email),
      )
      .map((message) => message.ID),
  );
}

async function newEmailCode(email, previousIds) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(`${mailboxUrl}/api/v1/messages`);
    if (!response.ok) throw new Error("The local captured mailbox is offline.");
    const mailbox = await response.json();
    const message = mailbox.messages?.find(
      (candidate) =>
        !previousIds.has(candidate.ID) &&
        candidate.To?.some((recipient) => recipient.Address === email),
    );
    const code = message?.Snippet?.match(/\b\d{6}\b/)?.[0];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The local coach sign-in email did not arrive in time.");
}

async function signIn(page) {
  const previousIds = await mailboxMessageIds(coachEmail);
  await page.goto(`${siteUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const button = document.querySelector(
      'form.auth-form button[type="submit"]',
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.getByLabel("Email address").fill(coachEmail);
  await page.locator('form.auth-form button[type="submit"]').click();
  await page.getByText("Check your email.").waitFor({ timeout: 60_000 });
  await page
    .getByLabel("Six-digit code")
    .fill(await newEmailCode(coachEmail, previousIds));
  await page.locator('form.auth-form button[type="submit"]').click();
  await page
    .getByText("Signed in as Daniel Park.")
    .waitFor({ timeout: 30_000 });
}

function pendingGroup(page, slotId) {
  return page.locator(`article.coach-request-group[data-slot-id="${slotId}"]`);
}

async function loadEveryRequestPage(page) {
  const loadMore = page.getByRole("button", { name: "Load more requests" });
  for (let attempts = 0; attempts < 5; attempts += 1) {
    if ((await loadMore.count()) === 0) return;
    await loadMore.click();
    await page.waitForTimeout(150);
  }
  throw new Error("The request rehearsal exceeded its bounded page count.");
}

async function rehearseQueue(page, slotIds) {
  await page.goto(`${siteUrl}/coach?view=bookings`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", { name: "Run your coaching week." })
    .waitFor();
  await page.getByText("Profile published", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Booking requests" }).waitFor();
  await page.getByText("20 pending shown", { exact: true }).waitFor();
  await loadEveryRequestPage(page);
  await page.getByText("24 pending", { exact: true }).waitFor();
  for (const slotId of slotIds) {
    assert.equal(
      await pendingGroup(page, slotId)
        .locator(".coach-request-candidates > li")
        .count(),
      8,
    );
  }

  await page.screenshot({
    path: `${evidenceDirectory}/coach-request-queue-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 393, height: 852 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  const firstAccept = pendingGroup(page, slotIds[0])
    .getByRole("button", { name: "Accept", exact: true })
    .first();
  const firstAcceptBox = await firstAccept.boundingBox();
  assert.ok(firstAcceptBox && firstAcceptBox.height >= 44);
  await firstAccept.focus();
  assert.equal(
    await firstAccept.evaluate((element) => element === document.activeElement),
    true,
  );
  const closeTrigger = pendingGroup(page, slotIds[2]).getByRole("button", {
    name: "Close this occurrence",
    exact: true,
  });
  await closeTrigger.focus();
  await page.keyboard.press("Enter");
  await pendingGroup(page, slotIds[2])
    .getByText(/recurring schedule will not change/i)
    .waitFor();
  await pendingGroup(page, slotIds[2])
    .getByRole("button", { name: "Keep open" })
    .click();
  await page.screenshot({
    path: `${evidenceDirectory}/coach-request-queue-mobile.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 1040 });
  const declineGroup = pendingGroup(page, slotIds[1]);
  await declineGroup
    .getByRole("button", { name: "Decline", exact: true })
    .first()
    .click();
  await page
    .getByText("Request declined. The occurrence remains open.")
    .waitFor({ timeout: 30_000 });
  await page.getByText("19 pending shown", { exact: true }).waitFor();
  await loadEveryRequestPage(page);
  await page.getByText("23 pending", { exact: true }).waitFor();
  assert.equal(
    await pendingGroup(page, slotIds[1])
      .locator(".coach-request-candidates > li")
      .count(),
    7,
  );

  const acceptGroup = pendingGroup(page, slotIds[0]);
  const acceptedClient = (
    await acceptGroup
      .locator(".coach-request-identity strong")
      .first()
      .textContent()
  )?.trim();
  assert.ok(acceptedClient);
  await acceptGroup
    .getByRole("button", { name: "Accept", exact: true })
    .first()
    .click();
  await page
    .getByText("Request accepted. The private session is confirmed.")
    .waitFor({ timeout: 30_000 });
  await page.getByText("13 pending shown", { exact: true }).waitFor();
  await loadEveryRequestPage(page);
  await page.getByText("15 pending", { exact: true }).waitFor();
  await pendingGroup(page, slotIds[0]).waitFor({ state: "detached" });
  await page
    .locator("article.coach-client-card")
    .filter({ hasText: acceptedClient })
    .waitFor();
  const acceptedBookingCard = page
    .locator("article.coach-client-card")
    .filter({ hasText: acceptedClient });
  await acceptedBookingCard
    .getByRole("button", { name: "Cancel session" })
    .waitFor();

  const closeGroup = pendingGroup(page, slotIds[2]);
  await closeGroup
    .getByRole("button", { name: "Close this occurrence", exact: true })
    .click();
  await closeGroup
    .getByRole("button", { name: "Close occurrence", exact: true })
    .click();
  await page
    .getByText("Occurrence closed. Its pending requests are no longer active.")
    .waitFor({ timeout: 30_000 });
  await page.getByText("6 pending shown", { exact: true }).waitFor();
  await loadEveryRequestPage(page);
  await page
    .locator(".coach-request-queue-heading .coach-slot-count")
    .filter({ hasText: /^7 pending$/ })
    .waitFor();
  await pendingGroup(page, slotIds[2]).waitFor({ state: "detached" });

  const history = page.locator("details.coach-request-history");
  await history.locator("summary").click();
  await history.getByText("Accepted", { exact: true }).first().waitFor();
  await history.getByText("Declined", { exact: true }).first().waitFor();
  await history.getByText("Not selected", { exact: true }).first().waitFor();
  await history
    .getByText("Occurrence closed", { exact: true })
    .first()
    .waitFor();
  await page.screenshot({
    path: `${evidenceDirectory}/coach-request-workflow-complete-desktop.png`,
    fullPage: true,
  });
}

await cleanupRehearsalFixtures();
await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const clients = await createClients();
  const slotIds = await createOccurrences(await coachLocationSnapshot());
  await createRequests(clients, slotIds);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await signIn(page);
  await rehearseQueue(page, slotIds);
  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log(
    "Coach request rehearsal passed for bounded pagination, occurrence grouping, accept/decline/closure, immutable history, confirmed-booking continuity, keyboard focus and responsive layout.",
  );
} finally {
  await browser.close();
  await cleanupRehearsalFixtures();
  await database.end();
}
