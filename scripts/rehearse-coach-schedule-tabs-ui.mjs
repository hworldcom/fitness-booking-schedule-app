// Actual route/components with isolated Auth/service/API fixtures; no .env, SQL or hosted writes.
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

const root = process.cwd(),
  port = 3196,
  base = `http://127.0.0.1:${port}`;
const checkout = await mkdtemp(path.join(tmpdir(), "mov204-schedule-tabs-"));
const output = path.join(root, "test-results/coach-schedule-tabs");
const checks = [],
  errors = [],
  writes = [],
  clientWrites = [];
let server,
  browser,
  log = "",
  success = false;
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
try {
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, "recovery.json"),
    JSON.stringify({ checkout, port, owned: true }),
  );
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
  await cp(
    path.join(root, "tests/fixtures"),
    path.join(checkout, "src/tests-fixtures"),
    { recursive: true },
  );
  let auth = await readFile(
    path.join(root, "tests/fixtures/coach-events-auth.ts"),
    "utf8",
  );
  auth = auth
    .replaceAll("dev0239-", "mov204-")
    .replace(
      "const { actor } = await fixtureScenario();",
      "const { actor, fault } = await fixtureScenario();",
    )
    .replace(
      '  if (actor === "signed-out")',
      '  if (fault === "checking") return {session:{status:"unavailable"},actor:{status:"unavailable"}};\n  if (actor === "signed-out")',
    )
    .replace(
      'slug: "fixture", name:',
      'slug: actor === "dataset" ? "fixture-dataset" : "fixture", name:',
    );
  await writeFile(
    path.join(checkout, "src/tests-fixtures/schedule-auth.ts"),
    auth,
  );
  await writeFile(
    path.join(checkout, "src/tests-fixtures/schedule-services.ts"),
    `
    import {initialAuthorizationState,fixtureScenario} from "./schedule-auth";
    import {AVAILABILITY_COACH} from "./availability-editor-data";
    import {calendarFixture} from "./coach-calendar-data";
    import {berlinAvailabilityDate} from "@/domain/effective-availability";
    export async function currentCoachAvailabilityWorkspace(){
      const {session,actor}=await initialAuthorizationState(),{fault}=await fixtureScenario();
      if(fault==="workspace-unavailable") return {status:"unavailable"} as const;
      if(fault==="workspace-forbidden") return {status:"forbidden"} as const;
      if(actor.status!=="authorized"||session.status!=="signed-in") return {status:actor.status} as const;
      return {status:"authorized" as const,coach:fault==="missing-profile"?null:{...AVAILABILITY_COACH,visibility:fault==="hidden-profile"?"hidden":"visible"},
        rules:[],slots:[],actorScope:[session.subject,"profile-id","run-id",actor.role].join(":"),
        actorIdentity:[actor.profile.slug,actor.demoRun.slug,actor.role].join(":"),ownerDisplayName:actor.profile.slug==="fixture-other"?"Other owner":"Schedule Coach",
        coachAccess:{status:actor.coachAccessStatus,submittedAt:null,decisionReason:null,verificationPolicyVersion:null}};
    }
    export async function loadAvailabilityEditor(){const state=await currentCoachAvailabilityWorkspace();return {status:"ready",data:{scope:state.actorScope,actorIdentity:state.actorIdentity,today:berlinAvailabilityDate(new Date()),locations:AVAILABILITY_COACH.locations,policy:{revision:0,weeklyHours:[],dates:[]}}};}
    export async function loadCoachCalendar(query:any){const state=await currentCoachAvailabilityWorkspace();return {status:"ready",data:{...calendarFixture(query),scope:state.actorScope,actorIdentity:state.actorIdentity}};}
    export async function sessionNotesCommand(){return {status:"ready",value:{viewerIsCoach:true}};}
  `,
  );
  await writeFile(
    path.join(checkout, "src/tests-fixtures/schedule-controls.tsx"),
    `"use client";
    import{useAuthSession}from"@/auth/client/session-provider";import{useActor}from"@/auth/client/actor-provider";
    export function ScheduleControls(){const{refreshSession}=useAuthSession();const{refreshActor}=useActor();return <p style={{padding:8}}>Isolated schedule fixture — no real Auth, database or email. <button onClick={async()=>{await refreshSession();await refreshActor()}}>Refresh fixture account</button></p>}
  `,
  );
  for (const name of [
    "src/app/layout.tsx",
    "src/app/api/auth/actor/route.ts",
  ]) {
    const file = path.join(checkout, name);
    let source = (await readFile(file, "utf8")).replace(
      'from "@/server/authorization/service"',
      'from "@/tests-fixtures/schedule-auth"',
    );
    if (name.endsWith("layout.tsx"))
      source =
        'import {ScheduleControls}from"@/tests-fixtures/schedule-controls";\n' +
        source.replace(
          "<Shell>{children}</Shell>",
          "<ScheduleControls/><Shell>{children}</Shell>",
        );
    await writeFile(file, source);
  }
  await writeFile(
    path.join(checkout, "src/app/api/auth/session/route.ts"),
    `import{initialAuthorizationState}from"@/tests-fixtures/schedule-auth";export async function GET(){return Response.json((await initialAuthorizationState()).session,{headers:{"cache-control":"private, no-store"}})}`,
  );
  for (const name of [
    "src/app/coach/page.tsx",
    "src/app/coach/schedule-page.tsx",
  ]) {
    const file = path.join(checkout, name);
    const source = (await readFile(file, "utf8"))
      .replaceAll(
        'from "@/server/coaches/service"',
        'from "@/tests-fixtures/schedule-services"',
      )
      .replaceAll(
        'from "@/server/coaches/availability-editor-service"',
        'from "@/tests-fixtures/schedule-services"',
      )
      .replaceAll(
        'from "@/server/coaches/calendar-service"',
        'from "@/tests-fixtures/schedule-services"',
      );
    await writeFile(file, source);
  }
  await writeFile(
    path.join(checkout, "src/app/coach/calendar-actions.ts"),
    `"use server";import{loadCoachCalendar}from"@/tests-fixtures/schedule-services";export async function loadCoachCalendarAction(query:any){return loadCoachCalendar(query)}`,
  );
  await writeFile(
    path.join(checkout, "src/app/coach/availability-actions.ts"),
    `"use server";import{loadAvailabilityEditor}from"@/tests-fixtures/schedule-services";export async function loadAvailabilityEditorAction(){return loadAvailabilityEditor()}export async function changeAvailabilityEditorAction(){throw Error("This layout rehearsal never saves availability")}`,
  );
  const detailRoute = path.join(
    checkout,
    "src/app/coach/sessions/[bookingId]/page.tsx",
  );
  await writeFile(
    detailRoute,
    (await readFile(detailRoute, "utf8"))
      .replace(
        'from "@/server/authorization/service"',
        'from "@/tests-fixtures/schedule-auth"',
      )
      .replace(
        'from "@/server/notes/service"',
        'from "@/tests-fixtures/schedule-services"',
      ),
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|DEV\d/.test(key),
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
      String(port),
    ],
    { cwd: checkout, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (c) => {
      log += c;
    });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null)
      throw Error(`Fixture server stopped: ${log.slice(-3000)}`);
    try {
      if ((await fetch(base + "/coach/session-types")).ok) break;
    } catch {}
    if (attempt === 119)
      throw Error(`Fixture server not ready: ${log.slice(-3000)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const id = "20400000-0000-4000-8000-000000000001";
  const type = {
    id,
    format: "private",
    name: "Layout fixture",
    description: "",
    color: "#123456",
    durationMinutes: 75,
    defaultLocationId: id,
    bookable: true,
    archived: false,
    revision: 0,
  };
  const client = {
    id,
    name: "Saved fixture client",
    email: null,
    linkedProfileId: null,
    revision: 0,
    createdAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-01T12:00:00Z",
  };
  let failCatalog = false,
    failOptions = false,
    emptyClients = false,
    moreClients = false,
    clientSave = "unavailable";
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.startsWith("/api/auth/")) return route.continue();
    if (
      url.pathname === "/api/coach/external-clients" &&
      request.method() === "POST"
    ) {
      const payload = request.postDataJSON();
      assert.equal(payload.action, "create");
      clientWrites.push(payload);
      return route.fulfill({
        json:
          clientSave === "ready"
            ? {
                status: "ready",
                client: {
                  ...client,
                  id: "20700000-0000-4000-8000-000000000001",
                  name: payload.name,
                  email: payload.email,
                },
              }
            : { status: "unavailable" },
      });
    }
    if (request.method() !== "GET") {
      writes.push(url.pathname);
      return route.fulfill({ status: 503, json: { status: "unavailable" } });
    }
    if (url.pathname === "/api/coach/session-types")
      return route.fulfill({
        json: failCatalog
          ? { status: "unavailable" }
          : {
              status: "ready",
              types: [type],
              locations: [{ id, name: "Fixture studio" }],
            },
      });
    if (url.pathname === "/api/session-bookings") {
      if (!url.searchParams.has("options"))
        return route.fulfill({ status: 503, json: { status: "unavailable" } });
      return route.fulfill({
        json: failOptions
          ? { status: "unavailable" }
          : {
              status: "ready",
              types: [type],
              locations: [{ id, name: "Fixture studio" }],
              athletes: { items: [], nextCursor: null },
              externalClients: {
                items: emptyClients ? [] : [client],
                next: moreClients ? "fixture-more" : null,
              },
            },
      });
    }
    if (url.pathname === "/api/notifications")
      return route.fulfill({
        json: { status: "ready", items: [], unreadCount: 0, nextCursor: null },
      });
    if (url.pathname === "/api/messages")
      return route.fulfill({ json: { status: "ready", unreadCount: 0 } });
    return route.fulfill({ status: 503, json: { status: "unavailable" } });
  });
  const nav = () =>
    page.getByRole("navigation", { name: "Schedule sections", exact: true });
  const open = (href) => page.goto(base + href, { waitUntil: "networkidle" });
  const cookie = async (actor = "owner", fault = "none") =>
    page.context().addCookies([
      { name: "mov204-actor", value: actor, url: base },
      { name: "mov204-fault", value: fault, url: base },
    ]);
  const refresh = () =>
    page
      .getByRole("button", { name: "Refresh fixture account", exact: true })
      .click();
  const tabs = [
    ["Schedule", "/coach?view=schedule&section=calendar"],
    ["Availability", "/coach?view=schedule&section=availability"],
    ["Session types", "/coach/session-types"],
    ["Schedule a client", "/coach/bookings/new"],
  ];
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    let reference;
    await open(tabs[0][1]);
    for (const [name, href] of tabs) {
      if (name !== "Schedule") {
        await nav().getByRole("link", { name, exact: true }).focus();
        await page.keyboard.press("Enter");
        await page.waitForURL(base + href);
      }
      await expect(nav().locator('[aria-current="page"]')).toHaveCount(1);
      await expect(
        nav().getByRole("link", { name, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Run your coaching week.",
        }),
      ).toBeVisible();
      assert.equal(await page.locator("main h1").count(), 1);
      const selected = page
        .getByRole("navigation", {
          name: width > 760 ? "Main navigation" : "Mobile navigation",
          exact: true,
        })
        .getByRole("link", { name: "Calendar", exact: true });
      await expect(selected).toHaveAttribute("aria-current", "page");
      await expect(selected).toHaveAttribute("href", "/coach");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const frame = await page.locator(".coach-workspace-header").boundingBox(),
        bar = await nav().boundingBox();
      assert.ok(frame && bar);
      if (reference)
        for (const key of ["x", "y", "width", "height"])
          assert.ok(
            Math.abs(frame[key] - reference[key]) < 1,
            `${width} ${name} header ${key}`,
          );
      reference = frame;
      if (name === "Session types" || name === "Schedule a client") {
        const content = await page
          .locator(".schedule-tab-content")
          .boundingBox();
        assert.ok(content);
        assert.ok(Math.abs(content.x - bar.x) < 1);
        assert.ok(Math.abs(content.width - bar.width) < 1);
        assert.equal(
          await page
            .getByRole("link", { name: /← (Schedule|Bookings)/ })
            .count(),
          0,
        );
      }
      await page.screenshot({
        path: path.join(output, `${width}-${name.replaceAll(" ", "-")}.png`),
        fullPage: true,
      });
    }
    await page.goBack({ waitUntil: "networkidle" });
    await expect(
      nav().getByRole("link", { name: "Session types", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.goForward({ waitUntil: "networkidle" });
    await expect(
      nav().getByRole("link", { name: "Schedule a client", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    record(
      `${width}px actual four-route frame/alignment/one-H1/keyboard/active-tab/history/overflow`,
    );
  }
  for (const [, href] of tabs.slice(2)) {
    await open(href);
    await expect(nav()).toBeVisible();
  }
  await open(`/coach/bookings/new?externalClientId=${id}`);
  await expect(page.getByLabel("Client type", { exact: true })).toHaveValue(
    "external",
  );
  await expect(page.getByLabel("External client", { exact: true })).toHaveValue(
    id,
  );
  await page
    .getByRole("button", { name: "Start · Berlin time", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Cancel date and time selection",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  record(
    "direct links, saved external-client handoff and actual date-picker cancel remain usable",
  );
  const picker = () =>
    page.getByRole("region", {
      name: "External client selection",
      exact: true,
    });
  const addClient = () =>
    picker().getByRole("button", {
      name: "Add a new external client",
      exact: true,
    });
  const closeClient = () =>
    picker().getByRole("button", {
      name: "Close new client form",
      exact: true,
    });
  const manageClients = () =>
    picker().getByRole("link", {
      name: "Manage external clients",
      exact: true,
    });
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 1000 });
    emptyClients = true;
    await open(tabs[3][1]);
    await page
      .getByLabel("Client type", { exact: true })
      .selectOption("external");
    await expect(
      picker().getByText(
        "No saved external clients yet. Add your first client to get started.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(addClient()).toHaveAttribute("aria-expanded", "false");
    await expect(manageClients()).toHaveAttribute(
      "href",
      "/coach/athletes/external",
    );
    for (const action of [addClient(), manageClients()]) {
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      assert.ok(
        box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width,
      );
      const contrast = await action.evaluate((el) => {
        const css = getComputedStyle(el);
        const lum = (s) => {
          const rgb = s
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number)
            .map((v) => {
              v /= 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        const a = lum(css.color),
          b = lum(css.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      assert.ok(contrast >= 4.5, `action contrast ${contrast}`);
    }
    await addClient().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
    await expect(closeClient()).toHaveAttribute("aria-expanded", "true");
    await closeClient().scrollIntoViewIfNeeded();
    await expect(closeClient()).toBeVisible();
    await page.screenshot({
      path: path.join(output, `${width}-external-client-actions.png`),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await closeClient().click();
    await expect(addClient()).toBeFocused();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    record(
      `${width}px visible external-client actions,4.5 contrast,44px targets, empty help, keyboard expansion/focus/close`,
    );
  }
  emptyClients = false;
  await page.setViewportSize({ width: 375, height: 1000 });
  await open(`/coach/bookings/new?externalClientId=${id}`);
  await addClient().click();
  await page.getByLabel("Name", { exact: true }).fill("New picker client");
  await page.getByRole("button", { name: "Save client", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry exact save", exact: true }),
  ).toBeVisible();
  await expect(closeClient()).toBeDisabled();
  await expect(manageClients()).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByLabel("External client", { exact: true }),
  ).toBeDisabled();
  const pendingUrl = page.url();
  await manageClients().dispatchEvent("click");
  assert.equal(page.url(), pendingUrl);
  clientSave = "ready";
  await page
    .getByRole("button", { name: "Retry exact save", exact: true })
    .click();
  await expect(page.getByLabel("External client", { exact: true })).toHaveValue(
    "20700000-0000-4000-8000-000000000001",
  );
  await expect(
    page.getByLabel("External client", { exact: true }),
  ).toBeFocused();
  await expect(addClient()).toBeEnabled();
  await expect(manageClients()).not.toHaveAttribute("aria-disabled", "true");
  assert.equal(clientWrites.length, 2);
  assert.deepEqual(clientWrites[1], clientWrites[0]);
  moreClients = true;
  await open(`/coach/bookings/new?externalClientId=${id}`);
  await picker()
    .getByRole("button", { name: "Load more clients", exact: true })
    .click();
  await expect(
    picker().getByText("More clients could not be loaded. Try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(addClient()).toBeEnabled();
  await expect(manageClients()).toBeVisible();
  moreClients = false;
  record(
    "external-client unknown save retains exact retry,blocks conflicting navigation,selects saved client; paging errors preserve actions",
  );
  failOptions = true;
  await open(tabs[3][1]);
  await expect(
    page.getByText(
      "Coach scheduling options are unavailable. Check your access and reload.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(nav()).toBeVisible();
  failOptions = false;
  failCatalog = true;
  await open(tabs[2][1]);
  await expect(
    page.getByText(
      "We couldn’t verify the save. Retry the same action or reload to check.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(nav()).toBeVisible();
  failCatalog = false;
  record(
    "catalog/options errors retain shared navigation and truthful recovery states",
  );
  await open(tabs[2][1]);
  await page
    .getByRole("button", { name: "Create session type", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Retained layout draft");
  await cookie("owner", "checking");
  await refresh();
  await expect(
    page.getByText(
      "Verifying coach access. Your workspace is hidden until access can be checked.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator(".coach-workspace-header")).toBeHidden();
  await cookie();
  await refresh();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Retained layout draft",
  );
  for (const actor of ["other", "dataset", "athlete", "signed-out"]) {
    await cookie();
    await open(tabs[2][1]);
    await page
      .getByRole("button", { name: "Create session type", exact: true })
      .click();
    await page
      .getByLabel("Name", { exact: true })
      .fill("Must clear on access change");
    await cookie(actor);
    await refresh();
    await expect(page.locator(".coach-workspace-header")).toHaveCount(0);
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  }
  record(
    "temporary verification hides owner data/retains draft; account/dataset/access/sign-out remove it",
  );
  for (const fault of ["hidden-profile", "missing-profile"]) {
    await cookie("owner", fault);
    await open(tabs[2][1]);
    await expect(
      page.getByRole("button", { name: "Create session type", exact: true }),
    ).toBeEnabled();
    await expect(nav()).toBeVisible();
  }
  for (const actor of ["applicant", "suspended", "athlete"]) {
    await cookie(actor);
    for (const [, href] of tabs.slice(2)) {
      await open(href);
      await expect(nav()).toHaveCount(0);
      await expect(page.locator(".schedule-tab-content")).toHaveCount(0);
      await expect(page.locator(".coach-activation-gate")).toBeVisible();
    }
  }
  await cookie("owner", "workspace-unavailable");
  await open(tabs[3][1]);
  await expect(
    page.getByRole("heading", {
      name: "We couldn’t verify your coach workspace right now.",
    }),
  ).toBeVisible();
  await expect(nav()).toHaveCount(0);
  await cookie("signed-out");
  await open(`/coach/bookings/new?externalClientId=${id}`);
  assert.equal(new URL(page.url()).pathname, "/sign-in");
  assert.equal(
    new URL(page.url()).searchParams.get("returnTo"),
    `/coach/bookings/new?externalClientId=${id}`,
  );
  await cookie("owner", "workspace-forbidden");
  await open(tabs[2][1]);
  assert.equal(new URL(page.url()).pathname, "/sign-in");
  assert.equal(new URL(page.url()).searchParams.get("reason"), "forbidden");
  record(
    "hidden/missing-profile preparation preserved; non-coach/suspended/guest/unavailable/forbidden gates fail closed",
  );
  await cookie();
  for (const href of [`/coach/sessions/${id}`, `/sessions/${id}`]) {
    await open(href);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Session details",
        exact: true,
      }),
    ).toBeVisible();
    await expect(nav()).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "← Bookings", exact: true }),
    ).toBeVisible();
  }
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  record(
    "existing booking details stay standalone; no unexpected mutation requests or browser errors",
  );
  success = true;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    const closed = new Promise((r) => server.once("exit", r));
    server.kill("SIGTERM");
    await closed;
  }
  await writeFile(path.join(output, "server.log"), log);
  await rm(checkout, { recursive: true, force: true });
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        success,
        checks,
        errors,
        writes,
        clientWrites,
        ownedCheckoutRemoved: true,
        noDatabaseOrHostedAuth: true,
      },
      null,
      2,
    ),
  );
}
