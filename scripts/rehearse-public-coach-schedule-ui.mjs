// DEV0399: isolated real-component interface regression. No env files, accounts,
// database or email. The fixture transport cannot send an actual booking.
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { chromium, expect } from "@playwright/test";

const root = process.cwd();
const output = path.join(root, "test-results/dev0399-schedule");
const checkout = await mkdtemp(path.join(tmpdir(), "movx-dev0399-ui-"));
const port = Number(process.env.PUBLIC_SCHEDULE_UI_PORT ?? 3199);
assert.ok(Number.isInteger(port) && port >= 3100 && port <= 3999);
const base = `http://127.0.0.1:${port}`;
const serve = process.argv.includes("--serve");
const production = process.argv.includes("--production");
await mkdir(output, { recursive: true });
for (const entry of [
  "src",
  "public",
  "tests",
  "scripts",
  "supabase",
  "docs",
  "tickets",
  "README.md",
  "AGENTS.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
])
  await cp(path.join(root, entry), path.join(checkout, entry), {
    recursive: true,
  });
await symlink(
  path.join(root, "node_modules"),
  path.join(checkout, "node_modules"),
  "dir",
);
await cp(
  path.join(root, "tests/fixtures"),
  path.join(checkout, "src/tests-fixtures"),
  { recursive: true },
);
await writeFile(
  path.join(checkout, "src/app/coaches/[slug]/page.tsx"),
  `import {SevenDayBookingHarness} from "../../../tests-fixtures/seven-day-booking-harness";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {return <SevenDayBookingHarness params={await searchParams}/>;}`,
);
// Only this disposable checkout replaces the actor route. The real weekly API
// keeps its own Auth checks and still rejects preview callers without credentials.
await writeFile(
  path.join(checkout, "src/app/api/auth/actor/route.ts"),
  `import {PUBLIC_SCHEDULE_ACTOR} from "../../../../tests-fixtures/public-schedule-data";
export async function GET(){return Response.json(PUBLIC_SCHEDULE_ACTOR,{headers:{"cache-control":"private, no-store"}});}`,
);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC/.test(key),
  ),
);
env.NEXT_TELEMETRY_DISABLED = "1";
const next = path.join(root, "node_modules/next/dist/bin/next");
let log = "",
  server,
  browser;
const passed = [];
const record = (message) => {
  passed.push(message);
  console.log(`PASS ${message}`);
};
async function build() {
  const child = spawn(process.execPath, [next, "build", "--webpack"], {
    cwd: checkout,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (chunk) => {
      log += chunk;
    });
  const code = await new Promise((resolve) => child.once("exit", resolve));
  await writeFile(path.join(output, "build.log"), log);
  assert.equal(code, 0, log.slice(-6000));
  record("isolated production build and Next.js type checks");
}
try {
  if (production) await build();
  server = spawn(
    process.execPath,
    [
      next,
      production ? "start" : "dev",
      ...(production ? [] : ["--webpack"]),
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: checkout, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => {
      log += chunk;
    });
  console.log(`Fixture checkout: ${checkout}`);
  for (let n = 0; n < 120; n++) {
    if (server.exitCode !== null)
      throw new Error(`Fixture server exited: ${log.slice(-3000)}`);
    try {
      if ((await fetch(`${base}/coaches/schedule-coach`)).ok) break;
    } catch {}
    if (n === 119) throw new Error(`Fixture unavailable: ${log.slice(-3000)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const area = () => page.locator("#private-schedule");
  const times = () => area().locator(".seven-day-times button");
  const cards = () => area().locator(".seven-day-card");
  const commands = async () =>
    JSON.parse(await page.getByTestId("typed-commands").innerText());
  const legacyCommands = async () =>
    JSON.parse(await page.getByTestId("legacy-commands").innerText());
  const control = (name) => page.getByRole("button", { name, exact: true });
  async function open(query = "") {
    await page.goto(`${base}/coaches/schedule-coach${query}`);
    await expect(page.getByTestId("fixture-ready")).toHaveText("Ready");
    await expect(times()).toHaveCount(18);
  }
  async function review() {
    await area()
      .getByRole("button", { name: "Review request", exact: false })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  async function send() {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Send request", exact: true })
      .click();
  }
  await open();
  await expect(cards()).toHaveCount(7);
  await expect(area().locator('input[type="date"]')).toHaveCount(0);
  await expect(
    area().getByRole("button", { name: "Previous 7 days" }),
  ).toBeDisabled();
  await expect(
    area().getByRole("button", { name: "Review request", exact: false }),
  ).toBeDisabled();
  assert.equal((await commands()).length, 0);
  for (const date of ["2026-10-23", "2026-10-30", "2026-11-06", "2026-11-13"]) {
    await control("Next 7 days").click();
    await expect(page).toHaveURL(new RegExp(`date=${date}`));
    await expect(area().locator(".seven-day-range")).toContainText(
      new Date(`${date}T12:00Z`).getUTCDate().toString(),
    );
    await expect(times()).toHaveCount(date === "2026-11-13" ? 6 : 18);
  }
  await expect(cards()).toHaveCount(2);
  await expect(control("Next 7 days")).toBeDisabled();
  await page.goBack();
  await expect(page).toHaveURL(/date=2026-11-06/);
  await expect(cards()).toHaveCount(7);
  await control("This week").click();
  await expect(times()).toHaveCount(18);
  record(
    "all thirty dates, final two-day page, bounded navigation and browser Back",
  );

  await times().first().click();
  await page
    .getByLabel("Venue", { exact: true })
    .selectOption("b0399000-0000-4000-8000-000000000002");
  await expect(
    area().getByRole("button", { name: "Review request", exact: false }),
  ).toBeDisabled();
  await expect(times()).toHaveCount(18);
  await expect(times().first()).toHaveAccessibleName(/12:00/);
  await page
    .getByLabel("Session type", { exact: true })
    .selectOption("b0399000-0000-4000-8000-000000000090");
  await expect(times()).toHaveCount(6);
  await expect(times().first()).toHaveAccessibleName(/12:00.*13:30/);
  await page
    .getByLabel("Fixture availability", { exact: true })
    .selectOption("slow");
  await expect(times()).toHaveCount(18);
  await page
    .getByLabel("Session type", { exact: true })
    .selectOption("b0399000-0000-4000-8000-000000000090");
  await page
    .getByLabel("Session type", { exact: true })
    .selectOption("b0399000-0000-4000-8000-000000000060");
  await expect(times()).toHaveCount(18);
  await page.waitForTimeout(1100);
  await expect(times()).toHaveCount(18);
  record(
    "class duration/venue updates, selection clearing and ignored late responses even when transport ignores abort",
  );

  await times().first().click();
  await control("Revise class details").click();
  await expect(times()).toHaveCount(18);
  await expect(
    area().getByRole("button", { name: "Review request", exact: false }),
  ).toBeDisabled();
  record(
    "catalog revision changes clear old time/terms without inventing an offer",
  );

  for (const scenario of ["error", "malformed"]) {
    await page
      .getByLabel("Fixture availability", { exact: true })
      .selectOption(scenario);
    await expect(
      area().getByRole("heading", { name: "We couldn’t load the times" }),
    ).toBeVisible();
    await expect(area().locator(".seven-day-total strong")).toHaveText("—");
    await expect(times()).toHaveCount(0);
  }
  await page
    .getByLabel("Fixture availability", { exact: true })
    .selectOption("retry");
  await expect(control("Try again")).toBeVisible();
  await control("Try again").click();
  await expect(times()).toHaveCount(18);
  await page
    .getByLabel("Fixture availability", { exact: true })
    .selectOption("empty");
  await expect(
    area().getByRole("heading", { name: "No times in this week" }),
  ).toBeVisible();
  await expect(area().locator(".seven-day-total strong")).toHaveText("0");
  await page
    .getByLabel("Fixture availability", { exact: true })
    .selectOption("available");
  await expect(times()).toHaveCount(18);
  record(
    "verified empty, loading failure, corrupt week and explicit retry remain distinct",
  );

  await times().first().click();
  const reviewButton = area().getByRole("button", {
    name: "Review request",
    exact: false,
  });
  await reviewButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(reviewButton).toBeFocused();
  assert.equal((await commands()).length, 0);
  await page
    .getByLabel("Fixture request result", { exact: true })
    .selectOption("unknown");
  await review();
  await send();
  await expect(control("Retry the same request")).toBeVisible();
  await expect(page.getByLabel("Session type", { exact: true })).toBeDisabled();
  await expect(control("Next 7 days")).toBeDisabled();
  await control("Retry the same request").click();
  await expect.poll(async () => (await commands()).length).toBe(2);
  await expect(control("Retry the same request")).toBeEnabled();
  let written = await commands();
  assert.equal(written[0].typeRevision, 2);
  assert.deepEqual(written[0], written[1]);
  await page
    .getByLabel("Fixture request result", { exact: true })
    .selectOption("saved");
  await control("Retry the same request").click();
  await expect(
    area().getByRole("heading", { name: /Request sent/ }),
  ).toBeVisible();
  written = await commands();
  assert.equal(written.length, 3);
  assert.deepEqual(written[0], written[2]);
  record(
    "keyboard review/Escape/focus, no automatic submission, exact same-command retries and coach-pending success",
  );

  await control("Choose another time").click();
  await expect(times()).toHaveCount(18);
  await page
    .getByLabel("Fixture request result", { exact: true })
    .selectOption("slow");
  await times().first().click();
  await review();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send request", exact: true })
    .click({ clickCount: 2 });
  await expect.poll(async () => (await commands()).length).toBe(4);
  await control("Guest").click();
  await control("Athlete").click();
  await expect(times()).toHaveCount(18);
  await page.waitForTimeout(850);
  await expect(
    area().getByRole("heading", { name: /Request sent/ }),
  ).toHaveCount(0);
  await expect(
    area().getByRole("button", { name: "Review request", exact: false }),
  ).toBeDisabled();
  assert.equal((await commands()).length, 4);
  record(
    "double submission is guarded and a late write result cannot reappear after account concealment",
  );
  await page
    .getByLabel("Fixture request result", { exact: true })
    .selectOption("conflict");
  const oldName = await times().first().getAttribute("aria-label");
  await times().first().click();
  await review();
  await send();
  await expect(area()).toContainText("This time or class has changed");
  await expect(times()).toHaveCount(17);
  await expect(
    area().getByRole("button", { name: oldName, exact: true }),
  ).toHaveCount(0);
  await expect(
    area().getByRole("button", { name: "Review request", exact: false }),
  ).toBeDisabled();
  await control("Coach owner").click();
  await expect(times()).toHaveCount(17);
  await times().first().click();
  await expect(area()).toContainText("This is your coaching profile");
  await expect(
    area().getByRole("button", { name: "Review request", exact: false }),
  ).toBeDisabled();
  for (const account of ["Changed account", "Unverified account", "Guest"]) {
    await control(account).click();
    await expect(times()).toHaveCount(0);
    await expect(area().locator(".coach-private-schedule-days a")).toHaveCount(
      7,
    );
  }
  const guestLink = area().locator(".coach-private-schedule-days a").nth(6);
  const href = await guestLink.getAttribute("href");
  const target = new URL(href, base).searchParams.get("returnTo");
  assert.match(target, /date=2026-10-22#private-schedule/);
  await page.goto(base + target);
  await expect(times()).toHaveCount(18);
  await expect(cards()).toHaveCount(7);
  await expect(
    area().getByRole("button", { name: "Review request", exact: false }),
  ).toBeDisabled();
  record(
    "conflict refresh removes stale time; own-coach, account changes, guest concealment and safe date return",
  );

  await page
    .getByLabel("Fixture request result", { exact: true })
    .selectOption("saved");
  await control("Legacy booking").click();
  await expect(times()).toHaveCount(60);
  await expect(times().filter({ hasText: "Requested" })).toHaveCount(1);
  await times().first().click();
  const original = await area()
    .locator("li[data-slot-id]")
    .getAttribute("data-slot-id");
  await review();
  await send();
  await expect(
    area().getByText("Awaiting coach confirmation", { exact: true }).first(),
  ).toBeVisible();
  assert.deepEqual(await legacyCommands(), [original]);
  await control("Withdraw request").click();
  await expect(
    page.getByText("Request withdrawn.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Fixture request result", { exact: true })
    .selectOption("conflict");
  await review();
  await send();
  await expect(
    page.getByText("That hour is no longer available.", { exact: true }),
  ).toBeVisible();
  await expect(times()).toHaveCount(59);
  assert.deepEqual(await legacyCommands(), [original, original]);
  await control("Next 7 days").click();
  await expect(page).toHaveURL(/date=2026-10-23/);
  await expect(times()).toHaveCount(70);
  await control("Previous 7 days").click();
  await expect(times()).toHaveCount(59);
  await expect(times().filter({ hasText: "Requested" })).toHaveCount(1);
  await times().filter({ hasText: "Requested" }).click();
  await expect(control("Withdraw request")).toBeVisible();
  record(
    "legacy original IDs, actual venues, explicit request review, pending/withdrawal/conflict and week navigation",
  );

  await control("Class booking").click();
  await expect(times()).toHaveCount(18);
  for (const width of [1440, 320, 375, 430]) {
    await page.setViewportSize({ width, height: 920 });
    await area().scrollIntoViewIfNeeded();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `overflow at ${width}`,
    );
    const small = await area()
      .locator(".seven-day-pages button, .seven-day-times button, select")
      .evaluateAll((nodes) =>
        nodes
          .filter(
            (node) =>
              node.getClientRects().length &&
              node.getBoundingClientRect().height < 43.5,
          )
          .map((node) => node.textContent),
      );
    assert.deepEqual(small, [], `touch targets at ${width}`);
    const wrappedTimes = await times()
      .locator(":scope > span")
      .evaluateAll((nodes) =>
        nodes
          .filter(
            (node) =>
              node.getBoundingClientRect().height >
              parseFloat(getComputedStyle(node).fontSize) * 1.8,
          )
          .map((node) => node.textContent),
      );
    assert.deepEqual(
      wrappedTimes,
      [],
      `clock labels must stay on one line at ${width}`,
    );

    await area().screenshot({
      path: path.join(output, `schedule-${width}.png`),
    });
    await times().first().click();
    await review();
    await expect(page.getByRole("dialog")).toBeVisible();
    const dialogBox = await page.getByRole("dialog").boundingBox();
    assert.ok(
      dialogBox && Math.abs(dialogBox.x + dialogBox.width / 2 - width / 2) < 2,
      `dialog centered at ${width}`,
    );
    assert.ok(
      dialogBox.y >= 12 && dialogBox.y + dialogBox.height <= 909,
      `dialog contained at ${width}`,
    );
    await page.keyboard.press("Escape");
    for (const scenario of ["empty", "retry"]) {
      await page
        .getByLabel("Fixture availability", { exact: true })
        .selectOption(scenario);
      await expect(
        area().getByRole("heading", {
          name:
            scenario === "empty"
              ? "No times in this week"
              : "We couldn’t load the times",
        }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        false,
      );
      if (scenario === "retry") await control("Try again").click();
    }
    await page
      .getByLabel("Fixture availability", { exact: true })
      .selectOption("available");
    await expect(times()).toHaveCount(18);
  }
  record(
    "1440/320/375/430-pixel layouts, 44-pixel controls, keyboard dialogs and empty/error/retry states",
  );
  for (const [query, notice] of [
    ["?date=broken", "invalid"],
    ["?date=2026-10-20&date=2026-10-21", "invalid"],
    ["?date=2026-11-15", "outside"],
  ]) {
    await open(query);
    await expect(area()).toContainText(`That date is ${notice}`);
    await expect(area().locator(".seven-day-range")).toContainText("16 Oct");
    await expect(
      area().getByRole("button", { name: "Review request", exact: false }),
    ).toBeDisabled();
  }
  record(
    "invalid, repeated and outside-window dates recover to this week without choosing/submitting a time",
  );
  const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 900 },
  });
  const plain = await nojs.newPage();
  await plain.goto(`${base}/coaches/schedule-coach?fixtureGuest=1`);
  assert.equal(
    await plain.locator(".coach-private-schedule-days a").count(),
    7,
  );
  assert.equal(await plain.locator(".seven-day-times button").count(), 0);
  assert.match(
    await plain
      .locator(".coach-private-schedule-days a")
      .last()
      .getAttribute("href"),
    /sign-in\?returnTo=/,
  );
  await nojs.close();
  assert.deepEqual(errors, []);
  record("no-JavaScript public counts/login links; no page exceptions");
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      { passed, pageErrors: errors, fixtureOnly: true, production, base },
      null,
      2,
    ),
  );
  await browser.close();
  browser = undefined;
  if (serve) {
    console.log(`REVIEW ${base}/coaches/schedule-coach#private-schedule`);
    console.log(
      "Type cleanup to stop only this fixture server and remove its temporary checkout.",
    );
    process.stdin.setEncoding("utf8");
    await new Promise((resolve) => {
      process.stdin.once("data", resolve);
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  }
} catch (error) {
  await writeFile(path.join(output, "server.log"), log);
  console.error(log.slice(-3500));
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      if (server.exitCode !== null) resolve();
      else {
        server.once("exit", resolve);
        setTimeout(resolve, 5000).unref();
      }
    });
  }
  await writeFile(path.join(output, "server.log"), log);
  await rm(checkout, { recursive: true, force: true });
}
