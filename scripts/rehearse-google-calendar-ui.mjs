// MOV-225: mounted connection UI with explicit Auth/API fixtures. No real grant,
// database, environment files, retained account or Google calendar is used.
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
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { rehearseCalendarExport } from "./lib/google-calendar-export-ui.mjs";

const exportMode = process.argv.includes("--export");
const root = process.cwd(),
  scratch = await mkdtemp(
    path.join(tmpdir(), exportMode ? "mov226-ui-" : "mov225-ui-"),
  );
const evidence = path.join(
    root,
    exportMode
      ? "test-results/google-calendar-export-ui"
      : "test-results/google-calendar-ui",
  ),
  port = exportMode ? 3207 : 3206,
  base = `http://localhost:${port}`;
let server,
  browser,
  log = "";
const checks = [],
  errors = [];
const actor = {
  status: "authorized",
  profile: {
    slug: "calendar-owner",
    displayName: "Calendar Owner",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "calendar-fixture", name: "Disposable Calendar Fixture" },
  role: "member",
  coachAccessStatus: "approved",
};
const session = {
  status: "signed-in",
  subject: "11111111-1111-4111-8111-111111111111",
  email: "fixture@example.test",
  expiresAt: 4102444800,
};
const generation = "22222222-2222-4222-8222-222222222222";
let state = "disconnected",
  enabled = true,
  authorizationStarts = 0,
  fault = false,
  deletionFault = false,
  hold = false,
  release;
let setupAvailable = false,
  setupSync = false,
  setupFault = false,
  setupOutcome = "denied",
  holdExport = false,
  releaseExport;
const setupForms = [];
const posts = [];
const result = () => ({
  status: "ready",
  enabled,
  connection: {
    state,
    generation,
    email:
      state === "disconnected"
        ? null
        : "calendar.owner.with.a.long.address@example.test",
    calendarId:
      state === "connected" ? "fixture@group.calendar.google.com" : null,
    checkedAt: state === "connected" ? "2026-11-11T20:00:00Z" : null,
  },
});
function pass(text) {
  checks.push(text);
  console.log(`PASS ${text}`);
}
async function showDisconnect(page, choice = "keep") {
  const section = page.locator(".calendar-disconnect");
  if ((await section.getAttribute("open")) === null)
    await section.locator("summary").click();
  await page
    .getByRole("radio", {
      name:
        choice === "delete"
          ? "Disconnect and delete calendar"
          : "Just disconnect",
      exact: true,
    })
    .check();
}

try {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "localhost", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
  await mkdir(evidence, { recursive: true });
  for (const file of [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
    "next.config.ts",
  ])
    await cp(path.join(root, file), path.join(scratch, file), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  const styles = (await readFile("src/app/layout.tsx", "utf8"))
    .split("\n")
    .filter((l) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(l));
  await writeFile(
    path.join(scratch, "src/app/layout.tsx"),
    `${styles.join("\n")}\nexport default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}`,
  );
  await mkdir(path.join(scratch, "src/app/calendar-fixture"), {
    recursive: true,
  });
  await writeFile(
    path.join(scratch, "src/app/calendar-fixture/controls.tsx"),
    `"use client";
import {useState} from "react";
import {AuthSessionProvider} from "@/auth/client/session-provider";
import {ActorProvider} from "@/auth/client/actor-provider";
import {AccountSettingsView} from "@/features/account/account-settings";
import {GoogleCalendarConnection} from "@/features/account/google-calendar-connection";
export function Controls({notice}:{notice?:string}) {const [out,setOut]=useState(false);return <>
<button onClick={()=>setOut(true)}>Sign out fixture</button>
<AuthSessionProvider key={String(out)} initialSession={out?{status:"signed-out"}:${JSON.stringify(session)} as const}>
<ActorProvider initialActor={out?{status:"signed-out"}:${JSON.stringify(actor)} as const}>
<AccountSettingsView email="fixture@example.test" section="connected-calendars" calendarSettings={<GoogleCalendarConnection notice={notice}/>}/>
</ActorProvider></AuthSessionProvider></>;}`,
  );
  await writeFile(
    path.join(scratch, "src/app/calendar-fixture/page.tsx"),
    `import {Controls} from "./controls";export default async function Page({searchParams}:{searchParams:Promise<{calendar?:string}>}){return <Controls notice={(await searchParams).calendar}/>;}`,
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) =>
        !/DATABASE|SUPABASE|MOVX|AUTH|NEXT_PUBLIC|VERCEL|MUX|RESEND|SMTP|NOTIFICATION|CRON_SECRET|GEOAPIFY/.test(
          k,
        ),
    ),
  );
  env.NEXT_TELEMETRY_DISABLED = "1";
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "localhost",
      "--port",
      String(port),
    ],
    { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => {
      log += String(chunk);
    });
  for (let n = 0; ; n++) {
    if (server.exitCode !== null)
      throw Error(`Fixture server exited: ${log.slice(-2000)}`);
    try {
      const response = await fetch(`${base}/calendar-fixture`);
      if (response.ok) break;
    } catch {}
    if (n > 100) throw Error(`Fixture server unavailable: ${log.slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/auth/actor", (route) =>
    route.fulfill({ json: actor }),
  );
  await page.route("**/api/account/google-calendar/export", async (route) => {
    assert.equal(
      route.request().method(),
      "GET",
      "initial setup never posts an unbound client enable",
    );
    if (holdExport)
      await new Promise((resolve) => {
        releaseExport = resolve;
      });
    if (setupFault)
      return route.fulfill({ status: 503, json: { status: "unavailable" } });
    return route.fulfill({
      json: {
        status: "ready",
        available: setupAvailable,
        generation,
        connectionState: state,
        export: {
          enabled: setupSync,
          version: generation,
          backfillPending: setupSync,
          pending: 0,
          failed: 0,
          missing: 0,
          issues: [],
          lastSyncedAt: null,
        },
      },
    });
  });
  await page.route("**/api/account/google-calendar", async (route) => {
    if (hold && route.request().method() === "GET")
      await new Promise((r) => {
        release = r;
      });
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      posts.push(input);
      if (input.action === "delete" && deletionFault) {
        state = "recovery-required";
        return route.fulfill({
          status: 503,
          json: { status: "delete-uncertain" },
        });
      }
      if (fault)
        return route.fulfill({ status: 503, json: { status: "unavailable" } });
      if (input.action === "disconnect" || input.action === "delete")
        state = "disconnected";
      else state = "connected";
    }
    await route.fulfill({ json: result() }).catch(() => {});
  });
  await page.route("**/auth/google-calendar/start", async (route) => {
    authorizationStarts++;
    assert.equal(route.request().method(), "POST");
    assert.equal(
      new URLSearchParams(route.request().postData()).get("generation"),
      generation,
    );
    const form = new URLSearchParams(route.request().postData());
    setupForms.push(Object.fromEntries(form));
    assert.deepEqual(
      [...form.keys()].sort(),
      form.has("intent") ? ["generation", "intent"] : ["generation"],
    );
    if (setupOutcome !== "denied") state = "connected";
    if (setupOutcome === "connected-sync-enabled") setupSync = true;
    await route.fulfill({
      status: 303,
      headers: {
        location: `${base}/calendar-fixture?calendar=${setupOutcome}`,
      },
    });
  });
  const open = () => page.goto(`${base}/calendar-fixture`);
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    state = "disconnected";
    enabled = true;
    fault = false;
    await open();
    await expect(
      page.getByRole("button", {
        name: "Connect Google Calendar",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("On Google’s permission screen, allow access", {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Connect Google Calendar", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Calendar permission was not granted.", { exact: false }),
    ).toBeVisible();
    assert.ok(!page.url().includes("code="));
    state = "connected";
    await open();
    await expect(
      page.getByText("Calendar: MovX.", { exact: false }),
    ).toBeVisible();
    for (const name of ["Reload connection status", "Check connection"]) {
      const style = await page
        .getByRole("button", { name, exact: true })
        .evaluate((button) => {
          const css = getComputedStyle(button);
          return {
            height: button.getBoundingClientRect().height,
            background: css.backgroundColor,
            border: Number.parseFloat(css.borderTopWidth),
            borderStyle: css.borderTopStyle,
            color: css.color,
          };
        });
      assert.ok(style.height >= 44, `${name} needs a mobile touch target`);
      assert.ok(
        style.border >= 1 && style.borderStyle !== "none",
        `${name} needs a visible border`,
      );
      assert.notEqual(style.background, "rgba(0, 0, 0, 0)");
      const luminance = (color) => {
        const rgb = color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const values = [luminance(style.background), luminance(style.color)].sort(
        (a, b) => b - a,
      );
      assert.ok(
        (values[0] + 0.05) / (values[1] + 0.05) >= 4.5,
        `${name} text needs readable contrast`,
      );
    }
    await expect(page.locator(".calendar-disconnect > summary")).toHaveCount(1);
    const order = await page
      .getByRole("region", { name: "Google booking sync" })
      .evaluate((sync) => {
        const actions = document.querySelector(".calendar-connection-actions"),
          disconnect = document.querySelector(".calendar-disconnect");
        return (
          !!(
            actions.compareDocumentPosition(sync) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ) &&
          !!(
            sync.compareDocumentPosition(disconnect) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
        );
      });
    assert.equal(
      order,
      true,
      "Booking sync must follow connection actions and precede disconnection",
    );
    const beforeReload = posts.length;
    await page
      .getByRole("button", { name: "Reload connection status", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check connection", exact: true }),
    ).toBeVisible();
    assert.equal(posts.length, beforeReload, "Reload must remain read-only");
    await page.screenshot({
      path: path.join(evidence, `connected-settings-${width}.png`),
      fullPage: true,
    });
    pass(
      `${width}px: visible bordered status buttons, touch size/contrast, read-only reload and connection/sync/disconnect order`,
    );
    await page
      .getByRole("button", { name: "Check connection", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check connection", exact: true }),
    ).toBeEnabled();
    await page.getByText("Disconnect calendar", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Confirm disconnect" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm disconnect" }).click();
    await expect(
      page.getByRole("button", {
        name: "Connect Google Calendar",
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    pass(
      `${width}px: connect/denial, checked connection, keyboard disconnect and no overflow`,
    );
    state = "connected";
    await open();
    await page.getByText("Disconnect calendar", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("radio", { name: "Just disconnect", exact: true })
      .focus();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("radio", {
        name: "Disconnect and delete calendar",
        exact: true,
      }),
    ).toBeChecked();
    const deleteButton = page.getByRole("button", {
      name: "Confirm disconnect and delete calendar",
      exact: true,
    });
    await expect(deleteButton).toBeDisabled();
    const beforeDelete = posts.length;
    await page
      .getByRole("checkbox", {
        name: "I want to permanently delete this MovX calendar and all its events.",
        exact: true,
      })
      .focus();
    await page.keyboard.press("Space");
    await expect(deleteButton).toBeEnabled();
    assert.equal(
      posts.length,
      beforeDelete,
      "opening/confirming the explanation sends no delete",
    );
    await page
      .getByRole("radio", { name: "Just disconnect", exact: true })
      .check();
    await page
      .getByRole("radio", {
        name: "Disconnect and delete calendar",
        exact: true,
      })
      .check();
    const deleteAcknowledgement = page.getByRole("checkbox", {
      name: "I want to permanently delete this MovX calendar and all its events.",
      exact: true,
    });
    await expect(deleteAcknowledgement).not.toBeChecked();
    await expect(deleteButton).toBeDisabled();
    await deleteAcknowledgement.check();

    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page
      .locator("details")
      .filter({
        has: page.getByText("Disconnect and delete calendar", { exact: true }),
      })
      .screenshot({ path: path.join(evidence, `delete-confirm-${width}.png`) });
    await deleteButton.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Google calendar deleted. MovX is disconnected.", {
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(posts.length, beforeDelete + 1);
    assert.deepEqual(Object.keys(posts.at(-1)).sort(), [
      "action",
      "commandId",
      "generation",
    ]);
    assert.equal(posts.at(-1).action, "delete");
    pass(
      `${width}px: explicit permanent-delete confirmation, keyboard action and target-free request`,
    );
    state = "connected";
    deletionFault = true;
    await open();
    await showDisconnect(page, "delete");
    await page
      .getByRole("checkbox", {
        name: "I want to permanently delete this MovX calendar and all its events.",
        exact: true,
      })
      .check();
    await deleteButton.click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Google calendar deletion" }),
    ).toContainText("deletion could not be confirmed");
    const afterUncertain = posts.length;
    await expect(
      page.getByText("Google calendar deleted. MovX is disconnected.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Reload connection status", exact: true })
      .click();
    await expect(
      page.getByText("Calendar recovery required", { exact: true }),
    ).toBeVisible();
    assert.equal(
      posts.length,
      afterUncertain,
      "uncertainty/reload never automatically retries deletion",
    );
    await expect(
      page.getByText("Google calendar deleted. MovX is disconnected.", {
        exact: true,
      }),
    ).toHaveCount(0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    deletionFault = false;
    pass(
      `${width}px: unknown delete outcome gives recovery guidance without false success or automatic retry`,
    );
    for (const previousState of ["connected", "reconnect-required"]) {
      state = previousState;
      const beforeMismatch = posts.length;
      const beforeAuthorization = authorizationStarts;
      await page.goto(`${base}/calendar-fixture?calendar=account-mismatch`);
      const warning = page.getByRole("alert", {
        name: "Different Google account selected",
        exact: true,
      });
      await expect(warning).toBeVisible();
      await expect(warning).toBeFocused();
      await expect(warning).toContainText(
        "Your existing calendar connection was not changed.",
      );
      await expect(warning).toContainText(
        "disconnect first, then connect again",
      );
      await expect(
        page.getByText(
          previousState === "connected" ? "Connected" : "Reconnect required",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Google account: calendar.owner.with.a.long.address@example.test",
          { exact: true },
        ),
      ).toBeVisible();
      await expect
        .poll(async () =>
          warning.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return box.top >= 0 && box.bottom <= innerHeight;
          }),
        )
        .toBe(true);
      assert.equal(
        posts.length,
        beforeMismatch,
        "account warning must not mutate the preserved connection",
      );
      assert.equal(
        authorizationStarts,
        beforeAuthorization,
        "account warning must not automatically repeat authorization",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      if (previousState === "connected")
        await warning.screenshot({
          path: path.join(evidence, `account-mismatch-${width}.png`),
        });
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", {
          name: "How MovX uses Google Calendar data",
          exact: true,
        }),
      ).toBeFocused();
    }
    pass(
      `${width}px: focused account-mismatch warning, preserved identity/truthful status and keyboard continuation without automatic writes`,
    );
    for (const previousState of ["disconnected", "reconnect-required"]) {
      state = previousState;
      const startCount = posts.length;
      const authorizationCount = authorizationStarts;
      await page.goto(`${base}/calendar-fixture?calendar=permission-required`);
      await expect(
        page.getByText("Google Calendar permission was not granted.", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Your previous connection settings are unchanged.", {
          exact: false,
        }),
      ).toBeVisible();
      const retry = page.getByRole("button", {
        name:
          previousState === "disconnected"
            ? "Connect Google Calendar"
            : "Reconnect Google Calendar",
        exact: true,
      });
      await expect(retry).toBeVisible();
      assert.ok(page.url().includes("calendar=permission-required"));
      assert.equal(
        posts.length,
        startCount,
        "no automatic command on partial consent",
      );
      assert.equal(authorizationStarts, authorizationCount);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      if (previousState === "reconnect-required")
        await page.screenshot({
          path: path.join(evidence, `permission-${width}.png`),
          fullPage: true,
        });
      await retry.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByText("Calendar permission was not granted.", {
          exact: false,
        }),
      ).toBeVisible();
      assert.equal(authorizationStarts, authorizationCount + 1);
    }
    pass(
      `${width}px: partial-consent guidance, truthful prior status and user-initiated keyboard retry`,
    );
    state = "recovery-required";
    await open();
    const replace = page.getByRole("button", {
      name: "Create replacement calendar",
    });
    await expect(replace).toBeDisabled();
    await page
      .getByLabel("I checked Google Calendar", { exact: false })
      .check();
    await replace.click();
    await expect(
      page.getByText("Calendar: MovX.", { exact: false }),
    ).toBeVisible();
    const command = posts.at(-1);
    assert.equal(command.action, "replace");
    assert.match(command.commandId, /^[a-f0-9-]{36}$/);
    state = "recovery-required";
    await open();
    await page
      .getByLabel("Existing MovX calendar ID")
      .fill("recovered@group.calendar.google.com");
    await page
      .getByRole("button", { name: "Recover existing calendar" })
      .click();
    await expect(
      page.getByText("Calendar: MovX.", { exact: false }),
    ).toBeVisible();
    assert.equal(posts.at(-1).action, "recover");
    state = "recovery-required";
    await open();
    await expect(replace).toBeDisabled();
    await page.screenshot({
      path: path.join(evidence, `recovery-${width}.png`),
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    pass(
      `${width}px: explicit recovery/replacement, stable command identifier and readable long content`,
    );
  }
  enabled = false;
  state = "disconnected";
  await open();
  await expect(
    page.getByText("Google Calendar connection is unavailable right now.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Google Calendar", exact: true }),
  ).toHaveCount(0);
  pass("Feature-disabled state offers no false connection action");
  state = "connected";
  await open();
  await showDisconnect(page);
  await expect(
    page.getByRole("radio", {
      name: "Disconnect and delete calendar",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Confirm disconnect and delete calendar",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Confirm disconnect", exact: true }),
  ).toBeEnabled();
  pass(
    "Feature-disabled state preserves ordinary disconnect and disables deletion",
  );
  enabled = true;
  state = "connected";
  fault = true;
  await open();
  await page
    .getByRole("button", { name: "Check connection", exact: true })
    .click();
  await expect(
    page.getByText("We couldn’t verify your calendar connection.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check connection", exact: true }),
  ).toHaveCount(0);
  fault = false;
  await page.getByRole("button", { name: "Reload connection status" }).click();
  await expect(
    page.getByRole("button", { name: "Check connection", exact: true }),
  ).toBeVisible();
  pass(
    "Uncertain/error response requires read-only status reload before another mutation",
  );
  // These are controlled callback/status fixtures, not real Google acceptance.
  setupAvailable = true;
  const setupButton = page.getByRole("button", {
    name: "Connect & sync Google Calendar",
    exact: true,
  });
  const syncRegion = page.getByRole("region", { name: "Google booking sync" });
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    state = "disconnected";
    setupSync = false;
    setupOutcome = "denied";
    await open();
    await expect(setupButton).toBeEnabled();
    await expect(
      syncRegion.getByRole("checkbox", {
        name: "Sync confirmed bookings",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Connect and automatically sync your upcoming confirmed bookings",
        { exact: false },
      ),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(evidence, `combined-setup-${width}.png`),
      fullPage: true,
    });
    await setupButton.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Calendar permission was not granted.", { exact: false }),
    ).toBeVisible();
    assert.deepEqual(setupForms.at(-1), { generation, intent: "sync" });
    assert.equal(setupSync, false);
    setupOutcome = "connected-sync-enabled";
    await setupButton.click();
    await expect(
      page.getByText("Google Calendar connected. Booking sync is on.", {
        exact: false,
      }),
    ).toBeVisible();
    const toggle = syncRegion.getByRole("checkbox", {
      name: "Sync confirmed bookings",
      exact: true,
    });
    await expect(toggle).toBeChecked();
    await expect(
      syncRegion.getByText("Finding upcoming confirmed bookings…", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      syncRegion.getByText(
        "Update counts will be available after preparation.",
      ),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(evidence, `combined-connected-${width}.png`),
      fullPage: true,
    });
    setupSync = false;
    setupOutcome = "connected";
    await open();
    await expect(toggle).not.toBeChecked();
    await page
      .getByRole("button", { name: "Reconnect Google Calendar", exact: true })
      .click();
    await expect(toggle).not.toBeChecked();
    assert.deepEqual(setupForms.at(-1), { generation });
    pass(
      `${width}px: explicit combined setup/denial, server callback opt-in, truthful preparation, keyboard/mobile and paused reconnect`,
    );
  }
  state = "disconnected";
  setupSync = false;
  holdExport = true;
  await open();
  await expect(setupButton).toBeDisabled();
  await expect(syncRegion.getByText("Loading booking sync…")).toBeVisible();
  holdExport = false;
  setupFault = true;
  releaseExport?.();
  await expect(
    syncRegion.getByText("Booking sync is unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(setupButton).toBeDisabled();
  setupFault = false;
  await syncRegion
    .getByRole("button", { name: "Reload booking sync", exact: true })
    .click();
  await expect(setupButton).toBeEnabled();
  pass(
    "Unknown/failed export status cannot imply connect-only availability; read-only reload restores setup",
  );
  for (const outcome of ["sync-setup-incomplete", "sync-settings-changed"]) {
    state = "disconnected";
    setupSync = false;
    setupOutcome = outcome;
    await open();
    await setupButton.click();
    await expect(
      syncRegion.getByRole("checkbox", {
        name: "Sync confirmed bookings",
        exact: true,
      }),
    ).not.toBeChecked();
    await expect(
      page.getByText(
        outcome === "sync-setup-incomplete"
          ? "Booking sync setup could not be confirmed."
          : "Your calendar or booking sync settings changed during setup.",
        { exact: false },
      ),
    ).toBeVisible();
  }
  pass(
    "Partial setup and newer settings are visible without automatic client enable or false delivered success",
  );
  setupAvailable = false;
  setupSync = false;
  setupOutcome = "denied";
  state = "connected";
  hold = true;
  await open();
  await page.getByRole("button", { name: "Sign out fixture" }).click();
  await expect(
    page.getByText("Verify your account to manage calendar connections."),
  ).toBeVisible();
  hold = false;
  release?.();
  await expect(
    page.getByText("calendar.owner.with.a.long.address@example.test", {
      exact: false,
    }),
  ).toHaveCount(0);
  pass("Account loss clears protected connection and ignores late reads");
  if (exportMode) {
    state = "connected";
    fault = false;
    await rehearseCalendarExport({
      page,
      base,
      evidence,
      generation,
      pass,
      setState: (next) => {
        state = next;
      },
    });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, "checks.json"),
    JSON.stringify(
      { checks, errors, posts: posts.map((p) => ({ action: p.action })) },
      null,
      2,
    ),
  );
} catch (error) {
  await mkdir(evidence, { recursive: true });
  await writeFile(path.join(evidence, "fixture.log"), log);
  throw error;
} finally {
  release?.();
  releaseExport?.();
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 5000);
    });
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(scratch, { recursive: true, force: true });
}
