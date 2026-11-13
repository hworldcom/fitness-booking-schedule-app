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

const root = process.cwd(),
  scratch = await mkdtemp(path.join(tmpdir(), "mov225-ui-"));
const evidence = path.join(root, "test-results/google-calendar-ui"),
  port = 3206,
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
  fault = false,
  hold = false,
  release;
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
  await page.route("**/api/account/google-calendar", async (route) => {
    if (hold && route.request().method() === "GET")
      await new Promise((r) => {
        release = r;
      });
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      posts.push(input);
      if (fault)
        return route.fulfill({ status: 503, json: { status: "unavailable" } });
      if (input.action === "disconnect") state = "disconnected";
      else state = "connected";
    }
    await route.fulfill({ json: result() }).catch(() => {});
  });
  await page.route("**/auth/google-calendar/start", async (route) => {
    assert.equal(route.request().method(), "POST");
    assert.equal(
      new URLSearchParams(route.request().postData()).get("generation"),
      generation,
    );
    await route.fulfill({
      status: 303,
      headers: { location: `${base}/calendar-fixture?calendar=denied` },
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
    await page
      .getByRole("button", { name: "Check connection", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check connection", exact: true }),
    ).toBeEnabled();
    await page.getByText("Disconnect Google Calendar", { exact: true }).focus();
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
