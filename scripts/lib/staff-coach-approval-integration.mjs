// MOV-145/146: two separately built apps, actual Auth/actions/SQL/cron/Mailpit.
// Caller exclusively owns the disposable stack; no retained/hosted writes.
import assert from "node:assert/strict";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });
export async function rehearseStaffCoachApproval({
  base,
  adminBase,
  browser,
  coach,
  stranger,
  person,
  database,
  mail,
  cron,
  pass,
  output,
}) {
  assert.equal(base, "http://localhost:3169");
  assert.equal(adminBase, "http://localhost:3170");
  assert.equal(new URL(mail).port, "55424");
  const detail = adminBase + "/admin/coaches/" + coach.profileId;
  const staff = await person("QA Reviewer");
  await database`select app.set_platform_staff(${staff.profileId}::uuid,${staff.runId}::uuid,0,'active','Assign isolated fixture staff access','fixture-operator')`;
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const publicCookies = await stranger.context.cookies(base);
  const login = async (account, p = page) => {
    await p.goto(
      adminBase +
        "/sign-in?returnTo=" +
        encodeURIComponent("/admin/coaches/" + coach.profileId),
    );
    await p.getByLabel("Email address", { exact: true }).fill(account.email);
    await p.getByLabel("Password", { exact: true }).fill(account.password);
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(p).toHaveURL(detail);
  };
  await page.goto(detail);
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
  const guestHtml = await (await fetch(detail)).text();
  for (const secret of [coach.email, "+4915198765432"])
    assert.equal(guestHtml.includes(secret), false);
  await login(stranger);
  await expect(
    page.getByRole("heading", { name: "Staff access required" }),
  ).toBeVisible();
  assert.equal((await page.content()).includes(coach.email), false);
  // Same localhost host, separate cookie names: admin must not alter a public login.
  const shared = await stranger.context.newPage();
  await login(staff, shared);
  await expect(
    shared.getByRole("heading", { name: coach.name, exact: true }),
  ).toBeVisible();
  const afterCookies = await stranger.context.cookies(base);
  for (const cookie of publicCookies.filter((c) => c.name.startsWith("sb-")))
    assert.equal(
      afterCookies.find((c) => c.name === cookie.name)?.value,
      cookie.value,
    );
  const adminCookies = afterCookies.filter((c) =>
    c.name.startsWith("movx-admin-auth"),
  );
  assert.ok(adminCookies.length);
  assert.ok(adminCookies.every((c) => c.httpOnly && c.domain === "localhost"));
  assert.equal(
    (await stranger.context.request.get(base + "/api/notifications")).status(),
    200,
  );
  await shared.close();
  await login(staff);
  pass(
    "separate admin Auth, guest/member denial, exact sign-in return and independent HttpOnly host-only cookies coexist with public login",
  );
  await page.goto(adminBase + "/admin/coaches?status=approved");
  await expect(
    page.getByText("No approved applications on this page."),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Application status" })
    .getByRole("link", { name: "Pending", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: coach.name, exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await page.getByRole("link", { name: coach.name, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Contact information" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: coach.email, exact: true }),
  ).toBeVisible();
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(output, `admin-detail-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const reviewReason =
    "Identity and completed application reviewed\nwith matching evidence out of band";
  const prepare = async () => {
    for (const box of await page.locator(".staff-checklist input").all())
      await box.check();
    await page.getByLabel("Review reason", { exact: true }).fill(reviewReason);
    await page
      .getByRole("button", { name: "Review decision", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  };
  await prepare();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review decision", exact: true }),
  ).toBeFocused();
  assert.equal(
    (
      await database`select status from app.coach_applications where profile_id=${coach.profileId}::uuid`
    )[0].status,
    "pending",
  );
  pass(
    "bounded status filters, private review data, desktop/mobile320/375 layout and keyboard Escape confirmation cancel leave application pending",
  );
  const recoverAccess = async (width) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.bringToFront();
    await database.unsafe("revoke app_runtime from qa_app");
    try {
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(
        page.getByRole("heading", { name: "Staff access changed" }),
      ).toBeVisible();
      await expect(page.locator("dialog")).toHaveJSProperty("open", false);
      assert.equal(
        (await page.locator("body").innerText()).includes(coach.email),
        false,
      );
      const retry = page.getByRole("button", {
        name: "Retry access check",
        exact: true,
      });
      await retry.focus();
      await expect(retry).toBeFocused();
      const response = page.waitForResponse(
        (r) => r.request().method() === "POST",
      );
      await page.keyboard.press("Enter");
      await response;
      await expect(
        page.getByRole("heading", { name: "Staff access changed" }),
      ).toBeVisible();
      await expect(page.locator("dialog")).toHaveJSProperty("open", false);
      await page.screenshot({
        path: path.join(output, `admin-access-recovery-${width}.png`),
        fullPage: true,
      });
    } finally {
      await database.unsafe("grant app_runtime to qa_app");
    }
    await page
      .getByRole("button", { name: "Retry access check", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator(".staff-reason-preview")).toHaveText(
      reviewReason,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  };
  for (const width of [1440, 375, 320]) {
    await prepare();
    await recoverAccess(width);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Review reason", { exact: true })).toHaveValue(
      reviewReason,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  pass(
    "access-check outages suspend open native dialogs, expose keyboard retry and restore the private draft at desktop/mobile widths",
  );
  // A genuine owner action changes the saved contact after staff viewed it.
  await coach.page.goto(base + "/profile/coach");
  await coach.page
    .getByLabel("Phone number", { exact: true })
    .fill("+4915198765433");
  await coach.page
    .getByRole("button", { name: "Save application changes", exact: true })
    .click();
  await expect(
    coach.page.getByText(
      "Application details saved for review. You can continue editing while you wait.",
      { exact: true },
    ),
  ).toBeVisible();
  await prepare();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page.getByText(
      "This application changed. Reload it and review the latest details before deciding.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.equal(
    Number(
      (
        await database`select count(*) n from app.coach_approval_notifications where profile_id=${coach.profileId}::uuid`
      )[0].n,
    ),
    0,
  );
  await page
    .getByRole("link", { name: "Reload saved application", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "+4915198765433", exact: true }),
  ).toBeVisible();
  pass(
    "real owner contact update fences a stale staff approval without false review or receipt",
  );
  // A failed transport cannot tell the UI whether the write reached SQL.
  await prepare();
  await page.route("**/admin/coaches/" + coach.profileId, async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postData()?.includes("commandId")
    )
      await route.abort("failed");
    else await route.continue();
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  const unknown = page.getByRole("dialog");
  await expect(
    unknown.getByRole("button", { name: "Retry same decision", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(unknown).toBeVisible();
  const history = unknown.getByRole("link", {
    name: "Reload saved application",
    exact: true,
  });
  await history.focus();
  await expect(history).toBeFocused();
  await page.unroute("**/admin/coaches/" + coach.profileId);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Review this application", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  assert.equal(
    Number(
      (
        await database`select count(*) n from app.staff_coach_review_commands where application_profile_id=${coach.profileId}::uuid`
      )[0].n,
    ),
    0,
  );
  pass(
    "an unknown decision keeps alternate edits blocked while its modal provides keyboard navigation to saved history",
  );
  await prepare();
  let lost = false;
  let capturedAction;
  await page.route("**/admin/coaches/" + coach.profileId, async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().headers()["next-action"] &&
      route.request().postData()?.includes("commandId") &&
      !lost
    ) {
      lost = true;
      capturedAction = {
        id: route.request().headers()["next-action"],
        type: route.request().headers()["content-type"],
        body: route.request().postData(),
      };
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Retry same decision", exact: true }),
  ).toBeVisible();
  assert.equal(
    (
      await database`select status from app.coach_applications where profile_id=${coach.profileId}::uuid`
    )[0].status,
    "approved",
  );
  await page.unroute("**/admin/coaches/" + coach.profileId);
  await recoverAccess(375);
  const retried = page.waitForRequest(
    (r) => r.method() === "POST" && r.postData()?.includes("commandId"),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retry same decision", exact: true })
    .click();
  const retryRequest = await retried;
  assert.equal(retryRequest.postData(), capturedAction.body);
  assert.equal(retryRequest.headers()["next-action"], capturedAction.id);
  await expect(
    page.getByText(
      "Coach approved. An email and an in-app alert were queued.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.ok(capturedAction?.id && capturedAction.body);
  const [reviewEvent] =
    await database`select reason from app.coach_application_review_events where profile_id=${coach.profileId}::uuid and review_source='staff-panel'`;
  assert.equal(reviewEvent.reason, reviewReason.replaceAll(/\s+/g, " "));
  const ordinaryContext = await browser.newContext(),
    ordinary = await ordinaryContext.newPage();
  await login(stranger, ordinary);
  const replay = await ordinaryContext.request.post(detail, {
    headers: {
      origin: adminBase,
      "next-action": capturedAction.id,
      "content-type": capturedAction.type,
    },
    data: capturedAction.body,
  });
  assert.equal(replay.status(), 200);
  const denied = await replay.text();
  assert.match(denied, /forbidden|Staff access required/);
  assert.equal(denied.includes(coach.email), false);
  await ordinaryContext.close();
  const receipts =
    await database`select * from app.coach_approval_notifications where profile_id=${coach.profileId}::uuid`;
  assert.equal(receipts.length, 1);
  const job = receipts[0];
  assert.equal(
    Number(
      (
        await database`select count(*) n from app.staff_coach_review_commands where application_profile_id=${coach.profileId}::uuid`
      )[0].n,
    ),
    1,
  );
  assert.equal(
    (
      await database`select visibility from app.coach_profiles where profile_id=${coach.profileId}::uuid`
    )[0].visibility,
    "hidden",
  );
  const latest = await coach.context.request.get(base + "/api/notifications", {
    headers: { "x-movx-notification-version": "4" },
  });
  assert.equal(latest.status(), 200);
  const page4 = (await latest.json()).value;
  assert.equal(page4.items.find((x) => x.id === job.id).kind, "coach-approval");
  const legacy = await coach.context.request.get(base + "/api/notifications", {
    headers: { "x-movx-notification-version": "3" },
  });
  const page3 = (await legacy.json()).value;
  assert.equal(
    page3.items.some((x) => x.id === job.id),
    false,
  );
  await coach.context.request.post(base + "/api/notifications", {
    headers: { origin: base, "x-movx-notification-version": "3" },
    data: { action: "read-all", args: { throughAt: page3.snapshotAt } },
  });
  assert.equal(
    (
      await database`select read_at from app.coach_approval_notifications where id=${job.id}`
    )[0].read_at,
    null,
  );
  await coach.page.bringToFront();
  await coach.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const bell = coach.page.getByRole("button", {
    name: "Notifications, 1 unread",
    exact: true,
  });
  await expect(bell).toBeVisible();
  await bell.click();
  const dialog = coach.page.getByRole("dialog");
  await expect(
    dialog.getByRole("link", { name: /Your coach application was approved/ }),
  ).toHaveAttribute("href", "/profile/coach");
  await dialog
    .getByRole("button", {
      name: "Mark coach approval notification as read",
      exact: true,
    })
    .click();
  await expect(
    coach.page.getByRole("button", {
      name: "Notifications, 0 unread",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(
    (
      await database`select state from app.coach_approval_notifications where id=${job.id}`
    )[0].state,
    "queued",
  );
  const sent = await fetch(base + "/api/internal/notifications/dispatch", {
    headers: { authorization: "Bearer " + cron },
  });
  assert.equal(sent.status, 200);
  assert.equal((await sent.json()).result.accepted, 1);
  const [accepted] =
    await database`select * from app.coach_approval_notifications where id=${job.id}`;
  assert.equal(accepted.state, "accepted");
  const email = await (
    await fetch(mail + "/api/v1/message/" + accepted.provider_id)
  ).json();
  assert.deepEqual(
    email.To.map((x) => x.Address),
    [coach.email],
  );
  assert.equal(email.From.Address, "notification@movx.club");
  assert.match(email.Text, /was approved/);
  assert.match(email.Text, /hidden until you publish/);
  assert.ok(email.Text.includes(base + "/profile/coach"));
  for (const secret of [
    "out of band",
    "fixture-operator",
    staff.email,
    "+4915198765433",
  ])
    assert.equal(email.Text.includes(secret), false);
  const navigated = coach.page.waitForNavigation({
    waitUntil: "domcontentloaded",
  });
  await dialog
    .getByRole("link", { name: /Your coach application was approved/ })
    .click();
  const profileResponse = await navigated;
  assert.equal(profileResponse?.status(), 200);
  await expect(coach.page).toHaveURL(base + "/profile/coach");
  await expect(
    coach.page.getByRole("button", { name: "Profile settings", exact: true }),
  ).toBeVisible();
  pass(
    "actual staff approval with lost committed response recovers one exact command/receipt; applicant bell, legacy isolation, independent read, real cron/Mailpit email and coach-profile destination pass without auto publication",
  );
  // A failed authority read must remain unavailable, never an empty queue.
  await database.unsafe("revoke app_runtime from qa_app");
  try {
    await page.goto(adminBase + "/admin/coaches");
    await expect(
      page.getByRole("heading", { name: "Application review unavailable" }),
    ).toBeVisible();
    assert.equal((await page.content()).includes(coach.email), false);
  } finally {
    await database.unsafe("grant app_runtime to qa_app");
  }
  await page.getByRole("link", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review coach applications" }),
  ).toBeVisible();
  pass(
    "direct ordinary-member Server Action replay is denied; failed runtime-authority read renders unavailable and recovers after restoration",
  );
  // Changing the admin account in another tab conceals the former staff page.
  await page.goto(detail);
  const switched = await context.newPage();
  await login(stranger, switched);
  await switched.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: "Staff access changed" }),
  ).toBeVisible();
  assert.equal(
    (await page.locator("body").innerText()).includes(coach.email),
    false,
  );
  await login(staff);
  pass(
    "admin account change in another tab conceals private data on focus without changing the public session",
  );
  // Staff capability is checked again on subsequent renders and actions.
  await page.goto(detail);
  await database`select app.set_platform_staff(${staff.profileId}::uuid,${staff.runId}::uuid,1,'revoked','Revoke isolated fixture staff access','fixture-operator')`;
  const revoked = await context.request.post(detail, {
    headers: {
      origin: adminBase,
      "next-action": capturedAction.id,
      "content-type": capturedAction.type,
    },
    data: capturedAction.body,
  });
  assert.equal(revoked.status(), 200);
  assert.match(await revoked.text(), /forbidden|Staff access required/);
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: "Staff access changed" }),
  ).toBeVisible();
  assert.equal(
    (await page.locator("body").innerText()).includes(coach.email),
    false,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Staff access required" }),
  ).toBeVisible();
  pass(
    "revoked staff lose private presentation on focus, cannot replay a Server Action and cannot reload review data",
  );
  assert.deepEqual(errors, []);
  await context.close();
}
