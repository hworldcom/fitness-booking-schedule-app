// MOV-292: actual routes/components/actions with fictional Auth/services, never a DB/provider.
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
import path from "node:path";
import { tmpdir } from "node:os";
import { chromium, expect } from "@playwright/test";
import { returnToVisiblePage } from "./lib/browser-visibility.mjs";
const root = process.cwd(),
  scratch = await mkdtemp(path.join(tmpdir(), "mov292-ui-"));
const dataScratch = await mkdtemp(path.join(tmpdir(), "mov292-data-"));
const output = path.join(root, "test-results/athlete-coaches-ui"),
  base = "http://127.0.0.1:3221",
  checks = [],
  errors = [];
let server,
  browser,
  log = "";
try {
  await mkdir(output, { recursive: true });
  for (const name of [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, name), path.join(scratch, name), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  await rm(path.join(scratch, "src/proxy.ts"));
  await mkdir(path.join(scratch, "src/tests-fixtures"), { recursive: true });
  for (const name of ["coach-athletes-auth.ts", "athlete-coaches-services.ts"])
    await cp(
      path.join(root, "tests/fixtures", name),
      path.join(scratch, "src/tests-fixtures", name),
    );
  await writeFile(
    path.join(scratch, "src/tests-fixtures/roster-controls.tsx"),
    `"use client";import{useEffect,useRef}from"react";import{useAuthSession}from"@/auth/client/session-provider";import{useActor}from"@/auth/client/actor-provider";export function RosterAccountCheck(){const{refreshSession}=useAuthSession(),{refreshActor}=useActor(),latest=useRef(refreshActor);latest.current=refreshActor;useEffect(()=>{(window as any).__mov292AccountCheck=async()=>{await refreshSession();await new Promise(resolve=>setTimeout(resolve,0));await latest.current();};return()=>{delete(window as any).__mov292AccountCheck;};},[refreshSession]);return null;}`,
  );
  for (const name of [
    "src/app/layout.tsx",
    "src/app/api/auth/actor/route.ts",
  ]) {
    const file = path.join(scratch, name);
    await writeFile(
      file,
      (await readFile(file, "utf8")).replaceAll(
        'from "@/server/authorization/service"',
        'from "@/tests-fixtures/coach-athletes-auth"',
      ),
    );
  }
  const layoutFile = path.join(scratch, "src/app/layout.tsx");
  await writeFile(
    layoutFile,
    'import{RosterAccountCheck}from"@/tests-fixtures/roster-controls";\n' +
      (await readFile(layoutFile, "utf8")).replace(
        "<Shell>{children}</Shell>",
        "<RosterAccountCheck/><Shell>{children}</Shell>",
      ),
  );
  await writeFile(
    path.join(scratch, "src/app/api/auth/session/route.ts"),
    'import{initialAuthorizationState}from"@/tests-fixtures/coach-athletes-auth";export async function GET(){return Response.json((await initialAuthorizationState()).session,{headers:{"cache-control":"private, no-store"}})}',
  );
  for (const route of [
    "src/app/api/messages/route.ts",
    "src/app/api/notifications/route.ts",
  ]) {
    await writeFile(
      path.join(scratch, route),
      'export async function GET(){return Response.json({status:"unavailable"},{status:503,headers:{"cache-control":"private, no-store"}})}',
    );
  }
  const rosterFile = path.join(
    scratch,
    "src/features/connections/athlete-coach-roster.tsx",
  );
  await writeFile(
    rosterFile,
    (await readFile(rosterFile, "utf8")).replace(
      "const router = useRouter();",
      "const router = useRouter();useEffect(()=>{(window as any).__mov292RosterReady=true;return()=>{delete(window as any).__mov292RosterReady;};},[]);",
    ),
  );
  for (const name of [
    "src/app/my-coaches/page.tsx",
    "src/app/my-coaches/actions.ts",
    "src/app/connections/actions.ts",
    "src/app/api/connections/pending-count/route.ts",
  ]) {
    const file = path.join(scratch, name);
    await writeFile(
      file,
      (await readFile(file, "utf8"))
        .replaceAll(
          'from "@/server/authorization/page-access"',
          'from "@/tests-fixtures/athlete-coaches-services"',
        )
        .replaceAll(
          'from "@/server/connections/athlete-coaches-service"',
          'from "@/tests-fixtures/athlete-coaches-services"',
        )
        .replaceAll(
          'from "@/server/external-clients/pending-invitation"',
          'from "@/tests-fixtures/athlete-coaches-services"',
        )
        .replaceAll(
          'from "@/server/connections/service"',
          'from "@/tests-fixtures/athlete-coaches-services"',
        ),
    );
  }
  const authFile = path.join(
    scratch,
    "src/tests-fixtures/coach-athletes-auth.ts",
  );
  await writeFile(
    authFile,
    (await readFile(authFile, "utf8")).replace(
      "const { actor } = await fixtureScenario();",
      'const { actor, fault } = await fixtureScenario(); if (fault === "checking") return {session:{status:"unavailable"},actor:{status:"unavailable"}};',
    ),
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|MUX|RESEND|SMTP|CRON|GEOAPIFY|OPENAI|SENTRY|VERCEL/.test(
          key,
        ),
    ),
  );
  env.NEXT_TELEMETRY_DISABLED = "1";
  env.MOV292_UI_STORE = path.join(dataScratch, "store.json");
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3221",
    ],
    { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => (log = (log + data).slice(-24000)));
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base + "/my-coaches")).ok) break;
    } catch {}
    if (n === 99) throw Error(log);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1440, 375, 320]) {
    await rm(env.MOV292_UI_STORE, { force: true });
    const context = await browser.newContext({
        viewport: { width, height: 1000 },
      }),
      page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(90000);
    page.on("pageerror", (error) => errors.push(error.message));
    const cookie = (name, value) =>
      context.addCookies([{ name: `dev0239-${name}`, value, url: base }]);
    const rows = () => page.locator(".coach-athlete-roster-row");
    const nav = () =>
      page.getByRole("navigation", { name: "My coaches sections" });
    const store = async () =>
      JSON.parse(await readFile(env.MOV292_UI_STORE, "utf8"));
    const open = async (href = "/my-coaches") => {
      await page.goto(base + href);
      await expect(
        page.getByRole("heading", {
          name: "My coaches",
          exact: true,
          level: 1,
        }),
      ).toBeVisible();
      if (!href.includes("requests"))
        await page.waitForFunction(() => window.__mov292RosterReady === true);
    };
    const reset = async () => {
      await cookie("actor", "athlete");
      await cookie("fault", "none");
      await rm(env.MOV292_UI_STORE, { force: true });
      await open();
    };
    await reset();
    await expect(rows()).toHaveCount(20);
    await expect(
      nav().getByRole("link", { name: "All coaches", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const workspaceNav = page.getByRole("navigation", {
      name: width > 760 ? "Main navigation" : "Mobile navigation",
      exact: true,
    });
    await expect(
      workspaceNav.getByRole("link", { name: "My coaches", exact: true }),
    ).toHaveText("My coaches");
    await expect(
      page.getByRole("combobox", { name: "Coach status" }).locator("option"),
    ).toHaveText(["All coaches", "Connected", "Not connected"]);
    const group = page.getByRole("article", {
      name: "Nora Group, Not connected",
      exact: true,
    });
    await expect(
      group.getByRole("button", { name: "Connect", exact: true }),
    ).toHaveCount(0);
    await expect(group).toContainText("Next:");
    const hidden = page.getByRole("article", {
      name: "Hidden Coach, Connected",
      exact: true,
    });
    await expect(
      hidden.getByRole("link", { name: "Hidden Coach", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Load more coaches", exact: true })
      .click();
    await expect(rows()).toHaveCount(25);
    assert.equal(new Set(await rows().allTextContents()).size, 25);
    await page
      .getByRole("combobox", { name: "Coach status" })
      .selectOption("connected");
    await expect(rows()).toHaveCount(2);
    await page
      .getByRole("combobox", { name: "Coach status" })
      .selectOption("unconnected");
    await expect(rows()).toHaveCount(20);
    await page
      .getByRole("button", { name: "Load more coaches", exact: true })
      .click();
    await expect(rows()).toHaveCount(23);
    await page.goBack();
    await expect(rows()).toHaveCount(2);
    await page.goForward();
    await expect(
      page.getByRole("combobox", { name: "Coach status" }),
    ).toHaveValue("unconnected");
    await reset();
    await page
      .getByRole("button", { name: "Load more coaches", exact: true })
      .click();
    await expect(rows()).toHaveCount(25);
    const before = (await store()).reads;
    await returnToVisiblePage(page);
    await expect
      .poll(async () => (await store()).reads)
      .toBeGreaterThanOrEqual(before + 2);
    await expect(page.locator(".athlete-coach-roster")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(rows()).toHaveCount(25);
    await cookie("fault", "read-failed");
    await returnToVisiblePage(page);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Coaches could not be refreshed" }),
    ).toBeVisible();
    await expect(rows()).toHaveCount(25);
    await cookie("fault", "none");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(rows()).toHaveCount(25);
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toHaveCount(0);
    checks.push(
      `${width}px labels, default/filter/history URLs, group-only/hidden privacy, paging and loaded-range return/failure recovery`,
    );
    await reset();
    await cookie("fault", "mutation-lost");
    await page
      .getByRole("article", { name: "Alex Morgan, Not connected", exact: true })
      .getByRole("button", { name: "Connect", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Retry same connection action",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Coach status" }),
    ).toBeDisabled();
    await expect(
      nav().getByRole("link", { name: /^Connection requests/ }),
    ).toHaveAttribute("aria-disabled", "true");
    const first = (await store()).commands.at(-1);
    await cookie("fault", "none");
    await page
      .getByRole("button", {
        name: "Retry same connection action",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("article", {
        name: "Alex Morgan, Request sent",
        exact: true,
      }),
    ).toBeVisible();
    assert.deepEqual((await store()).commands.at(-1), first);
    assert.equal(Object.keys((await store()).results).length, 1);
    await expect(
      page.getByRole("combobox", { name: "Coach status" }),
    ).toBeEnabled();
    await reset();
    const maya = () =>
      page.getByRole("article", { name: "Maya Patel, Connected", exact: true });
    await maya().locator("summary").focus();
    await page.keyboard.press("Enter");
    await maya()
      .getByRole("button", { name: "Shared history", exact: true })
      .click();
    await expect(
      maya().getByRole("region", {
        name: "Shared history with Maya Patel",
        exact: true,
      }),
    ).toBeVisible();
    await maya()
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    await expect(
      maya().getByRole("button", { name: "Stay connected", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(maya()).toBeVisible();
    await maya()
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    await maya()
      .getByRole("button", { name: "Confirm disconnect", exact: true })
      .click();
    await expect(
      page.getByRole("article", {
        name: "Maya Patel, Not connected",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("article", { name: "Maya Patel, Not connected", exact: true })
      .getByRole("button", { name: "Reconnect", exact: true })
      .click();
    await expect(
      page.getByRole("article", {
        name: "Maya Patel, Request sent",
        exact: true,
      }),
    ).toBeVisible();
    assert.ok((await store()).commands.at(-1).previousId);
    checks.push(
      `${width}px exact unknown send retry, disabled navigation, shared history, keyboard disconnect cancellation/confirmation and fresh reconnection`,
    );
    await reset();
    await nav()
      .getByRole("link", { name: /^Connection requests/ })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Incoming Coach", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Accept connection", exact: true })
      .click();
    await expect(page.locator(".coach-connection-feedback")).toContainText(
      "Connected.",
    );
    await nav().getByRole("link", { name: "All coaches", exact: true }).click();
    await expect(
      page.getByRole("article", {
        name: "Incoming Coach, Connected",
        exact: true,
      }),
    ).toBeVisible();
    for (const fault of ["pending-invitation", "invitation-unavailable"]) {
      await cookie("fault", fault);
      for (const href of ["/my-coaches", "/my-coaches?section=requests"]) {
        await open(href);
        await expect(
          page.getByRole("complementary", {
            name: "Coach invitation",
            exact: true,
          }),
        ).toBeVisible();
      }
    }
    await cookie("fault", "none");
    for (const actor of ["athlete", "applicant", "suspended"]) {
      await cookie("actor", actor);
      await open();
      await expect(rows()).toHaveCount(20);
    }
    await cookie("actor", "athlete");
    await open();
    await cookie("fault", "slow-read");
    const late = page.waitForResponse(
      (response) => response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Load more coaches", exact: true })
      .click();
    await cookie("fault", "checking");
    await page.evaluate(() => window.__mov292AccountCheck());
    await expect(nav()).toBeHidden();
    await cookie("fault", "none");
    await page.evaluate(() => window.__mov292AccountCheck());
    await expect(nav()).toBeVisible();
    await (await late).finished();
    await expect(rows()).toHaveCount(20);
    for (const actor of ["other", "dataset", "signed-out"]) {
      await cookie("actor", "athlete");
      await open();
      await cookie("fault", "slow-read");
      const late = page.waitForResponse(
        (response) => response.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Load more coaches", exact: true })
        .click();
      await cookie("actor", actor);
      await page.evaluate(() => window.__mov292AccountCheck());
      await expect(nav()).toHaveCount(0);
      await (await late).finished();
      await expect(rows()).toHaveCount(0);
      await cookie("fault", "none");
    }
    checks.push(
      `${width}px request acceptance/count/reminders, coach-as-athlete access and temporary/changed owner late-read fencing`,
    );
    await cookie("actor", "athlete");
    await open();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(output, `${width}-all-coaches.png`),
      fullPage: true,
    });
    await cookie("actor", "signed-out");
    await page.goto(base + "/my-coaches?status=connected");
    const signIn = new URL(
      await page
        .getByRole("link", { name: "Go to sign-in", exact: true })
        .getAttribute("href"),
      base,
    );
    assert.equal(
      signIn.searchParams.get("returnTo"),
      "/my-coaches?status=connected",
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({ checks, errors, passed: true }, null, 2),
  );
  console.log(`PASS ${checks.length} mounted My coaches browser groups`);
} catch (error) {
  await writeFile(
    path.join(output, "failure.json"),
    JSON.stringify({ checks, errors, message: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("close", resolve);
      setTimeout(resolve, 3000);
    });
  }
  await writeFile(path.join(output, "server.log"), log);
  await rm(scratch, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
  await rm(dataScratch, { recursive: true, force: true });
}
