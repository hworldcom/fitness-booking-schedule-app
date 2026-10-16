// Isolated interface proof only: explicit fixtures, no env files, database or email.
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const root = process.cwd();
const output = path.join(root, "test-results/dev0255-ui");
const checkout = await mkdtemp(path.join(tmpdir(), "movx-dev0255-ui-"));
const port = Number(process.env.PUBLIC_SCHEDULE_UI_PORT ?? 3139);
const base = `http://127.0.0.1:${port}`;
await mkdir(output, { recursive: true });
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
await cp(
  path.join(root, "tests/fixtures"),
  path.join(checkout, "src/tests-fixtures"),
  { recursive: true },
);
await writeFile(
  path.join(checkout, "src/app/coaches/[slug]/page.tsx"),
  `import {PublicScheduleHarness} from "../../../tests-fixtures/public-schedule-harness";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {return <PublicScheduleHarness params={await searchParams}/>;}`,
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
const passed = [];
const record = (message) => {
  passed.push(message);
  console.log(`PASS ${message}`);
};
const actor = {
  status: "authorized",
  profile: {
    slug: "schedule-athlete",
    displayName: "Fixture Athlete",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "schedule-fixture", name: "Isolated fixture" },
  role: "member",
  coachAccessStatus: "not-applied",
};
try {
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
  await context.route("**/api/auth/actor", (route) =>
    route.fulfill({ json: actor }),
  );
  await context.route(/https:\/\/(?:tiles|styles)\./, (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const open = async (query) => {
    await page.goto(`${base}/coaches/schedule-coach${query ?? ""}`);
    await page
      .getByTestId("fixture-ready")
      .filter({ hasText: "Ready" })
      .waitFor();
  };
  const dates = () =>
    page.getByRole("navigation", { name: "Private session dates" });
  const rows = () => page.locator("li[data-slot-id]");
  const browse = (value) =>
    page.getByLabel("Browse as", { exact: true }).selectOption(value);
  const selected = async (date) => {
    await page.waitForURL((url) => url.searchParams.get("date") === date);
    await dates().locator('[aria-current="date"]').waitFor();
  };
  await open();
  assert.equal(await dates().getByRole("link").count(), 7);
  assert.match(
    await dates().locator('[aria-current="date"]').innerText(),
    /16 Oct/,
  );
  for (const date of ["2026-10-23", "2026-10-30", "2026-11-06", "2026-11-13"]) {
    await page.getByRole("link", { name: "Next dates", exact: true }).click();
    await selected(date);
  }
  assert.equal(await dates().getByRole("link").count(), 2);
  await dates().getByRole("link").filter({ hasText: "14 Nov" }).click();
  await selected("2026-11-14");
  assert.equal(await rows().count(), 10);
  const signIn = await rows()
    .first()
    .getByRole("link", { name: "Sign in to request" })
    .getAttribute("href");
  assert.equal(
    new URL(signIn, base).searchParams.get("returnTo"),
    "/coaches/schedule-coach?date=2026-11-14#private-schedule",
  );
  await page.goBack();
  await selected("2026-11-13");
  await page.reload();
  await selected("2026-11-13");
  await page.getByLabel("Choose a date", { exact: true }).fill("2026-10-25");
  await page.getByRole("button", { name: "Show times", exact: true }).click();
  await selected("2026-10-25");
  assert.match(await rows().first().innerText(), /10:00–11:00/);
  record(
    "all 30 dates, last-day hours, sign-in return, DST labels and Back/reload",
  );

  await open("?date=2026-11-15");
  await page
    .getByText(/This date is outside the current 30-day request window/)
    .waitFor();
  assert.equal(await rows().count(), 0);
  assert.equal(
    await page.getByLabel("Choose a date", { exact: true }).getAttribute("max"),
    "2026-11-14",
  );
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await selected("2026-10-16");
  await open("?date=2026-10-20&date=2026-10-21");
  await page.getByText(/That date was invalid/).waitFor();
  await open("?date=2026-10-18");
  await page.getByText(/No open hours on this date/).waitFor();
  assert.equal(await rows().count(), 0);
  await open("?date=2026-10-20");
  assert.equal(await rows().count(), 10);
  await open("?unavailable=1");
  await page
    .getByRole("heading", { name: "We couldn’t verify this coach profile." })
    .waitFor();
  assert.equal(await page.locator("#private-schedule").count(), 0);
  record(
    "outside-window, repeated-date, empty, occupied/closed and failed-profile states remain distinct",
  );

  await open("?date=2026-11-14");
  await browse("athlete");
  const first = rows().first();
  const firstId = await first.getAttribute("data-slot-id");
  const request = first.getByRole("button", {
    name: "Request session",
    exact: true,
  });
  await request.waitFor();
  await request.focus();
  await page.keyboard.press("Enter");
  await page.getByText("Request saved.", { exact: true }).waitFor();
  await first.getByText("Requested", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("fixture-action").innerText(), firstId);
  assert.match(
    await page.locator(".coach-request-saved-detail").innerText(),
    /Awaiting coach confirmation/,
  );
  await first
    .getByRole("button", { name: "Withdraw request", exact: true })
    .click();
  await page.getByText("Request withdrawn.", { exact: true }).waitFor();
  await first
    .getByRole("button", { name: "Request session", exact: true })
    .waitFor();
  await page
    .getByLabel("Request response", { exact: true })
    .selectOption("conflict");
  await first
    .getByRole("button", { name: "Request session", exact: true })
    .click();
  await page.getByText(/That hour is no longer available/).waitFor();
  assert.equal(await page.locator(`li[data-slot-id="${firstId}"]`).count(), 0);
  await page
    .getByLabel("Request response", { exact: true })
    .selectOption("unavailable");
  await rows()
    .first()
    .getByRole("button", { name: "Request session", exact: true })
    .click();
  await page
    .getByText(
      "MovX could not verify the result. Refresh to check your requests and bookings before trying again.",
      {
        exact: true,
      },
    )
    .waitFor();
  await browse("changed");
  await page
    .getByText(/Your account changed or could not be verified/)
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Request session", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.getByText("Request saved.", { exact: true }).count(),
    0,
  );
  await browse("unavailable");
  await page
    .getByRole("button", { name: "Requests unavailable", exact: true })
    .first()
    .waitFor();
  assert.equal(await rows().count(), 9);
  record(
    "original request IDs, pending/withdrawal, closed-time and unavailable recovery, changed-account clearing",
  );

  await open("?date=2026-11-14");
  for (const width of [1440, 375, 430]) {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .locator("#private-schedule")
      .evaluate((el) =>
        el.scrollIntoView({ block: "start", behavior: "instant" }),
      );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `overflow at ${width}`,
    );
    const small = await page
      .locator("#private-schedule :is(a,button,input)")
      .evaluateAll((nodes) =>
        nodes
          .filter((n) => n.getClientRects().length)
          .filter((n) => n.getBoundingClientRect().height < 43.5)
          .map((n) => n.textContent),
      );
    assert.deepEqual(small, [], `touch targets at ${width}`);
    await page
      .locator("#private-schedule")
      .screenshot({ path: path.join(output, `schedule-${width}.png`) });
  }
  await page.getByRole("link", { name: "Previous dates", exact: true }).focus();
  await page.keyboard.press("Enter");
  await selected("2026-11-06");
  record(
    "desktop/375/430 px, full daily hours, touch targets and keyboard date navigation",
  );

  const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 900 },
  });
  const plain = await nojs.newPage();
  await plain.goto(`${base}/coaches/schedule-coach`);
  await plain.getByRole("link", { name: "Next dates", exact: true }).click();
  await plain.waitForURL(
    (url) => url.searchParams.get("date") === "2026-10-23",
  );
  await plain.waitForLoadState("networkidle");
  await plain.getByLabel("Choose a date", { exact: true }).fill("2026-11-14");
  assert.equal(
    await plain.getByLabel("Choose a date", { exact: true }).inputValue(),
    "2026-11-14",
  );
  await plain.getByRole("button", { name: "Show times", exact: true }).click();
  await plain.waitForURL(
    (url) => url.searchParams.get("date") === "2026-11-14",
  );
  assert.equal(await plain.locator("li[data-slot-id]").count(), 10);
  const refreshDocument = plain.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() &&
      response.request().method() === "GET",
  );
  await plain
    .getByRole("button", { name: "Refresh available times", exact: true })
    .click();
  assert.equal((await refreshDocument).status(), 200);
  assert.equal(new URL(plain.url()).searchParams.get("date"), "2026-11-14");
  assert.equal(await plain.locator("li[data-slot-id]").count(), 10);
  const plainReturn = await plain
    .locator("li[data-slot-id]")
    .first()
    .getByRole("link", { name: "Sign in to request" })
    .getAttribute("href");
  assert.equal(
    new URL(plainReturn, base).searchParams.get("returnTo"),
    "/coaches/schedule-coach?date=2026-11-14#private-schedule",
  );
  assert.equal(
    await plain
      .getByRole("button", { name: "Request session", exact: true })
      .count(),
    0,
  );
  await nojs.close();
  record(
    "no-JavaScript guest date links/form and explicit sign-in return without submission",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({ passed, pageErrors: errors, fixtureOnly: true }, null, 2),
  );
} catch (error) {
  console.error(log.slice(-3000));
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else {
      server.once("exit", resolve);
      setTimeout(resolve, 5000).unref();
    }
  });
  if (process.env.PUBLIC_SCHEDULE_UI_KEEP_CHECKOUT === "1")
    console.log(`Kept isolated checkout: ${checkout}`);
  else await rm(checkout, { recursive: true, force: true });
}
