import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { generateKeyPairSigner, signBytes } from "@solana/kit";
import postgres from "postgres";

const siteUrl = process.env.AUTH_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.AUTH_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const databaseUrl =
  process.env.DATABASE_TEST_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const nonce = Date.now();

async function emailCodeFor(email) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${mailboxUrl}/api/v1/messages`);
    if (!response.ok) throw new Error("The local captured mailbox is offline.");
    const mailbox = await response.json();
    const message = mailbox.messages?.find((candidate) =>
      candidate.To?.some((recipient) => recipient.Address === email),
    );
    const code = message?.Snippet?.match(/\b\d{6}\b/)?.[0];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The local OTP email did not arrive in time.");
}

async function createAccount(page, email, displayName) {
  await page.goto(`${siteUrl}/sign-in`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByText("Check your email.").waitFor({ timeout: 60_000 });
  await page.getByLabel("Six-digit code").fill(await emailCodeFor(email));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page
    .getByText(/Email verified|Signed in as/)
    .first()
    .waitFor({ timeout: 20_000 });
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Create my profile" }).click();
  await page
    .getByText(`Signed in as ${displayName}.`)
    .waitFor({ timeout: 20_000 });
}

async function prepareClub(email, walletAddress) {
  const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: false });
  try {
    await sql.begin(async (transaction) => {
      const people = await transaction`
        select
          auth_user.id as auth_user_id,
          profile.id as profile_id,
          participant.run_id
        from auth.users as auth_user
        join app.profiles as profile on profile.auth_user_id = auth_user.id
        join app.demo_run_participants as participant
          on participant.profile_id = profile.id
          and participant.status = 'active'
        where lower(auth_user.email) = ${email}
      `;
      assert.equal(people.length, 1);
      const clubs = await transaction`
        select id, run_id
        from app.organizations
        where slug = 'northside-combat'
          and status = 'active'
          and run_id = ${people[0].run_id}::uuid
      `;
      assert.equal(clubs.length, 1);
      const person = people[0];
      const club = clubs[0];

      await transaction`
        update app.organization_wallet_authorities
        set
          revoked_at = statement_timestamp(),
          revocation_reason = 'context-changed'
        where run_id = ${club.run_id}::uuid
          and organization_id = ${club.id}::uuid
          and revoked_at is null
      `;
      await transaction`
        update app.organization_memberships
        set status = 'revoked', revoked_at = statement_timestamp()
        where run_id = ${club.run_id}::uuid
          and organization_id = ${club.id}::uuid
          and role = 'primary_admin'
          and status = 'active'
      `;
      await transaction`
        insert into app.organization_memberships (
          run_id, organization_id, profile_id, role, status
        )
        values (
          ${club.run_id}::uuid,
          ${club.id}::uuid,
          ${person.profile_id}::uuid,
          'primary_admin',
          'active'
        )
      `;
      await transaction`
        update app.wallet_bindings
        set
          status = 'revoked',
          revoked_at = statement_timestamp(),
          revocation_reason = 'legacy'
        where run_id = ${club.run_id}::uuid
          and organization_id = ${club.id}::uuid
          and owner_type = 'organization'
          and status = 'active'
      `;
      await transaction`
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
          verified_at
        )
        values (
          ${club.run_id}::uuid,
          'solana:devnet',
          ${walletAddress},
          'organization',
          null,
          ${club.id}::uuid,
          ${person.auth_user_id}::uuid,
          'prepared',
          'active',
          statement_timestamp()
        )
      `;
    });
  } finally {
    await sql.end();
  }
}

async function clubRequest(page, path, options = {}) {
  return page.request.fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      origin: siteUrl,
      ...(options.data ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
}

async function signedProof(signer, challenge, message = challenge.message) {
  const signature = await signBytes(
    signer.keyPair.privateKey,
    new TextEncoder().encode(message),
  );
  return {
    challengeId: challenge.id,
    walletAddress: challenge.address,
    message,
    signature: Buffer.from(signature).toString("base64"),
  };
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const email = `dev0041-admin-${nonce}@example.com`;
  const clubSigner = await generateKeyPairSigner();
  const otherSigner = await generateKeyPairSigner();

  await createAccount(page, email, "Club Administrator");
  await page.goto(`${siteUrl}/clubs/sign-in`, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", {
      name: "This account has no prepared club access.",
    })
    .waitFor();
  assert.equal(await page.getByLabel("Email address").count(), 0);
  await page.getByText("Signed in personally as").waitFor();
  await page
    .locator(".club-personal-context")
    .getByText("Club Administrator", { exact: true })
    .waitFor();

  await prepareClub(email, clubSigner.address);

  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByText("Prepared access: Northside Combat", { exact: true })
    .waitFor();
  await page.getByText("Connect the prepared club wallet.").waitFor();
  await page.getByText(clubSigner.address).waitFor();
  await page.getByRole("button", { name: "Connect Phantom wallet" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Your club. Your wallet.",
  });
  const clubTab = dialog.getByRole("tab", {
    name: "Northside Combat club wallet",
  });
  await clubTab.focus();
  assert.equal(
    await clubTab.evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  await dialog.getByText("Connect the prepared club wallet.").waitFor();
  await dialog.getByText(clubSigner.address).waitFor();
  await page.setViewportSize({ width: 393, height: 852 });
  await dialog
    .getByRole("link", { name: "Get Phantom from the official site" })
    .waitFor();
  await dialog.getByRole("button", { name: "Close dialog" }).click();

  let response = await clubRequest(page, "/api/wallet/club");
  assert.equal(response.status(), 200);
  let result = await response.json();
  assert.equal(result.status, "eligible");
  assert.equal(result.club.name, "Northside Combat");
  assert.equal(result.club.wallet.address, clubSigner.address);

  response = await page.request.post(`${siteUrl}/api/wallet/club/challenge`, {
    headers: {
      origin: "https://untrusted.example",
      "content-type": "application/json",
    },
    data: { walletAddress: clubSigner.address },
  });
  assert.equal(response.status(), 403);

  response = await clubRequest(page, "/api/wallet/club/challenge", {
    method: "POST",
    data: { walletAddress: otherSigner.address },
  });
  assert.equal(response.status(), 409);
  assert.deepEqual(await response.json(), { status: "conflict" });

  response = await clubRequest(page, "/api/wallet/club/challenge", {
    method: "POST",
    data: { walletAddress: clubSigner.address },
  });
  assert.equal(response.status(), 200);
  result = await response.json();
  assert.equal(result.status, "challenge");
  assert.match(result.challenge.message, /Action: Authorize club wallet/);
  assert.match(result.challenge.message, /does not create a transaction/);

  const proof = await signedProof(clubSigner, result.challenge);
  response = await clubRequest(page, "/api/wallet/club/proof", {
    method: "POST",
    data: { ...proof, message: `${proof.message}\nchanged` },
  });
  assert.equal(response.status(), 400);
  assert.deepEqual(await response.json(), { status: "invalid-proof" });

  response = await clubRequest(page, "/api/wallet/club/proof", {
    method: "POST",
    data: proof,
  });
  assert.equal(response.status(), 200);
  result = await response.json();
  assert.equal(result.status, "authorized");
  assert.equal(result.club.name, "Northside Combat");
  assert.equal(
    new Date(result.authority.expiresAt).getTime() -
      new Date(result.authority.grantedAt).getTime(),
    10 * 60 * 1_000,
  );

  response = await clubRequest(page, "/api/wallet/club/proof", {
    method: "POST",
    data: proof,
  });
  assert.equal(response.status(), 400);
  assert.deepEqual(await response.json(), { status: "invalid-proof" });

  response = await clubRequest(page, "/api/wallet/club", {
    method: "DELETE",
  });
  assert.equal(response.status(), 200);
  assert.deepEqual(await response.json(), { status: "revoked" });
  response = await clubRequest(page, "/api/wallet/club");
  assert.equal((await response.json()).status, "eligible");

  assert.deepEqual(pageErrors, []);
  console.log(
    "Club wallet rehearsal passed for no-access and eligible club-entry states, server-derived eligibility, same-origin protection, exact message proof, replay rejection, ten-minute authority and explicit revocation.",
  );
} finally {
  await browser.close();
}
