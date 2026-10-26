// Actual components with isolated Auth/transport fixtures; no real accounts or DB writes.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const root = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), "movx-profile-canvas-"));
const evidence = path.join(root, "test-results/profile-edit-canvas");
const base = "http://127.0.0.1:3189";
const checks = [],
  errors = [],
  measurements = [];
const report = (message) => {
  checks.push(message);
  console.log(`PASS ${message}`);
};
let server,
  browser,
  page,
  log = "";
try {
  await mkdir(evidence, { recursive: true });
  for (const name of [
    "src",
    "tests",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, name), path.join(scratch, name), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  await mkdir(path.join(scratch, "public/vendor"), { recursive: true });
  await cp(
    path.join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"),
    path.join(scratch, "public/vendor/maplibre-gl-worker.mjs"),
  );
  const imports = (
    await readFile(path.join(root, "src/app/layout.tsx"), "utf8")
  )
    .split("\n")
    .filter((line) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(line));
  await writeFile(
    path.join(scratch, "src/app/layout.tsx"),
    `${imports.join("\n")}\nexport default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }\n`,
  );
  const fixture = (
    await readFile(
      path.join(root, "tests/fixtures/profile-edit-canvas-ui.tsx"),
      "utf8",
    )
  ).replace(
    '"./public-schedule-data"',
    '"../../tests/fixtures/public-schedule-data"',
  );
  await writeFile(path.join(scratch, "src/app/page.tsx"), fixture);
  await writeFile(
    path.join(scratch, "src/app/profile/coach/page.tsx"),
    fixture.replace('"../../tests/', '"../../../../tests/'),
  );
  await writeFile(
    path.join(scratch, "src/app/profile/coach/actions.ts"),
    `
export type CoachProfileActionState = {status:"idle"|"saved"|"invalid"|"unavailable";message:string;errors:readonly string[];slug?:string};
export type CoachTrainingLocationActionState = {status:"idle"|"saved"|"invalid"|"conflict"|"unavailable";message:string;errors:readonly string[]};
export async function updateCoachProfileAction(_previous:CoachProfileActionState, data:FormData):Promise<CoachProfileActionState> { return (await fetch('/__fixture/profile', {method:'POST', body:data})).json(); }
export async function createCoachTrainingLocationAction():Promise<CoachTrainingLocationActionState> { return {status:'unavailable',message:'Fixture has no location writes',errors:[]}; }
export const updateCoachTrainingLocationAction=createCoachTrainingLocationAction, setCoachPrimaryLocationAction=createCoachTrainingLocationAction, deactivateCoachTrainingLocationAction=createCoachTrainingLocationAction;
`,
  );
  await writeFile(
    path.join(scratch, "src/app/coach-marketplace-actions.ts"),
    `export type CoachMarketplaceActionResult={status:'unavailable';message:string}; export async function requestPrivateSessionAction(){return {status:'unavailable' as const,message:'Fixture cannot book'};} export const withdrawPrivateSessionRequestAction=requestPrivateSessionAction,cancelPrivateBookingAction=requestPrivateSessionAction;`,
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|MUX/.test(key),
    ),
  );
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3189",
    ],
    {
      cwd: scratch,
      env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => {
    log += chunk;
  });
  server.stderr.on("data", (chunk) => {
    log += chunk;
  });
  const deadline = Date.now() + 90_000;
  while (
    !log.includes("Ready") &&
    Date.now() < deadline &&
    server.exitCode === null
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"), "Fixture failed to start");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const actor = {
    status: "authorized",
    profile: {
      slug: "schedule-coach",
      displayName: "Fixture Coach",
      avatarUrl: null,
      coachPortraitUrl: null,
    },
    demoRun: {
      slug: "profile-canvas-fixture",
      name: "Isolated interface fixture",
    },
    role: "member",
    coachAccessStatus: "demo",
  };
  let actorResult = actor;
  let website = {
    schemaVersion: 1,
    revision: 2,
    content: {
      brandLabel: "Alex Coaching",
      introduction: "Build confidence with deliberate practice.",
      approach: "One step at a time.",
      experience: "Coach-provided experience.",
      focusLabels: ["Beginners"],
      faqs: [],
      links: [],
    },
    banner: null,
  };
  let rate = {
    schemaVersion: 1,
    revision: 1,
    amountCents: 4500,
    currency: "EUR",
    context: "private-session",
    showPublicly: false,
  };
  const media = {
    revision: 0,
    photos: [],
    video: null,
    published: { photos: [], video: null },
    uploads: [],
    videoAvailable: false,
    canPublish: false,
    cleanupPending: false,
  };
  let releaseWebsiteRead;
  let websiteMode = "ok",
    profileMode = "ok",
    writes = 0,
    actorReads = 0;
  const json = (route, value, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  await context.route("https://tiles.openfreemap.org/styles/**", (route) =>
    json(route, {
      version: 8,
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#eee8f4" },
        },
      ],
    }),
  );
  await context.route("**/api/auth/actor", (route) => {
    actorReads++;
    return json(route, actorResult);
  });
  let mediaDenial = null;
  await context.route("**/api/coach/media", (route) =>
    mediaDenial
      ? mediaDenial.malformed
        ? route.fulfill({
            status: mediaDenial.status,
            contentType: "text/plain",
            body: "Access denied",
          })
        : json(route, { status: "forbidden" }, mediaDenial.status)
      : json(route, { status: "ready", media }),
  );
  await context.route("**/api/coach/website", async (route) => {
    if (route.request().method() === "GET") {
      if (websiteMode === "unavailable")
        return json(route, { status: "unavailable" }, 503);
      if (websiteMode === "delayed")
        await new Promise((resolve) => {
          releaseWebsiteRead = resolve;
        });
      return json(route, { status: "ready", website });
    }
    writes++;
    if (websiteMode === "conflict")
      return json(route, { status: "conflict" }, 409);
    if (websiteMode === "unknown") return route.abort();
    const body = route.request().postDataJSON();
    assert.equal(body.expectedRevision, website.revision);
    website = {
      ...website,
      revision: website.revision + 1,
      content: body.content,
    };
    return json(route, { status: "saved", website });
  });
  await context.route("**/api/coach/starting-rate", (route) => {
    if (route.request().method() === "GET")
      return json(route, { status: "ready", startingRate: rate });
    writes++;
    const body = route.request().postDataJSON();
    assert.equal(body.expectedRevision, rate.revision);
    rate = {
      ...rate,
      revision: rate.revision + 1,
      amountCents: body.amountCents,
      showPublicly: body.showPublicly,
    };
    return json(route, { status: "saved", startingRate: rate });
  });
  await context.route("**/__fixture/profile", (route) => {
    writes++;
    return json(
      route,
      profileMode === "ok"
        ? { status: "saved", message: "Profile saved.", errors: [] }
        : {
            status: "unavailable",
            message: "Fixture save unavailable. Your draft is retained.",
            errors: [],
          },
    );
  });
  await context.route(
    (url) => url.pathname === "/coach",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Isolated calendar handoff destination</h1>",
      }),
  );
  page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/profile/coach`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  const canvas = page.locator(".coach-profile-canvas"),
    dialog = page.getByRole("dialog");
  const edit = (label) =>
    canvas.getByRole("button", { name: `Edit ${label}`, exact: true });
  const close = () =>
    dialog.getByRole("button", { name: "Close editing panel" }).click();
  await expect(
    canvas.getByRole("heading", { name: "Alex Morgan", exact: true }),
  ).toBeVisible();
  await expect(canvas.locator(".seven-day-grid")).toBeVisible();
  await expect(canvas.locator(".coach-website-name .eyebrow")).toHaveText(
    "Alex Coaching",
  );
  await expect(canvas.locator(".coach-website-rate")).toHaveCount(0);
  await edit("introduction").click();
  const introduction = dialog.getByLabel("Short introduction (optional)");
  await expect(introduction).toBeFocused();
  await introduction.fill("A draft introduction that stays with me.");
  await close();
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "A draft introduction that stays with me.",
  );
  await canvas
    .getByRole("button", { name: "Saved preview", exact: true })
    .click();
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    website.content.introduction,
  );
  await expect(edit("introduction")).toHaveCount(0);
  await canvas
    .getByRole("button", { name: "Back to editing", exact: true })
    .click();
  await edit("introduction").click();
  await expect(introduction).toHaveValue(
    "A draft introduction that stays with me.",
  );
  await dialog
    .getByRole("button", { name: "Save website content", exact: true })
    .click();
  await close();
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    website.content.introduction,
  );
  report(
    "Click-to-edit focuses the selected field; closing preserves drafts; saved preview excludes drafts; save updates the canvas",
  );

  await edit("starting rate").click();
  await dialog.getByLabel("Starting amount (EUR)").fill("62.50");
  await dialog.getByLabel("Show starting rate publicly").check();
  await close();
  await expect(canvas.locator(".coach-website-rate")).toContainText("62.50");
  await canvas
    .getByRole("button", { name: "Saved preview", exact: true })
    .click();
  await expect(canvas.locator(".coach-website-rate")).toHaveCount(0);
  await canvas
    .getByRole("button", { name: "Back to editing", exact: true })
    .click();
  await edit("starting rate").click();
  await dialog
    .getByRole("button", { name: "Save starting rate", exact: true })
    .click();
  await close();
  await expect(canvas.locator(".coach-website-rate")).toContainText("62.50");
  report(
    "Private saved rate stays out of preview while opted-in live draft and independently saved rate render correctly",
  );

  await edit("introduction").click();
  await introduction.fill("Retained through conflict and calendar navigation.");
  websiteMode = "conflict";
  await dialog
    .getByRole("button", { name: "Save website content", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Load latest saved version" }),
  ).toBeVisible();
  await expect(introduction).toHaveValue(
    "Retained through conflict and calendar navigation.",
  );
  website = {
    ...website,
    revision: website.revision + 1,
    content: {
      ...website.content,
      introduction: "Another tab saved this introduction.",
    },
  };
  websiteMode = "ok";
  await dialog
    .getByRole("button", { name: "Load latest saved version" })
    .click();
  await dialog.getByRole("button", { name: /Keep my draft/ }).click();
  await close();
  await canvas
    .getByRole("button", { name: "Saved preview", exact: true })
    .click();
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "Another tab saved this introduction.",
  );
  await canvas
    .getByRole("button", { name: "Back to editing", exact: true })
    .click();
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "Retained through conflict and calendar navigation.",
  );
  const popupPromise = page.waitForEvent("popup");
  await canvas
    .getByRole("link", { name: "Open calendar", exact: false })
    .click();
  const popup = await popupPromise;
  await expect(popup.getByRole("heading")).toHaveText(
    "Isolated calendar handoff destination",
  );
  await popup.close();
  await page.bringToFront();
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "Retained through conflict and calendar navigation.",
  );
  await canvas.getByRole("button", { name: "Next 7 days" }).click();
  await expect(page).toHaveURL(/\/profile\/coach\?date=/);
  await expect(canvas.locator(".coach-website-intro")).toHaveText(
    "Retained through conflict and calendar navigation.",
  );
  report(
    "Conflict recovery keeps the local draft separate from newer saved text; calendar popup and real seven-day navigation preserve the draft",
  );

  await edit("introduction").click();
  websiteMode = "unknown";
  await dialog
    .getByRole("button", { name: "Save website content", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Load latest saved version" }),
  ).toBeVisible();
  await expect(introduction).toHaveValue(
    "Retained through conflict and calendar navigation.",
  );
  websiteMode = "ok";
  await dialog
    .getByRole("button", { name: "Load latest saved version" })
    .click();
  await dialog.getByRole("button", { name: /Use (the )?latest saved/ }).click();
  await close();
  await edit("display name").click();
  await dialog
    .getByLabel("Display name", { exact: true })
    .fill("Draft Coach Name");
  profileMode = "error";
  await dialog.getByRole("button", { name: "Save profile details" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Your draft is retained",
  );
  await expect(dialog.getByLabel("Display name", { exact: true })).toHaveValue(
    "Draft Coach Name",
  );
  await dialog.getByRole("button", { name: "Cancel profile edits" }).click();
  await close();
  await expect(
    canvas.getByRole("heading", { name: "Alex Morgan", exact: true }),
  ).toBeVisible();
  report(
    "Lost response offers reconciliation without retrying blindly; failed profile save retains controlled inputs and explicit cancel restores saved details",
  );

  await edit("training photos and video").click();
  await expect(
    dialog.getByRole("heading", {
      name: "Training photos & video",
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByLabel("Training photo file").setInputFiles({
    name: "fixture-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("isolated selection fixture"),
  });
  await dialog
    .getByLabel("Describe this photo")
    .fill("A media selection that survives closing the drawer.");
  await close();
  await edit("training photos and video").click();
  await expect(dialog.getByLabel("Describe this photo")).toHaveValue(
    "A media selection that survives closing the drawer.",
  );
  assert.equal(
    await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
    true,
  );
  await dialog
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  const nestedPhoto = {
    id: "93290000-0000-4000-8000-000000000077",
    alt: "Nested photo preview",
    width: 1200,
    height: 800,
    thumbnailUrl:
      "/api/coach/media/photos/93290000-0000-4000-8000-000000000077/thumbnail",
    fullUrl:
      "/api/coach/media/photos/93290000-0000-4000-8000-000000000077/full",
  };
  media.photos = [nestedPhoto];
  media.published = { photos: [nestedPhoto], video: null };
  media.revision++;
  await context.route("**/api/coach/media/photos/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await dialog
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  const ownerDrawer = page.locator("dialog.profile-edit-drawer");
  const nestedTrigger = ownerDrawer.getByRole("button", {
    name: "View photo: Nested photo preview",
    exact: true,
  });
  await nestedTrigger.click();
  await expect(
    page.getByRole("dialog", { name: "Nested photo preview", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ownerDrawer).toBeVisible();
  await expect(nestedTrigger).toBeFocused();
  media.photos = [];
  media.published = { photos: [], video: null };
  media.revision++;
  await ownerDrawer
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  report(
    "Escape closes a nested media preview while retaining the editing drawer and restoring focus",
  );
  await close();
  await page.getByRole("button", { name: "Toggle hidden fixture" }).click();
  await expect(
    canvas.getByRole("heading", { name: "Public schedule is not available" }),
  ).toBeVisible();
  await expect(
    canvas.getByText("Hidden profile · private preview", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle hidden fixture" }).click();
  report(
    "Media file/description selection survives closing; pending media warns before unload; hidden profiles show an explicit private schedule state",
  );

  for (const width of [1440, 1024, 768, 430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await edit("brand label").focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Brand label (optional)")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(edit("brand label")).toBeFocused();
    await page.screenshot({
      path: path.join(evidence, `canvas-${width}.png`),
      fullPage: true,
    });
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      page: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dimensions.page <= width + 1,
      `Canvas overflow at ${width}: ${dimensions.page}`,
    );
    await edit("biography").click();
    const drawer = await dialog.evaluate((el) => ({
      width: el.clientWidth,
      scroll: el.scrollWidth,
    }));
    assert.ok(drawer.scroll <= drawer.width + 1, `Drawer overflow at ${width}`);
    await page.keyboard.press("Tab");
    assert.ok(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      "Focus escaped native modal",
    );
    await dialog.screenshot({
      path: path.join(evidence, `drawer-${width}.png`),
    });
    await close();
    measurements.push({ ...dimensions, drawer });
  }
  report(
    "Seven widths from 320 to 1440 px have no horizontal overflow; keyboard editing, Escape, focus restoration and native modal focus containment work",
  );
  actorResult = {
    ...actor,
    demoRun: { slug: "other-dataset", name: "Other dataset" },
  };
  await page.getByRole("button", { name: "Refresh fixture actor" }).click();
  await expect(
    page.getByRole("heading", { name: "Reload your coach profile" }),
  ).toBeVisible();
  await expect(page.getByText("Alex Morgan", { exact: true })).toHaveCount(0);
  report(
    "Dataset change conceals the entire prior owner canvas and editing controls",
  );
  for (const revoked of [
    { status: "signed-out" },
    { ...actor, coachAccessStatus: "suspended" },
    { ...actor, profile: { ...actor.profile, slug: "other-coach" } },
  ]) {
    actorResult = actor;
    const check = await context.newPage();
    check.on("pageerror", (error) => errors.push(error.message));
    await check.goto(`${base}/profile/coach`, { waitUntil: "networkidle" });
    await expect(check.locator(".coach-profile-canvas")).toBeVisible();
    actorResult = revoked;
    await check.getByRole("button", { name: "Refresh fixture actor" }).click();
    await expect(
      check.getByRole("heading", { name: "Reload your coach profile" }),
    ).toBeVisible();
    await expect(check.locator(".coach-profile-canvas")).toHaveCount(0);
    await check.close();
  }
  report(
    "Signed-out, suspended and different-account actor refreshes conceal prior profile content",
  );
  actorResult = actor;
  websiteMode = "delayed";
  const slow = await context.newPage();
  slow.on("pageerror", (error) => errors.push(error.message));
  await slow.goto(`${base}/profile/coach`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => typeof releaseWebsiteRead).toBe("function");
  await expect(slow.locator(".profile-canvas-notice")).toHaveCount(0);
  await slow
    .getByRole("button", { name: "Edit introduction", exact: true })
    .click();
  await expect(slow.getByRole("dialog")).toBeVisible();
  releaseWebsiteRead();
  await expect(
    slow.getByRole("dialog").getByLabel("Short introduction (optional)"),
  ).toBeFocused();
  await expect(slow.locator(".profile-canvas-notice")).toHaveCount(0);
  await slow.close();
  report(
    "Pending reads show no verification failure; an early click opens and focuses the field once saved content arrives",
  );
  websiteMode = "unavailable";
  const unavailable = await context.newPage();
  unavailable.on("pageerror", (error) => errors.push(error.message));
  await unavailable.goto(`${base}/profile/coach`, { waitUntil: "networkidle" });
  await expect(unavailable.locator(".profile-canvas-notice")).toContainText(
    "Some saved content could not be verified",
  );
  await unavailable
    .getByRole("button", { name: "Edit introduction", exact: true })
    .click();
  websiteMode = "ok";
  await unavailable
    .locator('[data-website-panel="content"]')
    .getByRole("button", { name: "Retry loading", exact: true })
    .click();
  await expect(unavailable.locator(".profile-canvas-notice")).toHaveCount(0);
  await expect(
    unavailable.getByRole("dialog").getByLabel("Short introduction (optional)"),
  ).toBeFocused();
  await unavailable.close();
  report(
    "A failed initial read shows verification/retry guidance; successful retry clears it and opens the requested field",
  );
  websiteMode = "ok";
  for (const denial of [
    { status: 403 },
    { status: 401 },
    { status: 403, malformed: true },
  ]) {
    mediaDenial = null;
    const denied = await context.newPage();
    denied.on("pageerror", (error) => errors.push(error.message));
    await denied.goto(`${base}/profile/coach`, { waitUntil: "networkidle" });
    await denied
      .getByRole("button", {
        name: "Edit training photos and video",
        exact: true,
      })
      .click();
    mediaDenial = denial;
    await denied
      .locator(".coach-media-editor")
      .getByRole("button", { name: "Reload media", exact: true })
      .click();
    await expect(denied.locator(".coach-profile-canvas")).toHaveCount(0);
    await denied.close();
  }
  report(
    "Media 401/403 responses, including a non-JSON denial, conceal the complete owner canvas before the actor snapshot refreshes",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, "validation.json"),
    JSON.stringify(
      {
        checks,
        measurements,
        errors,
        writes,
        actorReads,
        proof:
          "Actual components, fictional verified-session/actor and intercepted API/action transport. No live Auth/SQL/Storage/Mux authority proof.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (page) {
    await page
      .screenshot({ path: path.join(evidence, "failure.png"), fullPage: true })
      .catch(() => {});
    const state = await page
      .locator("dialog")
      .evaluateAll((dialogs) =>
        dialogs.map((el) => ({
          open: el.open,
          html: el.outerHTML.slice(0, 14000),
          focus: document.activeElement?.outerHTML.slice(0, 400),
        })),
      )
      .catch(() => []);
    await writeFile(
      path.join(evidence, "failure-state.json"),
      JSON.stringify(state, null, 2),
    );
  }
  throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 5000);
    });
  }
  await writeFile(path.join(evidence, "next.log"), log).catch(() => {});
  await rm(scratch, { recursive: true, force: true });
}
