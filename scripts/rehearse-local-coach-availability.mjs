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

function futureLocalStart(hoursFromNow) {
  const target = Date.now() + hoursFromNow * 60 * 60 * 1000;
  const rounded = Math.ceil(target / (15 * 60 * 1000)) * 15 * 60 * 1000;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(rounded));
  const part = (type) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
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
  await page.getByRole("heading", { name: "Plan your next week." }).waitFor();
  await page.getByLabel("Local start").fill(futureLocalStart(2));
  await page.getByLabel("Duration").selectOption("60");
  await page.getByRole("button", { name: "Publish slot" }).click();
  await page.getByText("1 active slot").waitFor({ timeout: 20_000 });

  const slot = page.locator(".coach-slot-card");
  await slot.getByText("open", { exact: true }).waitFor();
  await slot.getByText(gymName, { exact: true }).waitFor();
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
  await page.getByRole("heading", { name: "1 open time this week." }).waitFor();
  await page.getByText(gymName, { exact: true }).last().waitFor();

  await page.goto(`${siteUrl}/coach`, { waitUntil: "domcontentloaded" });
  const updatedStart = futureLocalStart(3);
  await page
    .locator(".coach-slot-card")
    .getByLabel("Local start")
    .fill(updatedStart);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .locator(".coach-slot-card")
    .getByLabel("Local start")
    .waitFor({ state: "visible" });
  assert.equal(
    await page
      .locator(".coach-slot-card")
      .getByLabel("Local start")
      .inputValue(),
    updatedStart,
  );

  await page.getByRole("button", { name: "Withdraw" }).click();
  await page.getByRole("heading", { name: "No upcoming slots yet." }).waitFor();
  await page.setViewportSize({ width: 393, height: 852 });
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

  await page.goto(`${siteUrl}${publicProfileHref}`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "No open times right now." })
    .waitFor();
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
    "Coach availability rehearsal passed for authenticated profile setup, publish, public projection, edit, withdrawal, keyboard focus and responsive layout.",
  );
} finally {
  await browser.close();
}
