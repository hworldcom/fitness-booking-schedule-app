// UI-only rehearsal. Uses an isolated checkout and explicit fixtures; never loads .env or runs migrations.
import assert from "node:assert/strict";
import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const root = process.cwd();
const output = path.join(root, "test-results/dev0254-ui");
const checkout = path.join(tmpdir(), "movx-dev0254-ui-checkout");
const port = Number(process.env.CALENDAR_UI_PORT ?? 3138);
const base = `http://127.0.0.1:${port}`;
await mkdir(output, { recursive: true });
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
await writeFile(
  path.join(checkout, "src/app/coach/page.tsx"),
  `import {CoachCalendarHarness} from "../../tests-fixtures/coach-calendar-harness";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {return <CoachCalendarHarness params={await searchParams}/>;}`,
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
      if ((await fetch(`${base}/coach`)).ok) break;
    } catch {}
    if (attempt === 119)
      throw new Error(`Calendar fixture unavailable: ${log.slice(-3000)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1040 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const open = async (query = "") => {
    await page.goto(`${base}/coach?date=2026-10-16${query}`);
    await page
      .getByRole("heading", { name: "Calendar", exact: true })
      .waitFor();
    await page
      .getByTestId("fixture-ready")
      .filter({ hasText: "Ready" })
      .waitFor();
  };
  const views = () =>
    page.getByRole("navigation", { name: "Calendar views", exact: true });
  const types = () =>
    page.getByRole("navigation", { name: "Session type filters", exact: true });
  const agenda = () =>
    page.getByRole("region", { name: "Calendar agenda", exact: true });
  const scenario = async (value) =>
    page
      .getByLabel("Calendar response scenario", { exact: true })
      .selectOption(value);
  const reload = () =>
    page.getByRole("button", { name: "Reload calendar", exact: true });
  await open();
  assert.equal(
    await views()
      .getByRole("link", { name: "Week", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  await page
    .getByRole("group", { name: "week timed calendar", exact: true })
    .count();
  await page.screenshot({
    path: path.join(output, "desktop-week.png"),
    fullPage: true,
  });
  await types().getByRole("link", { name: "Group", exact: true }).click();
  await page.waitForURL(/type=group/);
  await agenda().locator(".coach-calendar-item.group").first().waitFor();
  assert.equal(
    await agenda().locator(".coach-calendar-item.availability").count(),
    0,
  );
  await page.goBack();
  await page.waitForURL((url) => !url.searchParams.has("type"));
  await agenda().locator(".coach-calendar-item.availability").first().waitFor();
  record(
    "Week default, mixed states and canonical type filtering/browser Back",
  );

  await views().getByRole("link", { name: "Month", exact: true }).click();
  await page.waitForURL(/calendarView=month/);
  await page.locator(".coach-calendar-month-day").first().waitFor();
  assert.equal(await page.locator(".coach-calendar-month-day").count(), 42);
  const day = page.locator(".coach-calendar-month-day").filter({
    has: page.getByRole("link", { name: /Open Friday,? 16 Oct/, exact: true }),
  });
  assert.equal(await day.locator(".coach-calendar-item").count(), 3);
  assert.equal(
    await day.getByRole("link", { name: /Show all 6 items/ }).textContent(),
    "+3 more",
  );
  const later = page.locator(".coach-calendar-month-day").filter({
    has: page.getByRole("link", {
      name: /Open Saturday,? 7 Nov/,
      exact: true,
    }),
  });
  assert.equal(await later.locator(".coach-calendar-item").count(), 3);
  await page.screenshot({
    path: path.join(output, "desktop-month.png"),
    fullPage: true,
  });
  while (
    await page
      .getByRole("button", { name: "Load more calendar items", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Load more calendar items", exact: true })
      .click();
  assert.match(
    await agenda().locator("header p").first().textContent(),
    /^(\d+) of \1 times/,
  );
  await day.getByRole("link", { name: /Show all 6 items/ }).click();
  await page.waitForURL(/calendarView=day/);
  await agenda().getByRole("button").first().waitFor();
  assert.equal(await agenda().locator(".coach-calendar-item").count(), 6);
  await page.reload();
  await page
    .getByTestId("fixture-ready")
    .filter({ hasText: "Ready" })
    .waitFor();
  assert.equal(
    await views()
      .getByRole("link", { name: "Day", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  record(
    "42-cell month, exact overflow independent of page loading, complete pagination and More/day/reload state",
  );

  await open();
  await page
    .getByLabel("Calendar venue", { exact: true })
    .selectOption("60000000-0000-4000-8000-000000000003");
  await page.getByLabel("Show cancelled / withdrawn", { exact: true }).check();
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await page.waitForURL(/history=1/);
  await agenda()
    .getByRole("button", { name: /Private session:.*Confirmed/ })
    .waitFor();
  await agenda()
    .getByRole("button", { name: /Private session:.*Cancelled/ })
    .waitFor();
  await agenda()
    .getByRole("button", { name: /Private session:.*Confirmed/ })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByText("This booking remains Confirmed", { exact: false })
    .waitFor();
  assert.match(
    await dialog
      .getByRole("link", { name: "View original booking", exact: true })
      .getAttribute("href"),
    /#coach-booking-/,
  );
  await page.keyboard.press("Escape");
  await page.goto(`${base}/coach?date=2026-12-03&calendarView=day`);
  await agenda()
    .getByRole("button", { name: /Winter technical workshop/ })
    .waitFor();
  assert.equal(
    await agenda().locator(".coach-calendar-item.availability").count(),
    0,
  );
  await agenda()
    .getByRole("button", { name: /Winter technical workshop/ })
    .click();
  await page
    .getByRole("dialog")
    .getByText("awaiting coach confirmation", { exact: false })
    .waitFor();
  assert.match(
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "View published session", exact: true })
      .getAttribute("href"),
    /^\/events\/group-/,
  );
  await page.keyboard.press("Escape");
  record(
    "inactive snapshot venues, cancelled history, unchanged past private confirmation and real groups beyond private horizon",
  );

  await open("&calendarView=month");
  await scenario("unavailable");
  const countBefore = await agenda().locator(".coach-calendar-item").count();
  await page
    .getByRole("button", { name: "Load more calendar items", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Fixture calendar unavailable" })
    .waitFor();
  assert.equal(
    await agenda().locator(".coach-calendar-item").count(),
    countBefore,
  );
  await scenario("changed");
  await page
    .getByRole("button", { name: "Load more calendar items", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "calendar changed" })
    .waitFor();
  assert.equal(await agenda().count(), 0);
  await reload().click();
  await agenda().waitFor();
  await scenario("denied");
  await reload().click();
  await page
    .getByRole("heading", { name: "Calendar access changed", exact: true })
    .waitFor();
  assert.equal(await page.locator(".coach-calendar-item").count(), 0);
  record(
    "unavailable page preserves loaded data; changed-page version requires reload; revoked access clears the calendar",
  );

  await open();
  await page
    .getByRole("navigation", { name: "Schedule sections", exact: true })
    .getByRole("link", { name: "Availability", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Availability", exact: true })
    .waitFor();
  await page
    .getByLabel("Monday range 1 end", { exact: true })
    .selectOption("13:00");
  const calendar = page
    .getByRole("navigation", { name: "Schedule sections", exact: true })
    .getByRole("link", { name: "Calendar", exact: true });
  await calendar.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Monday range 1 end", { exact: true }).inputValue(),
    "13:00",
  );
  await calendar.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await page.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
  record(
    "Calendar/Availability transition keeps or deliberately discards the real editor draft",
  );

  for (const width of [375, 430]) {
    await page.setViewportSize({ width, height: 932 });
    await open();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${width}px week overflow`,
    );
    assert.equal(
      await page.locator(".coach-calendar-timed").isVisible(),
      false,
    );
    await page.screenshot({
      path: path.join(output, `mobile-${width}-week.png`),
      fullPage: true,
    });
    await views().getByRole("link", { name: "Month", exact: true }).click();
    await page.locator(".coach-calendar-month-day").first().waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${width}px month overflow`,
    );
    await page.screenshot({
      path: path.join(output, `mobile-${width}-month.png`),
      fullPage: true,
    });
    await agenda().getByRole("button").first().focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    for (let n = 0; n < 5; n++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => !!document.activeElement?.closest("dialog")),
        true,
      );
    }
    await page.screenshot({
      path: path.join(output, `mobile-${width}-detail.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
  }
  await open("&historyOnly=1");
  assert.equal(
    await page.getByRole("link", { name: /Edit availability for/ }).count(),
    0,
  );
  await page
    .getByText("Availability publishing is paused", { exact: false })
    .waitFor();
  record(
    "375/430px agenda/month/details, long venues, keyboard dialog focus and history-only presentation",
  );
  assert.deepEqual(errors, [], "no browser runtime errors");
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        passed,
        errors,
        scope:
          "Isolated client fixtures only. Migration, SQL/Auth proof and owner group-management navigation remain pending.",
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
