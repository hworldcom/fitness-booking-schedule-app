// MOV-288: actual routes/components/actions with fictional Auth/services, never a DB/provider.
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
  scratch = await mkdtemp(path.join(tmpdir(), "mov288-ui-"));
const dataScratch = await mkdtemp(path.join(tmpdir(), "mov288-data-"));
const output = path.join(root, "test-results/coach-athletes-ui"),
  base = "http://127.0.0.1:3220",
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
  for (const name of ["coach-athletes-auth.ts", "coach-athletes-services.ts"])
    await cp(
      path.join(root, "tests/fixtures", name),
      path.join(scratch, "src/tests-fixtures", name),
    );
  await writeFile(
    path.join(scratch, "src/tests-fixtures/roster-controls.tsx"),
    `"use client";import{useEffect,useRef}from"react";import{useAuthSession}from"@/auth/client/session-provider";import{useActor}from"@/auth/client/actor-provider";export function RosterAccountCheck(){const{refreshSession}=useAuthSession(),{refreshActor}=useActor(),latest=useRef(refreshActor);latest.current=refreshActor;useEffect(()=>{(window as any).__mov288AccountCheck=async()=>{await refreshSession();await new Promise(resolve=>setTimeout(resolve,0));await latest.current();};return()=>{delete(window as any).__mov288AccountCheck;};},[refreshSession]);return null;}`,
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
    "src/features/coaches/athlete-roster.tsx",
  );
  await writeFile(
    rosterFile,
    (await readFile(rosterFile, "utf8")).replace(
      "const router = useRouter();",
      "const router = useRouter();useEffect(()=>{(window as any).__mov288RosterReady=true;return()=>{delete(window as any).__mov288RosterReady;};},[]);",
    ),
  );
  for (const name of [
    "src/app/coach/athletes/page.tsx",
    "src/app/coach/athletes/actions.ts",
    "src/app/connections/actions.ts",
    "src/app/api/connections/pending-count/route.ts",
  ]) {
    const file = path.join(scratch, name);
    await writeFile(
      file,
      (await readFile(file, "utf8"))
        .replaceAll(
          'from "@/server/coaches/service"',
          'from "@/tests-fixtures/coach-athletes-services"',
        )
        .replaceAll(
          'from "@/server/connections/coach-athletes-service"',
          'from "@/tests-fixtures/coach-athletes-services"',
        )
        .replaceAll(
          'from "@/server/connections/service"',
          'from "@/tests-fixtures/coach-athletes-services"',
        ),
    );
  }
  await writeFile(
    path.join(scratch, "src/app/api/coach/external-clients/route.ts"),
    'import{fixtureExternal}from"@/tests-fixtures/coach-athletes-services";export async function GET(r:Request){return Response.json(await fixtureExternal(r))}export async function POST(r:Request){return Response.json(await fixtureExternal(r))}',
  );
  await mkdir(path.join(scratch, "src/app/coach/qa-roster-bookings"), {
    recursive: true,
  });
  await writeFile(
    path.join(scratch, "src/app/coach/qa-roster-bookings/page.tsx"),
    `import{ConnectionWorkspace}from"@/features/connections/connection-workspace";import{UNAVAILABLE_CONNECTION_PAGES}from"@/features/connections/connection-model";import"@/features/connections/connections.css";
 const base={title:"Fixture session",titleRevision:0,canEditTitle:false,id:"28800000-0000-4000-8000-000000000301",slotId:"28800000-0000-4000-8000-000000000401",coachProfileId:"28800000-0000-4000-8000-000000000500",coachDisplayName:"Fixture coach",coachSlug:"fixture-owner",coachPortraitUrl:null,clientProfileId:null,clientDisplayName:"Another test",clientAvatarUrl:null,athleteProfileHref:"/coach/athletes/external/28800000-0000-4000-8000-000000000003",status:"confirmed" as const,scheduledStartAt:"2035-01-01T10:00:00Z",scheduledEndAt:"2035-01-01T11:00:00Z",coachTimezone:"Europe/Berlin",location:{trainingLocationId:null,name:"Fixture studio",kind:"independent" as const,gymName:null,publicLabel:"Berlin"},cancelledBy:null,cancelledAt:null,completedAt:null,createdAt:"2026-11-27T10:00:00Z"};
 export default function Page(){return <ConnectionWorkspace role="coach" view="sessions" mayInitiate bookings={[base,{...base,id:"28800000-0000-4000-8000-000000000302",clientProfileId:"28800000-0000-4000-8000-000000000002",clientDisplayName:"Alex Morgan",athleteProfileHref:"/members/28800000-0000-4000-8000-000000000002"}]} referenceTime="2026-11-27T10:00:00Z" sourceVersion="fixture" initialPages={UNAVAILABLE_CONNECTION_PAGES}/>}`,
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
  env.MOV288_UI_STORE = path.join(dataScratch, "store.json");
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3220",
    ],
    { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => (log = (log + data).slice(-24000)));
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base + "/coach/athletes")).ok) break;
    } catch {}
    if (n === 99) throw Error(log);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1440, 375, 320]) {
    await rm(env.MOV288_UI_STORE, { force: true });
    const context = await browser.newContext({
        viewport: { width, height: 1000 },
      }),
      page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(90000);
    page.on("pageerror", (e) => errors.push(e.message));
    const cookie = (name, value) =>
      context.addCookies([{ name: `dev0239-${name}`, value, url: base }]);
    const open = async (href = "/coach/athletes") => {
      await page.goto(base + href);
      await expect(
        page.getByRole("heading", { name: "My athletes", exact: true }),
      ).toBeVisible();
      await page.locator(".coach-athlete-roster-row").first().waitFor();
      await page.waitForFunction(() => window.__mov288RosterReady === true);
    };
    await open();
    await expect(page.locator(".coach-athlete-roster-row")).toHaveCount(20);
    assert.equal(
      await page
        .getByRole("navigation", { name: "My athletes sections" })
        .getByRole("link")
        .count(),
      2,
    );
    const external = page.getByRole("article", {
      name: "Another test, External athlete",
      exact: true,
    });
    await expect(
      external.getByRole("link", { name: "Invite", exact: true }),
    ).toBeVisible();
    assert.doesNotMatch(
      await external.innerText(),
      /Not connected|shared session/,
    );
    await page
      .getByRole("button", { name: "Load more athletes", exact: true })
      .click();
    await expect(page.locator(".coach-athlete-roster-row")).toHaveCount(25);
    await page
      .getByRole("combobox", { name: "Athlete status" })
      .selectOption("external");
    await page.waitForURL(/status=external/);
    await expect(page.locator(".coach-athlete-roster-row")).toHaveCount(20);
    assert.equal(
      await page.getByRole("button", { name: "Connect", exact: true }).count(),
      0,
    );
    await page.goBack();
    await expect(
      page.getByRole("button", { name: "Connect", exact: true }),
    ).toBeVisible();
    const before = JSON.parse(
      await readFile(env.MOV288_UI_STORE, "utf8"),
    ).reads;
    await returnToVisiblePage(page);
    await expect
      .poll(
        async () =>
          JSON.parse(await readFile(env.MOV288_UI_STORE, "utf8")).reads,
      )
      .toBeGreaterThan(before);
    await cookie("fault", "roster-unavailable");
    await returnToVisiblePage(page);
    await expect(
      page.getByRole("alert").filter({ hasText: "could not be refreshed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", {
        name: "Alex Morgan, Not connected",
        exact: true,
      }),
    ).toBeVisible();
    await cookie("fault", "none");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "could not be refreshed" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Manage Maya Patel", exact: true })
      .count()
      .then(async (count) => {
        if (count)
          await page
            .getByRole("button", { name: "Manage Maya Patel", exact: true })
            .click();
        else
          await page.locator('summary[aria-label="Manage Maya Patel"]').click();
      });
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    const paused = JSON.parse(
      await readFile(env.MOV288_UI_STORE, "utf8"),
    ).reads;
    await returnToVisiblePage(page);
    await page.waitForTimeout(300);
    assert.equal(
      JSON.parse(await readFile(env.MOV288_UI_STORE, "utf8")).reads,
      paused,
    );
    await page
      .getByRole("button", { name: "Stay connected", exact: true })
      .click();
    await page.locator('summary[aria-label="Manage Maya Patel"]').click();
    await cookie("fault", "mutation-lost");
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Retry same connection action",
        exact: true,
      }),
    ).toBeVisible();
    const count = JSON.parse(await readFile(env.MOV288_UI_STORE, "utf8")).reads;
    await returnToVisiblePage(page);
    await page.waitForTimeout(250);
    assert.equal(
      JSON.parse(await readFile(env.MOV288_UI_STORE, "utf8")).reads,
      count,
    );
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
    const sends = JSON.parse(
      await readFile(env.MOV288_UI_STORE, "utf8"),
    ).commands.filter((r) => r.intent === "send");
    assert.deepEqual(sends.at(-1), sends.at(-2));
    assert.ok(sends.at(-1).ownerScope);
    await page.getByRole("link", { name: /Connection requests, / }).click();
    await expect(
      page.getByRole("heading", { name: "Connection requests", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "All athletes", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "All athletes", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "Athlete status" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add athlete", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "Add external athlete",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel("Name", { exact: true })
      .fill(`Roster new ${width}`);
    page.once("dialog", (prompt) => prompt.dismiss());
    await dialog
      .getByRole("button", { name: "Close new athlete form", exact: true })
      .click();
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
      `Roster new ${width}`,
    );
    const draftReads = JSON.parse(
      await readFile(env.MOV288_UI_STORE, "utf8"),
    ).reads;
    await returnToVisiblePage(page);
    await page.waitForTimeout(250);
    assert.equal(
      JSON.parse(await readFile(env.MOV288_UI_STORE, "utf8")).reads,
      draftReads,
    );
    await cookie("fault", "contact-lost");
    await dialog
      .getByRole("button", { name: "Save athlete", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Retry exact save", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await cookie("fault", "none");
    await dialog
      .getByRole("button", { name: "Retry exact save", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "View athlete", exact: true }),
    ).toBeVisible();
    const creates = JSON.parse(
      await readFile(env.MOV288_UI_STORE, "utf8"),
    ).commands.filter((r) => r.action === "create");
    assert.deepEqual(creates.at(-1), creates.at(-2));
    await page.goto(base + "/coach/qa-roster-bookings");
    await expect(
      page.getByText("External athlete", { exact: true }),
    ).toBeVisible();
    assert.equal(
      await page
        .getByRole("button", { name: "Connection options", exact: true })
        .count(),
      0,
    );
    await expect(
      page.getByRole("link", {
        name: "View Another test’s athlete details",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", {
        name: "View Another test’s athlete details",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "External athlete", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#external-athlete-invitation")).toBeVisible();
    await open();
    await cookie("fault", "read-delay");
    const beforeLate = JSON.parse(
      await readFile(env.MOV288_UI_STORE, "utf8"),
    ).reads;
    await returnToVisiblePage(page);
    await expect
      .poll(
        async () =>
          JSON.parse(await readFile(env.MOV288_UI_STORE, "utf8")).reads,
      )
      .toBeGreaterThan(beforeLate);
    await cookie("actor", "other");
    await page.evaluate(() => window.__mov288AccountCheck());
    await expect(
      page.getByText(/account or coach access changed/),
    ).toBeVisible();
    assert.equal(
      await page
        .getByRole("article", { name: "Maya Patel, Connected", exact: true })
        .count(),
      0,
    );
    await page.waitForTimeout(1000);
    assert.equal(
      await page
        .getByRole("article", { name: "Maya Patel, Connected", exact: true })
        .count(),
      0,
    );
    await cookie("actor", "owner");
    await cookie("fault", "none");
    await open();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    if (width === 320) {
      const athleteLink = await page
        .getByRole("link", { name: "Maya Patel", exact: true })
        .boundingBox();
      assert.ok(
        athleteLink.height >= 44 && athleteLink.width >= 44,
        "Athlete details link has a mobile touch target",
      );
      const tabs = await page
        .getByRole("navigation", { name: "My athletes sections" })
        .getByRole("link")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().top),
        );
      assert.ok(
        Math.abs(tabs[0] - tabs[1]) <= 1,
        "Compact mobile tabs stay on one row",
      );
      const [heading, add] = await Promise.all([
        page
          .getByRole("heading", { name: "My athletes", exact: true })
          .boundingBox(),
        page
          .getByRole("button", { name: "Add athlete", exact: true })
          .boundingBox(),
      ]);
      assert.ok(
        add.y < heading.y + heading.height,
        "Add athlete stays beside the heading",
      );
    }
    await page.screenshot({
      path: path.join(output, `roster-${width}.png`),
      fullPage: true,
    });
    if (width === 1440) {
      await cookie("actor", "dataset");
      await open();
      await expect(
        page.getByRole("link", {
          name: "Other account Maya Patel",
          exact: true,
        }),
      ).toBeVisible();
      await cookie("actor", "suspended");
      await open();
      assert.equal(
        await page
          .getByRole("button", { name: "Add athlete", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page.getByRole("link", { name: "Invite", exact: true }).count(),
        0,
      );
      await cookie("actor", "signed-out");
      await page.goto(base + "/coach/athletes");
      await page.waitForURL(/sign-in/);
      assert.equal(await page.locator(".coach-athlete-roster-row").count(), 0);
    }
    checks.push(
      `${width}: roster/filter/paging/history, external distinction, one guarded return, failed-read retention, disconnect/draft/unknown-write protection, exact retries, request tab, coach booking cleanup and owner clearing`,
    );
    console.log("PASS " + checks.at(-1));
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        checks,
        errors,
        scope:
          "Actual routes/components/actions; explicit fictional Auth/services, separate SQL rehearsal required.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  const activePage = browser?.contexts()[0]?.pages()[0];
  if (activePage) {
    await activePage.screenshot({
      path: path.join(output, "failure.png"),
      fullPage: true,
    });
    await writeFile(
      path.join(output, "failure-body.txt"),
      await activePage.locator("body").innerText(),
    );
  }
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
