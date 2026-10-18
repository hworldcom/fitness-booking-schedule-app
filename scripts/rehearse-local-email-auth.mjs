import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import sharp from "sharp";

// Deliberately refuses hosted Auth, databases, mailboxes and websites. CLI keys
// remain in memory. Every created account has an exact per-run cleanup record.
const base = process.env.AUTH_TEST_SITE_URL ?? "http://localhost:3100";
assert.equal(base, "http://localhost:3100");
const values = Object.fromEntries(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  })
    .toString()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
assert.equal(values.API_URL, "http://127.0.0.1:55321");
assert.equal(
  values.DB_URL,
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
);
const mailbox = "http://127.0.0.1:55324";
const admin = createClient(values.API_URL, values.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = postgres(values.DB_URL, {
  max: 4,
  prepare: false,
  ssl: false,
  onnotice: () => {},
});
const expect = baseExpect.configure({ timeout: 30000 });
const tag = `dev0286-${randomUUID()}`;
let cleanupTag = tag;
const evidence = `tmp/email-auth-rehearsal/${tag}`;
await mkdir(evidence, { recursive: true, mode: 0o700 });
const owned = [],
  checks = [];
const ownedFlowHashes = new Set();
let phase = "setup",
  browser;
const password = "starter passphrase",
  resetPassword = "new easy passphrase",
  changedPassword = "another passphrase";
const digest = (value) => createHash("sha256").update(value).digest("hex");
async function step(name, fn) {
  phase = name;
  console.log("Checking: " + name);
  await fn();
  checks.push(name);
  console.log("Passed: " + name);
}
async function command(context, body) {
  if (typeof body.email === "string" && body.email.startsWith(tag))
    ownedFlowHashes.add(digest(body.email));
  const response = await context.request.post(base + "/api/auth/operations", {
    headers: { origin: base },
    data: body,
  });
  return { code: response.status(), body: await response.json() };
}
async function session(context) {
  return (await context.request.get(base + "/api/auth/session")).json();
}
async function actor(context) {
  return (await context.request.get(base + "/api/auth/actor")).json();
}
async function authRow(email) {
  const [row] = await sql`select id from auth.users where email=${email}`;
  assert.ok(row);
  if (!owned.some((item) => item.id === row.id)) {
    owned.push({ id: row.id, email });
    await writeFile(evidence + "/recovery-ids.json", JSON.stringify(owned), {
      mode: 0o600,
    });
  }
  return row.id;
}
async function message(email, subject) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const list = await (await fetch(mailbox + "/api/v1/messages")).json();
    const found = list.messages?.find(
      (item) =>
        item.To?.some((to) => to.Address === email) && item.Subject === subject,
    );
    if (found)
      return (await fetch(mailbox + "/api/v1/message/" + found.ID)).json();
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Expected local captured email did not arrive");
}
function emailLink(mail) {
  const link = mail.HTML?.match(/href="([^"]+)"/i)?.[1]?.replaceAll(
    "&amp;",
    "&",
  );
  assert.ok(link);
  const url = new URL(link);
  assert.equal(url.origin, base);
  assert.equal(url.pathname, "/auth/confirm");
  assert.equal(url.search, "");
  assert.ok(url.hash.includes("token_hash="));
  return link;
}
function proofFrom(link) {
  const p = new URLSearchParams(new URL(link).hash.slice(1));
  return {
    action: "confirm-email",
    flow: p.get("flow"),
    tokenHash: p.get("token_hash"),
    type: p.get("type"),
  };
}
async function confirm(page, link) {
  await page.goto(link, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Continue securely" }),
  ).toBeEnabled();
  assert.equal(new URL(page.url()).hash, "");
  await page.getByRole("button", { name: "Continue securely" }).click();
}
async function open(page, path) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await expect(
    page.locator(".authentication-form input").first(),
  ).toBeEnabled();
}
async function login(context, email, secret = password) {
  const result = await command(context, {
    action: "sign-in",
    email,
    password: secret,
  });
  assert.equal(result.body.status, "success", JSON.stringify(result.body));
  return session(context);
}
async function snapshot(id) {
  return sql.begin(async (tx) => {
    const [profile] =
      await tx`select to_jsonb(p) value from app.profiles p where auth_user_id=${id}::uuid`;
    const details =
      await tx`select to_jsonb(d) value from app.account_personal_details d where profile_id=(select id from app.profiles where auth_user_id=${id}::uuid)`;
    const messages =
      await tx`select to_jsonb(e) value from app.message_entries e join app.message_conversations c on c.id=e.conversation_id where c.athlete_profile_id=(select id from app.profiles where auth_user_id=${id}::uuid) order by e.seq`;
    return JSON.stringify({
      profile: profile?.value,
      details: details.map((r) => r.value),
      messages: messages.map((r) => r.value),
    });
  });
}
const baseline =
  await sql`select id, md5(to_jsonb(p)::text) hash from app.profiles p`;
try {
  if (process.argv[2] === "--cleanup") {
    const manifest = process.argv[3];
    const matched = manifest?.match(
      /^tmp\/email-auth-rehearsal\/(dev0286-[a-f0-9-]{36})\/recovery-ids[.]json$/,
    );
    assert.ok(matched);
    cleanupTag = matched[1];
    ownedFlowHashes.add(digest(matched[1] + "-absent@users.movx.test"));
    for (const item of JSON.parse(await readFile(manifest, "utf8"))) {
      assert.match(item.id, /^[0-9a-f-]{36}$/);
      assert.match(
        item.email,
        /^dev0286-[a-f0-9-]+(?:-legacy|-reserved|-picture)?@users\.movx\.test$/,
      );
      assert.ok(
        item.email === matched[1] + "@users.movx.test" ||
          item.email === matched[1] + "-legacy@users.movx.test" ||
          item.email === matched[1] + "-reserved@users.movx.test" ||
          item.email === matched[1] + "-picture@users.movx.test",
      );
      ownedFlowHashes.add(digest(item.email));
      const rows =
        await sql`select id from auth.users where id=${item.id}::uuid and email=${item.email}`;
      if (rows.length) owned.push(item);
    }
  } else {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const first = await browser.newContext({
        viewport: { width: 1440, height: 1040 },
      }),
      second = await browser.newContext({
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      }),
      stranger = await browser.newContext();
    const page = await first.newPage(),
      mobile = await second.newPage();
    const errors = [];
    for (const p of [page, mobile]) {
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("request", (r) => {
        const u = new URL(r.url());
        const unsafe = [
          "password",
          "currentPassword",
          "token_hash",
          "access_token",
          "refresh_token",
        ].some((key) => u.searchParams.has(key));
        if (unsafe) errors.push("Credential in request URL");
      });
    }
    const email = tag + "@users.movx.test";
    const username = "r_" + tag.slice(8).replaceAll("-", "").slice(0, 16);
    const reservedEmail = tag + "-reserved@users.movx.test";
    const reserved = await admin.auth.admin.createUser({
      email: reservedEmail,
      email_confirm: true,
    });
    assert.equal(reserved.error, null);
    const reservedId = await authRow(reservedEmail);
    const [reservedProfile] =
      await sql`select identity_profile_id id from app.enroll_application_identity(${reservedId}::uuid,'Reserved rehearsal handle')`;
    await sql`insert into app.account_personal_details(profile_id,username) values (${reservedProfile.id}::uuid,${username + "_taken"})`;
    let id, original, link, secondRefresh;
    await step(
      "registration validates an easy 8-character policy and requires email proof",
      async () => {
        await open(page, "/register");
        await page.getByLabel("Email address").fill(email);
        await page.getByLabel("New password", { exact: true }).fill("short");
        await page
          .getByRole("button", { name: "Create account", exact: true })
          .click();
        await expect(page.locator(".authentication-error")).toContainText(
          "8 characters",
        );
        await page.getByLabel("New password", { exact: true }).fill(password);
        await page
          .getByRole("button", { name: "Create account", exact: true })
          .click();
        await expect(page).toHaveURL(/\/check-email\?/);
        id = await authRow(email);
        assert.equal((await actor(first)).status, "signed-out");
        const unconfirmedEnrollment = await first.request.post(
          base + "/api/auth/identity",
          {
            headers: { origin: base },
            data: {
              username,
              fullName: "Private Rehearsal Name",
              displayName: "Auth Rehearsal Athlete",
            },
          },
        );
        assert.equal(unconfirmedEnrollment.status(), 401);
        assert.equal(
          (await command(second, { action: "sign-in", email, password })).body
            .status,
          "invalid-credentials",
        );
        link = emailLink(await message(email, "Confirm your MovX Club email"));
      },
    );
    await step(
      "confirmation rejects wrong-browser and wrong-purpose proofs without consuming the valid link",
      async () => {
        const proof = proofFrom(link);
        assert.equal(
          (await command(stranger, proof)).body.status,
          "invalid-proof",
        );
        assert.equal(
          (await command(first, { ...proof, type: "recovery" })).body.status,
          "invalid-proof",
        );
        const before =
          await sql`select consumed_at from app.email_auth_flows where id_hash=${digest(proof.flow)}`;
        assert.equal(before[0].consumed_at, null);
        await confirm(page, link);
        await expect(page).toHaveURL(/\/complete-profile\?/);
        assert.equal(new URL(page.url()).searchParams.get("returnTo"), "/");
        assert.equal((await actor(first)).status, "forbidden");
        assert.equal(
          (await (await first.request.get(base + "/api/auth/identity")).json())
            .status,
          "profile-required",
        );
        assert.equal(
          (await command(first, proof)).body.status,
          "invalid-proof",
        );
        // A rejected replay leaves the established identity intact; returning login uses the same subject.
        await login(first, email);
        await page.goto(base + "/complete-profile", {
          waitUntil: "domcontentloaded",
        });
        await expect(page.getByLabel("Display name")).toBeEnabled();
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click();
        await expect(page.locator(".authentication-error")).toContainText(
          "full name and display name",
        );
        await page
          .getByLabel("Username", { exact: true })
          .fill(username + "_taken");
        await page
          .getByLabel("Full name", { exact: true })
          .fill("Private Rehearsal Name");
        await page.getByLabel("Display name").fill("Auth Rehearsal Athlete");
        await page.screenshot({
          path: evidence + "/registration-profile-desktop.png",
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click();
        await expect(page.locator(".authentication-error")).toContainText(
          "username is already taken",
        );
        await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
          "Private Rehearsal Name",
        );
        assert.equal(
          (
            await sql`select id from app.profiles where auth_user_id=${id}::uuid`
          ).length,
          0,
        );
        await page.setViewportSize({ width: 393, height: 852 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await expect(page.locator(".authentication-error")).toBeFocused();
        await page.screenshot({
          path: evidence + "/registration-profile-mobile-error.png",
          fullPage: true,
        });
        await page
          .getByLabel("Username", { exact: true })
          .fill(" @" + username.toUpperCase() + " ");
        await page.getByLabel("Display name").press("Enter");
        const pictureHeading = page.getByRole("heading", {
          name: "Add a profile picture",
          exact: true,
        });
        await expect(pictureHeading).toBeVisible();
        await expect(pictureHeading).toBeFocused();
        const later = page.getByRole("button", {
          name: "Do this later",
          exact: true,
        });
        await expect(later).toBeEnabled();
        await page.screenshot({
          path: evidence + "/optional-picture-mobile.png",
          fullPage: true,
        });
        await later.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(base + "/");
        await page.setViewportSize({ width: 1440, height: 1040 });
        original = await actor(first);
        assert.equal(original.profile.avatarUrl, null);
        original.identity = await (
          await first.request.get(base + "/api/auth/identity")
        ).json();
        assert.ok(original.identity.profile.id);
        const [saved] =
          await sql`select legal_name,preferred_first_name,username from app.account_personal_details where profile_id=${original.identity.profile.id}::uuid`;
        assert.equal(saved.legal_name, "Private Rehearsal Name");
        assert.equal(saved.preferred_first_name, "Auth Rehearsal Athlete");
        assert.equal(saved.username, username);
        assert.ok(!JSON.stringify(original).includes("Private Rehearsal Name"));
        assert.ok(!JSON.stringify(original.identity).includes(username));
        const privateDetails = await (
          await first.request.get(base + "/api/account")
        ).json();
        assert.equal(privateDetails.details.username, username);
        assert.equal(
          privateDetails.details.legalName,
          "Private Rehearsal Name",
        );
        assert.equal(original.status, "authorized");
        assert.equal((await session(first)).subject, id);
      },
    );
    await step(
      "optional registration picture normalizes private upload and preserves explicit coach continuation",
      async () => {
        const pictureEmail = tag + "-picture@users.movx.test";
        const created = await admin.auth.admin.createUser({
          email: pictureEmail,
          password,
          email_confirm: true,
        });
        assert.equal(created.error, null);
        const pictureId = await authRow(pictureEmail);
        await login(stranger, pictureEmail);
        const picturePage = await stranger.newPage();
        await picturePage.setViewportSize({ width: 1440, height: 1040 });
        await open(
          picturePage,
          "/complete-profile?intent=coach&returnTo=%2Fsessions%3Fsection%3Drequests",
        );
        await picturePage
          .getByLabel("Username", { exact: true })
          .fill(username + "_photo");
        await picturePage
          .getByLabel("Full name", { exact: true })
          .fill("Picture Private Name");
        await picturePage
          .getByLabel("Display name", { exact: true })
          .fill("Picture Fixture");
        await picturePage
          .getByRole("button", { name: "Continue", exact: true })
          .press("Enter");
        await expect(
          picturePage.getByRole("heading", {
            name: "Add a profile picture",
            exact: true,
          }),
        ).toBeFocused();
        await picturePage.locator('input[type="file"]').setInputFiles({
          name: "invalid.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("not an image"),
        });
        await expect(
          picturePage.locator(".profile-image-uploader").getByRole("alert"),
        ).toContainText("Choose a JPEG, PNG or WebP image.");
        await expect(
          picturePage.getByRole("button", {
            name: "Do this later",
            exact: true,
          }),
        ).toBeEnabled();
        await expect(
          picturePage.getByRole("button", { name: "Continue", exact: true }),
        ).toBeEnabled();
        let releaseUpload;
        const held = new Promise((resolve) => {
          releaseUpload = resolve;
        });
        await picturePage.route("**/api/profile/avatar", async (route) => {
          if (route.request().method() === "POST") await held;
          await route.continue();
        });
        const source = await sharp({
          create: {
            width: 900,
            height: 600,
            channels: 3,
            background: "#49783a",
          },
        })
          .jpeg()
          .toBuffer();
        const uploadStarted = picturePage.waitForRequest(
          (r) =>
            new URL(r.url()).pathname === "/api/profile/avatar" &&
            r.method() === "POST",
        );
        try {
          await picturePage.locator('input[type="file"]').setInputFiles({
            name: "picture.jpg",
            mimeType: "image/jpeg",
            buffer: source,
          });
          await uploadStarted;
          await expect(
            picturePage.getByRole("button", { name: "Continue", exact: true }),
          ).toBeDisabled();
          await expect(
            picturePage.getByRole("button", {
              name: "Do this later",
              exact: true,
            }),
          ).toBeDisabled();
        } finally {
          releaseUpload();
        }
        await expect(
          picturePage
            .getByRole("status")
            .filter({ hasText: "Account avatar saved." }),
        ).toBeVisible();
        const privateImage = await stranger.request.get(
          base + "/api/profile/avatar",
        );
        assert.equal(privateImage.status(), 200);
        assert.match(privateImage.headers()["content-type"], /image\/webp/);
        const bytes = await privateImage.body();
        const metadata = await sharp(bytes).metadata();
        assert.equal(metadata.width, 512);
        assert.equal(metadata.height, 512);
        assert.equal(metadata.exif, undefined);
        assert.ok(bytes.length <= 512 * 1024);
        assert.equal(
          (await second.request.get(base + "/api/profile/avatar")).status(),
          401,
        );
        await picturePage.screenshot({
          path: evidence + "/optional-picture-desktop-saved.png",
          fullPage: true,
        });
        await picturePage
          .getByRole("button", { name: "Remove", exact: true })
          .click();
        await expect(
          picturePage
            .getByRole("status")
            .filter({ hasText: "Account avatar removed." }),
        ).toBeVisible();
        assert.equal(
          (await stranger.request.get(base + "/api/profile/avatar")).status(),
          404,
        );
        await picturePage.locator('input[type="file"]').setInputFiles({
          name: "picture.jpg",
          mimeType: "image/jpeg",
          buffer: source,
        });
        await expect(
          picturePage
            .getByRole("status")
            .filter({ hasText: "Account avatar saved." }),
        ).toBeVisible();
        await picturePage
          .getByRole("button", { name: "Continue", exact: true })
          .press("Enter");
        await expect(
          picturePage.getByRole("button", {
            name: "Apply to coach",
            exact: true,
          }),
        ).toBeVisible();
        assert.equal((await actor(stranger)).coachAccessStatus, "not-applied");
        await picturePage
          .getByRole("link", { name: "Continue as an athlete", exact: true })
          .click();
        await expect(picturePage).toHaveURL(/\/sessions\?section=requests$/);
        await picturePage.goto(base + "/profile");
        await expect(
          picturePage.getByRole("heading", {
            name: "Choose your account picture",
            exact: true,
          }),
        ).toBeVisible();
        const [saved] =
          await sql`select avatar_storage_path from app.profiles where auth_user_id=${pictureId}::uuid`;
        assert.ok(saved.avatar_storage_path);
        assert.equal(
          (await command(stranger, { action: "sign-out" })).body.status,
          "success",
        );
        assert.equal((await session(stranger)).status, "signed-out");
        await picturePage.close();
      },
    );
    await step(
      "returning password login, desktop/mobile layout and current-device sign-out",
      async () => {
        await open(mobile, "/sign-in");
        await mobile.getByLabel("Email address").fill(email);
        await mobile.getByLabel("Password", { exact: true }).fill(password);
        await mobile
          .getByRole("button", { name: "Sign in", exact: true })
          .press("Enter");
        await expect(mobile).toHaveURL(base + "/");
        assert.equal(
          (await (await second.request.get(base + "/api/auth/identity")).json())
            .profile.id,
          original.identity.profile.id,
        );
        await page.goto(base + "/account?section=login-security", {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("button", { name: "Change password", exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: evidence + "/account-desktop.png",
          fullPage: true,
        });
        assert.equal(
          (await command(second, { action: "sign-out" })).body.status,
          "success",
        );
        assert.equal((await session(second)).status, "signed-out");
        assert.equal((await session(first)).subject, id);
        const deliberateReturn = await command(second, {
          action: "sign-in",
          email,
          password,
          returnTo: "/sessions?section=requests",
        });
        assert.equal(deliberateReturn.body.next, "/sessions?section=requests");
        const coachIntent = await command(second, {
          action: "sign-in",
          email,
          password,
          intent: "coach",
        });
        assert.equal(
          coachIntent.body.next,
          "/complete-profile?returnTo=%2F&intent=coach",
        );
        assert.equal(
          (await command(second, { action: "sign-out" })).body.status,
          "success",
        );
        await open(mobile, "/sign-in");
        assert.ok(
          await mobile.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await mobile.screenshot({
          path: evidence + "/sign-in-mobile.png",
          fullPage: true,
        });
        await login(second, email);
      },
    );
    const tokenCookies = (await second.cookies())
      .filter((c) => /^sb-.+-auth-token(?:\.\d+)?$/.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    const encoded = tokenCookies.map((c) => c.value).join("");
    assert.ok(encoded.startsWith("base64-"));
    secondRefresh = JSON.parse(
      Buffer.from(encoded.slice(7), "base64url").toString(),
    ).refresh_token;
    assert.ok(secondRefresh);
    await step(
      "recovery is restricted on the server, rate-limited, single-use and revokes both devices",
      async () => {
        await open(
          page,
          "/forgot-password?returnTo=%2Faccount%3Fsection%3Dlogin-security",
        );
        await page.getByLabel("Email address").fill(email);
        await page.getByRole("button", { name: "Send reset link" }).click();
        await expect(page).toHaveURL(/\/check-email\?/);
        assert.equal(
          (await command(first, { action: "request-recovery", email })).code,
          429,
        );
        const recovery = emailLink(
          await message(email, "Reset your MovX Club password"),
        );
        await confirm(page, recovery);
        await expect(page).toHaveURL(/\/reset-password$/);
        assert.equal((await session(first)).status, "recovery-required");
        assert.equal((await actor(first)).status, "signed-out");
        assert.equal(
          (await first.request.get(base + "/api/account")).status(),
          401,
        );
        assert.equal(
          (await command(first, { action: "sign-in", email, password })).body
            .status,
          "recovery-required",
        );
        const denied = await first.request.post(base + "/api/auth/identity", {
          headers: { origin: base },
          data: {
            username: "forbidden_change",
            fullName: "Forbidden Private",
            displayName: "Forbidden Change",
          },
        });
        assert.equal(denied.status(), 401);
        await page
          .getByLabel("New password", { exact: true })
          .fill(resetPassword);
        await page
          .getByRole("button", { name: "Save new password", exact: true })
          .click();
        await expect(page).toHaveURL(/\/sign-in\?.*notice=password-updated/);
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: "Your password was saved" }),
        ).toBeVisible();
        assert.equal((await session(first)).status, "signed-out");
        assert.equal((await session(second)).status, "signed-out");
        assert.equal(
          (await command(first, { action: "sign-in", email, password })).body
            .status,
          "invalid-credentials",
        );
        assert.equal(
          (await command(first, proofFrom(recovery))).body.status,
          "invalid-proof",
        );
        const refreshed = await fetch(
          values.API_URL + "/auth/v1/token?grant_type=refresh_token",
          {
            method: "POST",
            headers: {
              apikey: values.PUBLISHABLE_KEY ?? values.ANON_KEY,
              "content-type": "application/json",
            },
            body: JSON.stringify({ refresh_token: secondRefresh }),
          },
        );
        assert.equal(
          refreshed.ok,
          false,
          "A revoked device still refreshed its Auth session",
        );
        await message(email, "Your MovX Club password has changed");
        await login(first, email, resetPassword);
        assert.equal(
          (await (await first.request.get(base + "/api/auth/identity")).json())
            .profile.id,
          original.identity.profile.id,
        );
      },
    );
    await step(
      "Account password changes require the current password and end all old sessions",
      async () => {
        await login(second, email, resetPassword);
        await page.goto(base + "/account?section=login-security", {
          waitUntil: "domcontentloaded",
        });
        await page
          .getByRole("button", { name: "Change password", exact: true })
          .click();
        await page
          .getByLabel("Current password", { exact: true })
          .fill("wrong current");
        await page
          .getByLabel("New password", { exact: true })
          .fill(changedPassword);
        await page
          .getByRole("button", { name: "Save new password", exact: true })
          .click();
        await expect(page.locator(".authentication-error")).toContainText(
          "incorrect",
        );
        assert.equal((await session(first)).subject, id);
        await page
          .getByLabel("Current password", { exact: true })
          .fill(resetPassword);
        await page
          .getByRole("button", { name: "Save new password", exact: true })
          .click();
        await expect(page).toHaveURL(/\/sign-in\?notice=password-updated/);
        assert.equal((await session(second)).status, "signed-out");
        assert.equal(
          (
            await command(second, {
              action: "sign-in",
              email,
              password: resetPassword,
            })
          ).body.status,
          "invalid-credentials",
        );
        await login(first, email, changedPassword);
      },
    );
    await step(
      "existing passwordless identity gains a password without losing profile or private account data",
      async () => {
        const legacyEmail = tag + "-legacy@users.movx.test";
        const created = await admin.auth.admin.createUser({
          email: legacyEmail,
          email_confirm: true,
          user_metadata: { fixture: tag },
        });
        assert.ok(!created.error);
        const legacyId = await authRow(legacyEmail);
        const [enrolled] =
          await sql`select * from app.enroll_application_identity(${legacyId}::uuid,'Legacy Auth Athlete')`;
        await sql.begin(async (tx) => {
          await tx.unsafe("set local role app_runtime");
          await tx`select set_config('app.current_auth_user_id',${legacyId},true),set_config('app.current_profile_id',${enrolled.identity_profile_id},true),set_config('app.current_run_id',${enrolled.identity_run_id},true),set_config('app.current_run_role','member',true)`;
          await tx`select app.update_current_account_settings('personal-details',${tx.json({ legalName: "Private Auth Fixture", preferredFirstName: "Legacy", birthdate: null, gender: null })},0)`;
        });
        assert.equal((await session(stranger)).status, "signed-out");
        const avatar = await sharp({
          create: {
            width: 512,
            height: 512,
            channels: 3,
            background: "#526c31",
          },
        })
          .webp({ quality: 82 })
          .toBuffer();
        const avatarPath =
          enrolled.identity_profile_id + "/" + randomUUID() + ".webp";
        const uploaded = await admin.storage
          .from("account-avatars")
          .upload(avatarPath, avatar, { contentType: "image/webp" });
        assert.ok(!uploaded.error);
        await sql.begin(async (tx) => {
          await tx.unsafe("set local role app_runtime");
          await tx`select set_config('app.current_auth_user_id',${legacyId},true),set_config('app.current_profile_id',${enrolled.identity_profile_id},true),set_config('app.current_run_id',${enrolled.identity_run_id},true),set_config('app.current_run_role','member',true)`;
          await tx`select app.set_current_account_avatar_reference(${avatarPath},null)`;
          const [conversation] =
            await tx`select app.message_command('inquire',${tx.json({ coachId: "10000000-0000-4000-8000-000000000002", submissionId: randomUUID(), body: "Private authentication continuity fixture." })}) result`;
          assert.ok(conversation.result.conversationId);
        });
        const imageBefore = avatar;
        const saved = await snapshot(legacyId);
        assert.equal(
          (
            await command(stranger, {
              action: "request-recovery",
              email: legacyEmail,
            })
          ).body.status,
          "requested",
        );
        assert.equal(
          (
            await command(
              stranger,
              proofFrom(
                emailLink(
                  await message(legacyEmail, "Reset your MovX Club password"),
                ),
              ),
            )
          ).body.status,
          "recovery-required",
        );
        const race = await Promise.all([
          command(stranger, { action: "reset-password", password }),
          command(stranger, {
            action: "reset-password",
            password: changedPassword,
          }),
        ]);
        assert.equal(
          race.filter((r) => r.body.status === "password-updated").length,
          1,
        );
        const winner =
          race[0].body.status === "password-updated"
            ? password
            : changedPassword;
        await login(stranger, legacyEmail, winner);
        assert.equal((await session(stranger)).subject, legacyId);
        assert.equal(await snapshot(legacyId), saved);
        assert.deepEqual(
          await (
            await stranger.request.get(base + "/api/profile/avatar")
          ).body(),
          imageBefore,
        );
      },
    );
    await step(
      "removed code commands fail while unknown recovery and duplicate signup stay generic",
      async () => {
        const unknown = tag + "-absent@users.movx.test";
        assert.equal(
          (await command(second, { action: "request-code", email: unknown }))
            .code,
          400,
        );
        assert.equal(
          (
            await sql`select count(*)::int n from auth.users where email=${unknown}`
          )[0].n,
          0,
        );
        assert.equal(
          (
            await command(second, {
              action: "verify-code",
              email: unknown,
              code: "123456",
            })
          ).code,
          400,
        );
        assert.equal(
          (
            await command(second, {
              action: "request-recovery",
              email: unknown,
            })
          ).body.status,
          "requested",
        );
        const legacyFlow = randomUUID().replaceAll("-", "").repeat(2),
          binding = randomUUID().replaceAll("-", "").repeat(2);
        await sql`select app.begin_email_auth_flow(${digest(legacyFlow)},${digest(binding)},${digest(unknown)},'login',null,'/sessions')`;
        await second.addCookies([
          {
            name: "movx-auth-flow",
            value: legacyFlow + "." + binding,
            url: base,
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        const invalid = await command(second, {
          action: "confirm-email",
          flow: legacyFlow,
          tokenHash: "b".repeat(64),
          type: "signup",
        });
        assert.equal(invalid.body.status, "invalid-proof");
        assert.equal((await session(second)).status, "signed-out");
        await sql`update app.email_auth_flows set requested_at=statement_timestamp()-interval '61 seconds' where email_hash=${digest(email)}`;
        assert.equal(
          (await command(second, { action: "register", email, password })).body
            .status,
          "requested",
        );
        assert.equal(
          (
            await sql`select count(*)::int n from auth.users where email=${email}`
          )[0].n,
          1,
        );
      },
    );
    assert.deepEqual(errors, []);
  }
} catch (error) {
  console.error("Failed phase: " + phase);
  console.error(error);
  throw error;
} finally {
  await browser?.close();
  // A request may commit before navigation times out and before authRow records
  // its ID. Recover only this run's four explicitly permitted fixture addresses.
  for (const suffix of ["", "-legacy", "-reserved", "-picture"]) {
    const email = cleanupTag + suffix + "@users.movx.test";
    const rows = await sql`select id from auth.users where email=${email}`;
    for (const row of rows) {
      if (!owned.some((item) => item.id === row.id))
        owned.push({ id: row.id, email });
    }
  }
  await writeFile(evidence + "/recovery-ids.json", JSON.stringify(owned), {
    mode: 0o600,
  });
  const removedProfileIds = [];
  for (const fixture of owned) {
    const images =
      await sql`select id,avatar_storage_path from app.profiles where auth_user_id=${fixture.id}::uuid and avatar_storage_path is not null`;
    for (const image of images) {
      assert.ok(image.avatar_storage_path.startsWith(image.id + "/"));
      const removed = await admin.storage
        .from("account-avatars")
        .remove([image.avatar_storage_path]);
      assert.ok(!removed.error, "Exact fixture Storage cleanup failed");
    }
    await sql.begin(async (tx) => {
      const profiles =
        await tx`select id from app.profiles where auth_user_id=${fixture.id}::uuid`;
      const ids = profiles.map((r) => r.id);
      removedProfileIds.push(...ids);
      if (ids.length) {
        await tx`delete from app.account_personal_details where profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.message_conversations where athlete_profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.demo_run_participants where profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.profiles where id=any(${ids}::uuid[]) and auth_user_id=${fixture.id}::uuid`;
      }
      await tx`delete from app.email_auth_flows where email_hash=${digest(fixture.email)}`;
    });
    const result = await admin.auth.admin.deleteUser(fixture.id);
    assert.ok(!result.error, "Exact fixture Auth cleanup failed");
  }
  if (ownedFlowHashes.size)
    await sql`delete from app.email_auth_flows where email_hash=any(${Array.from(ownedFlowHashes)}::text[])`;
  const after =
    await sql`select id, md5(to_jsonb(p)::text) hash from app.profiles p`;
  assert.deepEqual(
    Array.from(after).sort((a, b) => a.id.localeCompare(b.id)),
    baseline
      .filter((p) => !removedProfileIds.includes(p.id))
      .sort((a, b) => a.id.localeCompare(b.id)),
    "Existing profiles changed",
  );
  await sql.end();
  await writeFile(
    evidence + "/result.json",
    JSON.stringify(
      {
        passed: checks,
        phase,
        cleanup: "exact owned accounts removed; existing profiles preserved",
      },
      null,
      2,
    ),
  );
}
console.log(
  process.argv[2] === "--cleanup"
    ? "Exact local rehearsal fixture cleanup passed."
    : "Local Auth/Mailpit registration, recovery and identity checks passed.",
);
