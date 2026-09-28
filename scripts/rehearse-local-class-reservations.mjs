import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { generateKeyPairSigner } from "@solana/kit";
import postgres from "postgres";

const siteUrl =
  process.env.RESERVATION_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.RESERVATION_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const adminUrl =
  process.env.DATABASE_TEST_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const runtimeUrl =
  process.env.DATABASE_URL ??
  "postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres";
const email = `dev0087-reservations-${Date.now()}@example.com`;
const walletAddress = (await generateKeyPairSigner()).address;
const destinationAddress = "ComputeBudget111111111111111111111111111111";
const mintAddress = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
const tokenProgramAddress = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const referenceAddress = "6".repeat(44);
const transactionSignature = "7".repeat(88);
const gymSlugs = ["northside-combat", "fabrik", "vela", "groundline-mma"];

const admin = postgres(adminUrl, { max: 1, prepare: false, ssl: false });
const runtime = postgres(runtimeUrl, { max: 1, prepare: false, ssl: false });

async function emailCodeFor(recipient) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${mailboxUrl}/api/v1/messages`);
    if (!response.ok) throw new Error("The local captured mailbox is offline.");
    const mailbox = await response.json();
    const message = mailbox.messages?.find((candidate) =>
      candidate.To?.some((address) => address.Address === recipient),
    );
    const code = message?.Snippet?.match(/\b\d{6}\b/)?.[0];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The local OTP email did not arrive in time.");
}

async function createAccount(page) {
  await page.goto(`${siteUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  const requestButton = page.getByRole("button", {
    name: "Email me a sign-in code",
  });
  await expect(requestButton).toBeEnabled();
  await page.getByLabel("Email address").fill(email);
  await requestButton.click();
  try {
    await page.getByText("Check your email.").waitFor({ timeout: 20_000 });
  } catch (error) {
    const visibleState = (await page.locator("body").innerText()).slice(
      0,
      2_000,
    );
    throw new Error(
      `Email-code request did not reach its pending state at ${page.url()}. Visible page text:\n${visibleState}`,
      { cause: error },
    );
  }
  await page.getByLabel("Six-digit code").fill(await emailCodeFor(email));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page
    .getByText(/Email verified|Signed in as/)
    .first()
    .waitFor();
  await page.getByLabel("Display name").fill("Reservation Tester");
  await page.getByRole("button", { name: "Create my profile" }).click();
  await page
    .getByText("Signed in as Reservation Tester.")
    .waitFor({ timeout: 20_000 });
}

async function actorForEmail() {
  const rows = await admin`
    select
      auth_user.id::text as auth_user_id,
      profile.id::text as profile_id,
      participant.run_id::text as run_id,
      participant.role
    from auth.users as auth_user
    join app.profiles as profile on profile.auth_user_id = auth_user.id
    join app.demo_run_participants as participant
      on participant.profile_id = profile.id
      and participant.status = 'active'
    where auth_user.email = ${email}
  `;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "member");
  return rows[0];
}

async function activateTestMembership(actor) {
  const operationId = randomUUID();
  const challengeId = randomUUID();
  await admin`
    insert into app.auth_challenges (
      id,
      run_id,
      auth_user_id,
      owner_type,
      profile_id,
      organization_id,
      purpose,
      cluster,
      wallet_address,
      origin,
      message_version,
      nonce_hash,
      message_hash,
      issued_at,
      expires_at,
      consumed_at,
      consumed_result
    )
    values (
      ${challengeId}::uuid,
      ${actor.run_id}::uuid,
      ${actor.auth_user_id}::uuid,
      'personal',
      ${actor.profile_id}::uuid,
      null,
      'link-personal-wallet',
      'solana:devnet',
      ${walletAddress},
      'http://localhost:3100',
      1,
      decode(repeat('01', 32), 'hex'),
      decode(repeat('02', 32), 'hex'),
      statement_timestamp(),
      statement_timestamp() + interval '5 minutes',
      statement_timestamp(),
      'linked'
    )
  `;
  await admin`
    insert into app.wallet_bindings (
      run_id,
      cluster,
      wallet_address,
      owner_type,
      profile_id,
      organization_id,
      bound_by_auth_user_id,
      provenance,
      status,
      verified_at,
      verified_by_challenge_id
    )
    values (
      ${actor.run_id}::uuid,
      'solana:devnet',
      ${walletAddress},
      'personal',
      ${actor.profile_id}::uuid,
      null,
      ${actor.auth_user_id}::uuid,
      'user-proof',
      'active',
      statement_timestamp(),
      ${challengeId}::uuid
    )
  `;

  await runtime.begin(async (transaction) => {
    await transaction`
      select
        set_config('app.current_auth_user_id', ${actor.auth_user_id}, true),
        set_config('app.current_profile_id', ${actor.profile_id}, true),
        set_config('app.current_run_id', ${actor.run_id}, true),
        set_config('app.current_run_role', 'member', true)
    `;
    const prepared = await transaction`
      select app.prepare_membership_payment_activation(
        ${operationId}::uuid,
        'basic',
        ${gymSlugs}::text[],
        ${referenceAddress},
        ${destinationAddress},
        ${mintAddress},
        ${tokenProgramAddress},
        6
      ) as result
    `;
    assert.equal(prepared[0]?.result, "prepared");
    const submitted = await transaction`
      select app.record_membership_payment_submission(
        ${operationId}::uuid,
        ${transactionSignature}
      ) as result
    `;
    assert.equal(submitted[0]?.result, "submitted");
    const completed = await transaction`
      select * from app.complete_verified_membership_payment(
        ${operationId}::uuid,
        ${walletAddress},
        ${destinationAddress},
        ${mintAddress},
        ${tokenProgramAddress},
        ${referenceAddress},
        6,
        ${transactionSignature},
        800000001,
        80000000
      )
    `;
    assert.equal(completed[0]?.completion_result, "confirmed");
  });
}

async function cleanup(actor) {
  if (!actor) return;
  await admin.begin(async (transaction) => {
    await transaction`
      delete from app.class_reservations
      where profile_id = ${actor.profile_id}::uuid
    `;
    await transaction`
      delete from app.membership_daily_access_claims
      where profile_id = ${actor.profile_id}::uuid
    `;
    await transaction`
      delete from app.membership_period_core_gyms
      where membership_period_id in (
        select id from app.membership_periods
        where profile_id = ${actor.profile_id}::uuid
      )
    `;
    await transaction`
      delete from app.membership_periods
      where profile_id = ${actor.profile_id}::uuid
    `;
    await transaction`
      delete from app.membership_activation_operation_gyms
      where operation_id in (
        select id from app.membership_activation_operations
        where profile_id = ${actor.profile_id}::uuid
      )
    `;
    await transaction`
      delete from app.membership_activation_operations
      where profile_id = ${actor.profile_id}::uuid
    `;
    await transaction`
      delete from app.wallet_bindings
      where profile_id = ${actor.profile_id}::uuid
    `;
    await transaction`
      delete from app.auth_challenges
      where auth_user_id = ${actor.auth_user_id}::uuid
    `;
    await transaction`
      delete from app.demo_run_participants
      where profile_id = ${actor.profile_id}::uuid
    `;
    await transaction`
      delete from app.profiles where id = ${actor.profile_id}::uuid
    `;
    await transaction`
      delete from auth.users where id = ${actor.auth_user_id}::uuid
    `;
  });
}

let actor;
const browser = await chromium.launch({ channel: "chrome" });
try {
  await mkdir("test-results", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await createAccount(page);
  actor = await actorForEmail();
  await activateTestMembership(actor);

  await page.goto(`${siteUrl}/my-access`, { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Your active membership." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Plan your next session." }),
  ).toBeVisible();
  await expect(
    page.getByText(/not attendance until gym staff confirm/i),
  ).toBeVisible();
  assert.ok((await page.locator(".class-session-card").count()) > 0);

  const availableCard = page
    .locator(".class-session-card.status-available")
    .first();
  const classTitle = await availableCard.locator("h4").innerText();
  const reserveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/membership/reservations") &&
      response.request().method() === "POST",
    { timeout: 20_000 },
  );
  await availableCard
    .getByRole("button", { name: "Reserve included class" })
    .click();
  const reserveResponse = await reserveResponsePromise;
  const reserveBody = await reserveResponse.json();
  assert.equal(reserveResponse.status(), 200, JSON.stringify(reserveBody));
  assert.equal(reserveBody.status, "reserved");
  const reservedCard = page.locator(".class-session-card", {
    hasText: classTitle,
  });
  await expect(reservedCard.getByText("Reserved", { exact: true })).toBeVisible(
    {
      timeout: 20_000,
    },
  );
  await expect(reservedCard.getByText(/Not attendance yet/)).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  const recoveredCard = page.locator(".class-session-card", {
    hasText: classTitle,
  });
  await expect(
    recoveredCard.getByText("Reserved", { exact: true }),
  ).toBeVisible();
  await expect(
    recoveredCard.getByRole("button", { name: "Cancel reservation" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dev0087-desktop.png",
    fullPage: true,
  });

  await recoveredCard
    .getByRole("button", { name: "Cancel reservation" })
    .click();
  await expect(
    recoveredCard.locator(".class-session-status", {
      hasText: "Cancelled by you",
    }),
  ).toBeVisible();

  await page.setViewportSize({ width: 393, height: 852 });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const keyboardCard = page
    .locator(".class-session-card.status-available")
    .first();
  const keyboardClassTitle = await keyboardCard.locator("h4").innerText();
  const reserveButton = keyboardCard.getByRole("button", {
    name: "Reserve included class",
  });
  await reserveButton.focus();
  await expect(reserveButton).toBeFocused();
  await page.keyboard.press("Enter");
  const keyboardReservedCard = page.locator(".class-session-card", {
    hasText: keyboardClassTitle,
  });
  await expect(
    keyboardReservedCard.getByText("Reserved", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await page.screenshot({
    path: "test-results/dev0087-mobile.png",
    fullPage: true,
  });

  assert.deepEqual(pageErrors, []);
  console.log(
    "Class reservation rehearsal passed for persistent reserve/reload/cancel, keyboard activation, responsive layout and honest held-access copy.",
  );
} finally {
  await browser.close();
  await cleanup(actor);
  await runtime.end();
  await admin.end();
}
