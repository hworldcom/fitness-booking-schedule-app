// Mounted real calendar with explicit Auth/API fixtures. No retained accounts or DB.
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
const expect = baseExpect.configure({ timeout: 30000 }),
  root = process.cwd(),
  scratch = await mkdtemp(path.join(tmpdir(), "mov120-ui-"));
const evidence = path.join(root, "test-results/athlete-training"),
  base = "http://127.0.0.1:3192";
let server,
  browser,
  log = "";
const checks = [],
  errors = [];
try {
  await mkdir(evidence, { recursive: true });
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
      '\nexport default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}',
  );
  await writeFile(
    path.join(scratch, "src/app/sessions/calendar/page.tsx"),
    'import Fixture from "../../../../tests/fixtures/training-calendar-ui";export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){return <Fixture view={(await searchParams).view==="month"?"month":"week"}/>;}',
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
      "3192",
    ],
    {
      cwd: scratch,
      env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (
    const deadline = Date.now() + 90000;
    !log.includes("Ready") && Date.now() < deadline && server.exitCode === null;
  )
    await new Promise((r) => setTimeout(r, 200));
  assert.ok(log.includes("Ready"));
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1440, 375, 320]) {
    const context = await browser.newContext({
        viewport: {
          width,
          height: width === 1440 ? 1000 : width === 375 ? 812 : 700,
        },
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    const items = [],
      requests = [];
    let fail = false;
    let failList = false;
    let remindersEnabled = false;
    let actorChanged = false;
    await context.route("**/api/auth/actor", (r) =>
      r.fulfill({
        json: {
          status: "authorized",
          profile: {
            slug: actorChanged ? "another-athlete" : "fixture",
            displayName: "Training athlete",
            avatarUrl: null,
            coachPortraitUrl: null,
          },
          demoRun: { slug: "mov120", name: "Isolated training fixture" },
          role: "member",
          coachAccessStatus: "not-applied",
        },
      }),
    );
    await context.route("**/api/auth/session", (r) =>
      r.fulfill({
        json: {
          status: "signed-in",
          subject: "12000000-0000-4000-8000-000000000001",
          email: "fixture@example.invalid",
          expiresAt: null,
        },
      }),
    );
    await page.route("**/api/training", async (route) => {
      const body = route.request().postDataJSON(),
        c = body.command;
      requests.push(c);
      if (c.action === "list" && failList) {
        failList = false;
        await route.fulfill({ status: 503, json: { status: "unavailable" } });
        return;
      }
      if (fail) {
        fail = false;
        if (width === 375) {
          await route.abort("failed");
          return;
        }
        await route.fulfill({ status: 503, json: { status: "unavailable" } });
        return;
      }
      // Deliberately small response fixture, not a substitute for SQL rules.
      if (c.action === "save" || c.action === "series") {
        const existing = items.find((i) =>
          c.action === "series"
            ? i.seriesId === c.args.seriesId
            : i.key === c.args.key,
        );
        const startsAt = new Date(c.args.date + "T" + c.args.time + ":00Z");
        const value = {
          key:
            existing?.key ??
            (c.args.weekly
              ? `p:${c.args.commandId}:${c.args.date}`
              : "manual:" + c.args.commandId),
          source: "personal",
          title: c.args.title,
          startsAt: startsAt.toISOString(),
          endsAt: new Date(+startsAt + c.args.minutes * 60000).toISOString(),
          timezone: "UTC",
          state: "planned",
          attendance: c.args.completed ? "attended" : "planned",
          notes: c.args.notes ?? "",
          intensity: c.args.intensity ?? null,
          actualMinutes: c.args.actualMinutes ?? null,
          revision: (existing?.revision ?? 0) + 1,
          seriesId:
            existing?.seriesId ?? (c.args.weekly ? c.args.commandId : null),
          planRevision:
            c.action === "series"
              ? (existing?.planRevision ?? 0) + 1
              : (existing?.planRevision ?? (c.args.weekly ? 1 : null)),
          href: null,
          location: null,
        };
        if (existing) Object.assign(existing, value);
        else items.push(value);
      }
      if (c.action === "attendance") {
        const i = items.find((i) => i.key === c.args.key);
        Object.assign(i, c.args, { revision: i.revision + 1 });
      }
      if (c.action === "preference") remindersEnabled = c.args.enabled;
      const offset = c.args.offset ?? 0;
      await route.fulfill({
        json: {
          status: "ready",
          scope: "mov120:fixture",
          value:
            c.action === "list"
              ? {
                  items: items.slice(offset, offset + 100),
                  next: items.length > offset + 100 ? offset + 100 : null,
                  now: "2026-10-26T12:00:00Z",
                  weekCount: items.filter((i) => i.attendance === "attended")
                    .length,
                  monthCount: items.filter((i) => i.attendance === "attended")
                    .length,
                  remindersEnabled,
                }
              : { saved: true },
        },
      });
    });
    await page.goto(base + "/sessions/calendar");
    await expect(
      page.getByRole("heading", { name: "My training", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Plan training", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Planned minutes")).toHaveValue("60");
    const checkbox = await page
      .getByRole("checkbox", { name: "Repeat weekly" })
      .boundingBox();
    assert.ok(
      checkbox && checkbox.width <= 24,
      "Repeat checkbox must not stretch across the form",
    );
    await page.screenshot({
      path: path.join(evidence, `plan-dialog-${width}.png`),
    });
    await page
      .getByLabel("Activity", { exact: true })
      .fill("Strength and movement");
    await page
      .getByRole("button", { name: "Save training", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Strength and movement" }),
    ).toBeVisible();
    const strength = page.locator(".training-agenda-item").filter({
      has: page.getByRole("heading", {
        name: "Strength and movement",
        exact: true,
      }),
    });
    await strength
      .getByRole("button", { name: "Skipped", exact: true })
      .click();
    await expect(strength.getByText("skipped", { exact: true })).toBeVisible();
    await strength
      .getByRole("button", { name: "Clear attendance", exact: true })
      .click();
    await strength
      .getByRole("button", { name: "Edit workout / log", exact: true })
      .click();
    await page.getByLabel("Planned minutes").fill("90");
    await page.getByText("Optional workout details", { exact: true }).click();
    await page.getByLabel("Actual minutes", { exact: true }).fill("45");
    await page
      .getByRole("combobox", { name: /How did it feel/ })
      .selectOption("Hard");
    await page
      .getByLabel("Personal notes", { exact: true })
      .fill("Private strength note");
    await page
      .getByRole("button", { name: "Save training", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      strength.getByText("Private strength note", { exact: true }),
    ).toBeVisible();
    await expect(
      strength.getByText("Hard · 45 minutes", { exact: true }),
    ).toBeVisible();
    assert.equal(
      requests.filter((c) => c.action === "save").at(-1).args.minutes,
      90,
    );
    assert.ok(requests.filter((c) => c.action === "save").at(-1).args.key);

    await page
      .getByRole("button", { name: "Plan training", exact: true })
      .click();
    await page.getByLabel("Activity", { exact: true }).fill("Weekly mobility");
    await page.getByLabel("Time", { exact: true }).fill("14:00");
    await page.getByLabel("Planned minutes").fill("40");
    await page.getByRole("checkbox", { name: "Repeat weekly" }).check();
    await page
      .getByRole("button", { name: "Save training", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    assert.equal(
      requests.filter((c) => c.action === "save").at(-1).args.weekly,
      true,
    );
    await page
      .getByRole("button", { name: "Edit future series", exact: true })
      .click();
    await expect(
      page.getByText("Changes apply to future, unlogged workouts.", {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .getByLabel("Activity", { exact: true })
      .fill("Weekly mobility revised");
    await page.getByLabel("Planned minutes").fill("50");
    await page
      .getByRole("button", { name: "Save training", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const seriesCommand = requests.findLast((c) => c.action === "series");
    assert.ok(seriesCommand.args.seriesId);
    assert.equal(seriesCommand.args.planRevision, 1);
    const mobility = page.locator(".training-agenda-item").filter({
      has: page.getByRole("heading", {
        name: "Weekly mobility revised",
        exact: true,
      }),
    });
    await mobility
      .getByRole("button", { name: "Edit workout / log", exact: true })
      .click();
    await page
      .getByLabel("Activity", { exact: true })
      .fill("Mobility occurrence only");
    await page
      .getByRole("button", { name: "Save training", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    assert.ok(requests.findLast((c) => c.action === "save").args.key);
    const occurrence = page.locator(".training-agenda-item").filter({
      has: page.getByRole("heading", {
        name: "Mobility occurrence only",
        exact: true,
      }),
    });
    await occurrence
      .getByRole("button", { name: "Cancel workout", exact: true })
      .click();
    await expect(
      occurrence.getByText("cancelled", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Log workout", exact: true })
      .click();
    await page.getByLabel("Activity", { exact: true }).fill("Morning walk");
    await page.getByText("Optional workout details", { exact: true }).click();
    await page.getByLabel("Actual minutes", { exact: true }).fill("30");
    await page
      .getByRole("combobox", { name: /How did it feel/ })
      .selectOption("Moderate");
    await page
      .getByLabel("Personal notes", { exact: true })
      .fill("Private morning note");
    fail = true;
    await page.getByRole("button", { name: "Save completed workout" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    const failed = requests.filter((c) => c.action === "save").at(-1);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Retry last save" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    assert.deepEqual(
      requests.filter((c) => c.action === "save").at(-1),
      failed,
    );
    await expect(
      page.getByText("You confirmed attendance", { exact: false }),
    ).toBeVisible();
    assert.equal(items.filter((i) => i.title === "Morning walk").length, 1);
    await expect(
      page.getByText("Moderate · 30 minutes", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".training-count strong").first()).toHaveText(
      "1",
    );
    const reminder = page.getByRole("checkbox", {
      name: "Email me before training",
    });
    await reminder.click();
    await expect(reminder).toBeChecked();
    assert.equal(
      requests.findLast((c) => c.action === "preference").args.enabled,
      true,
    );
    // A successful write followed by a failed reload must stay recoverable.
    failList = true;
    await reminder.click();
    await expect(page.locator(".training-error")).toBeVisible();
    await expect(page.locator(".training-error")).toContainText("unavailable");
    const preferencesBeforeRefresh = requests.filter(
      (c) => c.action === "preference",
    ).length;
    await page
      .getByRole("button", { name: "Refresh calendar", exact: true })
      .click();
    await expect(reminder).not.toBeChecked();
    await expect(page.locator(".training-error")).toHaveCount(0);
    assert.equal(
      requests.filter((c) => c.action === "preference").length,
      preferencesBeforeRefresh,
      "Reload recovery must not repeat an acknowledged write",
    );
    await expect(
      page.getByRole("button", { name: "Retry last save", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Month", exact: true }).click();
    await expect(page.locator(".training-day")).toHaveCount(42);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      "Month horizontal overflow " + width,
    );
    await page.screenshot({
      path: path.join(evidence, `month-${width}.png`),
      fullPage: true,
    });
    await page.goBack();
    await expect(page.locator(".training-day")).toHaveCount(7);
    await page
      .getByRole("button", { name: "Plan training", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .focus();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Close dialog", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Plan training", exact: true }),
    ).toBeFocused();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      "Horizontal overflow " + width,
    );
    await page.screenshot({
      path: path.join(evidence, `calendar-${width}.png`),
      fullPage: true,
    });
    // Read pagination and source-session presentation share the actual component,
    // while their authority and canonical storage remain separate SQL tests.
    const template = items[0];
    for (const source of ["booking", "group", "request"]) {
      items.push({
        ...template,
        key: source + ":" + crypto.randomUUID(),
        source,
        title: source + " fixture",
        state: source === "booking" ? "completed" : "pending",
        attendance: "planned",
        notes: "",
        intensity: null,
        actualMinutes: null,
        href:
          source === "group" ? "/events/group-fixture" : "/sessions/fixture",
        seriesId: null,
        planRevision: null,
      });
    }
    for (let n = items.length; n < 103; n++)
      items.push({
        ...template,
        key: "page:" + n,
        title: "Paging workout " + n,
        notes: "",
        attendance: "planned",
      });
    await reminder.click();
    await expect(
      page.getByRole("button", { name: "Load more training", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("More training is available in this period.", {
        exact: false,
      }),
    ).toBeVisible();
    failList = true;
    await page
      .getByRole("button", { name: "Load more training", exact: true })
      .click();
    await expect(page.locator(".training-error")).toContainText(
      "Could not load more",
    );
    await expect(page.locator(".training-agenda-item")).toHaveCount(100);
    await page
      .getByRole("button", { name: "Load more training", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Load more training", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".training-error")).toHaveCount(0);
    await expect(page.locator(".training-agenda-item")).toHaveCount(103);
    assert.equal(
      requests.findLast((c) => c.action === "list").args.offset,
      100,
    );
    const booking = page.locator(".training-agenda-item").filter({
      has: page.getByRole("heading", {
        name: "booking fixture",
        exact: true,
      }),
    });
    await expect(booking).toContainText(
      "Coach marked complete · Attendance not recorded",
    );
    await expect(
      booking.getByRole("link", { name: "View booking details" }),
    ).toHaveAttribute("href", "/sessions/fixture");
    await booking
      .getByRole("button", { name: "Edit personal log", exact: true })
      .click();
    await expect(page.getByLabel("Activity", { exact: true })).toHaveCount(0);
    await page.getByText("Optional workout details", { exact: true }).click();
    await page
      .getByLabel("Personal notes", { exact: true })
      .fill("My booking note");
    await page
      .getByRole("button", { name: "Save training", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const bookingLog = requests.findLast((c) => c.action === "attendance");
    assert.equal(bookingLog.args.attendance, "planned");
    await expect(booking).toContainText(
      "Coach marked complete · Attendance not recorded",
    );
    await expect(
      booking.getByText("My booking note", { exact: true }),
    ).toBeVisible();
    const request = page.locator(".training-agenda-item").filter({
      has: page.getByRole("heading", {
        name: "request fixture",
        exact: true,
      }),
    });
    await expect(request.getByRole("button")).toHaveCount(0);
    const group = page.locator(".training-agenda-item").filter({
      has: page.getByRole("heading", { name: "group fixture", exact: true }),
    });
    await expect(
      group.getByRole("link", { name: "View group session" }),
    ).toHaveAttribute("href", "/events/group-fixture");
    actorChanged = true;
    await page.getByRole("button", { name: "Refresh fixture actor" }).click();
    await expect(
      page.getByText("Sign in again to load your training."),
    ).toBeVisible();
    await expect(page.locator(".training-agenda-item")).toHaveCount(0);
    checks.push(
      `${width}px create/default60, checkbox sizing, skip/clear, edit details, weekly/series/occurrence/cancel, completed log/count, exact retry, reminders, failed reload/recovery, week/month/Back, keyboard/focus, pagination103, source logs/links, actor change and overflow`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, "result.json"),
    JSON.stringify({ checks, pageErrors: errors, fixtureOnly: true }, null, 2),
  );
  console.log("PASS " + checks.join("\nPASS "));
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  await writeFile(path.join(evidence, "server.log"), log);
  await rm(scratch, { recursive: true, force: true });
}
