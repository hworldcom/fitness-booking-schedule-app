// MOV-101: runs only inside the recorded disposable media integration project.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });

export async function rehearseProfileEditing({
  base,
  browser,
  database,
  coach,
  stranger,
  person,
  output,
  pass,
  errors,
  tag,
}) {
  assert.equal(new URL(base).port, "3169");
  const page = coach.page;
  const canvas = page.locator(".coach-profile-canvas");
  const drawer = page.locator("dialog.profile-edit-drawer");
  page.on("dialog", (dialog) => dialog.accept());
  const close = () =>
    drawer
      .getByRole("button", { name: "Close editing panel", exact: true })
      .click();
  const edit = (name) =>
    canvas.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  const intro = () => drawer.getByLabel("Short introduction (optional)");
  async function savedPreview(saved) {
    await canvas
      .getByRole("button", {
        name: saved ? "Saved preview" : "Back to editing",
        exact: true,
      })
      .click();
  }
  const ownWebsite = async () =>
    (await (await page.request.get(base + "/api/coach/website")).json())
      .website;
  async function responseDuring(target, predicate, action) {
    const [response] = await Promise.all([
      target.waitForResponse(predicate),
      action(),
    ]);
    return response;
  }
  function saveContent(target = drawer) {
    return responseDuring(
      page,
      (r) =>
        r.url() === base + "/api/coach/website" &&
        r.request().method() === "PUT",
      () =>
        target
          .getByRole("button", { name: "Save website content", exact: true })
          .click(),
    );
  }
  const asOwner = (work) =>
    database.begin(async (tx) => {
      await tx`select set_config('app.current_auth_user_id',${coach.authId},true),set_config('app.current_profile_id',${coach.profileId},true),set_config('app.current_run_id',${coach.runId},true),set_config('app.current_run_role','member',true)`;
      return work(tx);
    });
  const guest = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const publicPage = await guest.newPage();
  publicPage.on("pageerror", (e) => errors.push(e.message));
  const [record] =
    await database`select public_slug from app.coach_profiles where profile_id=${coach.profileId}::uuid`;
  let publicPath = `/coaches/${record.public_slug}`;
  const accountTrigger = page.getByRole("button", {
    name: /^Account menu for /,
  });
  const accountPanel = page.locator(".account-menu-panel:not([hidden])");
  async function openAccountMenu() {
    if ((await accountTrigger.getAttribute("aria-expanded")) !== "true") {
      await accountTrigger.focus();
      await page.keyboard.press("Enter");
    }
    await expect(accountTrigger).toHaveAttribute("aria-expanded", "true");
  }
  async function accountDestination(label, href) {
    await openAccountMenu();
    const link = accountPanel.getByRole("link", { name: label, exact: true });
    assert.equal(await link.getAttribute("href"), href);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(base + href);
  }
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + "/profile");
    await expect(page.locator(".account-profile-workspace")).toBeVisible();
    await accountDestination("Switch to coach view", "/profile/coach");
    await expect(canvas).toBeVisible();
    await page.reload();
    await expect(canvas).toBeVisible();
    await accountDestination("Profile", "/profile/coach");
    await accountDestination("Switch to athlete view", "/profile");
    await expect(page.locator(".account-profile-workspace")).toBeVisible();
    await expect(canvas).toHaveCount(0);
    await page.reload();
    await accountDestination("Trainings", "/sessions");
    await accountDestination("Profile", "/profile");
    await accountDestination("Switch to coach view", "/profile/coach");
    await accountDestination("Trainings", "/coach");
    await accountDestination("Profile", "/profile/coach");
    for (const neutral of ["/account", "/messages", "/"]) {
      await page.goto(base + neutral);
      await page.reload();
      await accountDestination("Profile", "/profile/coach");
      await expect(canvas).toBeVisible();
    }
    await openAccountMenu();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(output, `profile-view-switch-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(accountTrigger).toBeFocused();
    await expect(accountPanel).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  pass(
    "Profile view switching stays on Profile in both directions; coach Profile entry survives workspace/shared-page navigation and reload at desktop/mobile with keyboard menus",
  );
  await page.goto(base + "/profile/coach");
  await expect(canvas).toBeVisible();
  await expect.poll(async () => !!(await ownWebsite())).toBe(true);

  const initialRead = await coach.context.newPage();
  const initialIntroduction = initialRead
    .locator("dialog.profile-edit-drawer")
    .getByLabel("Short introduction (optional)");
  initialRead.on("pageerror", (error) => errors.push(error.message));
  let releaseInitialReads;
  const heldReads = new Promise((resolve) => {
    releaseInitialReads = resolve;
  });
  let waitingReads = 0,
    released = false,
    failWebsiteRead = false;
  await initialRead.route(
    (url) =>
      ["/api/coach/website", "/api/coach/starting-rate"].includes(url.pathname),
    async (route) => {
      if (route.request().method() === "GET") {
        if (!released) {
          waitingReads++;
          await heldReads;
        }
        if (
          failWebsiteRead &&
          new URL(route.request().url()).pathname === "/api/coach/website"
        )
          return route.fulfill({
            status: 503,
            json: { status: "unavailable" },
          });
      }
      await route.continue();
    },
  );
  try {
    await initialRead.goto(base + "/profile/coach", {
      waitUntil: "domcontentloaded",
    });
    await expect.poll(() => waitingReads).toBe(2);
    await expect(initialRead.locator(".profile-canvas-notice")).toHaveCount(0);
    await initialRead
      .getByRole("button", { name: "Edit introduction", exact: true })
      .click();
    released = true;
    releaseInitialReads();
    await expect(initialIntroduction).toBeFocused();
    await expect(initialRead.locator(".profile-canvas-notice")).toHaveCount(0);
    failWebsiteRead = true;
    await initialRead.reload({ waitUntil: "networkidle" });
    await expect(initialRead.locator(".profile-canvas-notice")).toContainText(
      "Some saved content could not be verified",
    );
    await initialRead
      .getByRole("button", { name: "Edit introduction", exact: true })
      .click();
    failWebsiteRead = false;
    await initialRead
      .locator('[data-website-panel="content"]')
      .getByRole("button", { name: "Retry loading", exact: true })
      .click();
    await expect(initialIntroduction).toBeFocused();
    await expect(initialRead.locator(".profile-canvas-notice")).toHaveCount(0);
  } finally {
    releaseInitialReads();
    await initialRead.close();
  }
  pass(
    "pending website/rate reads show no failure notice; an actual failed read offers retry and real server recovery clears the notice",
  );

  const original = (
    await database`select display_name,bio,(select id from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary) primary_location_id from app.coach_profiles where profile_id=${coach.profileId}::uuid`
  )[0];
  await edit("display name");
  await drawer
    .getByLabel("Display name", { exact: true })
    .fill("Discarded profile name");
  await close();
  await expect(canvas.locator(".coach-website-name h1")).toHaveText(
    "Discarded profile name",
  );
  await savedPreview(true);
  await expect(canvas.locator(".coach-website-name h1")).toHaveText(
    original.display_name,
  );
  await savedPreview(false);
  await edit("display name");
  await drawer
    .getByRole("button", { name: "Cancel profile edits", exact: true })
    .click();
  await expect(drawer.getByLabel("Display name", { exact: true })).toHaveValue(
    original.display_name,
  );
  const publicName = `Profile QA ${tag}`;
  await drawer.getByLabel("Display name", { exact: true }).fill(publicName);
  await drawer
    .getByRole("button", { name: "Save profile details", exact: true })
    .click();
  await expect(drawer.getByRole("status")).toContainText(/saved/i);
  await expect
    .poll(
      async () =>
        (
          await database`select display_name from app.coach_profiles where profile_id=${coach.profileId}::uuid`
        )[0].display_name,
    )
    .toBe(publicName);
  await close();
  await page.reload();
  await expect(canvas.locator(".coach-website-name h1")).toHaveText(publicName);
  assert.equal(
    (
      await database`select id primary_location_id from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`
    )[0].primary_location_id,
    original.primary_location_id,
  );
  pass(
    "real profile action saves and reloads the public name, cancel/saved-preview isolate drafts and existing primary location is preserved",
  );

  await edit("introduction");
  await intro().fill("Saved through the actual production website API.");
  await drawer
    .getByRole("button", { name: "Add question", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Save website content", exact: true })
    .click();
  await expect(drawer.locator(".website-content-errors")).toBeFocused();
  await expect(intro()).toHaveValue(
    "Saved through the actual production website API.",
  );
  await drawer.getByLabel("FAQ 1 question").fill("What should I bring?");
  await drawer.getByLabel("FAQ 1 answer").fill("Comfortable training clothes.");
  assert.equal((await saveContent()).status(), 200);
  await close();
  await publicPage.goto(base + publicPath);
  await expect(publicPage.locator(".coach-website-intro")).toHaveText(
    "Saved through the actual production website API.",
  );
  await expect(
    publicPage.getByText("What should I bring?", { exact: true }),
  ).toBeVisible();
  pass(
    "real optional content/FAQ save, invalid-row focus and public rendering round trip",
  );

  const otherTab = await coach.context.newPage();
  otherTab.on("pageerror", (e) => errors.push(e.message));
  otherTab.on("dialog", (dialog) => dialog.accept());
  await otherTab.goto(base + "/profile/coach");
  await otherTab
    .getByRole("button", { name: "Edit introduction", exact: true })
    .click();
  const otherDrawer = otherTab.locator("dialog.profile-edit-drawer");
  await otherDrawer
    .getByLabel("Short introduction (optional)")
    .fill("A different real tab saved this text.");
  await edit("introduction");
  await intro().fill("Local draft kept through the real revision conflict.");
  const remoteSave = await responseDuring(
    otherTab,
    (r) =>
      r.url() === base + "/api/coach/website" && r.request().method() === "PUT",
    () =>
      otherDrawer
        .getByRole("button", { name: "Save website content", exact: true })
        .click(),
  );
  assert.equal(remoteSave.status(), 200);
  await otherTab.close();
  assert.equal((await saveContent()).status(), 409);
  await drawer
    .getByRole("button", { name: "Load latest saved version", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Keep my draft for review", exact: true })
    .click();
  await close();
  await savedPreview(true);
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "A different real tab saved this text.",
  );
  await savedPreview(false);
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "Local draft kept through the real revision conflict.",
  );
  await edit("introduction");
  assert.equal((await saveContent()).status(), 200);
  await close();
  pass(
    "two real tabs enforce website revision conflicts; reconciliation keeps draft and latest saved preview distinct",
  );

  let lostWrites = 0;
  await page.route("**/api/coach/website", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    lostWrites++;
    const result = await route.fetch();
    assert.equal(result.status(), 200);
    await route.fulfill({ status: 503, json: { status: "unavailable" } });
  });
  await edit("introduction");
  await intro().fill("The server saved this before its response was lost.");
  assert.equal((await saveContent()).status(), 503);
  await expect(intro()).toHaveValue(
    "The server saved this before its response was lost.",
  );
  await page.unroute("**/api/coach/website");
  await drawer
    .getByRole("button", { name: "Load latest saved version", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Use latest saved version", exact: true })
    .click();
  await close();
  assert.equal(
    (await ownWebsite()).content.introduction,
    "The server saved this before its response was lost.",
  );
  assert.equal(lostWrites, 1);
  pass(
    "a real committed website save with a lost HTTP response reconciles without a duplicate write",
  );

  await edit("introduction");
  await intro().fill("This draft must survive a separately saved banner.");
  await close();
  await edit("banner image");
  const image = await sharp({
    create: { width: 1600, height: 800, channels: 3, background: "#61417b" },
  })
    .jpeg()
    .toBuffer();
  const bannerSave = await responseDuring(
    page,
    (r) =>
      r.url().includes("/api/coach/website/banner") &&
      r.request().method() === "POST",
    () =>
      drawer
        .locator('[data-website-panel="banner"] input[type="file"]')
        .setInputFiles({
          name: "qa-banner.jpg",
          mimeType: "image/jpeg",
          buffer: image,
        }),
  );
  assert.equal(bannerSave.status(), 200);
  await close();
  await expect(canvas.locator(".coach-website-banner img")).toBeVisible();
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "This draft must survive a separately saved banner.",
  );
  await edit("introduction");
  await drawer
    .getByRole("button", { name: "Cancel content edits", exact: true })
    .click();
  await close();
  await publicPage.reload();
  const bannerUrl = await publicPage
    .locator(".coach-website-banner img")
    .getAttribute("src");
  const bannerBytes = await guest.request.get(base + bannerUrl);
  assert.equal(bannerBytes.status(), 200);
  const bannerMetadata = await sharp(await bannerBytes.body()).metadata();
  assert.equal(bannerMetadata.width, 1600);
  assert.equal(bannerMetadata.height, 600);
  pass(
    "real normalized Storage banner saves independently without discarding website text; cancelling text retains the saved banner",
  );

  await edit("starting rate");
  await drawer.getByLabel("Starting amount (EUR)").fill("57.50");
  await drawer.getByLabel("Show starting rate publicly").uncheck();
  await drawer
    .getByRole("button", { name: "Save starting rate", exact: true })
    .click();
  await expect(drawer.getByText(/Only you can see this amount/)).toBeVisible();
  await close();
  await publicPage.reload();
  await expect(publicPage.locator(".coach-website-rate")).toHaveCount(0);
  await savedPreview(true);
  await expect(canvas.locator(".coach-website-rate")).toHaveCount(0);
  await savedPreview(false);
  await edit("starting rate");
  await drawer.getByLabel("Starting amount (EUR)").fill("0");
  await drawer.getByLabel("Show starting rate publicly").check();
  await drawer
    .getByRole("button", { name: "Save starting rate", exact: true })
    .click();
  await expect(drawer.getByText(/Public disclosure on/)).toBeVisible();
  await close();
  await publicPage.reload();
  await expect(publicPage.locator(".coach-website-rate")).toContainText("Free");
  assert.equal(
    (
      await stranger.page.request.get(base + "/api/coach/starting-rate")
    ).status(),
    403,
  );
  pass(
    "real private starting rate stays out of visitor/saved preview; explicitly disclosed zero renders Free and unrelated account is denied",
  );

  await edit("coach picture");
  const portraitSave = await responseDuring(
    page,
    (r) =>
      r.url() === base + "/api/coach/portrait" &&
      r.request().method() === "POST",
    () =>
      drawer
        .locator('.profile-image-uploader input[type="file"]')
        .setInputFiles({
          name: "qa-portrait.jpg",
          mimeType: "image/jpeg",
          buffer: image,
        }),
  );
  assert.equal(portraitSave.status(), 200);
  await close();
  await expect(
    canvas.locator(".coach-website-identity .avatar img"),
  ).toBeVisible();
  await publicPage.reload();
  const portraitUrl = await publicPage
    .locator(".coach-website-identity .avatar img")
    .getAttribute("src");
  const portraitHref = new URL(portraitUrl, base).href;
  assert.ok(
    ["localhost", "127.0.0.1"].includes(new URL(portraitHref).hostname),
  );
  assert.equal((await guest.request.get(portraitHref)).status(), 200);
  const privateAvatar = await page.request.post(base + "/api/profile/avatar", {
    headers: { origin: base, "content-type": "image/webp" },
    data: await sharp(image).resize(512, 512).webp().toBuffer(),
  });
  assert.equal(privateAvatar.status(), 200);
  const avatar = await privateAvatar.json();
  assert.equal((await guest.request.get(base + avatar.imageUrl)).status(), 401);
  await publicPage.reload();
  assert.equal(
    await publicPage
      .locator(".coach-website-identity .avatar img")
      .getAttribute("src"),
    portraitUrl,
  );
  pass(
    "real portrait upload reaches the public page; a separately saved account avatar stays private and does not replace it",
  );

  await canvas
    .getByRole("button", { name: "Edit training locations", exact: true })
    .click();
  const locationCard = drawer.locator(".coach-training-location-card").first();
  await locationCard.locator("summary").filter({ hasText: "Edit" }).click();
  const gyms = locationCard.getByLabel("Select a reviewed gym");
  const alternatives = await gyms
    .locator("option")
    .evaluateAll((rows) =>
      rows.filter((row) => row.value && !row.selected).map((row) => row.value),
    );
  assert.ok(
    alternatives.length,
    "Disposable seed needs an alternate reviewed gym",
  );
  await gyms.selectOption(alternatives[0]);
  await locationCard
    .getByRole("button", { name: "Save location", exact: true })
    .click();
  await expect(locationCard.getByRole("status")).toContainText(
    "Training location updated.",
  );
  await close();
  const [venue] =
    await database`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
  const policy = await asOwner(
    (tx) =>
      tx`select app.save_owned_effective_coach_availability(${tx.json({ kind: "weekly", operationId: randomUUID(), expectedRevision: 0, hours: Array.from({ length: 7 }, (_, i) => ({ locationId: venue.id, locationUpdatedAt: venue.stamp, localStartTime: "12:00", isoWeekday: i + 1 })) })}::jsonb) result`,
  );
  assert.equal(policy[0].result.outcome, "saved");
  pass(
    "actual location form updates the owned primary gym; disposable weekly availability is seeded through the actor-checked command",
  );

  const account = await (await page.request.get(base + "/api/account")).json();
  const username = `qa_${tag}`;
  const named = await page.request.post(base + "/api/account", {
    headers: { origin: base },
    data: {
      section: "login-security",
      username,
      revision: account.details.revision,
    },
  });
  assert.equal(named.status(), 200);
  await page.reload();
  await canvas
    .getByRole("button", { name: "Profile settings", exact: true })
    .click();
  await expect(
    drawer.getByRole("button", { name: "Confirm public URL", exact: true }),
  ).toBeDisabled();
  await drawer.getByRole("checkbox", { name: /I agree to make/ }).check();
  await drawer
    .getByRole("button", { name: "Confirm public URL", exact: true })
    .click();
  await expect(drawer.getByText(/Public username confirmed/)).toBeVisible();
  await close();
  publicPath = `/@${username}`;
  await publicPage.goto(base + publicPath);
  await expect(publicPage.locator(".coach-website-name h1")).toHaveText(
    publicName,
  );
  await canvas
    .getByRole("button", { name: "Profile settings", exact: true })
    .click();
  await drawer.getByLabel("Discovery visibility").selectOption("hidden");
  await drawer
    .getByRole("button", { name: "Save profile details", exact: true })
    .click();
  await expect(
    drawer.getByRole("status").filter({ hasText: /saved/i }).first(),
  ).toBeVisible();
  await close();
  await expect(
    canvas.getByText("Hidden profile · private preview", { exact: true }),
  ).toBeVisible();
  await expect(
    canvas.getByRole("heading", {
      name: "Public schedule is not available",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal((await guest.request.get(base + publicPath)).status(), 404);
  assert.equal((await guest.request.get(base + bannerUrl)).status(), 404);
  // Separate portraits retain the established immutable public Storage URL.
  // Publication gates remove their discovery/page; they cannot recall public bytes.
  assert.equal((await guest.request.get(portraitHref)).status(), 200);
  await canvas
    .getByRole("button", { name: "Profile settings", exact: true })
    .click();
  await drawer.getByLabel("Discovery visibility").selectOption("visible");
  await drawer
    .getByRole("button", { name: "Save profile details", exact: true })
    .click();
  await expect(
    canvas.getByText("Visible profile", { exact: true }),
  ).toBeVisible();
  await close();
  await publicPage.reload();
  await expect(publicPage.locator(".coach-website-name h1")).toHaveText(
    publicName,
  );
  pass(
    "real public URL requires explicit consent; hiding revokes the canonical page/banner while preserving the existing public portrait URL contract",
  );

  await page.reload();
  await expect(
    canvas.locator("#private-schedule .seven-day-grid"),
  ).toBeVisible();
  await edit("introduction");
  await intro().fill("Draft retained while editing the real calendar.");
  await close();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    canvas.getByRole("link", { name: /Open calendar/ }).click(),
  ]);
  await expect(popup).toHaveURL(/\/coach\?view=schedule&section=calendar/);
  await expect(popup.locator(".coach-workspace")).toBeVisible();
  await popup.close();
  await page.bringToFront();
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "Draft retained while editing the real calendar.",
  );
  await canvas
    .getByRole("button", { name: "Next 7 days", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile\/coach\?date=/);
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "Draft retained while editing the real calendar.",
  );
  const refresh = canvas.getByRole("button", {
    name: "Refresh available times",
    exact: true,
  });
  if (await refresh.count()) await refresh.click();
  else await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "Draft retained while editing the real calendar.",
  );
  assert.equal(
    await canvas
      .getByRole("link", { name: "Message coach", exact: true })
      .count(),
    0,
  );
  pass(
    "real production seven-day schedule, calendar popup, date navigation and refresh preserve the website draft with no self-message action",
  );

  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const trigger = canvas.getByRole("button", {
      name: "Edit biography",
      exact: true,
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(drawer.getByLabel("Biography")).toBeFocused();
    await page.keyboard.press("Tab");
    assert.equal(
      await drawer.evaluate((el) => el.contains(document.activeElement)),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `owner overflow at ${width}`,
    );
    assert.equal(
      await drawer.evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
      `drawer overflow at ${width}`,
    );
    await drawer.screenshot({
      path: path.join(output, `profile-drawer-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await page.screenshot({
      path: path.join(output, `profile-canvas-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await edit("introduction");
  await drawer
    .getByRole("button", { name: "Cancel content edits", exact: true })
    .click();
  await close();
  pass(
    "real authenticated canvas at seven widths: keyboard Enter/Tab/Escape, native modal containment, focus restoration and no overflow",
  );

  const applicant = await person("QA Applicant");
  await database.begin(async (tx) => {
    await tx`select set_config('app.current_auth_user_id',${applicant.authId},true),set_config('app.current_profile_id',${applicant.profileId},true),set_config('app.current_run_id',${applicant.runId},true),set_config('app.current_run_role','member',true)`;
    await tx`select app.submit_owned_coach_application()`;
    await tx`select app.upsert_owned_coach_profile('Private QA Applicant','A private disposable application used only for profile editor QA.',array['Boxing']::text[],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null::text,null::numeric,null::numeric,null::text,null::text)`;
  });
  await applicant.page.goto(base + "/profile/coach");
  await expect(applicant.page.locator(".coach-editor")).toBeVisible();
  await expect(applicant.page.locator(".coach-profile-canvas")).toHaveCount(0);
  assert.equal(
    (
      await stranger.page.request.put(base + "/api/coach/website", {
        headers: { origin: base },
        data: {
          schemaVersion: 1,
          expectedRevision: (await ownWebsite()).revision,
          content: (await ownWebsite()).content,
        },
      })
    ).status(),
    403,
  );
  assert.equal(
    (await guest.request.get(base + "/api/coach/website")).status(),
    401,
  );
  await expect(publicPage.locator("[data-edit-field]")).toHaveCount(0);
  pass(
    "real applicant retains its private application editor; guest and unrelated accounts cannot use owner website operations",
  );
  await database`select app.review_coach_application(${applicant.profileId}::uuid,'pending','approved','Disposable revocation QA','local-test','movx-identity-application-v1')`;
  await applicant.page.goto(base + "/profile/coach");
  await applicant.page
    .getByRole("button", { name: "Edit introduction", exact: true })
    .click();
  const privateDrawer = applicant.page.locator("dialog.profile-edit-drawer");
  await privateDrawer
    .getByLabel("Short introduction (optional)")
    .fill("A private draft that must disappear after sign-out.");
  const signedOut = await applicant.page.request.post(
    base + "/api/auth/operations",
    { headers: { origin: base }, data: { action: "sign-out" } },
  );
  assert.equal(signedOut.status(), 200);
  // An outstanding actor/read refresh can already conceal the canvas on logout.
  // Otherwise force an owner read to prove the revoked session fails closed.
  await privateDrawer
    .getByRole("button", { name: "Load latest saved version", exact: true })
    .click({ timeout: 2000 })
    .catch(async () => {
      await expect(applicant.page.locator(".coach-profile-canvas")).toHaveCount(
        0,
      );
    });
  await expect(applicant.page.locator(".coach-profile-canvas")).toHaveCount(0);
  await expect(
    applicant.page.getByText(
      "A private draft that must disappear after sign-out.",
      { exact: true },
    ),
  ).toHaveCount(0);
  pass(
    "real sign-out and denied owner reads conceal the canvas and remove the previous private draft",
  );
  await guest.close();
}
