// UI-only rehearsal. Uses an isolated checkout and explicit fixtures; never loads .env or runs migrations.
import assert from "node:assert/strict";
import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const root = process.cwd();
const output = path.join(root, "test-results/dev0253-ui");
const checkout = path.join(tmpdir(), "movx-dev0253-ui-checkout");
const port = Number(process.env.AVAILABILITY_UI_PORT ?? 3137);
const base = `http://127.0.0.1:${port}`;
await rm(checkout, { recursive: true, force: true });
await mkdir(checkout, { recursive: true });
for (const entry of [
  "src",
  "public",
  "tests/fixtures",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "postcss.config.mjs",
])
  await cp(path.join(root, entry), path.join(checkout, entry), {
    recursive: true,
  });
await symlink(
  path.join(root, "node_modules"),
  path.join(checkout, "node_modules"),
  "dir",
);
await mkdir(path.join(checkout, "src/app/availability-fixture"), {
  recursive: true,
});
await writeFile(
  path.join(checkout, "src/app/availability-fixture/page.tsx"),
  `import { AvailabilityEditorHarness } from "../../tests-fixtures/availability-editor-harness";
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string;date?:string}>}) {const params=await searchParams;return <AvailabilityEditorHarness tab={params.tab==="dates"?"dates":"weekly"} date={params.date??"2026-10-16"}/>;}`,
);
await cp(
  path.join(root, "tests/fixtures"),
  path.join(checkout, "src/tests-fixtures"),
  { recursive: true },
);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC/.test(key),
  ),
);
env.NEXT_TELEMETRY_DISABLED = "1";
const server = spawn(
  process.execPath,
  [
    path.join(root, "node_modules/next/dist/bin/next"),
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { cwd: checkout, env, stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (chunk) => {
    log += chunk.toString();
  });
let browser;
let page;
const passed = [];
function record(message) {
  passed.push(message);
  console.log(`PASS ${message}`);
}
try {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null)
      throw new Error(`Fixture server exited: ${log.slice(-3000)}`);
    try {
      const response = await fetch(`${base}/availability-fixture`);
      if (response.ok) break;
    } catch {}
    if (attempt === 119)
      throw new Error(`Fixture server unavailable: ${log.slice(-3000)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  page = await browser.newPage({
    viewport: { width: 1440, height: 1040 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const open = async (query = "") => {
    await page.goto(`${base}/availability-fixture${query}`);
    await page
      .getByRole("heading", { name: "Availability", exact: true })
      .waitFor();
    await page
      .getByTestId("fixture-ready")
      .filter({ hasText: "Ready" })
      .waitFor();
  };
  const review = () =>
    page.getByRole("button", { name: "Review changes", exact: true });
  const dialog = () => page.getByRole("dialog");
  const scenario = async (value) =>
    page.getByLabel("Response scenario").selectOption(value);
  const setEnd = async (value) =>
    page.getByLabel("Monday range 1 end", { exact: true }).selectOption(value);
  const save = async () => {
    await review().click();
    await dialog()
      .getByRole("button", { name: "Save availability", exact: true })
      .click();
    await page.getByText("Availability saved.", { exact: false }).waitFor();
  };
  await open();
  await page.screenshot({
    path: path.join(output, "desktop-weekly.png"),
    fullPage: true,
  });
  await setEnd("13:00");
  await page
    .getByRole("region", { name: "Monday", exact: true })
    .getByRole("button", { name: "Add range" })
    .click();
  await page
    .getByLabel("Monday range 2 venue", { exact: true })
    .selectOption("60000000-0000-4000-8000-000000000002");
  await page
    .getByLabel("Monday range 2 start", { exact: true })
    .selectOption("10:00");
  await review().click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Availability ranges overlap" })
    .waitFor();
  await page
    .getByLabel("Monday range 2 start", { exact: true })
    .selectOption("13:00");
  const copy = page.getByRole("button", {
    name: "Copy Monday hours",
    exact: true,
  });
  await copy.focus();
  await page.keyboard.press("Enter");
  await dialog().getByLabel("Tuesday", { exact: false }).check();
  await dialog()
    .getByText("Replace existing hours on Tuesday?", { exact: false })
    .waitFor();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => !!document.activeElement?.closest("dialog")),
      true,
      "dialog contains keyboard focus",
    );
  }
  await page.keyboard.press("Escape");
  assert.equal(
    await copy.evaluate((el) => el === document.activeElement),
    true,
    "copy trigger regains focus",
  );
  await copy.click();
  await dialog().getByLabel("Tuesday", { exact: false }).check();
  await dialog().getByRole("button", { name: "Replace selected days" }).click();
  assert.equal(
    await page.getByLabel("Tuesday range 1 end", { exact: true }).inputValue(),
    "13:00",
  );
  assert.equal(
    await page
      .getByLabel("Tuesday range 2 venue", { exact: true })
      .inputValue(),
    "60000000-0000-4000-8000-000000000002",
  );
  await review().click();
  await dialog()
    .getByRole("heading", { name: "Review availability changes", exact: true })
    .waitFor();
  assert.equal(
    await dialog()
      .getByRole("link", { name: /View session/ })
      .count(),
    2,
  );
  await dialog().getByText("2 pending requests", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("operation-audit").textContent(), "");
  await dialog()
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await page.getByText("Availability saved.", { exact: false }).waitFor();
  assert.equal(await review().isDisabled(), true);
  record(
    "weekly ranges, cross-venue overlap, deliberate copy replacement, keyboard trap/restore and one atomic reviewed save",
  );

  await page
    .getByRole("button", { name: "Date overrides", exact: true })
    .click();
  await page.getByLabel("Choose a date", { exact: true }).fill("2026-10-20");
  await page.getByRole("button", { name: "Add to selected dates" }).click();
  await page
    .getByRole("button", { name: "Remove 2026-10-16", exact: true })
    .click();
  await page.getByLabel("Choose a date", { exact: true }).fill("2026-10-21");
  await page.getByRole("button", { name: "Add to selected dates" }).click();
  await save();
  assert.equal(
    await page
      .locator(".availability-overrides li")
      .filter({ hasText: "All day unavailable" })
      .count(),
    2,
  );
  await page.getByRole("radio", { name: /Custom hours/ }).check();
  await review().click();
  const reviewBox = await dialog().boundingBox();
  assert.ok(
    Math.abs(reviewBox.x + reviewBox.width / 2 - 720) < 2,
    "review dialog is centered",
  );
  await page.screenshot({
    path: path.join(output, "desktop-date-review.png"),
    fullPage: true,
  });
  await dialog()
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await page.getByText("Availability saved.", { exact: false }).waitFor();
  await page.getByRole("radio", { name: /Use normal week/ }).check();
  await page.getByText("Current weekly hours", { exact: true }).waitFor();
  await save();
  await page.getByText("No exceptions this month", { exact: true }).waitFor();
  record(
    "multi-date day off/custom hours, retained private/group warnings, pending closure counts and current-week restoration preview",
  );

  await open();
  await setEnd("13:00");
  await page
    .getByRole("button", { name: "Date overrides", exact: true })
    .click();
  await dialog()
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Monday range 1 end", { exact: true }).inputValue(),
    "13:00",
  );
  await page
    .getByRole("button", { name: "Date overrides", exact: true })
    .click();
  await dialog()
    .getByRole("button", { name: "Review & save", exact: true })
    .click();
  await dialog()
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Make an exception", exact: true })
    .waitFor();
  await page.getByRole("radio", { name: /Custom hours/ }).check();
  await page.getByRole("button", { name: "Weekly hours", exact: true }).click();
  await dialog()
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Your normal week", exact: true })
    .waitFor();
  await setEnd("14:00");
  await page.getByRole("link", { name: "Bookings", exact: true }).click();
  await dialog()
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Monday range 1 end", { exact: true }).inputValue(),
    "14:00",
  );
  await page.evaluate(() => history.pushState({}, "", "?history-check=1"));
  await page.evaluate(() => history.back());
  await dialog()
    .getByRole("heading", { name: "Unsaved availability changes", exact: true })
    .waitFor();
  await dialog()
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  record(
    "save/discard/stay for section changes, workspace links and browser Back, including protection after saving",
  );

  await open();
  await setEnd("13:00");
  await page
    .getByRole("button", { name: "Simulate external revision" })
    .click();
  await page
    .getByText("A newer saved version is available.", { exact: false })
    .waitFor();
  assert.equal(
    await page.getByLabel("Monday range 1 end", { exact: true }).inputValue(),
    "13:00",
  );
  await review().click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Availability changed elsewhere" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Monday range 1 end", { exact: true }).inputValue(),
    "13:00",
  );
  await page
    .getByRole("button", { name: "Reload saved version", exact: true })
    .click();
  await dialog()
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Monday range 1 end", { exact: true }).inputValue(),
    "12:00",
  );
  await setEnd("13:00");
  await scenario("invalid");
  await review().click();
  await page
    .getByRole("alert")
    .filter({ hasText: "That venue has changed" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Monday range 1 end", { exact: true }).inputValue(),
    "13:00",
  );
  await scenario("unavailable");
  await review().click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Fixture network unavailable" })
    .waitFor();
  record(
    "new server props preserve dirty drafts; stale revision, inactive venue and unavailable preview keep explicit recovery",
  );

  await open();
  await setEnd("13:00");
  await scenario("lost");
  await review().click();
  await dialog()
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await dialog()
    .getByRole("button", { name: "Retry same save", exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Monday range 1 end", { exact: true }).isDisabled(),
    true,
  );
  await dialog()
    .getByRole("button", { name: "Retry same save", exact: true })
    .click();
  await page.getByText("Availability saved.", { exact: false }).waitFor();
  const audit = JSON.parse(
    await page.getByTestId("operation-audit").textContent(),
  );
  assert.equal(audit.length, 2);
  assert.deepEqual(audit[0], audit[1]);
  await setEnd("14:00");
  await scenario("denied");
  await review().click();
  await page
    .getByRole("heading", { name: "Coach access changed", exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Monday range 1 end", { exact: true }).count(),
    0,
  );
  record(
    "lost response retries the identical operation/payload; denied action clears private drafts",
  );

  for (const width of [375, 430]) {
    await page.setViewportSize({ width, height: 932 });
    await open();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${width}px weekly page has no horizontal overflow`,
    );
    await page.screenshot({
      path: path.join(output, `mobile-${width}-weekly.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Copy Monday hours", exact: true })
      .click();
    await dialog().getByLabel("Tuesday", { exact: false }).check();
    await page.screenshot({
      path: path.join(output, `mobile-${width}-copy.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Date overrides", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Make an exception", exact: true })
      .waitFor();
    await open("?tab=dates&date=2026-10-20");
    await page.getByRole("radio", { name: /Custom hours/ }).check();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${width}px date page has no horizontal overflow`,
    );
    await page.screenshot({
      path: path.join(output, `mobile-${width}-dates.png`),
      fullPage: true,
    });
    await review().click();
    await dialog()
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
  }
  record(
    "375/430px weekly/date views, long venues, copy/save dialogs and keyboard Escape",
  );
  assert.deepEqual(errors, [], "no browser runtime errors");
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        passed,
        errors,
        scope:
          "Explicit client fixtures only; real Auth, persistence, migration and reload rehearsal deferred.",
      },
      null,
      2,
    ),
  );
  console.log(`Screenshots and results: ${output}`);
} catch (error) {
  await page
    ?.screenshot({ path: path.join(output, "failure.png"), fullPage: true })
    .catch(() => {});
  await writeFile(
    path.join(output, "partial-results.json"),
    JSON.stringify({ passed, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile(path.join(output, "server.log"), log);
}
