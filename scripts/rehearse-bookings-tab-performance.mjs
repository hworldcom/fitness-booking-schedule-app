// MOV-261: actual route orchestration; delayed fictional service interfaces, no Auth/DB.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
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
import { chromium, webkit, expect as baseExpect } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 30000 });
const root = process.cwd();
// An explicit immutable ref makes the baseline reproducible after implementation.
const baseline = process.argv.includes("--baseline");
const streaming = process.argv.includes("--streaming");
const useWebkit = process.argv.includes("--webkit");
assert.ok(!baseline || !streaming, "Choose baseline or streaming checks");
const ref = "c48f7870";
const label = streaming
  ? `streaming-${useWebkit ? "webkit" : "chrome"}`
  : baseline
    ? "baseline"
    : "current";
const scratch = await mkdtemp(path.join(tmpdir(), "mov261-bookings-"));
const evidence = path.join(
  root,
  "test-results/bookings-tab-performance",
  label,
);
const base = "http://127.0.0.1:3205";
const results = [],
  errors = [];
let server,
  browser,
  log = "";
async function put(file, text) {
  const target = path.join(scratch, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
}
try {
  await mkdir(evidence, { recursive: true });
  for (const file of [
    "src",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, file), path.join(scratch, file), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  // Unrelated catch-all/proxy code must not compile or reach providers in this fixture.
  await rm(path.join(scratch, "src/app/[handle]"), {
    recursive: true,
    force: true,
  });
  await rm(path.join(scratch, "src/proxy.ts"), { force: true });
  await put(
    "src/app/favicon.ico/route.ts",
    "export function GET(){return new Response(null,{status:204})}",
  );
  if (baseline) {
    for (const file of [
      "src/app/sessions/page.tsx",
      "src/app/sessions/groups/page.tsx",
      "src/features/profile/my-sessions-navigation.tsx",
    ])
      await put(
        file,
        execFileSync("git", ["show", `${ref}:${file}`], { encoding: "utf8" }),
      );
  }
  const styles = (await readFile("src/app/layout.tsx", "utf8"))
    .split("\n")
    .filter((line) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(line));
  await put(
    "src/app/layout.tsx",
    `${styles.join("\n")}\nexport default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><main className="training-page">{children}</main></body></html>}`,
  );
  // Service delays model the independently verified source boundaries, not live timings.
  await put(
    "src/booking-performance-fixture.ts",
    `
import {cookies, headers} from "next/headers";
type Counts = Record<string,number>;
const g=globalThis as typeof globalThis & {bookingCounts?:Counts};
export function counts(){return g.bookingCounts??={};}
export function reset(){g.bookingCounts={};}
function count(key:string){counts()[key]=(counts()[key]??0)+1;}
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export async function access(){
  await headers(); count("access"); await delay(250);
  return (await cookies()).get("qa-mode")?.value??"authorized";
}
export async function query(name:string){count(name);await delay(120);}
export const actor={authUserId:"fixture-auth",profileId:"fixture-profile",runId:"fixture-run",runRole:"member"};
export async function workspace(){
  count("workspace");const status=await access();if(status!=="authorized")return {status};
  await query("bookings");await query("requests");
  return {status,bookings:[],requests:{items:[],nextCursor:null},actorScope:"fixture-run:fixture-profile"};
}
export async function coach(){
  count("coach");const status=await access();if(status!=="authorized")return {status};
  await query("coachProjection");return {status,coachAccess:{status:"not-applied"}};
}
export async function connection(){
  const status=await access();if(status!=="authorized")return {status};
  await query("connections");return {status:"ready",value:{items:[],nextCursor:null}};
}
export async function history(after:unknown){
  count("history");const status=await access();if(status!=="authorized")return {status};
  if((await cookies()).get("qa-slow-group")?.value==="yes")await delay(900);
  await query("registrations");count("historyReady");return {status:"ready",scope:"fixture-run:fixture-profile",value:{items:[],nextCursor:after?null:{at:"2026-10-10T10:00:00.000Z",id:"26200000-0000-4000-8000-000000000001"}}};
}
`,
  );
  await put(
    "src/server/authorization/service.ts",
    `import {access,actor} from "@/booking-performance-fixture";
export async function withAuthorizedActor(work:any){const status=await access();return status==="authorized"?{status,actor,value:await work({},actor)}:{status};}`,
  );
  await put(
    "src/server/coaches/booking-request-service.ts",
    'export {workspace as currentClientSessionWorkspace} from "@/booking-performance-fixture";',
  );
  await put(
    "src/server/coaches/service.ts",
    'export {coach as currentCoachAccess} from "@/booking-performance-fixture";',
  );
  await put(
    "src/server/group-sessions/athlete-service.ts",
    'export {history as athleteGroupHistory} from "@/booking-performance-fixture";',
  );
  await put(
    "src/server/connections/service.ts",
    `export {connection as currentConnectionPage} from "@/booking-performance-fixture";
export async function currentConnectionHistory(){throw Error("Unexpected history call");}
export async function currentBookingConnectionContext(){throw Error("Unexpected context call");}
export async function decideCoachAthleteConnection(){throw Error("Unexpected mutation");}
export async function sendCoachAthleteConnection(){throw Error("Unexpected mutation");}`,
  );
  await put(
    "src/features/profile/client-booking-requests.tsx",
    'export function ClientBookingRequests(){return <section id="booking-requests">Fixture booking requests</section>}',
  );
  await put(
    "src/features/connections/connection-workspace.tsx",
    'export function ConnectionWorkspace(){return <section id="my-sessions">Fixture confirmed sessions</section>}',
  );
  await put(
    "src/features/events/participation-form.tsx",
    "export function ParticipationForm(){return null}",
  );
  await put(
    "src/app/api/qa-bookings/route.ts",
    'import {counts,reset} from "@/booking-performance-fixture";export async function GET(){return Response.json(counts())}export async function DELETE(){reset();return Response.json({ok:true})}',
  );
  await put(
    "src/app/sign-in/page.tsx",
    "export default function Page(){return <h1>Fixture sign-in</h1>}",
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|MUX|RESEND|SMTP|CRON_SECRET/.test(
          key,
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
      "3205",
    ],
    {
      cwd: scratch,
      env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => (log += chunk));
  for (
    const deadline = Date.now() + 60000;
    !log.includes("Ready") && Date.now() < deadline && server.exitCode === null;
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"), "Owned fixture failed to start");
  // Finish initial compilation before any browser connects to development HMR.
  // Every measurement still gets a new browser/router cache.
  for (const route of [
    "/sessions",
    "/sessions/groups",
    "/api/qa-bookings",
    "/favicon.ico",
  ]) {
    const response = await fetch(base + route);
    assert.ok(response.ok, `Could not warm owned fixture ${route}`);
    await response.text();
  }
  browser = useWebkit
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1440, 375, 320]) {
    for (const target of ["private", "group"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
      });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(60000);
      page.on("pageerror", (e) => errors.push(e.message));
      const href = target === "private" ? "/sessions" : "/sessions/groups";
      const start = target === "private" ? "/sessions/groups" : "/sessions";
      const name = target === "private" ? "Private sessions" : "Group sessions";
      await page.goto(base + start);
      await page
        .locator(target === "private" ? ".group-history-page" : "#my-sessions")
        .waitFor({ state: "visible" });
      const tab = page
        .getByRole("navigation", { name: "Session type" })
        .getByRole("link", { name, exact: true });
      await tab.focus();
      await context.request.delete(base + "/api/qa-bookings");
      const began = Date.now();
      // Capture the navigation event, excluding assertion retry/polling delays.
      const navigation = page
        .waitForURL(base + href, { waitUntil: "commit" })
        .then(() => Date.now() - began);
      const readySelector =
        target === "private" ? "#my-sessions" : ".group-history-page";
      const ready = page
        .waitForFunction((selector) => {
          const element = document.querySelector(selector);
          return (
            !!element &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== "hidden"
          );
        }, readySelector)
        .then(() => Date.now() - began);
      const loading = streaming
        ? page
            .waitForFunction((label) => {
              const element = document.querySelector(".booking-page-loading");
              return (
                !!element &&
                element.getClientRects().length > 0 &&
                document
                  .querySelector('.my-session-types [aria-current="page"]')
                  ?.getAttribute("aria-label") === label
              );
            }, name)
            .then(() => Date.now() - began)
        : null;
      // Closing the page after an earlier failure must not mask that failure.
      void navigation.catch(() => {});
      void ready.catch(() => {});
      void loading?.catch(() => {});
      await page.keyboard.press("Enter");
      if (!baseline && !streaming) {
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: `Loading ${name.toLowerCase()}…` })
            .first(),
        ).toBeVisible();
        assert.ok(
          Date.now() - began < 400,
          "Pending feedback must precede delayed data",
        );
      }
      let loadingMs;
      let focusedTab;
      if (streaming) {
        loadingMs = await loading;
        await expect(page.locator(".booking-page-loading")).toBeVisible();
        assert.ok(
          loadingMs < 250,
          `Loading view waited ${loadingMs}ms for service data`,
        );
        await expect(
          page.locator(
            target === "private" ? ".group-history-page" : "#my-sessions",
          ),
        ).not.toBeVisible();
        await page.screenshot({
          path: path.join(evidence, `${target}-loading-${width}.png`),
        });
      }
      const elapsedMs = await navigation;
      if (streaming && (await page.locator(".booking-page-loading").count())) {
        focusedTab = page.getByRole("link", {
          name: target === "private" ? "Group sessions" : "Private sessions",
          exact: true,
        });
        await focusedTab.focus();
      }
      const readyMs = await ready;
      await expect(page.locator(".booking-page-loading")).toHaveCount(0);
      if (focusedTab) await expect(focusedTab).toBeFocused();
      await expect(
        page
          .getByRole("navigation", { name: "Session type" })
          .locator('[aria-current="page"]'),
      ).toHaveText(name);
      const counts = await (
        await context.request.get(base + "/api/qa-bookings")
      ).json();
      assert.equal(
        counts.access,
        target === "private" ? (baseline ? 7 : 2) : baseline ? 2 : 1,
      );
      assert.equal(
        counts.connections ?? 0,
        target === "private" && baseline ? 4 : 0,
      );
      assert.equal(
        counts[target === "private" ? "bookings" : "registrations"],
        1,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page.screenshot({
        path: path.join(evidence, `${target}-${width}.png`),
        fullPage: true,
      });
      await page.goBack();
      await expect(page).toHaveURL(base + start);
      results.push({ width, target, elapsedMs, loadingMs, readyMs, counts });
      console.log(JSON.stringify(results.at(-1)));
      await context.close();
    }
  }
  if (streaming) {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/sessions/groups");
    await page
      .getByRole("link", { name: "Older registrations →", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".booking-page-loading")).toBeVisible();
    await expect(page).toHaveURL(/afterAt=.*afterId=/);
    await expect(
      page.getByRole("heading", { name: "No more registrations on this page" }),
    ).toBeVisible();
    await expect(page.locator(".booking-page-loading")).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(base + "/sessions/groups");
    await expect(
      page.getByRole("heading", { name: "No group registrations yet" }),
    ).toBeVisible();

    await page.goto(base + "/sessions");
    await context.addCookies([
      { name: "qa-slow-group", value: "yes", url: base },
    ]);
    await page
      .getByRole("link", { name: "Group sessions", exact: true })
      .click();
    await expect(page).toHaveURL(base + "/sessions/groups");
    await expect(page.locator(".booking-page-loading")).toBeVisible();
    const retainedFocus = page.getByRole("link", {
      name: "Private sessions",
      exact: true,
    });
    await retainedFocus.focus();
    await expect(page.locator(".group-history-page")).toBeVisible();
    await expect(retainedFocus).toBeFocused();
    await page.goto(base + "/sessions");
    let heldDone;
    const held = new Promise((resolve) => {
      heldDone = resolve;
    });
    await context.route("**/sessions/groups?*", async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 600));
      // Cancellation by a later tab choice can dispose the intercepted request.
      await route.fulfill({ response }).catch(() => {});
      heldDone();
    });
    await context.request.delete(base + "/api/qa-bookings");
    await page
      .getByRole("link", { name: "Group sessions", exact: true })
      .click();
    await expect(page.locator(".booking-page-loading")).toBeVisible();
    assert.equal(
      page.url(),
      base + "/sessions",
      "Local selection must work before the held RSC response/URL commit",
    );
    await page
      .getByRole("link", { name: "Private sessions", exact: true })
      .click();
    await expect(page).toHaveURL(base + "/sessions");
    await expect(page.locator("#my-sessions")).toBeVisible();
    await held;
    await expect
      .poll(
        async () =>
          (await (await context.request.get(base + "/api/qa-bookings")).json())
            .historyReady ?? 0,
      )
      .toBe(1);
    await expect(page).toHaveURL(base + "/sessions");
    await expect(page.locator(".group-history-page")).toHaveCount(0);
    await expect(
      page
        .getByRole("navigation", { name: "Session type" })
        .locator('[aria-current="page"]'),
    ).toHaveText("Private sessions");
    await page.goBack();
    await expect(page).toHaveURL(base + "/sessions/groups");
    await context.close();
  }
  // Every route access/recovery branch, including invalid cursors before history reads.
  for (const mode of [
    "preview",
    "unavailable",
    "signed-out",
    "forbidden",
    "authorized",
  ]) {
    for (const route of [
      "/sessions",
      "/sessions/groups",
      "/sessions/groups?after=bad",
    ]) {
      const context = await browser.newContext();
      await context.addCookies([{ name: "qa-mode", value: mode, url: base }]);
      const page = await context.newPage();
      await context.request.delete(base + "/api/qa-bookings");
      await page.goto(base + route);
      if (mode === "signed-out" || mode === "forbidden") {
        await expect(
          page.getByRole("heading", { name: "Fixture sign-in" }),
        ).toBeVisible();
        const url = new URL(page.url());
        assert.equal(
          url.searchParams.get("returnTo"),
          route.startsWith("/sessions/groups")
            ? "/sessions/groups"
            : "/sessions",
        );
        if (mode === "forbidden")
          assert.equal(url.searchParams.get("reason"), "forbidden");
      } else if (mode === "preview")
        await expect(
          page.getByRole("link", { name: /^(Go to sign-in|Sign in)$/ }),
        ).toBeVisible();
      else if (mode === "unavailable")
        await expect(
          page.getByRole("link", { name: /check sign-in|try again/i }),
        ).toBeVisible();
      else if (route.includes("?"))
        await expect(
          page.getByRole("heading", { name: "Invalid registration page" }),
        ).toBeVisible();
      const counts = await (
        await context.request.get(base + "/api/qa-bookings")
      ).json();
      await expect(page.locator(".booking-page-loading")).toHaveCount(0);
      if (route.includes("?")) assert.equal(counts.history ?? 0, 0);
      if (mode !== "authorized")
        for (const query of [
          "bookings",
          "requests",
          "connections",
          "registrations",
        ])
          assert.equal(counts[query] ?? 0, 0);
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, "validation.json"),
    JSON.stringify(
      {
        baseline,
        streaming,
        engine: useWebkit ? "webkit" : "chrome",
        ref,
        results,
        errors,
        proof:
          "Actual pages and Links; delayed fictional guarded service interfaces. 250ms access, 120ms per query. No production latency/Auth/SQL claim.",
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 5000);
    });
  }
  await writeFile(path.join(evidence, "next.log"), log).catch(() => {});
  await rm(scratch, { recursive: true, force: true });
}
