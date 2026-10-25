// Explicit isolated UI/action fixtures only: no .env, Docker, hosted calls or migrations.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
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
import { chromium } from "@playwright/test";

const root = process.cwd();
const checkout = await mkdtemp(path.join(tmpdir(), "movx-dev0239-ui-"));
const output = path.join(root, "test-results/dev0239-ui");
const base = "http://127.0.0.1:3139";
const original = "33333333-3333-4333-8333-333333333333";
const own = [
  "src",
  "tests",
  "src/app/coach/events",
  "src/features/coach-events",
  "src/features/events/event-ui.tsx",
  "src/features/events/event-contract.ts",
  "src/domain/group-sessions.ts",
  "src/events/contracts.ts",
  "src/server/group-sessions/owner-service.ts",
  "src/features/coaches/coach-workspace-navigation.tsx",
  "tests/fixtures/coach-events-auth.ts",
  "tests/fixtures/coach-events-owner-service.ts",
];
let server,
  browser,
  page,
  log = "";
const report = (text) => console.log(`PASS ${text}`);
try {
  await mkdir(output, { recursive: true });
  execFileSync("tar", ["-xf", "-", "-C", checkout], {
    input: execFileSync("git", ["archive", "HEAD"], {
      cwd: root,
      maxBuffer: 100 * 1024 * 1024,
    }),
  });
  for (const name of own) {
    await mkdir(path.dirname(path.join(checkout, name)), { recursive: true });
    await cp(path.join(root, name), path.join(checkout, name), {
      recursive: true,
    });
  }
  await symlink(
    path.join(root, "node_modules"),
    path.join(checkout, "node_modules"),
    "dir",
  );
  await mkdir(path.join(checkout, "src/tests-fixtures"), { recursive: true });
  await cp(
    path.join(root, "tests/fixtures/coach-events-auth.ts"),
    path.join(checkout, "src/tests-fixtures/coach-events-auth.ts"),
  );
  const fixture = (
    await readFile(
      path.join(root, "tests/fixtures/coach-events-owner-service.ts"),
      "utf8",
    )
  ).replace('"./coach-events-auth"', '"@/tests-fixtures/coach-events-auth"');
  await writeFile(
    path.join(checkout, "src/server/group-sessions/owner-service.ts"),
    fixture,
  );
  for (const name of [
    "src/app/layout.tsx",
    "src/app/api/auth/actor/route.ts",
  ]) {
    const target = path.join(checkout, name);
    let text = await readFile(target, "utf8");
    text = text.replace(
      'from "@/server/authorization/service"',
      'from "@/tests-fixtures/coach-events-auth"',
    );
    if (name.endsWith("layout.tsx"))
      text = text.replace(
        "<Shell>{children}</Shell>",
        '<aside style={{padding:12,background:"#fff2cc"}}>Explicit isolated UI fixture — no database or real saves</aside><Shell>{children}</Shell>',
      );
    await writeFile(target, text);
  }
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|DEV0239/.test(key),
    ),
  );
  env.NEXT_TELEMETRY_DISABLED = "1";
  env.DEV0239_FIXTURE_STORE = path.join(checkout, "fixture-state.json");
  const built = execFileSync("npm", ["run", "build", "--", "--webpack"], {
    cwd: checkout,
    env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  await writeFile(path.join(output, "build.log"), built);
  report("production fixture build");
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3139",
    ],
    { cwd: checkout, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => {
      log = (log + data.toString()).slice(-16000);
    });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null)
      throw new Error(`Fixture server exited: ${log.slice(-2500)}`);
    try {
      if ((await fetch(`${base}/coach/events`)).ok) break;
    } catch {}
    if (attempt === 119)
      throw new Error(`Fixture server unavailable: ${log.slice(-2500)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cookie = async (name, value) =>
    context.addCookies([{ name: `dev0239-${name}`, value, url: base }]);
  const open = async (href = "/coach/events") => {
    await page.goto(base + href, { waitUntil: "domcontentloaded" });
    await page.getByRole("main").waitFor();
  };
  const decision = async (label) => {
    const button = page.getByRole("button", { name: label, exact: true });
    await page
      .locator("form")
      .filter({ has: button })
      .getByRole("checkbox")
      .check();
    await button.click();
  };
  await open();
  await page.getByRole("heading", { name: "Events", exact: true }).waitFor();
  assert.equal(await page.locator(".group-history-card").count(), 20);
  await page.getByRole("link", { name: "More sessions", exact: true }).click();
  await page.waitForURL(/afterAt=/);
  assert.equal(await page.locator(".group-history-card").count(), 4);
  await page
    .getByRole("link", { name: "Back to first page", exact: true })
    .click();
  report("bounded owner inventory, canonical cursor and first-page recovery");
  await page
    .getByRole("link", { name: "Create group session", exact: true })
    .click();
  await page.waitForURL(/draftId=/);
  const newPath = new URL(page.url()).pathname + new URL(page.url()).search;
  await page
    .getByLabel("Session title", { exact: true })
    .fill("Fixture new footwork");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Literal <script>text</script> — bring gloves.");
  await page.getByLabel("Starts at", { exact: true }).fill("2027-07-21T18:00");
  await page.getByLabel("Ends at", { exact: true }).fill("2027-07-21T19:30");
  await page
    .getByLabel("Coach decision deadline", { exact: true })
    .fill("2027-07-20T18:00");
  await page.getByLabel("Minimum participants", { exact: true }).fill("9");
  await page.getByLabel("Maximum participants", { exact: true }).fill("8");
  await page
    .getByLabel("Price per person (EUR)", { exact: true })
    .fill("15.50");
  await page
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Check all fields" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Session title", { exact: true }).inputValue(),
    "Fixture new footwork",
  );
  await page.getByLabel("Minimum participants", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await page.waitForURL(/\/coach\/events\/[a-f0-9-]{36}$/);
  const savedPath = new URL(page.url()).pathname;
  await page
    .getByRole("heading", { name: "Publication review", exact: true })
    .waitFor();
  assert.match(await page.locator("main").innerText(), /€15.50 per person/);
  assert.match(await page.locator("main").innerText(), /18:00/);
  assert.equal(await page.locator("main script").count(), 0);
  report(
    "draft validation retains fields; real Server Action redirects to review with Berlin time, literal description and exact EUR terms (fixture service)",
  );
  await page.getByRole("link", { name: "Edit draft", exact: true }).click();
  await page
    .getByLabel("Session title", { exact: true })
    .fill("Fixture reviewed footwork");
  await cookie("fault", "save-conflict");
  await page
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "session, roster" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Session title", { exact: true }).inputValue(),
    "Fixture reviewed footwork",
  );
  await cookie("fault", "none");
  await page
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await page.waitForURL(base + savedPath);
  await cookie("fault", "schedule-conflict");
  await decision("Publish session");
  await page.waitForURL(/issue=schedule-conflict/);
  await page
    .getByRole("alert")
    .filter({ hasText: "overlaps your private availability" })
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Edit draft", exact: true }).count(),
    1,
  );
  await cookie("fault", "venue-changed");
  await open(savedPath);
  await decision("Publish session");
  await page.waitForURL(/issue=venue-changed/);
  await page.getByRole("alert").filter({ hasText: "venue changed" }).waitFor();
  await cookie("fault", "none");
  await open(savedPath);
  await decision("Publish session");
  await page.waitForURL(base + savedPath);
  await page
    .getByRole("heading", { name: "Published session", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Edit draft", exact: true }).count(),
    0,
  );
  await open(savedPath + "/edit");
  assert.equal(new URL(page.url()).pathname, savedPath);
  report(
    "stale saves retain proposed fields; publication conflict/venue recovery and frozen published terms",
  );
  await open(`/coach/events/${original}`);
  await cookie("fault", "approval");
  await page.reload();
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      items: [...document.querySelectorAll("body *")]
        .map((el) => ({
          tag: el.tagName,
          cls: el.className,
          right: el.getBoundingClientRect().right,
          left: el.getBoundingClientRect().left,
          width: el.getBoundingClientRect().width,
          text: el.textContent?.slice(0, 100),
        }))
        .filter((el) => el.right > innerWidth + 0.5 || el.left < -0.5),
    }));
    if (layout.scrollWidth > layout.width)
      await writeFile(
        path.join(output, `layout-${width}.json`),
        JSON.stringify(layout, null, 2),
      );
    assert.equal(
      layout.scrollWidth > layout.width,
      false,
      `Pending approval controls at ${width}`,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Approve participant", exact: true })
        .count(),
      2,
    );
    await page.screenshot({
      path: path.join(output, `pending-approval-${width}.png`),
      fullPage: true,
    });
  }
  await cookie("fault", "none");
  await page.reload();
  report("pending participant controls and long names fit 320/375/1440 widths");
  await decision("Confirm session");
  await page.getByText("Confirmed by coach", { exact: true }).waitFor();
  await cookie("fault", "withdrawn");
  await page.reload();
  assert.match(await page.locator("main").innerText(), /1 of 8/);
  await page.getByText("Confirmed by coach", { exact: true }).waitFor();
  await cookie("fault", "long-roster");
  await page.reload();
  assert.equal(await page.locator(".coach-event-roster li").count(), 50);
  assert.equal(await page.locator(".coach-event-roster img").count(), 0);
  assert.doesNotMatch(
    await page.locator(".coach-event-roster").innerText(),
    /@/,
  );
  await page
    .getByRole("link", { name: "More participants", exact: true })
    .click();
  await page.waitForURL(/afterAt=/);
  assert.equal(await page.locator(".coach-event-roster li").count(), 1);
  await cookie("fault", "none");
  await open(`/coach/events/${original}`);
  await cookie("actor", "suspended");
  await page.reload();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm session", exact: true })
      .count(),
    0,
  );
  await decision("Cancel session");
  await page.getByText("Cancelled", { exact: true }).waitFor();
  assert.match(
    await page.locator(".coach-event-roster").innerText(),
    /Session cancelled/,
  );
  report(
    "manual confirmation, retained confirmation after withdrawals, 50-item private roster and suspended cancellation",
  );
  await cookie("actor", "owner");
  await cookie("fault", "under-minimum");
  await open(savedPath);
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm session", exact: true })
      .count(),
    0,
  );
  await cookie("fault", "deadline");
  await page.reload();
  await page.getByText("Not confirmed", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm session", exact: true })
      .count(),
    0,
  );
  for (const actor of ["other", "athlete", "applicant"]) {
    await cookie("actor", actor);
    await open(`/coach/events/${original}`);
    await page
      .getByRole("heading", {
        name: "This coach event is not available to this account",
        exact: true,
      })
      .waitFor();
    assert.equal(await page.locator(".coach-event-roster").count(), 0);
  }
  await cookie("actor", "owner");
  await cookie("fault", "unavailable");
  await open();
  await page
    .getByRole("heading", {
      name: "Coach Events could not be verified",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.getByText("No group sessions yet", { exact: true }).count(),
    0,
  );
  await cookie("fault", "none");
  await open(newPath);
  await page
    .getByLabel("Session title", { exact: true })
    .fill("Account switch attempt");
  await page.getByLabel("Starts at", { exact: true }).fill("2027-08-01T18:00");
  await page.getByLabel("Ends at", { exact: true }).fill("2027-08-01T19:00");
  await page
    .getByLabel("Coach decision deadline", { exact: true })
    .fill("2027-07-31T18:00");
  await cookie("actor", "other");
  await page
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "signed-in account changed" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Session title", { exact: true }).count(),
    0,
  );
  report(
    "minimum/deadline/other-owner/applicant denial, unavailable versus empty and old-account submission rejection (explicit fixtures)",
  );
  await cookie("actor", "owner");
  await cookie("fault", "none");
  const deletedPath = "/coach/events/55555555-5555-4555-8555-000000000001";
  await open(deletedPath);
  await decision("Delete draft");
  await page.waitForURL(base + "/coach/events");
  await open(deletedPath);
  await page
    .getByRole("heading", {
      name: "This coach event is not available to this account",
      exact: true,
    })
    .waitFor();
  report(
    "acknowledged draft deletion returns to inventory and cannot expose a deleted draft",
  );
  for (const width of [375, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/coach/events",
      newPath,
      `/coach/events/${original}`,
    ]) {
      await open(route);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${width} ${route}`,
      );
    }
    await page.screenshot({
      path: path.join(output, `detail-${width}.png`),
      fullPage: true,
    });
  }
  await page.keyboard.press("ControlOrMeta+Home");
  await page.reload();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "main-content",
  );
  const native = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 950 },
  });
  const np = await native.newPage();
  np.setDefaultTimeout(12000);
  await np.goto(`${base}/coach/events/new`);
  await np
    .getByLabel("Session title", { exact: true })
    .fill("Fixture native free session");
  await np.getByLabel("Starts at", { exact: true }).fill("2027-08-20T18:00");
  await np.getByLabel("Ends at", { exact: true }).fill("2027-08-20T19:00");
  await np
    .getByLabel("Coach decision deadline", { exact: true })
    .fill("2027-08-19T18:00");
  await np.getByLabel("Minimum participants", { exact: true }).fill("20");
  await np
    .getByRole("button", { name: "Save draft and review", exact: true })
    .focus();
  await np.keyboard.press("Enter");
  await np.getByRole("alert").filter({ hasText: "Check all fields" }).waitFor();
  assert.equal(
    await np.getByLabel("Session title", { exact: true }).inputValue(),
    "Fixture native free session",
  );
  await np.getByLabel("Minimum participants", { exact: true }).fill("2");
  await np
    .getByRole("button", { name: "Save draft and review", exact: true })
    .focus();
  await np.keyboard.press("Enter");
  await np.waitForURL(/\/coach\/events\/[a-f0-9-]{36}$/);
  await np
    .getByRole("heading", { name: "Publication review", exact: true })
    .waitFor();
  assert.match(await np.locator("main").innerText(), /Free/);
  const publish = np.getByRole("button", {
    name: "Publish session",
    exact: true,
  });
  await np
    .locator("form")
    .filter({ has: publish })
    .getByRole("checkbox")
    .check();
  await publish.focus();
  await np.keyboard.press("Enter");
  await np
    .getByRole("heading", { name: "Published session", exact: true })
    .waitFor();
  const cancel = np.getByRole("button", {
    name: "Cancel session",
    exact: true,
  });
  await np
    .locator("form")
    .filter({ has: cancel })
    .getByRole("checkbox")
    .check();
  await cancel.focus();
  await np.keyboard.press("Enter");
  await np.getByText("Cancelled", { exact: true }).waitFor();
  await native.close();
  report(
    "four responsive widths, keyboard skip focus and no-JavaScript validation retention/Free draft/review/publication/cancellation through native Enter submits",
  );
  assert.deepEqual(errors, []);
  console.log(
    "DEV0239 fixture rehearsal passed. No database/Auth persistence or hosted deployment is claimed.",
  );
} catch (error) {
  if (page)
    await page
      .screenshot({ path: path.join(output, "failure.png"), fullPage: true })
      .catch(() => {});
  console.error(log.slice(-3000));
  throw error;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(checkout, { recursive: true, force: true });
}
