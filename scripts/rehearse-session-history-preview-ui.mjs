// Explicit isolated presentation fixtures. Real local preview uses authorized data.
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
import { chromium, expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 25000 });
const root = process.cwd(),
  scratch = await mkdtemp(path.join(tmpdir(), "mov156-ui-"));
const output = path.join(root, "test-results/session-history-preview"),
  base = "http://127.0.0.1:3195";
const checks = [],
  errors = [];
const widthArgument = process.argv[2];
assert.ok(
  process.argv.length <= 3 &&
    (!widthArgument || /^--width=(1440|430|375|320)$/.test(widthArgument)),
  "Use an optional --width=1440|430|375|320.",
);
const widths = widthArgument
  ? [Number(widthArgument.slice(8))]
  : [1440, 430, 375, 320];
let server,
  browser,
  log = "";
try {
  await mkdir(output, { recursive: true });
  for (const f of [
    "src",
    "tests",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, f), path.join(scratch, f), { recursive: true });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  const imports = (await readFile("src/app/layout.tsx", "utf8"))
    .split("\n")
    .filter((l) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(l));
  await writeFile(
    path.join(scratch, "src/app/layout.tsx"),
    imports.join("\n") +
      `
import {HistoryFixtureProviders} from "../../tests/fixtures/session-history-ui";
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><HistoryFixtureProviders>{children}</HistoryFixtureProviders></body></html>;}`,
  );
  await rm(path.join(scratch, "src/proxy.ts"));
  await writeFile(
    path.join(scratch, "src/app/sessions/preview/page.tsx"),
    `import Fixture from "../../../../tests/fixtures/session-history-ui";import "@/features/profile/session-history-preview.css";
export default async function Page({searchParams}:{searchParams:Promise<{view?:string;empty?:string;unavailable?:string}>}){return <Fixture {...await searchParams}/>;}`,
  );
  const apiDir = path.join(scratch, "src/app/api/session-notes");
  await writeFile(
    path.join(apiDir, "route.ts"),
    `export {notesResponse as POST} from "../../../../tests/fixtures/session-notes-preview-api";`,
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) =>
        !/(DATABASE|SUPABASE|SITE_URL|MUX|RESEND|NOTIFICATION|CRON_SECRET|GEOAPIFY|AUTH|VERCEL|NEXT_PUBLIC|SMTP)/.test(
          k,
        ),
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
      "3195",
    ],
    {
      cwd: scratch,
      env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  await writeFile(
    path.join(output, "recovery.json"),
    JSON.stringify(
      { scratch, pid: server.pid, port: 3195, fixtureOnly: true },
      null,
      2,
    ),
  );
  for (
    const deadline = Date.now() + 90000;
    !log.includes("Ready") && Date.now() < deadline && server.exitCode === null;
  )
    await new Promise((r) => setTimeout(r, 200));
  assert.ok(log.includes("Ready"), log.slice(-2000));
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1050 : 850 },
    });
    await context.addCookies([
      { name: "notes_preview_role", value: "athlete", url: base },
    ]);
    let foreign = false,
      failed = false;
    const actor = {
      status: "authorized",
      profile: {
        slug: "athlete",
        displayName: "Fictional Athlete",
        avatarUrl: null,
        coachPortraitUrl: null,
      },
      demoRun: { slug: "notes-preview", name: "Fictional test" },
      role: "member",
      coachAccessStatus: "not-applied",
    };
    await context.route("**/api/auth/actor", (r) =>
      r.fulfill({
        json: foreign
          ? { ...actor, profile: { ...actor.profile, slug: "other-athlete" } }
          : actor,
      }),
    );
    await context.route("**/api/auth/session", (r) =>
      r.fulfill({
        json: {
          status: "signed-in",
          subject: foreign ? "foreign-fixture" : "history-fixture",
          email: "fictional@example.invalid",
          expiresAt: null,
        },
      }),
    );
    await context.route("**/api/session-bookings?*", (r) =>
      r.fulfill({
        json: failed
          ? { status: "unavailable" }
          : {
              status: "ready",
              detail: {
                bookingId: "15000000-0000-4000-8000-000000000001",
                revision: 1,
                status: "confirmed",
                startsAt: "2026-10-31T10:00:00Z",
                endsAt: "2026-10-31T11:00:00Z",
                locationId: "25000000-0000-4000-8000-000000000001",
                venueName: "Training hall",
                sessionType: null,
                athleteId: "45000000-0000-4000-8000-000000000001",
                viewerIsCoach: false,
                historyTotal: 0,
                nextHistoryRevision: null,
                changes: [],
              },
            },
      }),
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/sessions/preview");
    await expect(
      page.getByRole("link", { name: "Past sessions 3", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".history-preview-card")).toHaveCount(3);
    await expect(
      page.getByText("Request-only Coach", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".history-preview-card h4")).toHaveText([
      "Practice 4",
      "Practice 1",
      "Practice 2",
    ]);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(output, `past-${width}.png`),
      fullPage: true,
    });
    const notes = page
      .getByRole("link", { name: /Session & notes with/ })
      .nth(1);
    await notes.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      /\/sessions\/preview\/15000000-0000-4000-8000-000000000001\?view=past$/,
    );
    await expect(
      page.getByRole("region", { name: "Session notes and videos" }),
    ).toBeVisible();
    await expect(
      page.getByText("My private notes", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "← My training", exact: true }),
    ).toHaveAttribute("href", "/sessions/preview?view=past");
    await page
      .getByRole("link", { name: "← My training", exact: true })
      .click();
    await expect(page).toHaveURL(/\/sessions\/preview\?view=past$/);
    await expect(
      page.getByRole("heading", { name: "Past sessions", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Upcoming 2", exact: true }).click();
    await expect(page).toHaveURL(/\/sessions\/preview\?view=upcoming$/);
    await expect(page.locator(".history-preview-card h4")).toHaveText([
      "Practice 5",
      "Practice 3",
    ]);
    await page.reload();
    await expect(page).toHaveURL(/\/sessions\/preview\?view=upcoming$/);
    await expect(page.locator(".history-preview-card")).toHaveCount(2);
    await page.goBack();
    await expect(page).toHaveURL(/\/sessions\/preview\?view=past$/);
    await expect(
      page.getByRole("heading", { name: "Past sessions", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Booking requests", exact: true })
      .click();
    await expect(
      page.getByText("Request-only Coach", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".history-preview-card")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Open all request history" }),
    ).toHaveAttribute("href", "/sessions#booking-requests");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(output, `requests-${width}.png`),
      fullPage: true,
    });
    for (const view of ["past", "upcoming", "requests"]) {
      await page.goto(`${base}/sessions/preview?view=${view}&empty=1`);
      await expect(page.locator(".history-preview-empty")).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    await page.goto(base + "/sessions/preview?unavailable=1");
    await expect(page.getByText("Practice 1", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("alert").filter({
        has: page.getByRole("heading", {
          name: "We couldn’t verify access right now.",
          exact: true,
        }),
      }),
    ).toBeVisible();
    await page.goto(base + "/sessions/preview?view=past");
    failed = true;
    await page
      .getByRole("link", { name: /Session & notes with/ })
      .nth(1)
      .click();
    await expect(
      page.getByText(
        "This session could not be verified for your account. Reload to try again.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Session notes and videos" }),
    ).toHaveCount(0);
    failed = false;
    await page.goto(base + "/sessions/15000000-0000-4000-8000-000000000001");
    await expect(
      page.getByRole("region", { name: "Session notes and videos" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "← My training", exact: true }),
    ).toHaveAttribute("href", "/sessions");
    await page.goto(base + "/sessions/preview?view=past");
    foreign = true;
    await page.getByRole("button", { name: "Change test actor" }).click();
    await expect(
      page.getByText("Verifying your training history…"),
    ).toBeVisible();
    await expect(page.getByText("Practice 1", { exact: true })).toHaveCount(0);
    checks.push(
      `${width}px: past/upcoming/request separation, exact notes destination/return, keyboard, reload/Back, empty/error and actor concealment`,
    );
    console.log("PASS " + checks.at(-1));
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(
      output,
      widthArgument ? `results-${widths[0]}.json` : "results.json",
    ),
    JSON.stringify(
      { success: true, checks, errors, fixtureOnly: true },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  await writeFile(path.join(output, "server.log"), log);
  await rm(scratch, { recursive: true, force: true });
}
