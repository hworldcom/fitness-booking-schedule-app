import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const siteUrl =
  process.env.PROFILE_IMAGE_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.PROFILE_IMAGE_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const fixturePath = "public/images/coaches/daniel-park.webp";
const testScope = process.env.PROFILE_IMAGE_TEST_SCOPE ?? "all";
if (!new Set(["all", "account", "coach"]).has(testScope)) {
  throw new Error("PROFILE_IMAGE_TEST_SCOPE must be all, account or coach.");
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
  throw new Error(`The local OTP email for ${email} did not arrive in time.`);
}

async function signIn(page, email, displayName) {
  const previousIds = await mailboxMessageIds(email);
  await page.goto(`${siteUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const button = document.querySelector(
      'form.auth-form button[type="submit"]',
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.getByLabel("Email address").fill(email);
  await page.locator('form.auth-form button[type="submit"]').click();
  await page.getByText("Check your email.").waitFor({ timeout: 60_000 });
  const code = await newEmailCode(email, previousIds);
  await page.getByLabel("Six-digit code").fill(code);
  await page.locator('form.auth-form button[type="submit"]').click();
  await page
    .getByText(`Signed in as ${displayName}.`)
    .waitFor({ timeout: 30_000 });
}

async function removeVisibleImage(page) {
  const remove = page.getByRole("button", { name: "Remove", exact: true });
  if ((await remove.count()) === 0) return;
  await remove.click();
  await page.getByText(/avatar removed|portrait removed/i).waitFor({
    timeout: 30_000,
  });
}

const shellAvatarSelectors = [
  ".sidebar-profile .avatar",
  ".header-avatar .avatar",
];

async function assertShellImages(page, expectedUrlFragment) {
  await page.waitForFunction(
    ({ selectors, expected }) =>
      selectors.every((selector) => {
        const image = document.querySelector(`${selector} img`);
        return (
          image instanceof HTMLImageElement && image.src.includes(expected)
        );
      }),
    { selectors: shellAvatarSelectors, expected: expectedUrlFragment },
  );
}

async function assertShellImagesVisible(page) {
  for (const selector of shellAvatarSelectors) {
    assert.equal(await page.locator(`${selector} img`).isVisible(), true);
  }
}

async function assertShellInitials(page, expectedInitials) {
  await page.waitForFunction(
    ({ selectors, expected }) =>
      selectors.every((selector) => {
        const avatar = document.querySelector(selector);
        return (
          avatar instanceof HTMLElement &&
          !avatar.querySelector("img") &&
          avatar.textContent?.trim() === expected
        );
      }),
    { selectors: shellAvatarSelectors, expected: expectedInitials },
  );
}

function runNpmScript(script) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", "--silent", script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`The ${script} command failed.`);
}

function restoreDanielFixture() {
  runNpmScript("db:seed");
}

const browser = await chromium.launch({ channel: "chrome" });
let accountPage;
let coachPage;
try {
  if (testScope !== "coach") {
    const accountContext = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
    });
    accountPage = await accountContext.newPage();
    await signIn(accountPage, "hoang@users.movx.test", "Hoang");
    const initialActorResponse = await accountPage.request.get(
      `${siteUrl}/api/auth/actor`,
    );
    const initialActor = await initialActorResponse.json();
    assert.equal(initialActor.profile.avatarUrl, null);
    assert.equal(initialActor.profile.coachPortraitUrl, null);
    await assertShellInitials(accountPage, "HO");

    await accountPage.goto(`${siteUrl}/profile`, {
      waitUntil: "domcontentloaded",
    });
    const accountInput = accountPage.locator(
      '.profile-image-uploader input[type="file"]',
    );
    await accountInput.focus();
    assert.equal(
      await accountInput.evaluate(
        (element) => element === document.activeElement,
      ),
      true,
    );
    await accountInput.setInputFiles(fixturePath);
    await accountPage.getByText("Account avatar saved.").waitFor({
      timeout: 30_000,
    });
    await accountPage.getByAltText("Hoang account avatar").first().waitFor();
    await assertShellImages(accountPage, "/api/profile/avatar?v=");
    await accountPage.setViewportSize({ width: 1440, height: 1040 });
    await assertShellImagesVisible(accountPage);
    await accountPage.setViewportSize({ width: 393, height: 852 });
    const privateImage = await accountPage.request.get(
      `${siteUrl}/api/profile/avatar`,
    );
    assert.equal(privateImage.status(), 200);
    assert.equal(privateImage.headers()["content-type"], "image/webp");
    const anonymousContext = await browser.newContext();
    const anonymousImage = await anonymousContext.request.get(
      `${siteUrl}/api/profile/avatar`,
    );
    assert.equal(anonymousImage.status(), 401);
    await anonymousContext.close();
    runNpmScript("auth:provision:test-user");
    const preservedActor = await (
      await accountPage.request.get(`${siteUrl}/api/auth/actor`)
    ).json();
    assert.match(
      preservedActor.profile.avatarUrl,
      /^\/api\/profile\/avatar[?]v=/,
    );
    assert.equal(
      await accountPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await removeVisibleImage(accountPage);
    const finalActor = await (
      await accountPage.request.get(`${siteUrl}/api/auth/actor`)
    ).json();
    assert.equal(finalActor.profile.avatarUrl, null);
    assert.equal(finalActor.profile.coachPortraitUrl, null);
    await assertShellInitials(accountPage, "HO");
  }

  if (testScope !== "account") {
    const coachContext = await browser.newContext({
      viewport: { width: 1440, height: 1040 },
    });
    coachPage = await coachContext.newPage();
    await signIn(coachPage, "daniel.park@coaches.movx.test", "Daniel Park");
    await assertShellImages(coachPage, "/images/coaches/daniel-park.webp");
    await assertShellImagesVisible(coachPage);
    await coachPage.goto(`${siteUrl}/profile`, {
      waitUntil: "domcontentloaded",
    });
    await coachPage
      .getByAltText("Daniel Park public coach portrait")
      .first()
      .waitFor();
    assert.equal(
      await coachPage
        .getByRole("button", { name: "Remove", exact: true })
        .count(),
      0,
    );
    await coachPage.getByText(/public coach portrait was detected/i).waitFor();
    await coachPage
      .locator('.profile-image-uploader input[type="file"]')
      .setInputFiles(fixturePath);
    await coachPage.getByText("Account avatar saved.").waitFor({
      timeout: 30_000,
    });
    await coachPage
      .getByAltText("Daniel Park account avatar")
      .first()
      .waitFor();
    await assertShellImages(coachPage, "/api/profile/avatar?v=");
    await removeVisibleImage(coachPage);
    await coachPage
      .getByAltText("Daniel Park public coach portrait")
      .first()
      .waitFor();
    await assertShellImages(coachPage, "/images/coaches/daniel-park.webp");
    await coachPage
      .getByText(/public coach portrait is shown instead/i)
      .waitFor();
    await coachPage.goto(`${siteUrl}/profile/coach`, {
      waitUntil: "domcontentloaded",
    });
    await coachPage
      .locator('.profile-image-uploader input[type="file"]')
      .setInputFiles(fixturePath);
    await coachPage.getByText("Public coach portrait saved.").waitFor({
      timeout: 30_000,
    });
    await assertShellImages(
      coachPage,
      "/storage/v1/object/public/coach-portraits/",
    );
    await coachPage.goto(`${siteUrl}/coaches/daniel-park`, {
      waitUntil: "domcontentloaded",
    });
    await coachPage.getByAltText("Daniel Park's coach portrait").waitFor();
    await coachPage.goto(`${siteUrl}/profile/coach`, {
      waitUntil: "domcontentloaded",
    });
    await removeVisibleImage(coachPage);
    await assertShellInitials(coachPage, "DP");
  }

  const scopeSummary =
    testScope === "all"
      ? "private account upload/removal, public coach upload/removal, both shell icons, fallback precedence, mobile overflow and intended-surface rendering"
      : testScope === "account"
        ? "private account upload/removal, both shell icons, private serving and mobile overflow"
        : "public coach upload/removal, both shell icons, fallback precedence and public-profile rendering";
  console.log(`Profile image rehearsal passed for ${scopeSummary}.`);
} finally {
  if (accountPage) {
    try {
      await accountPage.goto(`${siteUrl}/profile`, {
        waitUntil: "domcontentloaded",
      });
      await removeVisibleImage(accountPage);
    } catch {
      // The test's primary failure is reported after cleanup attempts.
    }
  }
  if (coachPage) {
    try {
      await coachPage.goto(`${siteUrl}/profile`, {
        waitUntil: "domcontentloaded",
      });
      await removeVisibleImage(coachPage);
      await coachPage.goto(`${siteUrl}/profile/coach`, {
        waitUntil: "domcontentloaded",
      });
      await removeVisibleImage(coachPage);
    } catch {
      // The checked-in fixture is restored below after cleanup attempts.
    }
  }
  await browser.close();
  restoreDanielFixture();
}
