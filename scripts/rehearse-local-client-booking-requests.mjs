import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const siteUrl =
  process.env.CLIENT_REQUEST_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.CLIENT_REQUEST_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const databaseUrl =
  process.env.CLIENT_REQUEST_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const clientEmail = "hoang@users.movx.test";
const coachEmail = "daniel.park@coaches.movx.test";
const competitorEmail = "dev0190-competitor@users.movx.test";
const competitorDisplayName = "DEV0190 Other Client";
const evidenceDirectory = "test-results/client-request-rehearsal";
const slotIds = [
  "de019000-0000-4000-8000-000000000001",
  "de019000-0000-4000-8000-000000000002",
  "de019000-0000-4000-8000-000000000003",
];

function assertLocalDatabaseTarget() {
  const database = new URL(databaseUrl);
  if (
    !new Set(["postgres:", "postgresql:"]).has(database.protocol) ||
    !new Set(["localhost", "127.0.0.1"]).has(database.hostname) ||
    database.port !== "55322"
  ) {
    throw new Error(
      "Client request rehearsal is restricted to loopback PostgreSQL on port 55322.",
    );
  }
}

assertLocalDatabaseTarget();
const database = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: false,
});

async function actorByEmail(email) {
  const [actor] = await database`
    select
      auth_user.id::text as auth_user_id,
      profile.id::text as profile_id,
      profile.display_name,
      participant.run_id::text as run_id,
      participant.role,
      coach.public_slug
    from auth.users as auth_user
    join app.profiles as profile
      on profile.auth_user_id = auth_user.id
    join app.demo_run_participants as participant
      on participant.profile_id = profile.id
      and participant.status = 'active'
    left join app.coach_profiles as coach
      on coach.run_id = participant.run_id
      and coach.profile_id = profile.id
    where auth_user.email = ${email}
  `;
  assert.ok(actor, "Provision the required local account before rehearsal.");
  return actor;
}

async function cleanupFixtures() {
  const competitorUsers = await database`
    select id::text
    from auth.users
    where email = ${competitorEmail}
  `;
  const competitorAuthIds = competitorUsers.map((user) => user.id);
  const competitorProfiles =
    competitorAuthIds.length === 0
      ? []
      : await database`
          select id::text
          from app.profiles
          where auth_user_id in ${database(competitorAuthIds)}
        `;
  const competitorProfileIds = competitorProfiles.map((profile) => profile.id);

  await database.begin(async (transaction) => {
    await transaction`
      select
        set_config('app.coach_booking_request_management', 'on', true),
        set_config('app.coach_booking_management', 'on', true),
        set_config('app.coach_availability_management', 'on', true)
    `;
    await transaction`
      delete from app.coach_booking_requests
      where slot_id in ${transaction(slotIds)}
        ${
          competitorProfileIds.length > 0
            ? transaction`or client_profile_id in ${transaction(competitorProfileIds)}`
            : transaction``
        }
    `;
    await transaction`
      delete from app.coach_private_bookings
      where slot_id in ${transaction(slotIds)}
    `;
    await transaction`
      delete from app.coach_availability_slots
      where id in ${transaction(slotIds)}
    `;
    if (competitorProfileIds.length > 0) {
      await transaction`
        delete from app.demo_run_participants
        where profile_id in ${transaction(competitorProfileIds)}
      `;
      await transaction`
        delete from app.profiles
        where id in ${transaction(competitorProfileIds)}
      `;
    }
  });
  if (competitorAuthIds.length > 0) {
    await database`
      delete from auth.users
      where id in ${database(competitorAuthIds)}
    `;
  }
}

async function createCompetitor() {
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
      ${competitorEmail},
      statement_timestamp(),
      jsonb_build_object('movx_dev0190_rehearsal', true),
      jsonb_build_object('display_name', ${competitorDisplayName}::text),
      statement_timestamp(),
      statement_timestamp()
    )
  `;
  const [actor] = await database`
    select
      identity_profile_id::text as profile_id,
      identity_run_id::text as run_id,
      identity_role as role
    from app.enroll_application_identity(
      ${authUserId}::uuid,
      ${competitorDisplayName}::text
    )
  `;
  assert.ok(actor);
  return { authUserId, ...actor };
}

async function coachSnapshot(coachProfileId) {
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

async function availableStarts(snapshot) {
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
        where run_id = ${snapshot.run_id}::uuid
          and profile_id = ${snapshot.profile_id}::uuid
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
  const starts = await availableStarts(snapshot);
  await database.begin(async (transaction) => {
    await transaction`
      select set_config('app.coach_availability_management', 'on', true)
    `;
    for (let index = 0; index < slotIds.length; index += 1) {
      const start = starts[index];
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
          ${slotIds[index]}::uuid,
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
    }
  });
}

async function createRequest(actor, slotId) {
  return database.begin(async (transaction) => {
    await transaction`
      select
        set_config('app.current_auth_user_id', ${actor.authUserId}, true),
        set_config('app.current_profile_id', ${actor.profile_id}, true),
        set_config('app.current_run_id', ${actor.run_id}, true),
        set_config('app.current_run_role', ${actor.role}, true)
    `;
    const [request] = await transaction`
      select * from app.create_coach_booking_request(${slotId}::uuid)
    `;
    assert.equal(request.request_status, "pending");
    return request.request_id;
  });
}

async function mailboxMessageIds(email) {
  const response = await fetch(mailboxUrl + "/api/v1/messages");
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
    const response = await fetch(mailboxUrl + "/api/v1/messages");
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
  throw new Error("The local sign-in email did not arrive in time.");
}

async function signIn(page, email, displayName) {
  const previousIds = await mailboxMessageIds(email);
  await page.goto(siteUrl + "/sign-in", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const button = document.querySelector(
      'form.auth-form button[type="submit"]',
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.getByLabel("Email address").fill(email);
  await page.locator('form.auth-form button[type="submit"]').click();
  await page.getByText("Check your email.").waitFor({ timeout: 60_000 });
  await page
    .getByLabel("Six-digit code")
    .fill(await newEmailCode(email, previousIds));
  await page.locator('form.auth-form button[type="submit"]').click();
  await page
    .getByText("Signed in as " + displayName + ".")
    .waitFor({ timeout: 30_000 });
}

function profileSlot(page, slotId) {
  return page.locator('li[data-slot-id="' + slotId + '"]');
}

function requestCard(page, slotId) {
  return page.locator(
    'article.client-request-card[data-slot-id="' + slotId + '"]',
  );
}

function coachGroup(page, slotId) {
  return page.locator(
    'article.coach-request-group[data-slot-id="' + slotId + '"]',
  );
}

async function requestSession(page, coachSlug, slotId) {
  await page.goto(siteUrl + "/coaches/" + coachSlug, {
    waitUntil: "domcontentloaded",
  });
  const slot = profileSlot(page, slotId);
  await slot.getByRole("button", { name: "Request session" }).click();
  await page.getByText("Request saved.", { exact: true }).waitFor();
  await page
    .getByText("Awaiting coach confirmation", { exact: true })
    .first()
    .waitFor();
  await page
    .getByText("This session is not confirmed yet.", { exact: true })
    .first()
    .waitFor();
}

async function coachCandidateRow(page, slotId, clientDisplayName) {
  const group = coachGroup(page, slotId);
  await group.waitFor();
  return group
    .locator(".coach-request-candidates > li")
    .filter({ hasText: clientDisplayName });
}

await cleanupFixtures();
await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const client = await actorByEmail(clientEmail);
  const coach = await actorByEmail(coachEmail);
  assert.ok(coach.public_slug);
  const competitor = await createCompetitor();
  const snapshot = await coachSnapshot(coach.profile_id);
  await createOccurrences(snapshot);
  await createRequest(
    {
      authUserId: competitor.authUserId,
      profile_id: competitor.profile_id,
      run_id: competitor.run_id,
      role: competitor.role,
    },
    slotIds[0],
  );

  const clientContext = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const coachContext = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const clientPage = await clientContext.newPage();
  const coachPage = await coachContext.newPage();
  const pageErrors = [];
  const responseBodyPromises = [];
  clientPage.on("pageerror", (error) => pageErrors.push(error.message));
  coachPage.on("pageerror", (error) => pageErrors.push(error.message));
  clientPage.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      response.url().startsWith(siteUrl)
    ) {
      responseBodyPromises.push(response.text().catch(() => ""));
    }
  });

  await signIn(clientPage, clientEmail, client.display_name);
  await signIn(coachPage, coachEmail, coach.display_name);

  await requestSession(clientPage, coach.public_slug, slotIds[0]);
  await clientPage.reload({ waitUntil: "domcontentloaded" });
  await profileSlot(clientPage, slotIds[0])
    .getByText("Requested", { exact: true })
    .waitFor();
  const withdrawButton = profileSlot(clientPage, slotIds[0]).getByRole(
    "button",
    { name: "Withdraw request" },
  );
  await withdrawButton.focus();
  await clientPage.keyboard.press("Enter");
  await clientPage.getByText("Request withdrawn.", { exact: true }).waitFor();

  await clientPage.goto(siteUrl + "/sessions", {
    waitUntil: "domcontentloaded",
  });
  await requestCard(clientPage, slotIds[0])
    .getByText("Withdrawn", { exact: true })
    .waitFor();
  await requestSession(clientPage, coach.public_slug, slotIds[0]);

  await coachPage.goto(siteUrl + "/coach?view=bookings", {
    waitUntil: "domcontentloaded",
  });
  const declinedRow = await coachCandidateRow(
    coachPage,
    slotIds[0],
    client.display_name,
  );
  await declinedRow
    .getByRole("button", { name: "Decline", exact: true })
    .click();
  await coachPage
    .getByText("Request declined. The occurrence remains open.")
    .waitFor();

  await clientPage.goto(siteUrl + "/sessions", {
    waitUntil: "domcontentloaded",
  });
  await requestCard(clientPage, slotIds[0])
    .getByText("Not confirmed", { exact: true })
    .waitFor();
  await requestSession(clientPage, coach.public_slug, slotIds[0]);

  await coachPage.reload({ waitUntil: "domcontentloaded" });
  const acceptedRow = await coachCandidateRow(
    coachPage,
    slotIds[0],
    client.display_name,
  );
  await acceptedRow
    .getByRole("button", { name: "Accept", exact: true })
    .click();
  await coachPage
    .getByText("Request accepted. The private session is confirmed.")
    .waitFor();

  await clientPage.goto(siteUrl + "/sessions", {
    waitUntil: "domcontentloaded",
  });
  await requestCard(clientPage, slotIds[0])
    .getByText("Confirmed", { exact: true })
    .waitFor();
  await clientPage
    .locator(
      'section[aria-labelledby="upcoming-sessions-title"] article.client-session-card',
    )
    .filter({ hasText: coach.display_name })
    .first()
    .waitFor();

  await requestSession(clientPage, coach.public_slug, slotIds[1]);
  await coachPage.goto(siteUrl + "/coach?view=bookings", {
    waitUntil: "domcontentloaded",
  });
  const closeGroup = coachGroup(coachPage, slotIds[1]);
  await closeGroup
    .getByRole("button", { name: "Close this occurrence", exact: true })
    .click();
  await closeGroup
    .getByRole("button", { name: "Close occurrence", exact: true })
    .click();
  await coachPage
    .getByText("Occurrence closed. Its pending requests are no longer active.")
    .waitFor();
  await clientPage.goto(siteUrl + "/sessions", {
    waitUntil: "domcontentloaded",
  });
  await requestCard(clientPage, slotIds[1])
    .getByText("Request closed", { exact: true })
    .waitFor();

  await requestSession(clientPage, coach.public_slug, slotIds[2]);
  await database`
    update app.coach_booking_requests
    set
      created_at = statement_timestamp() - interval '13 hours',
      decision_deadline_at = statement_timestamp() - interval '1 minute'
    where slot_id = ${slotIds[2]}::uuid
      and client_profile_id = ${client.profile_id}::uuid
      and status = 'pending'
  `;
  await clientPage.goto(siteUrl + "/sessions", {
    waitUntil: "domcontentloaded",
  });
  await requestCard(clientPage, slotIds[2])
    .getByText("Expired", { exact: true })
    .waitFor();

  const clientText = await clientPage.locator("body").innerText();
  assert.doesNotMatch(clientText, new RegExp(competitorDisplayName, "i"));
  assert.doesNotMatch(clientText, /other requests|other candidates/i);
  await clientPage.screenshot({
    path: evidenceDirectory + "/client-requests-desktop.png",
    fullPage: true,
  });
  await clientPage.setViewportSize({ width: 393, height: 852 });
  assert.equal(
    await clientPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await clientPage.screenshot({
    path: evidenceDirectory + "/client-requests-mobile.png",
    fullPage: true,
  });

  const responseBodies = await Promise.all(
    responseBodyPromises.map((body) =>
      Promise.race([
        body,
        new Promise((resolve) => setTimeout(() => resolve(""), 2_000)),
      ]),
    ),
  );
  assert.ok(
    responseBodies.every((body) => !body.includes(competitorDisplayName)),
    "Client action responses must not expose another candidate identity.",
  );
  assert.deepEqual(pageErrors, []);
  await clientContext.close();
  await coachContext.close();
  console.log(
    "Client request rehearsal passed for persistence, withdrawal/retry, decline/retry, acceptance, closure, expiry, confirmed-booking continuity, candidate privacy, keyboard operation and responsive layout.",
  );
} finally {
  await browser.close();
  await cleanupFixtures();
  await database.end();
}
