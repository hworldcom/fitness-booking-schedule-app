import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });

export async function rehearseRegistrationAdmin({
  base,
  adminBase,
  browser,
  person,
  stranger,
  database,
  mail,
  cron,
  pass,
  output,
  tag,
}) {
  assert.equal(adminBase, "http://localhost:3171");
  assert.equal(new URL(mail).port, "55424");
  const staff = await person("QA User Monitor");
  await database`select app.set_platform_staff(${staff.profileId}::uuid,${staff.runId}::uuid,0,'active','Assign isolated user monitoring staff','fixture-operator')`;
  const dispatch = async () => {
    const r = await fetch(base + "/api/internal/notifications/dispatch", {
      headers: { authorization: "Bearer " + cron },
    });
    assert.equal(r.status, 200);
    return (await r.json()).result;
  };
  assert.equal((await dispatch()).accepted, 2);
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  const signup = await browser.newContext({
      viewport: { width: 375, height: 900 },
    }),
    signupPage = await signup.newPage();
  const email = `monitored-${tag}@users.movx.test`,
    password = randomUUID(),
    route = adminBase + "/admin/users";
  const login = async (account) => {
    await page.goto(
      adminBase +
        "/sign-in?returnTo=" +
        encodeURIComponent("/admin/users?status=all"),
    );
    await page.getByLabel("Email address", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
  };
  const filter = async (q, status = "all") => {
    await page.getByLabel("Search by email", { exact: true }).fill(q);
    await page
      .getByLabel("Email verification", { exact: true })
      .selectOption(status);
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
  };
  const card = () => page.getByRole("article", { name: email, exact: true });
  try {
    await page.goto(route + "?status=unverified");
    await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
    await login(stranger);
    await expect(
      page.getByRole("heading", { name: "Staff access required" }),
    ).toBeVisible();
    assert.equal(
      (await page.locator("body").innerText()).includes(staff.email),
      false,
    );
    await login(staff);
    await expect(
      page.getByRole("heading", { name: "Registrations and verification" }),
    ).toBeVisible();
    pass(
      "Users requires actual verified active staff; guest return keeps the Users destination and an ordinary real account is denied",
    );

    await signupPage.goto(base + "/register");
    await signupPage.getByLabel("Email address", { exact: true }).fill(email);
    await signupPage.getByLabel("New password", { exact: true }).fill(password);
    await signupPage
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(signupPage).toHaveURL(/\/check-email\?/);
    const [user] =
      await database`select id from auth.users where email=${email}`;
    assert.ok(user);
    await filter(email, "unverified");
    await expect(card()).toBeVisible();
    await expect(card().getByText("Unverified", { exact: true })).toBeVisible();
    await expect(card().getByText("Incomplete", { exact: true })).toBeVisible();
    await expect(card().getByText("Queued", { exact: true })).toBeVisible();
    await expect(
      card().getByText("Waiting for verification", { exact: true }),
    ).toBeVisible();
    assert.equal((await dispatch()).accepted, 1);
    await page
      .getByRole("link", { name: "Refresh users", exact: true })
      .click();
    await expect(
      card().getByText("Accepted by provider", { exact: true }),
    ).toHaveCount(1);
    pass(
      "actual signup appears in Users before verification/profile setup, with queued then accepted signup staff mail and waiting verification",
    );

    let confirmation;
    await expect
      .poll(async () => {
        const list = await (await fetch(mail + "/api/v1/messages")).json();
        confirmation = list.messages.find(
          (m) =>
            m.Subject === "Confirm your MovX Club email" &&
            m.To.some((x) => x.Address === email),
        );
        return !!confirmation;
      })
      .toBe(true);
    const message = await (
      await fetch(mail + "/api/v1/message/" + confirmation.ID)
    ).json();
    const link = message.HTML.match(/href="([^"]+)"/i)?.[1].replaceAll(
      "&amp;",
      "&",
    );
    assert.ok(link);
    assert.equal(new URL(link).origin, base);
    await signupPage.goto(link);
    await signupPage.getByRole("button", { name: "Continue securely" }).click();
    await expect(signupPage).toHaveURL(/\/complete-profile/);
    await page
      .getByRole("link", { name: "Refresh users", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "No matching users" }),
    ).toBeVisible();
    await filter(email, "verified");
    await expect(card()).toBeVisible();
    await expect(card().getByText("Verified", { exact: true })).toBeVisible();
    await expect(card().getByText("Queued", { exact: true })).toBeVisible();
    assert.equal((await dispatch()).accepted, 1);
    await page
      .getByRole("link", { name: "Refresh users", exact: true })
      .click();
    await expect(
      card().getByText("Accepted by provider", { exact: true }),
    ).toHaveCount(2);
    const completed = await signup.request.post(base + "/api/auth/identity", {
      headers: { origin: base },
      data: {
        username: "monitor_" + tag,
        fullName: "Private monitored fixture",
        displayName: "Monitored new user",
      },
    });
    assert.equal(completed.status(), 200);
    await page
      .getByRole("link", { name: "Refresh users", exact: true })
      .click();
    await expect(card().getByText("Complete", { exact: true })).toBeVisible();
    await expect(
      card().getByText("Monitored new user", { exact: true }),
    ).toBeVisible();
    assert.equal((await dispatch()).claimed, 0);
    pass(
      "real email proof updates the verified filter and second staff email state; completing the profile updates Users without sending more mail",
    );

    const search = page.getByLabel("Search by email", { exact: true });
    await search.focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByLabel("Email verification", { exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Apply filters", exact: true }),
    ).toBeFocused();
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(card()).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const rect = await card().boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1);
      await page.screenshot({
        path: path.join(output, `admin-users-${width}.png`),
        fullPage: true,
      });
    }
    pass(
      "Users is readable within actual desktop/375/320 bounds and email search, filter and submit follow keyboard order",
    );

    const prefix = `paged-${tag}`;
    const addresses = [];
    for (let i = 0; i < 25; i++) {
      const address = `${prefix}-${i}@users.movx.test`;
      addresses.push(address);
      await database`insert into auth.users(id,email,created_at,is_anonymous,is_sso_user) values(${randomUUID()}::uuid,${address},'2026-11-01T10:00:00Z',false,false)`;
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await filter(prefix);
    await expect(page.getByRole("article")).toHaveCount(20);
    const first = await page
      .getByRole("article")
      .getByRole("heading", { level: 2 })
      .allTextContents();
    await page.getByRole("link", { name: "Older users", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(5);
    const second = await page
      .getByRole("article")
      .getByRole("heading", { level: 2 })
      .allTextContents();
    assert.equal(new Set([...first, ...second]).size, 25);
    assert.deepEqual(new Set([...first, ...second]), new Set(addresses));
    await page.getByRole("link", { name: "Newest users", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(20);
    for (let i = 0; i < 5; i++) {
      const result = await dispatch();
      assert.equal(result.failed, 0);
      assert.equal(result.unknown, 0);
      if (result.claimed === 0) break;
    }
    pass(
      "actual Users search and timestamp-tied20-item cursor paging preserve every account once and return to newest with filters intact",
    );

    await filter("no-such-user-" + tag);
    await expect(
      page.getByRole("heading", { name: "No matching users" }),
    ).toBeVisible();
    await filter(email);
    await database.unsafe("revoke app_runtime from qa_app");
    try {
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Users unavailable" }),
      ).toBeVisible();
      assert.equal(
        (await page.locator("body").innerText()).includes("No matching users"),
        false,
      );
    } finally {
      await database.unsafe("grant app_runtime to qa_app");
    }
    await page.getByRole("link", { name: "Try again", exact: true }).click();
    await expect(card()).toBeVisible();
    pass(
      "empty search stays distinct from a real unavailable restricted-role read, and Users recovers without changing accounts",
    );

    const switched = await context.newPage();
    await switched.goto(
      adminBase + "/sign-in?returnTo=" + encodeURIComponent("/admin/users"),
    );
    await switched
      .getByLabel("Email address", { exact: true })
      .fill(stranger.email);
    await switched
      .getByLabel("Password", { exact: true })
      .fill(stranger.password);
    await switched
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(switched).toHaveURL(/\/admin\/users/);
    await switched.close();
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("heading", { name: "Staff access changed" }),
    ).toBeVisible();
    assert.equal(
      (await page.locator("body").innerText()).includes(email),
      false,
    );
    await login(staff);
    await filter(email);
    await expect(card()).toBeVisible();
    await database`select app.set_platform_staff(${staff.profileId}::uuid,${staff.runId}::uuid,1,'revoked','Revoke isolated user monitoring staff','fixture-operator')`;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("heading", { name: "Staff access changed" }),
    ).toBeVisible();
    assert.equal(
      (await page.locator("body").innerText()).includes(email),
      false,
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Staff access required" }),
    ).toBeVisible();
    pass(
      "Users conceals private addresses after an account change or staff revocation and subsequent reads stay denied",
    );
  } catch (error) {
    await page
      .screenshot({
        path: path.join(output, "failure-admin-users.png"),
        fullPage: true,
      })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
    await signup.close();
  }
}
