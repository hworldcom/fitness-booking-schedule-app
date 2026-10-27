// MOV-131: real verified Auth session and ordinary profile-enrollment/inbox routes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });
export async function rehearseMemberWelcome({
  base,
  browser,
  database,
  auth,
  stranger,
  output,
  pass,
  errors,
  tag,
  secrets,
  project,
}) {
  assert.equal(base, "http://localhost:3169");
  assert.ok(project.startsWith("mov19-media-qa-"));
  const email = `welcome-${tag}@users.movx.test`,
    password = randomUUID();
  secrets.push(password);
  const created = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { movx_test_ticket: "MOV-131", temporary: true },
  });
  assert.ifError(created.error);
  const authId = created.data.user.id;
  assert.equal(
    (
      await database`select id from app.profiles where auth_user_id=${authId}::uuid`
    ).length,
    0,
  );
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(base + "/sign-in?returnTo=%2Fmessages");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    await page.getByLabel("Username", { exact: true }).fill("welcome_" + tag);
    await page
      .getByLabel("Full name", { exact: true })
      .fill("Private Welcome QA Member");
    await page
      .getByLabel("Display name", { exact: true })
      .fill("Welcome QA Member");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Do this later", exact: true }),
    ).toBeVisible();
    const rows =
      await database`select w.*,p.auth_user_id from app.member_welcomes w join app.profiles p on p.id=w.profile_id where p.auth_user_id=${authId}::uuid`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].read_at, null);
    const welcome = rows[0];
    await page
      .getByRole("button", { name: "Do this later", exact: true })
      .click();
    await expect(page).toHaveURL(base + "/messages");
    const sender = () =>
      page.locator(".mailbox-list-item").filter({ hasText: "MovX" });
    await expect(sender()).toContainText("Official welcome");
    await expect(sender().getByLabel("Unread", { exact: true })).toBeVisible();
    const v1 = await page.request.get(base + "/api/messages", {
      headers: { "X-MovX-Message-Version": "1" },
    });
    assert.equal(v1.status(), 200);
    assert.equal((await v1.json()).value.items.length, 0);
    pass(
      "real new-member password Auth/profile form creates exactly one initially unread welcome; old API version unchanged",
    );
    let lost = false;
    await page.route("**/api/messages", async (route) => {
      const r = route.request();
      if (
        r.method() === "POST" &&
        r.postDataJSON().action === "read" &&
        !lost
      ) {
        const result = await route.fetch();
        assert.equal(result.status(), 200);
        lost = true;
        await route.abort("failed");
      } else await route.continue();
    });
    await page.bringToFront();
    await sender().click();
    await expect(
      page.getByRole("heading", { name: "MovX", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Official MovX welcome", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/MovX is in beta/)).toBeVisible();
    await expect
      .poll(async () =>
        Boolean(
          (
            await database`select read_at from app.member_welcomes where id=${welcome.id}::uuid`
          )[0].read_at,
        ),
      )
      .toBe(true);
    assert.equal(lost, true);
    const [read] =
      await database`select read_at,body,created_at from app.member_welcomes where id=${welcome.id}::uuid`;
    await expect(
      page.getByRole("button", { name: "Refresh conversation", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh conversation", exact: true })
      .click();
    await page.unroute("**/api/messages");
    await expect(
      page.getByRole("button", { name: "Refresh conversation", exact: true }),
    ).toHaveCount(0);
    for (const width of [1440, 393, 375, 320]) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1000 : 852,
      });
      await expect(
        page.getByRole("heading", { name: "MovX", exact: true }),
      ).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      // MOV-132: overflow:hidden can conceal an oversized grid column even when
      // document.scrollWidth fits. Check the real shell's visible geometry.
      for (const selector of [
        ".messages-shell-header a",
        ".messages-shell-header button",
        ".mailbox-thread",
        ".mailbox-message",
      ]) {
        for (const element of await page.locator(selector).all()) {
          if (!(await element.isVisible())) continue;
          const box = await element.boundingBox();
          assert.ok(
            box && box.x >= -1 && box.x + box.width <= width + 1,
            `${selector} must fit ${width}px: ${JSON.stringify(box)}`,
          );
        }
      }
      const workspaceReturn = page.getByRole("link", {
        name: "Back to My training",
        exact: true,
      });
      const returnBox = await workspaceReturn.boundingBox();
      assert.ok(returnBox && returnBox.width >= 44 && returnBox.height >= 44);
      await workspaceReturn.focus();
      await expect(workspaceReturn).toBeFocused();
      await expect(page.locator("textarea")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /^Block|^Send$/ }),
      ).toHaveCount(0);
      await expect(page.getByRole("link", { name: /View MovX/ })).toHaveCount(
        0,
      );
      const help = page.getByRole("link", {
        name: "Contact hello@movx.club",
        exact: true,
      });
      await expect(help).toHaveAttribute("href", "mailto:hello@movx.club");
      await help.focus();
      await expect(help).toBeFocused();
      await page.screenshot({
        path: path.join(output, `welcome-${width}.png`),
        fullPage: true,
      });
    }
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "MovX", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/MovX is in beta/)).toBeVisible();
    assert.deepEqual(
      (
        await database`select read_at,body,created_at from app.member_welcomes where id=${welcome.id}::uuid`
      )[0],
      read,
    );
    const foreign = await stranger.page.request.get(
      base + `/api/messages?conversationId=${welcome.id}`,
      { headers: { "X-MovX-Message-Version": "2" } },
    );
    assert.equal(foreign.status(), 409);
    assert.equal((await foreign.json()).status, "conflict");
    const reply = await page.request.post(base + "/api/messages", {
      headers: { origin: base, "X-MovX-Message-Version": "2" },
      data: {
        action: "send",
        args: {
          conversationId: welcome.id,
          submissionId: randomUUID(),
          contextId: null,
          body: "Not permitted",
        },
      },
    });
    assert.equal(reply.status(), 409);
    const block = await page.request.post(base + "/api/messages", {
      headers: { origin: base, "X-MovX-Message-Version": "2" },
      data: { action: "block", args: { conversationId: welcome.id } },
    });
    assert.equal(block.status(), 409);
    const retry = await page.request.post(base + "/api/auth/identity", {
      headers: { origin: base },
      data: {
        username: "other_" + tag,
        fullName: "Another Private Name",
        displayName: "Replacement Name",
      },
    });
    assert.equal(retry.status(), 200);
    assert.equal(
      (
        await database`select id from app.member_welcomes where profile_id=${welcome.profile_id}::uuid`
      ).length,
      1,
    );
    const [effects] =
      await database`select (select count(*)::int from app.notification_emails where conversation_id=${welcome.id}::uuid) emails,(select count(*)::int from app.message_entries where conversation_id=${welcome.id}::uuid) human_entries`;
    assert.equal(effects.emails, 0);
    assert.equal(effects.human_entries, 0);
    await page
      .getByRole("button", { name: "Back to conversations", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Messages", exact: true }),
    ).toBeVisible();
    await expect(sender()).toBeFocused();
    await page.getByRole("button", { name: "Unread", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "You’re all caught up", exact: true }),
    ).toBeVisible();
    pass(
      "welcome read persists through committed-response loss/refresh/reload; readonly/help and back/focus at1440/393/375/320; foreign member/reply/block denied; no email/user-chat side effects",
    );
  } finally {
    await context.close();
  }
}
