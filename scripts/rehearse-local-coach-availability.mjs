import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const siteUrl =
  process.env.COACH_AVAILABILITY_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.AUTH_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const evidenceDirectory = "test-results/coach-availability-rehearsal";
const email = `dev0104-coach-${Date.now()}@example.com`;

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
  await page.getByRole("button", { name: "Offer coaching" }).click();
  await page.waitForURL(/\/profile\/coach$/);
}

async function createCoachProfile(page) {
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
  const workingDay = futureWorkingDay();
  const firstCell = page.getByRole("button", {
    name: `Add ${workingDay.weekday} ${workingDay.firstHour}–11:00`,
  });
  const secondCell = page.getByRole("button", {
    name: `Add ${workingDay.weekday} ${workingDay.secondHour}–12:00`,
  });
  await firstCell.click();
  await page.getByText("1 selected hour").waitFor({ timeout: 20_000 });
  await secondCell.click();
  await page.getByText("2 selected hours").waitFor({ timeout: 20_000 });
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
  await page
    .getByRole("heading", { name: "2 open times this week." })
    .waitFor();
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
  await page.getByText("1 selected hour").waitFor({ timeout: 20_000 });
  await page
    .getByRole("button", {
      name: `Remove ${workingDay.weekday} ${workingDay.secondHour}–12:00`,
    })
    .click();
  await page.getByText("0 selected hours").waitFor({ timeout: 20_000 });
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

  await signInAndEnroll(page);
  const gymName = await createCoachProfile(page);
  await rehearseAvailability(page, gymName);

  assert.deepEqual(pageErrors, []);
  console.log(
    "Coach availability rehearsal passed for authenticated profile setup, adjacent working-week toggles, public dated projection, removal, keyboard focus and responsive layout.",
  );
} finally {
  await browser.close();
}
