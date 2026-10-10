import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const siteUrl =
  process.env.COACH_LOCATION_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.COACH_LOCATION_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const coachEmail = "daniel.park@coaches.movx.test";
const evidenceDirectory = "test-results/coach-location-rehearsal";
const databaseUrl =
  process.env.COACH_LOCATION_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

function assertLocalDatabaseTarget() {
  const target = new URL(databaseUrl);
  if (
    target.protocol !== "postgresql:" ||
    !new Set(["127.0.0.1", "localhost"]).has(target.hostname) ||
    target.port !== "55322"
  ) {
    throw new Error(
      "Coach location rehearsal cleanup requires local PostgreSQL on port 55322.",
    );
  }
}

async function removeInactiveTestLocations() {
  assertLocalDatabaseTarget();
  const database = postgres(databaseUrl, { max: 1 });
  try {
    await database.begin(async (transaction) => {
      await transaction`
        select set_config(
          'app.coach_training_location_management',
          'on',
          true
        )
      `;
      await transaction`
        delete from app.coach_training_locations as location
        where location.public_name like 'DEV0178 %'
          and location.status = 'inactive'
          and not location.is_primary
          and not exists (
            select 1
            from app.coach_availability_rules as rule
            where rule.coach_training_location_id = location.id
          )
          and not exists (
            select 1
            from app.coach_availability_slots as slot
            where slot.coach_training_location_id = location.id
          )
      `;
    });
  } finally {
    await database.end();
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

function activeLocationCard(page, name) {
  return page
    .locator("article.coach-training-location-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

async function deactivateActiveTestLocations(page) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const cards = page.locator("article.coach-training-location-card");
    const count = await cards.count();
    let target = null;
    let targetName = "";
    for (let index = 0; index < count; index += 1) {
      const heading = cards.nth(index).getByRole("heading");
      const name = (await heading.textContent())?.trim() ?? "";
      if (name.startsWith("DEV0178 ")) {
        target = cards.nth(index);
        targetName = name;
        break;
      }
    }
    if (!target) return;

    const deactivate = target
      .locator("details")
      .filter({ hasText: "Deactivate" })
      .first();
    await deactivate.locator("summary").click();
    const replacement = deactivate.getByLabel("Replacement primary location");
    if ((await replacement.count()) > 0) {
      const options = await replacement.locator("option").allTextContents();
      const fixtureIndex = options.findIndex(
        (option) => !option.trim().startsWith("DEV0178 "),
      );
      assert.ok(
        fixtureIndex >= 0,
        "A non-test primary replacement is required.",
      );
      await replacement.selectOption({ index: fixtureIndex });
    }
    await deactivate
      .getByRole("button", { name: "Deactivate location" })
      .click();
    await page
      .getByRole("heading", { name: targetName, exact: true })
      .waitFor({ state: "detached", timeout: 30_000 });
  }
  throw new Error("Too many active DEV0178 rehearsal locations to clean up.");
}

await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const page = await context.newPage();
  await signIn(page);

  await page.goto(`${siteUrl}/profile/coach`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Edit your public coach profile." })
    .waitFor();
  await page
    .getByRole("heading", { name: "Manage where you coach." })
    .waitFor();
  await deactivateActiveTestLocations(page);
  await removeInactiveTestLocations();
  assert.equal(
    await page
      .getByRole("heading", { name: "Your public training place" })
      .count(),
    0,
  );

  const nonce = Date.now();
  const locationName = `DEV0178 outdoor base ${nonce}`;
  const revisedName = `DEV0178 revised base ${nonce}`;
  const revisedLabel = `Tempelhofer Feld — DEV0178 gate ${nonce}`;
  const add = page.locator("details.coach-location-add");
  const addSummary = add.locator("summary");
  await addSummary.focus();
  assert.equal(
    await addSummary.evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  await add.getByRole("button", { name: "Independent place" }).click();
  const manual = add.getByRole("button", { name: "Manual coordinates" });
  if ((await manual.count()) > 0) await manual.click();
  await add.getByLabel("Short public location name").fill(locationName);
  await add
    .getByLabel("Public location label")
    .fill(`Tempelhofer Feld — DEV0178 entrance ${nonce}`);
  await add.getByLabel("Latitude").fill("52.473086");
  await add.getByLabel("Longitude").fill("13.403665");
  await add.getByRole("button", { name: "Confirm public location" }).click();
  await add.getByRole("button", { name: "Add location" }).click();
  await page.getByText("Training location added.").waitFor({ timeout: 30_000 });
  await page.getByRole("heading", { name: locationName }).waitFor();

  let card = activeLocationCard(page, locationName);
  await card.getByRole("button", { name: "Set as primary" }).click();
  await card.getByText("Primary", { exact: true }).waitFor({ timeout: 30_000 });

  const recoverableName = `DEV0178 recoverable input ${nonce}`;
  const competingName = `DEV0178 concurrent save ${nonce}`;
  let edit = card.locator("details").filter({ hasText: "Edit" }).first();
  await edit.locator("summary").click();
  await edit.getByLabel("Short public location name").fill(recoverableName);

  const competingPage = await context.newPage();
  await competingPage.goto(`${siteUrl}/profile/coach`, {
    waitUntil: "domcontentloaded",
  });
  const competingCard = activeLocationCard(competingPage, locationName);
  const competingEdit = competingCard
    .locator("details")
    .filter({ hasText: "Edit" })
    .first();
  await competingEdit.locator("summary").click();
  await competingEdit
    .getByLabel("Short public location name")
    .fill(competingName);
  await competingEdit.getByRole("button", { name: "Save location" }).click();
  await competingPage.getByText("Training location updated.").waitFor({
    timeout: 30_000,
  });

  await edit.getByRole("button", { name: "Save location" }).click();
  await page.waitForTimeout(2_000);
  const actionMessages = await page
    .locator(".coach-location-action-result")
    .allTextContents();
  if (
    !actionMessages.some((message) =>
      /profile changed after the page loaded/i.test(message),
    )
  ) {
    const activeHeadings = await page
      .locator("article.coach-training-location-card h3")
      .allTextContents();
    throw new Error(
      `The stale edit did not expose recoverable conflict feedback. Active headings: ${JSON.stringify(activeHeadings)}; action messages: ${JSON.stringify(actionMessages)}.`,
    );
  }
  const conflictedEdit = page
    .locator("details[open]")
    .filter({ hasText: "profile changed after the page loaded" })
    .first();
  assert.equal(
    await conflictedEdit.getByLabel("Short public location name").inputValue(),
    recoverableName,
  );
  await competingPage.close();

  await page.reload({ waitUntil: "domcontentloaded" });
  card = activeLocationCard(page, competingName);
  edit = card.locator("details").filter({ hasText: "Edit" }).first();
  await edit.locator("summary").click();
  await edit.getByLabel("Short public location name").fill(revisedName);
  await edit.getByLabel("Public location label").fill(revisedLabel);
  await edit.getByRole("button", { name: "Confirm public location" }).click();
  await edit.getByRole("button", { name: "Save location" }).click();
  await page.getByText("Training location updated.").waitFor({
    timeout: 30_000,
  });
  await page.getByRole("heading", { name: revisedName }).waitFor();

  await page.screenshot({
    path: `${evidenceDirectory}/owner-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 393, height: 852 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: `${evidenceDirectory}/owner-mobile.png`,
    fullPage: true,
  });

  await page.goto(`${siteUrl}/coaches/daniel-park`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("PRIMARY TRAINING BASE · NOT LIVE").waitFor();
  const publicLocations = page.locator(".public-coach-locations");
  await publicLocations.getByText(revisedName, { exact: true }).waitFor();
  await publicLocations.getByText("Primary base", { exact: true }).waitFor();
  assert.ok((await publicLocations.locator("li").count()) >= 2);
  assert.match(
    await publicLocations.textContent(),
    /not the coach's current position/i,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: `${evidenceDirectory}/public-mobile.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto(`${siteUrl}/profile/coach`, {
    waitUntil: "domcontentloaded",
  });
  card = activeLocationCard(page, revisedName);
  const deactivate = card
    .locator("details")
    .filter({ hasText: "Deactivate" })
    .first();
  await deactivate.locator("summary").click();
  await deactivate.getByLabel("Replacement primary location").selectOption({
    index: 0,
  });
  await deactivate.getByRole("button", { name: "Deactivate location" }).click();
  await page.getByText(/Training location deactivated/).waitFor({
    timeout: 30_000,
  });
  await page.getByText(/Inactive locations/).waitFor();
  await deactivateActiveTestLocations(page);

  await page.goto(`${siteUrl}/coaches/daniel-park`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(
    await page
      .locator(".public-coach-locations")
      .getByText(revisedName, { exact: true })
      .count(),
    0,
  );
  await removeInactiveTestLocations();
  await context.close();
  process.stdout.write(
    "Coach location rehearsal passed: add, edit, stale-conflict recovery, primary, public, mobile, keyboard and deactivation flows.\n",
  );
} finally {
  await browser.close();
}
