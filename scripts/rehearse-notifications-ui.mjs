// MOV-81: actual shared headers/controller, isolated Auth/API fixtures only.
// No environment files, real accounts, databases or external delivery.
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
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";

const root = process.cwd(),
  checkout = await mkdtemp(path.join(tmpdir(), "mov81-notifications-ui-"));
const output = path.join(root, "test-results/notifications");
const base = "http://127.0.0.1:3168";
let server,
  browser,
  log = "";
try {
  for (const name of [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, name), path.join(checkout, name), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(checkout, "node_modules"),
    "dir",
  );
  await mkdir(output, { recursive: true });
  await mkdir(path.join(checkout, "src/tests-fixtures"), { recursive: true });
  const auth = await readFile(
    path.join(root, "tests/fixtures/coach-events-auth.ts"),
    "utf8",
  );
  await writeFile(
    path.join(checkout, "src/tests-fixtures/notification-auth.ts"),
    auth.replaceAll("dev0239-actor", "mov81-actor"),
  );
  for (const file of [
    "src/app/layout.tsx",
    "src/app/api/auth/actor/route.ts",
  ]) {
    const target = path.join(checkout, file);
    await writeFile(
      target,
      (await readFile(target, "utf8")).replace(
        'from "@/server/authorization/service"',
        'from "@/tests-fixtures/notification-auth"',
      ),
    );
  }
  await writeFile(
    path.join(checkout, "src/app/api/auth/session/route.ts"),
    `import {initialAuthorizationState} from "@/tests-fixtures/notification-auth";
     export async function GET(){return Response.json((await initialAuthorizationState()).session,{headers:{"cache-control":"private, no-store"}})}`,
  );
  await writeFile(
    path.join(checkout, "src/tests-fixtures/controls.tsx"),
    `"use client";
    import {useActor} from "@/auth/client/actor-provider";
    export function Controls(){const {refreshActor}=useActor();return <button onClick={()=>{document.cookie="mov81-actor=other; path=/";void refreshActor();}}>Switch fixture actor</button>}`,
  );
  for (const route of ["explore", "coach", "messages", "account", "profile"]) {
    await writeFile(
      path.join(checkout, `src/app/${route}/page.tsx`),
      `import {Controls} from "@/tests-fixtures/controls";export default function Fixture(){return <><h1>Explicit notification UI fixture</h1><p>No real Auth, database writes or email.</p><Controls/></>}`,
    );
  }
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|RESEND|NOTIFICATION|CRON_SECRET/.test(
          key,
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
      "127.0.0.1",
      "--port",
      "3168",
    ],
    { cwd: checkout, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => {
      log = (log + data.toString()).slice(-20000);
    });
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw Error(`Fixture exited: ${log.slice(-2500)}`);
    try {
      if ((await fetch(base + "/explore")).ok) break;
    } catch {}
    if (i === 119) throw Error(`Fixture unavailable: ${log.slice(-2500)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  let items = Array.from({ length: 23 }, (_, i) => ({
    id: randomUUID(),
    conversationId: randomUUID(),
    senderName: `Coach ${String(i + 1).padStart(2, "0")}`,
    createdAt: new Date(Date.now() - i * 60000 - 1000).toISOString(),
    readAt: null,
  }));
  const reads = [],
    writes = [];
  let failReads = false,
    failWrites = false,
    holdNext = false,
    releaseOld;
  await page.route("**/api/messages?*", (route) =>
    route.fulfill({
      json: { status: "ready", value: { items: [], unreadCount: 0 } },
    }),
  );
  await page.route("**/api/notifications?*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const other = request.headers().cookie?.includes("mov81-actor=other");
    reads.push(url.search);
    if (holdNext && !other) {
      holdNext = false;
      await new Promise((resolve) => {
        releaseOld = resolve;
      });
    }
    if (failReads)
      return route.fulfill({ status: 503, json: { status: "unavailable" } });
    let visible = other ? [] : items;
    const count = visible.filter((x) => !x.readAt).length;
    if (url.searchParams.get("filter") === "unread")
      visible = visible.filter((x) => !x.readAt);
    const before = url.searchParams.get("beforeId");
    if (before) {
      const index = visible.findIndex((x) => x.id === before);
      visible = index < 0 ? [] : visible.slice(index + 1);
    }
    await route.fulfill({
      json: {
        status: "ready",
        value: {
          items: visible.slice(0, 20),
          unreadCount: count,
          hasMore: visible.length > 20,
          snapshotAt: new Date().toISOString(),
        },
      },
    });
  });
  await page.route("**/api/notifications", async (route) => {
    const command = route.request().postDataJSON();
    writes.push(command);
    if (failWrites)
      return route.fulfill({ status: 503, json: { status: "unavailable" } });
    items = items.map((x) =>
      command.action === "read"
        ? x.id === command.args.id
          ? { ...x, readAt: new Date().toISOString() }
          : x
        : x.createdAt <= command.args.throughAt
          ? { ...x, readAt: new Date().toISOString() }
          : x,
    );
    await route.fulfill({ json: { status: "ready", value: {} } });
  });
  const bell = () => page.getByRole("button", { name: /^Notifications,/ });
  const dialog = () => page.getByRole("dialog", { name: "Notifications" });
  for (const route of ["explore", "coach", "messages", "account", "profile"]) {
    await page.goto(base + "/" + route);
    await expect(bell()).toHaveAttribute(
      "aria-label",
      "Notifications, 23 unread",
    );
    await bell().click();
    await expect(dialog()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog()).toHaveCount(0);
    await expect(bell()).toBeFocused();
  }
  console.log(
    "PASS all signed-in header placements and native keyboard dismissal/focus return",
  );
  await page.goto(base + "/explore");
  await expect(bell()).toHaveAttribute(
    "aria-label",
    "Notifications, 23 unread",
  );
  await bell().click();
  await expect(dialog().getByRole("link")).toHaveCount(20);
  assert.equal(writes.length, 0, "Bell opening wrote read state");
  const link = dialog().getByRole("link").first();
  assert.match(await link.getAttribute("href"), /^\/messages\?conversation=/);
  failWrites = true;
  await dialog()
    .getByRole("button", { name: /Mark message notification from Coach 01/ })
    .click();
  await expect(dialog().getByRole("status")).toContainText("unavailable");
  await expect(bell()).toHaveAttribute(
    "aria-label",
    "Notifications, 23 unread",
  );
  failWrites = false;
  await dialog()
    .getByRole("button", { name: /Mark message notification from Coach 01/ })
    .click();
  await expect(bell()).toHaveAttribute(
    "aria-label",
    "Notifications, 22 unread",
  );
  await dialog().getByRole("button", { name: "Older", exact: true }).click();
  await expect(dialog().getByRole("link")).toHaveCount(3);
  await expect(dialog().getByRole("link").first()).toContainText("Coach 21");
  const before = reads.length;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => reads.length).toBeGreaterThan(before);
  assert.ok(reads.at(-1).includes("beforeId="));
  await expect(dialog().getByRole("link").first()).toContainText("Coach 21");
  await dialog().getByRole("button", { name: "Newer", exact: true }).click();
  await expect(dialog().getByRole("link")).toHaveCount(20);
  failReads = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(dialog().getByRole("status")).toContainText(
    "Showing the last loaded",
  );
  await expect(bell()).toHaveAttribute(
    "aria-label",
    "Notifications, count unavailable",
  );
  failReads = false;
  await dialog()
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect(bell()).toHaveAttribute(
    "aria-label",
    "Notifications, 22 unread",
  );
  await dialog()
    .getByRole("button", { name: "Mark all read", exact: true })
    .click();
  await expect(bell()).toHaveAttribute("aria-label", "Notifications, 0 unread");
  assert.ok(writes.at(-1).args.throughAt);
  await dialog().getByRole("button", { name: "Unread", exact: true }).click();
  await expect(dialog()).toContainText("You’re all caught up");
  console.log(
    "PASS explicit read controls, bounded paging, stable focus refresh, unavailable and mutation retry states",
  );
  await dialog().getByRole("button", { name: "All", exact: true }).click();
  await expect(dialog().getByRole("link")).toHaveCount(20);
  await page.screenshot({
    path: path.join(output, "desktop.png"),
    fullPage: true,
  });
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    const box = await dialog().boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Header overflows at ${width}px`,
    );
    await page.screenshot({
      path: path.join(output, `mobile-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() =>
        dialog().evaluate((node) => node.contains(document.activeElement)),
      )
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await context.addCookies([
    { name: "mov81-actor", value: "athlete", url: base },
  ]);
  await page.reload();
  await page.setViewportSize({ width: 320, height: 812 });
  await expect(bell()).toHaveAttribute("aria-label", "Notifications, 0 unread");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Athlete header with coach entry overflows at 320px",
  );
  await page.screenshot({
    path: path.join(output, "athlete-header-320.png"),
    fullPage: true,
  });
  const hiddenReads = reads.length;
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await new Promise((resolve) => setTimeout(resolve, 31000));
  assert.equal(
    reads.length,
    hiddenReads,
    "Hidden page still polled notifications",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => reads.length).toBeGreaterThan(hiddenReads);
  console.log(
    "PASS compact athlete header and hidden-page polling pause/resume",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  holdNext = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => !!releaseOld).toBe(true);
  await page.getByRole("button", { name: "Switch fixture actor" }).click();
  await expect(bell()).toHaveAttribute("aria-label", "Notifications, 0 unread");
  releaseOld();
  await bell().click();
  await expect(dialog()).toContainText("No notifications yet");
  await expect(dialog()).not.toContainText("Coach 01");
  await page.keyboard.press("Escape");
  await context.addCookies([
    { name: "mov81-actor", value: "signed-out", url: base },
  ]);
  await page.reload();
  await expect(bell()).toHaveCount(0);
  console.log(
    "PASS desktop/mobile bounds, keyboard containment, stale actor response isolation and signed-out exclusion",
  );
} catch (error) {
  console.error(error.stack ?? error);
  console.error(log.slice(-2500));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  if (server?.exitCode === null)
    await new Promise((resolve) => server.once("exit", resolve));
  await rm(checkout, { recursive: true, force: true });
}
