import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { generateKeyPairSigner, signBytes } from "@solana/kit";

const siteUrl = process.env.AUTH_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.AUTH_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
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
  await Promise.race([
    page.getByText("Check your email.").waitFor({ timeout: 60_000 }),
    page.locator(".wallet-error, .auth-notice.warning").first().waitFor({
      timeout: 60_000,
    }),
  ]);
  if ((await page.getByText("Check your email.").count()) === 0) {
    throw new Error(
      `Email code request failed: ${await page.locator("main").innerText()}`,
    );
  }
  await page.getByLabel("Six-digit code").fill(await emailCodeFor(email));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page
    .getByText(/Email verified|Signed in as/)
    .first()
    .waitFor({ timeout: 20_000 });
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Create my profile" }).click();
  await page
    .getByRole("heading", { name: "How would you like to use MovX?" })
    .waitFor({ timeout: 20_000 });
  await page.getByRole("link", { name: "Find a coach" }).click();
  await page.waitForURL(/\/explore$/);
}

async function walletRequest(page, path, options = {}) {
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

async function requestChallenge(page, signer, purpose) {
  const response = await walletRequest(page, "/api/wallet/personal/challenge", {
    method: "POST",
    data: { purpose, walletAddress: signer.address },
  });
  assert.equal(response.status(), 200);
  const result = await response.json();
  assert.equal(result.status, "challenge");
  assert.equal(result.challenge.address, signer.address);
  assert.equal(result.challenge.purpose, purpose);
  assert.match(result.challenge.message, /does not create a transaction/);
  return result.challenge;
}

async function signedProof(signer, challenge, message = challenge.message) {
  const signature = await signBytes(
    signer.keyPair.privateKey,
    new TextEncoder().encode(message),
  );
  return {
    challengeId: challenge.id,
    purpose: challenge.purpose,
    walletAddress: challenge.address,
    message,
    signature: Buffer.from(signature).toString("base64"),
  };
}

async function submitProof(page, proof) {
  return walletRequest(page, "/api/wallet/personal/proof", {
    method: "POST",
    data: proof,
  });
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  const firstContext = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const firstPage = await firstContext.newPage();
  const firstErrors = [];
  firstPage.on("pageerror", (error) => firstErrors.push(error.message));
  await createAccount(
    firstPage,
    `dev0047-owner-${nonce}@example.com`,
    "Wallet Owner",
  );

  let response = await walletRequest(firstPage, "/api/wallet/personal");
  assert.equal(response.status(), 200);
  assert.deepEqual(await response.json(), { status: "unlinked" });

  const firstSigner = await generateKeyPairSigner();
  const secondSigner = await generateKeyPairSigner();
  response = await firstPage.request.post(
    `${siteUrl}/api/wallet/personal/challenge`,
    {
      headers: {
        origin: "https://untrusted.example",
        "content-type": "application/json",
      },
      data: {
        purpose: "link-personal-wallet",
        walletAddress: firstSigner.address,
      },
    },
  );
  assert.equal(response.status(), 403);
  assert.deepEqual(await response.json(), { status: "forbidden" });

  const linkChallenge = await requestChallenge(
    firstPage,
    firstSigner,
    "link-personal-wallet",
  );
  const exactLinkProof = await signedProof(firstSigner, linkChallenge);
  response = await submitProof(firstPage, {
    ...exactLinkProof,
    message: `${exactLinkProof.message}\nchanged`,
  });
  assert.equal(response.status(), 400);
  assert.deepEqual(await response.json(), { status: "invalid-proof" });

  response = await submitProof(firstPage, exactLinkProof);
  assert.equal(response.status(), 200);
  let result = await response.json();
  assert.equal(result.status, "linked");
  assert.equal(result.wallet.address, firstSigner.address);

  response = await submitProof(firstPage, exactLinkProof);
  assert.equal(response.status(), 400);
  assert.deepEqual(await response.json(), { status: "invalid-proof" });

  const replacementChallenge = await requestChallenge(
    firstPage,
    secondSigner,
    "replace-personal-wallet",
  );
  response = await submitProof(
    firstPage,
    await signedProof(secondSigner, replacementChallenge),
  );
  assert.equal(response.status(), 200);
  result = await response.json();
  assert.equal(result.status, "linked");
  assert.equal(result.wallet.address, secondSigner.address);

  const secondContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const secondPage = await secondContext.newPage();
  const secondErrors = [];
  secondPage.on("pageerror", (error) => secondErrors.push(error.message));
  await createAccount(
    secondPage,
    `dev0047-collision-${nonce}@example.com`,
    "Wallet Collision",
  );
  const collisionChallenge = await requestChallenge(
    secondPage,
    secondSigner,
    "link-personal-wallet",
  );
  response = await submitProof(
    secondPage,
    await signedProof(secondSigner, collisionChallenge),
  );
  assert.equal(response.status(), 409);
  assert.deepEqual(await response.json(), { status: "conflict" });

  response = await walletRequest(firstPage, "/api/wallet/personal", {
    method: "DELETE",
  });
  assert.equal(response.status(), 200);
  assert.deepEqual(await response.json(), { status: "unlinked" });
  response = await walletRequest(firstPage, "/api/wallet/personal");
  assert.deepEqual(await response.json(), { status: "unlinked" });

  assert.deepEqual(firstErrors, []);
  assert.deepEqual(secondErrors, []);
  console.log(
    "Personal wallet rehearsal passed for same-origin protection, exact message proof, replay rejection, replacement, cross-account collision and unlink.",
  );
} finally {
  await browser.close();
}
