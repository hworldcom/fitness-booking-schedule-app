// UI-only rehearsal. Uses an isolated checkout and explicit fixtures; never loads .env or runs migrations.
import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const root = process.cwd();
const output = path.join(root, "test-results/dev0254-ui");
const checkout = await mkdtemp(path.join(tmpdir(), "movx-dev0254-ui-"));
const port = Number(process.env.CALENDAR_UI_PORT ?? 3138);
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
// The real owner route/forms remain intact. Only its existing account/service
// boundaries are replaced with DEV0239's explicit fixtures in this checkout.
for (const name of ["src/app/layout.tsx", "src/app/api/auth/actor/route.ts"]) {
  const target = path.join(checkout, name);
  let source = (await readFile(target, "utf8")).replace(
    'from "@/server/authorization/service"',
    'from "@/tests-fixtures/coach-events-auth"',
  );
  if (name.endsWith("layout.tsx"))
    source = source.replace(
      "<Shell>{children}</Shell>",
      '<aside style={{padding:12,background:"#fff2cc"}}>Isolated calendar/owner integration fixture — no database or real authentication</aside><Shell>{children}</Shell>',
    );
  await writeFile(target, source);
}
await writeFile(
  path.join(checkout, "src/server/group-sessions/owner-service.ts"),
  (
    await readFile(
      path.join(root, "tests/fixtures/coach-events-owner-service.ts"),
      "utf8",
    )
  ).replace('"./coach-events-auth"', '"@/tests-fixtures/coach-events-auth"'),
);
const groupId = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const retainedGroupId = "20000000-0000-4000-8000-000000000001";
const ownerFixture = (id, title, startsAt, endsAt, status = "open") => ({
  id,
  slug: "group-" + id.replaceAll("-", ""),
  title,
  description:
    "Explicit isolated owner-navigation fixture. No real registrations or saves.",
  discipline: "Boxing",
  intendedLevel: "All levels",
  venue: {
    id: "60000000-0000-4000-8000-000000000002",
    name: "Riverside strength deck",
    label: "Berlin fixture venue",
    kind: "independent",
    latitude: 52.5,
    longitude: 13.4,
  },
  startsAt,
  endsAt,
  decisionDeadlineAt: "2026-10-16T15:00:00.000Z",
  minimumParticipants: 2,
  maximumParticipants: 8,
  priceCents: 0,
  currency: "EUR",
  status,
  displayStatus: status,
  revision: 1,
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  publishedAt: "2026-10-16T00:00:00.000Z",
  confirmedAt: null,
  closedAt: status === "cancelled" ? "2026-10-16T00:00:00.000Z" : null,
  coach: {
    slug: "fixture-owner",
    name: "Fixture coach",
    trustKind: "verified",
  },
  participantCount: status === "cancelled" ? 0 : 2,
  canJoin: false,
  canConfirm: status === "open",
  canCancel: status === "open",
  canEdit: false,
});
const ownerSessions = [
  ownerFixture(
    groupId(205),
    "Small-group padwork",
    "2026-10-16T16:00:00Z",
    "2026-10-16T17:00:00Z",
  ),
  ownerFixture(
    groupId(209),
    "Winter technical workshop",
    "2026-12-03T17:00:00Z",
    "2026-12-03T18:00:00Z",
  ),
  ownerFixture(
    groupId(210),
    "Boxing fundamentals",
    "2026-11-01T16:00:00Z",
    "2026-11-01T17:00:00Z",
    "cancelled",
  ),
  ownerFixture(
    retainedGroupId,
    "Retained group session",
    "2026-10-20T13:00:00Z",
    "2026-10-20T14:30:00Z",
  ),
];
const fixtureStore = path.join(checkout, "calendar-owner-fixture.json");
const fixtureBefore = JSON.stringify(
  Object.fromEntries(ownerSessions.map((session) => [session.id, session])),
);
await writeFile(fixtureStore, fixtureBefore);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|DEV0239/.test(key),
  ),
);
env.NEXT_TELEMETRY_DISABLED = "1";
env.DEV0239_FIXTURE_STORE = fixtureStore;
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
  assert.equal(
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "View group details", exact: true })
      .getAttribute("href"),
    `/coach/events/${groupId(209)}`,
  );
  const groupLink = page
    .getByRole("dialog")
    .getByRole("link", { name: "View group details", exact: true });
  await groupLink.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(
    (url) => url.pathname === `/coach/events/${groupId(209)}`,
  );
  await page
    .getByRole("heading", { name: "Winter technical workshop", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Confirm session", exact: true })
    .waitFor();
  await page.getByText("Fixture athlete 001", { exact: true }).waitFor();
  assert.equal(
    await readFile(fixtureStore, "utf8"),
    fixtureBefore,
    "opening group details performs no group mutation",
  );
  await page.goBack();
  await page.waitForURL(
    (url) =>
      url.pathname === "/coach" &&
      url.searchParams.get("date") === "2026-12-03",
  );
  await agenda()
    .getByRole("button", { name: /Winter technical workshop/ })
    .waitFor();
  if (await page.getByRole("dialog").count())
    await page.keyboard.press("Escape");
  record(
    "inactive/history/private confirmation and keyboard original group-owner navigation beyond the private horizon with Back and no mutation",
  );

  const cookie = (name, value) =>
    page.context().addCookies([{ name: `dev0239-${name}`, value, url: base }]);
  const ownerHref = `/coach/events/${groupId(209)}`;
  for (const actor of ["other", "athlete", "applicant"]) {
    await cookie("actor", actor);
    await page.goto(`${base}${ownerHref}`);
    await page
      .getByRole("heading", {
        name: "This coach event is not available to this account",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page.getByText("Fixture athlete 001", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Confirm session", exact: true })
        .count(),
      0,
    );
  }
  await cookie("actor", "signed-out");
  await page.goto(`${base}${ownerHref}`);
  await page.waitForURL((url) => url.pathname === "/sign-in");
  assert.equal(new URL(page.url()).searchParams.get("returnTo"), ownerHref);
  for (const actor of ["hidden", "suspended"]) {
    await cookie("actor", actor);
    await page.goto(`${base}${ownerHref}`);
    await page
      .getByRole("heading", { name: "Winter technical workshop", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Confirm session", exact: true })
        .count(),
      0,
    );
  }
  await cookie("actor", "owner");
  await cookie("fault", "unavailable");
  await page.goto(`${base}${ownerHref}`);
  await page
    .getByRole("heading", {
      name: "Coach Events could not be verified",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.getByText("Fixture athlete 001", { exact: true }).count(),
    0,
  );
  await cookie("fault", "none");
  await page.getByRole("link", { name: "Reload Events", exact: true }).click();
  await page
    .getByRole("heading", { name: "Winter technical workshop", exact: true })
    .waitFor();
  await page.goto(`${base}/coach?date=2026-11-01&calendarView=day&history=1`);
  await agenda()
    .getByRole("button", { name: /Boxing fundamentals/ })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "View group details", exact: true })
    .click();
  await page.waitForURL(
    (url) => url.pathname === `/coach/events/${groupId(210)}`,
  );
  await page.getByText("This session is closed.", { exact: false }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm session", exact: true })
      .count(),
    0,
  );
  record(
    "linked owner destination rechecks signed-out/other-owner/athlete/applicant access, hidden/suspended history and unavailable recovery",
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

  for (const width of [1440, 375, 430]) {
    await page.setViewportSize({ width, height: 1000 });
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
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    const review = page.getByRole("dialog");
    const retainedLink = review.getByRole("link", {
      name: "View group session in a new tab",
      exact: true,
    });
    await retainedLink.waitFor();
    assert.equal(
      await retainedLink.getAttribute("href"),
      `/coach/events/${retainedGroupId}`,
    );
    assert.equal(await retainedLink.getAttribute("target"), "_blank");
    assert.equal(await retainedLink.getAttribute("rel"), "noopener");
    assert.equal(
      await review
        .getByRole("link", {
          name: "View private session in a new tab",
          exact: true,
        })
        .getAttribute("href"),
      "/coach?view=bookings#coach-booking-10000000-0000-4000-8000-000000000001",
    );
    const previewPopup = page.context().waitForEvent("page");
    await retainedLink.focus();
    await page.keyboard.press("Enter");
    const popup = await previewPopup;
    popup.on("pageerror", (error) => errors.push(error.message));
    await popup.setViewportSize({ width, height: 1000 });
    await popup
      .getByRole("heading", { name: "Retained group session", exact: true })
      .waitFor();
    assert.equal(
      new URL(popup.url()).pathname,
      `/coach/events/${retainedGroupId}`,
    );
    assert.equal(
      await popup.evaluate(() => window.opener === null),
      true,
      "warning opens without an opener",
    );
    assert.equal(
      await popup.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `owner detail overflow ${width}`,
    );
    await popup.screenshot({
      path: path.join(output, `group-owner-${width}.png`),
      fullPage: true,
    });
    await popup.close();
    assert.equal(
      await page.getByLabel("Monday range 1 end", { exact: true }).inputValue(),
      "13:00",
    );
    assert.equal(
      await page.getByTestId("operation-audit").textContent(),
      "",
      "opening warning does not save availability",
    );
    await review
      .getByRole("button", { name: "Save availability", exact: true })
      .click();
    await page.getByText("Availability saved.", { exact: false }).waitFor();
    const savedLink = page.getByRole("link", {
      name: "View group session in a new tab",
      exact: true,
    });
    assert.equal(
      await savedLink.getAttribute("href"),
      `/coach/events/${retainedGroupId}`,
    );
    const savedPopup = page.context().waitForEvent("page");
    await savedLink.click();
    const saved = await savedPopup;
    saved.on("pageerror", (error) => errors.push(error.message));
    await saved
      .getByRole("heading", { name: "Retained group session", exact: true })
      .waitFor();
    await saved.close();
    assert.equal(
      await readFile(fixtureStore, "utf8"),
      fixtureBefore,
      "warning navigation performs no group mutation",
    );
  }
  record(
    "desktop/375/430 retained-group links reach the real owner page before/after save in opener-free tabs and preserve the draft/review/private anchors",
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
          "Isolated calendar/editor and actual owner-route UI with explicit account/service fixtures. No database, real Auth or group mutation. DEV0271 supplies separate SQL rollout evidence; real account integration remains pending.",
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
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else {
      server.once("exit", resolve);
      setTimeout(resolve, 5000).unref();
    }
  });
  if (process.env.CALENDAR_UI_KEEP_CHECKOUT === "1")
    console.log(`Kept isolated checkout: ${checkout}`);
  else await rm(checkout, { recursive: true, force: true });
}
