import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const siteUrl =
  process.env.COACH_AVAILABILITY_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.AUTH_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const evidenceDirectory = "test-results/coach-availability-rehearsal";
const email = `dev0104-coach-${Date.now()}@example.com`;
const coachReviewDatabaseUrl =
  process.env.COACH_REVIEW_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

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
  const gymSelect = page.getByLabel("Select a fictional gym");
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

async function rehearseAvailability(page, gymName) {
  await page.goto(`${siteUrl}/coach`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Set your working week." }).waitFor();
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
  const firstCell = page.getByRole("button", {
    name: `Add ${workingDay.weekday} ${workingDay.firstHour}–11:00`,
  });
  const secondCell = page.getByRole("button", {
    name: `Add ${workingDay.weekday} ${workingDay.secondHour}–12:00`,
  });
  await firstCell.click();
  await page.getByText("1 selected hour · Unsaved").waitFor();
  await secondCell.click();
  await page.getByText("2 selected hours · Unsaved").waitFor();
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
  await expectText(page, gymName);
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
  await page.getByText(gymName, { exact: true }).last().waitFor();
  await page.screenshot({
    path: `${evidenceDirectory}/coach-public-schedule.png`,
    fullPage: true,
  });

  await page.goto(`${siteUrl}/coach`, { waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 393, height: 852 });
  const removeFirstCell = page.getByRole("button", {
    name: `Remove ${workingDay.weekday} ${workingDay.firstHour}–11:00`,
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
  await page.getByText("1 selected hour · Unsaved").waitFor();
  await page
    .getByRole("button", {
      name: `Remove ${workingDay.weekday} ${workingDay.secondHour}–12:00`,
    })
    .click();
  await page.getByText("0 selected hours · Unsaved").waitFor();
  assert.equal(scheduleMutationRequests, 1);
  await page.getByRole("button", { name: "Save schedule" }).click();
  await page.getByText("Schedule saved.", { exact: false }).waitFor({
    timeout: 20_000,
  });
  assert.equal(scheduleMutationRequests, 2);
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

async function expectText(page, text) {
  await page.getByText(text, { exact: true }).first().waitFor();
}

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
  const gymName = await createCoachProfile(page, identity.profile.id);
  await rehearseAvailability(page, gymName);

  assert.deepEqual(pageErrors, []);
  console.log(
    "Coach availability rehearsal passed for local multi-selection with zero per-cell requests, one request per save, public dated projection, removal, keyboard focus and responsive layout.",
  );
} finally {
  await browser.close();
}
