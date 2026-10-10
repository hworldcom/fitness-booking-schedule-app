import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const siteUrl =
  process.env.COACH_AVAILABILITY_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.AUTH_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const evidenceDirectory = "test-results/coach-availability-rehearsal";
const email = `dev0104-coach-${Date.now()}@example.com`;
const coachReviewDatabaseUrl =
  process.env.COACH_REVIEW_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const rehearsalDatabaseUrl =
  process.env.COACH_AVAILABILITY_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

function assertLocalDatabaseTarget() {
  const target = new URL(rehearsalDatabaseUrl);
  if (
    target.protocol !== "postgresql:" ||
    !new Set(["127.0.0.1", "localhost"]).has(target.hostname) ||
    target.port !== "55322"
  ) {
    throw new Error(
      "Coach availability rehearsal cleanup requires local PostgreSQL on port 55322.",
    );
  }
}

async function removeRehearsalAccounts() {
  assertLocalDatabaseTarget();
  const database = postgres(rehearsalDatabaseUrl, { max: 1 });
  try {
    const users = await database`
      select id
      from auth.users
      where email like 'dev0104-coach-%@example.com'
    `;
    const authUserIds = users.map((user) => user.id);
    if (authUserIds.length === 0) return;
    const profiles = await database`
      select id
      from app.profiles
      where auth_user_id in ${database(authUserIds)}
    `;
    const profileIds = profiles.map((profile) => profile.id);

    await database.begin(async (transaction) => {
      if (profileIds.length > 0) {
        await transaction`
          select set_config(
            'app.coach_training_location_management',
            'on',
            true
          )
        `;
        await transaction`
          update app.coach_profiles
          set visibility = 'hidden'
          where profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.coach_booking_credit_operations
          where booking_id in (
            select booking.id
            from app.coach_private_bookings as booking
            where booking.client_profile_id in ${transaction(profileIds)}
               or booking.coach_profile_id in ${transaction(profileIds)}
          )
        `;
        await transaction`
          delete from app.coach_private_bookings
          where client_profile_id in ${transaction(profileIds)}
             or coach_profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.coach_availability_slots
          where profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.coach_availability_rules
          where profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.coach_training_locations
          where profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.coach_profile_disciplines
          where profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.coach_profiles
          where profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.coach_application_review_events
          where profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.coach_applications
          where profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.demo_run_participants
          where profile_id in ${transaction(profileIds)}
        `;
        await transaction`
          delete from app.profiles
          where id in ${transaction(profileIds)}
        `;
      }
      await transaction`
        delete from auth.users
        where id in ${transaction(authUserIds)}
      `;
    });
  } finally {
    await database.end();
  }
}

async function emailCodeFor(recipientEmail) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${mailboxUrl}/api/v1/messages`);
    if (!response.ok) throw new Error("The local captured mailbox is offline.");
    const mailbox = await response.json();
    const message = mailbox.messages?.find((candidate) =>
      candidate.To?.some((recipient) => recipient.Address === recipientEmail),
    );
    const code = message?.Snippet?.match(/\b\d{6}\b/)?.[0];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The local OTP email did not arrive in time.");
}

async function submitForm(page, selector = "form.auth-form") {
  await page.locator(selector).locator('button[type="submit"]').click();
}

function futureWorkingDay() {
  const target = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "long",
  }).format(target);
  return { weekday, firstHour: "10:00", secondHour: "11:00" };
}

async function signInAndEnroll(page) {
  await page.goto(`${siteUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const button = document.querySelector(
      'form.auth-form button[type="submit"]',
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.getByLabel("Email address").fill(email);
  await submitForm(page);
  await page.getByText("Check your email.").waitFor({ timeout: 60_000 });
  await page.getByLabel("Six-digit code").fill(await emailCodeFor(email));
  await submitForm(page);
  await page
    .getByText(/Email verified|Signed in as/)
    .first()
    .waitFor({ timeout: 20_000 });
  await page.getByLabel("Display name").fill("DEV0104 Coach");
  await submitForm(page);
  await page
    .getByRole("heading", { name: "How would you like to use MovX?" })
    .waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Become a coach" }).click();
  await page.waitForURL(/\/profile\/coach$/);
  const response = await page.request.get(`${siteUrl}/api/auth/identity`);
  assert.equal(response.status(), 200);
  const identity = await response.json();
  assert.equal(identity.status, "enrolled");
  return identity;
}

function reviewCoachApplication(profileId) {
  const commonArguments = [
    "scripts/review-coach-application.mjs",
    "--profile-id",
    profileId,
    "--expected",
    "pending",
    "--decision",
    "approved",
    "--reason",
    "Local rehearsal reviewed identity and completed application.",
    "--reviewer",
    "local-rehearsal",
  ];
  const environment = {
    ...process.env,
    COACH_REVIEW_DATABASE_URL: coachReviewDatabaseUrl,
  };
  const dryRun = spawnSync(process.execPath, commonArguments, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: environment,
  });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /Dry run only\. No database state was changed\./);
  assert.doesNotMatch(
    `${dryRun.stdout}${dryRun.stderr}`,
    /postgres(?:ql)?:\/\//,
  );

  const applied = spawnSync(
    process.execPath,
    [...commonArguments, "--apply", "--confirm", profileId],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment,
    },
  );
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /Coach application review applied:/);
  assert.doesNotMatch(
    `${applied.stdout}${applied.stderr}`,
    /postgres(?:ql)?:\/\//,
  );
}

async function createCoachProfile(page, profileId) {
  await page.goto(`${siteUrl}/profile/coach`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Become discoverable as a coach." })
    .waitFor();
  await page
    .getByLabel("Biography")
    .fill(
      "Private boxing coaching with patient fundamentals, adaptable drills and clear feedback for every developing athlete.",
    );
  await page.getByLabel("Boxing", { exact: true }).check({ force: true });
  const gymSelect = page.getByLabel("Select a reviewed gym");
  const firstGymValue = await gymSelect
    .locator("option")
    .nth(1)
    .getAttribute("value");
  const firstGymLabel = await gymSelect.locator("option").nth(1).textContent();
  assert.ok(firstGymValue);
  assert.ok(firstGymLabel);
  await gymSelect.selectOption(firstGymValue);
  await page.getByRole("button", { name: "Save coach profile" }).click();
  await page.getByText("Coach profile saved.").waitFor({ timeout: 20_000 });
  reviewCoachApplication(profileId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('input[name="visibility"][value="visible"]').check({
    force: true,
  });
  await page.getByRole("button", { name: "Save coach profile" }).click();
  await page.getByText("Coach profile saved.").waitFor({ timeout: 20_000 });
  return firstGymLabel.split(" — ")[0];
}

async function addSecondaryGym(page, primaryGymName) {
  const add = page.locator("details.coach-location-add");
  await add.locator("summary").click();
  await add.getByRole("button", { name: "Reviewed gym" }).click();
  const gymSelect = add.getByLabel("Select a reviewed gym");
  const options = await gymSelect.locator("option").allTextContents();
  const secondaryIndex = options.findIndex(
    (option, index) =>
      index > 0 && !option.trim().startsWith(`${primaryGymName} —`),
  );
  assert.ok(secondaryIndex > 0, "A second reviewed gym is required.");
  const secondaryLabel = options[secondaryIndex].trim();
  const secondaryName = secondaryLabel.split(" — ")[0];
  await gymSelect.selectOption({ index: secondaryIndex });
  await add.getByRole("button", { name: "Add location" }).click();
  await page.getByText("Training location added.").waitFor({
    timeout: 20_000,
  });
  await page.getByRole("heading", { name: secondaryName }).waitFor();
  return secondaryName;
}

async function assertCoachPrimaryNavigation(page) {
  const workspaceLink = page.getByRole("link", {
    name: "Coach workspace",
    exact: true,
  });
  await workspaceLink.first().waitFor();
  assert.equal(await workspaceLink.first().getAttribute("href"), "/coach");
  await workspaceLink.first().focus();
  assert.equal(
    await workspaceLink
      .first()
      .evaluate((element) => element === document.activeElement),
    true,
  );
  const sessionsLink = page.getByRole("link", {
    name: "My sessions",
    exact: true,
  });
  await sessionsLink.first().waitFor();
  assert.equal(await sessionsLink.first().getAttribute("href"), "/sessions");
  await sessionsLink.first().focus();
  assert.equal(
    await sessionsLink
      .first()
      .evaluate((element) => element === document.activeElement),
    true,
  );
}

async function locationColor(element) {
  return element.evaluate((node) =>
    getComputedStyle(node)
      .getPropertyValue("--coach-location-background")
      .trim(),
  );
}

async function assertDistinctLocationColors(
  page,
  primaryGymName,
  secondaryGymName,
) {
  const legend = page.locator(".coach-week-location-legend li");
  const primaryLegend = legend.filter({ hasText: primaryGymName }).first();
  const secondaryLegend = legend.filter({ hasText: secondaryGymName }).first();
  const primaryLocationId = await primaryLegend.getAttribute(
    "data-training-location-id",
  );
  const secondaryLocationId = await secondaryLegend.getAttribute(
    "data-training-location-id",
  );
  assert.ok(primaryLocationId);
  assert.ok(secondaryLocationId);

  const primaryColor = await locationColor(primaryLegend);
  const secondaryColor = await locationColor(secondaryLegend);
  assert.match(primaryColor, /^#[0-9a-f]{6}$/i);
  assert.match(secondaryColor, /^#[0-9a-f]{6}$/i);
  assert.notEqual(primaryColor, secondaryColor);

  const primaryCell = page
    .locator(
      `button.coach-week-cell[data-training-location-id="${primaryLocationId}"]`,
    )
    .first();
  const secondaryCell = page
    .locator(
      `button.coach-week-cell[data-training-location-id="${secondaryLocationId}"]`,
    )
    .first();
  assert.equal(await locationColor(primaryCell), primaryColor);
  assert.equal(await locationColor(secondaryCell), secondaryColor);
  assert.notEqual(
    await primaryLegend
      .locator(":scope > span")
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundColor),
    "rgb(255, 255, 255)",
  );
}

async function rehearseAvailability(
  page,
  context,
  primaryGymName,
  secondaryGymName,
) {
  await page.goto(`${siteUrl}/coach`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Set your working week." }).waitFor();
  await assertCoachPrimaryNavigation(page);
  let scheduleMutationRequests = 0;
  const countScheduleMutation = (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/coach"
    ) {
      scheduleMutationRequests += 1;
    }
  };
  page.on("request", countScheduleMutation);
  const workingDay = futureWorkingDay();
  const locationTool = page.getByLabel("Assignment location");
  assert.match(await locationTool.inputValue(), /.+/);
  assert.match(
    await locationTool.locator("option:checked").textContent(),
    new RegExp(primaryGymName),
  );
  const firstCell = page.getByRole("button", {
    name: `Assign ${primaryGymName} to ${workingDay.weekday} ${workingDay.firstHour}–11:00`,
  });
  await firstCell.click();
  await page.getByText("1 selected hour · Unsaved").waitFor();
  await locationTool.selectOption({ label: secondaryGymName });
  await page
    .getByRole("button", {
      name: `Review ${workingDay.weekday} ${workingDay.firstHour}–11:00, assigned to ${primaryGymName}; selected location is ${secondaryGymName}`,
    })
    .click();
  const moveDecision = page.getByRole("button", {
    name: `Move to ${secondaryGymName}`,
  });
  await moveDecision.waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Save schedule" }).isDisabled(),
    true,
  );
  assert.equal(
    await moveDecision.evaluate(
      (element) => element === document.activeElement,
    ),
    true,
  );
  await page.getByRole("button", { name: `Keep ${primaryGymName}` }).click();
  const secondCell = page.getByRole("button", {
    name: `Assign ${secondaryGymName} to ${workingDay.weekday} ${workingDay.secondHour}–12:00`,
  });
  await secondCell.click();
  await page.getByText("2 selected hours · Unsaved").waitFor();
  await assertDistinctLocationColors(page, primaryGymName, secondaryGymName);
  await page.setViewportSize({ width: 393, height: 852 });
  await page
    .locator(".coach-week-mobile-picker select")
    .selectOption({ label: `${workingDay.weekday} · 2 selected` });
  await assertDistinctLocationColors(page, primaryGymName, secondaryGymName);
  await page.screenshot({
    path: `${evidenceDirectory}/coach-availability-multiple-colors-mobile.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page
    .getByRole("button", {
      name: `Review ${workingDay.weekday} ${workingDay.firstHour}–11:00, assigned to ${primaryGymName}; selected location is ${secondaryGymName}`,
    })
    .click();
  await page
    .getByRole("button", { name: `Move to ${secondaryGymName}` })
    .click();
  await locationTool.selectOption({ label: `${primaryGymName} — Primary` });
  await page
    .getByRole("button", {
      name: `Review ${workingDay.weekday} ${workingDay.firstHour}–11:00, assigned to ${secondaryGymName}; selected location is ${primaryGymName}`,
    })
    .click();
  await page.getByRole("button", { name: `Move to ${primaryGymName}` }).click();
  await page
    .getByText("Your changes are only on this screen until you save.")
    .waitFor();
  assert.equal(scheduleMutationRequests, 0);
  await page.getByRole("button", { name: "Save schedule" }).click();
  await page.getByText("Schedule saved.", { exact: false }).waitFor({
    timeout: 20_000,
  });
  assert.equal(scheduleMutationRequests, 1);
  await page.getByText("2 upcoming times").waitFor({ timeout: 20_000 });
  const occurrenceList = page.locator(".coach-occurrence-list");
  await occurrenceList.getByText(primaryGymName, { exact: true }).waitFor();
  await occurrenceList.getByText(secondaryGymName, { exact: true }).waitFor();
  await page.screenshot({
    path: `${evidenceDirectory}/coach-availability-desktop.png`,
    fullPage: true,
  });

  const publicProfileHref = await page
    .getByRole("link", { name: "View public profile" })
    .getAttribute("href");
  assert.ok(publicProfileHref);
  await page.goto(`${siteUrl}${publicProfileHref}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("heading", { name: "2 open hours." }).waitFor();
  await page.getByText(workingDay.weekday, { exact: false }).first().waitFor();
  await page.getByText(primaryGymName, { exact: true }).last().waitFor();
  await page.getByText(secondaryGymName, { exact: true }).last().waitFor();
  await page.screenshot({
    path: `${evidenceDirectory}/coach-public-schedule.png`,
    fullPage: true,
  });

  await page.goto(`${siteUrl}/coach`, { waitUntil: "domcontentloaded" });
  const removePrimaryCell = page.getByRole("button", {
    name: `Remove ${primaryGymName} from ${workingDay.weekday} ${workingDay.firstHour}–11:00`,
  });
  await removePrimaryCell.click();
  await page.getByText("1 selected hour · Unsaved").waitFor();

  const competingPage = await context.newPage();
  await competingPage.goto(`${siteUrl}/profile/coach`, {
    waitUntil: "domcontentloaded",
  });
  const secondaryCard = competingPage
    .locator("article.coach-training-location-card")
    .filter({
      has: competingPage.getByRole("heading", {
        name: secondaryGymName,
        exact: true,
      }),
    });
  const deactivate = secondaryCard
    .locator("details")
    .filter({ hasText: "Deactivate" })
    .first();
  await deactivate.locator("summary").click();
  await deactivate.getByRole("button", { name: "Deactivate location" }).click();
  await competingPage
    .getByText(/Training location deactivated/)
    .waitFor({ timeout: 20_000 });
  await competingPage.close();

  await page.getByRole("button", { name: "Save schedule" }).click();
  await page
    .getByText(/working week changed elsewhere or conflicts/i)
    .waitFor({ timeout: 20_000 });
  await page.getByText("1 selected hour · Unsaved").waitFor();
  assert.equal(scheduleMutationRequests, 2);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 393, height: 852 });
  await assertCoachPrimaryNavigation(page);
  const removeFirstCell = page.getByRole("button", {
    name: `Remove ${primaryGymName} from ${workingDay.weekday} ${workingDay.firstHour}–11:00`,
  });
  await removeFirstCell.focus();
  assert.equal(
    await removeFirstCell.evaluate(
      (element) => element === document.activeElement,
    ),
    true,
  );
  const workspaceProfileLink = page
    .getByRole("navigation", { name: "Coach workspace" })
    .getByRole("link", { name: "Profile", exact: true });
  await workspaceProfileLink.focus();
  assert.equal(
    await workspaceProfileLink.evaluate(
      (element) => element === document.activeElement,
    ),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: `${evidenceDirectory}/coach-availability-mobile.png`,
    fullPage: true,
  });

  await removeFirstCell.click();
  await page.getByText("0 selected hours · Unsaved").waitFor();
  assert.equal(scheduleMutationRequests, 2);
  await page.getByRole("button", { name: "Save schedule" }).click();
  await page.getByText("Schedule saved.", { exact: false }).waitFor({
    timeout: 20_000,
  });
  assert.equal(scheduleMutationRequests, 3);
  await page
    .getByRole("heading", {
      name: "No dated times in the next seven days.",
    })
    .waitFor();

  await page.goto(`${siteUrl}${publicProfileHref}`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "No open times right now." })
    .waitFor();
  page.off("request", countScheduleMutation);
}

await removeRehearsalAccounts();
await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const identity = await signInAndEnroll(page);
  const primaryGymName = await createCoachProfile(page, identity.profile.id);
  const secondaryGymName = await addSecondaryGym(page, primaryGymName);
  await rehearseAvailability(page, context, primaryGymName, secondaryGymName);

  assert.deepEqual(pageErrors, []);
  console.log(
    "Coach availability rehearsal passed for distinct two-location legend/cell colors, local assignment, explicit keep/move/remove, zero per-cell requests, one request per save, inactive-location conflict recovery, actual-venue projection, keyboard focus and responsive layout.",
  );
} finally {
  await browser.close();
  await removeRehearsalAccounts();
}
