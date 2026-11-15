// MOV-238: actual two-browser password recovery, only in the owned loopback stack.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect } from "@playwright/test";

export async function rehearsePortableRecovery({
  base,
  browser,
  database,
  auth,
  mail,
  pass,
  output,
  secrets,
}) {
  assert.equal(base, "http://localhost:3169");
  assert.equal(new URL(mail).hostname, "127.0.0.1");
  assert.equal(new URL(mail).port, "55424");
  const tag = "mov238-" + randomUUID(),
    email = tag + "@users.movx.test",
    otherEmail = tag + "-other@users.movx.test",
    oldPassword = randomUUID(),
    newPassword = randomUUID();
  secrets.push(oldPassword, newPassword);
  const created = await auth.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true,
  });
  assert.ifError(created.error);
  const subject = created.data.user.id;
  const other = await auth.auth.admin.createUser({
    email: otherEmail,
    password: newPassword,
    email_confirm: true,
  });
  assert.ifError(other.error);
  const [identity] =
    await database`select * from app.enroll_application_identity(${subject}::uuid,'Recovery QA')`;
  await database`select * from app.enroll_application_identity(${other.data.user.id}::uuid,'Other Recovery QA')`;
  const before =
    await database`select to_jsonb(p)row from app.profiles p where id=${identity.identity_profile_id}::uuid`;
  const desktop = await browser.newContext(),
    phone = await browser.newContext({ viewport: { width: 375, height: 812 } }),
    unrelated = await browser.newContext();
  const command = async (context, data) => {
    const r = await context.request.post(base + "/api/auth/operations", {
      headers: { origin: base },
      data,
    });
    return { code: r.status(), body: await r.json() };
  };
  const session = async (c) =>
    (await c.request.get(base + "/api/auth/session")).json();
  const login = async (c, address, password) => {
    const r = await command(c, { action: "sign-in", email: address, password });
    assert.equal(r.body.status, "success");
  };
  try {
    await login(desktop, email, oldPassword);
    await login(unrelated, otherEmail, newPassword);
    const request = await command(desktop, {
      action: "request-recovery",
      email,
      returnTo: "/account?section=login-security",
    });
    assert.equal(request.body.status, "requested");
    assert.ok(
      (await desktop.cookies()).some((c) => c.name === "movx-auth-flow"),
    );
    assert.ok(
      !(await phone.cookies()).some((c) => c.name === "movx-auth-flow"),
    );
    let message;
    for (let i = 0; i < 40 && !message; i++) {
      const listing = await (await fetch(mail + "/api/v1/messages")).json();
      const entry = listing.messages?.find(
        (m) =>
          m.Subject === "Reset your MovX Club password" &&
          m.To?.some((t) => t.Address === email),
      );
      if (entry)
        message = await (
          await fetch(mail + "/api/v1/message/" + entry.ID)
        ).json();
      else await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(message, "Owned loopback recovery email must arrive");
    const link = message.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll(
      "&amp;",
      "&",
    );
    assert.ok(link);
    const url = new URL(link);
    assert.equal(url.origin, base);
    assert.equal(url.pathname, "/auth/confirm");
    assert.equal(url.search, "");
    const params = new URLSearchParams(url.hash.slice(1));
    const proof = {
      action: "confirm-email",
      flow: params.get("flow"),
      tokenHash: params.get("token_hash"),
      type: params.get("type"),
    };
    assert.equal(proof.type, "recovery");
    secrets.push(link, proof.flow, proof.tokenHash);
    const oldCookies = await unrelated.cookies();
    const conflict = await command(unrelated, proof);
    assert.deepEqual(conflict.body, {
      status: "invalid",
      message: "recovery-account-conflict",
    });
    assert.deepEqual(await unrelated.cookies(), oldCookies);
    assert.equal((await session(unrelated)).subject, other.data.user.id);
    assert.equal(
      (await command(phone, { ...proof, type: "signup" })).body.status,
      "invalid-proof",
    );
    const page = await phone.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(link);
    await expect(
      page.getByRole("button", { name: "Continue securely" }),
    ).toBeEnabled();
    assert.equal(page.url(), link);
    await page.getByRole("button", { name: "Continue securely" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/reset-password$/);
    assert.equal(new URL(page.url()).hash, "");
    assert.equal((await session(phone)).status, "recovery-required");
    assert.equal(
      (await phone.request.get(base + "/api/account")).status(),
      401,
    );
    assert.equal(
      (
        await command(phone, {
          action: "sign-in",
          email,
          password: oldPassword,
        })
      ).body.status,
      "recovery-required",
    );
    pass(
      "real desktop request → fresh phone browser without request cookie; exact email proof, wrong-purpose/different-account preservation and recovery-only authority",
    );
    await page.getByLabel("New password", { exact: true }).fill(oldPassword);
    await page
      .getByRole("button", { name: "Save new password", exact: true })
      .click();
    await expect(page.locator(".authentication-error")).toContainText(
      "different from your current password",
    );
    await expect(page.locator(".authentication-error")).toBeFocused();
    assert.equal((await session(phone)).status, "recovery-required");
    await expect(page.getByLabel("New password", { exact: true })).toHaveValue(
      oldPassword,
    );
    for (const width of [375, 320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: path.join(output, "password-reuse-" + width + ".png"),
        fullPage: true,
      });
    }
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page
      .getByRole("button", { name: "Save new password", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sign-in\?.*notice=password-updated/);
    assert.equal((await session(phone)).status, "signed-out");
    assert.equal((await session(desktop)).status, "signed-out");
    assert.equal(
      (
        await command(phone, {
          action: "sign-in",
          email,
          password: oldPassword,
        })
      ).body.status,
      "invalid-credentials",
    );
    await login(phone, email, newPassword);
    assert.equal((await session(phone)).subject, subject);
    assert.equal((await command(phone, proof)).body.status, "invalid-proof");
    assert.equal((await session(phone)).subject, subject);
    assert.equal((await session(unrelated)).subject, other.data.user.id);
    assert.deepEqual(
      await database`select to_jsonb(p)row from app.profiles p where id=${identity.identity_profile_id}::uuid`,
      before,
    );
    assert.deepEqual(errors, []);
    pass(
      "actual same-password rejection remains retryable; new password succeeds, old login fails correctly, original subject/profile persist and previous devices are revoked",
    );
  } finally {
    await desktop.close();
    await phone.close();
    await unrelated.close();
  }
}
