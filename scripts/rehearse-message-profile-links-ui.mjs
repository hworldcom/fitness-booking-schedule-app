// Real Mailbox and transport parsing, isolated browser fixtures; no real users/DB.
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
const expect = baseExpect.configure({ timeout: 30000 });
const root = process.cwd(),
  scratch = await mkdtemp(path.join(tmpdir(), "mov115-message-ui-"));
const evidence = path.join(root, "test-results/message-profile-links"),
  base = "http://127.0.0.1:3191";
const id = "ae011500-0000-4000-8000-000000000004",
  pair = "ae011500-0000-4000-8000-000000000005";
let server,
  browser,
  log = "",
  checks = [];
const errors = [];
const report = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
try {
  await mkdir(evidence, { recursive: true });
  for (const name of [
    "src",
    "tests",
    "package.json",
    "tsconfig.json",
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
  const imports = (await readFile("src/app/layout.tsx", "utf8"))
    .split("\n")
    .filter((l) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(l));
  await writeFile(
    path.join(scratch, "src/app/layout.tsx"),
    imports.join("\n") +
      '\nexport default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}',
  );
  await writeFile(
    path.join(scratch, "src/app/messages/page.tsx"),
    await readFile("tests/fixtures/message-profile-links-ui.tsx", "utf8"),
  );
  await mkdir(path.join(scratch, "src/app/coaches/fixture-coach"), {
    recursive: true,
  });
  await writeFile(
    path.join(scratch, "src/app/coaches/fixture-coach/page.tsx"),
    'import {redirect} from "next/navigation"; export default function Page(){redirect("/@fixture_coach");}',
  );
  // @ is a parallel-slot marker in filesystem routing: use the existing dynamic root route.
  await writeFile(
    path.join(scratch, "src/app/[handle]/page.tsx"),
    "export default function Page(){return <h1>Public coach fixture</h1>;}",
  );
  await writeFile(
    path.join(scratch, "src/app/coach/athletes/[pairId]/page.tsx"),
    "export default function Page(){return <h1>Private athlete fixture</h1>;}",
  );
  await writeFile(
    path.join(scratch, "src/app/members/[profileId]/page.tsx"),
    'import {MemberProfileFixture} from "../../../../tests/fixtures/message-profile-links-ui"; import "./profile.css"; export default async function Page({params,searchParams}:{params:Promise<{profileId:string}>,searchParams:Promise<{mismatch?:string}>}){return <MemberProfileFixture id={(await params).profileId} mismatch={(await searchParams).mismatch==="1"}/>;}',
  );
  // Exercise the actual server page's unavailable/retry branch with explicit service failure.
  await mkdir(path.join(scratch, "src/app/member-unavailable/[profileId]"), {
    recursive: true,
  });
  await writeFile(
    path.join(scratch, "src/server/member-profiles/service-fixture.ts"),
    'import type {currentMemberProfile as original} from "./service"; export async function currentMemberProfile(): Promise<Awaited<ReturnType<typeof original>>>{return {status:"unavailable"};}',
  );
  const actualMemberPage = await readFile(
    "src/app/members/[profileId]/page.tsx",
    "utf8",
  );
  await writeFile(
    path.join(scratch, "src/app/member-unavailable/[profileId]/page.tsx"),
    actualMemberPage
      .replace(
        '@/server/member-profiles/service"',
        '@/server/member-profiles/service-fixture"',
      )
      .replace('"./profile.css"', '"@/app/members/[profileId]/profile.css"'),
  );
  // Real photo service and HTTP response, isolated viewer/Storage dependencies.
  await writeFile(
    path.join(scratch, "src/server/member-profiles/avatar-fixture.ts"),
    `
import {cookies} from "next/headers";
import {memberAvatarBytes as actual} from "./avatar";
let downloads=0;
export async function memberAvatarBytes(id:string,version:string|null,tag:string|null){
 const viewer=(await cookies()).get("fixture-viewer")?.value;
 const result=await actual(id,version,tag,{
 reference:async()=>viewer?{status:"ready" as const,value:{path:id+"/fixture.webp",updatedAt:"2026-10-26T12:00:00.000Z",viewer}}:{status:"signed-out" as const},
 download:async()=>{downloads++; return new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPzYAAAAASUVORK5CYII=","base64"));}
 });return {...result,downloadCount:downloads};
}`,
  );
  await mkdir(path.join(scratch, "src/app/fixture-photo"), { recursive: true });
  await writeFile(
    path.join(scratch, "src/app/fixture-photo/page.tsx"),
    "export default function Page(){return <h1>Isolated photo cache fixture</h1>;}",
  );
  const photoRoute = await readFile(
    "src/app/api/members/[profileId]/avatar/route.ts",
    "utf8",
  );
  await writeFile(
    path.join(scratch, "src/app/api/members/[profileId]/avatar/route.ts"),
    photoRoute
      .replace(
        '@/server/member-profiles/avatar"',
        '@/server/member-profiles/avatar-fixture"',
      )
      .replace(
        'vary: "Cookie"',
        'vary: "Cookie", "x-fixture-downloads": String(result.downloadCount), "x-fixture-conditional": String(Boolean(request.headers.get("if-none-match")))',
      ),
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) =>
        !/(DATABASE|SUPABASE|SITE_URL|MUX|RESEND|NOTIFICATION|CRON_SECRET|GEOAPIFY|AUTH)/.test(
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
      "3191",
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
  assert.ok(log.includes("Ready"), "fixture startup");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(90000);
  page.on("pageerror", (e) => errors.push(e.message));
  let role = "athlete",
    href = "/coaches/fixture-coach",
    image = "/images/coaches/fixture.webp",
    imageFailed = false,
    fail = 0,
    name = "Fixture Coach",
    reads = 0;
  const conversation = () => ({
    id,
    coachProfileId: "ae011500-0000-4000-8000-000000000001",
    athleteProfileId: "ae011500-0000-4000-8000-000000000002",
    actorProfileId: "ae011500-0000-4000-8000-000000000002",
    counterpartName: name,
    counterpartImageUrl: image,
    counterpartProfileHref: href,
    role,
    activityAt: "2026-10-26T10:00:00Z",
    canSendGeneral: true,
    canRequestGeneral: false,
    blocked: false,
    blockedByMe: false,
    unread: false,
    consent: null,
  });
  await context.route("**/api/auth/actor", (r) =>
    r.fulfill({
      json: {
        status: "authorized",
        profile: {
          slug: "mov115-viewer",
          displayName: "Fixture viewer",
          avatarUrl: null,
          coachPortraitUrl: null,
        },
        demoRun: { slug: "mov115-fixture", name: "Isolated fixture" },
        role: "member",
        coachAccessStatus: "demo",
      },
    }),
  );
  await context.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: {
        status: "signed-in",
        subject: "ae011500-0000-4000-8000-000000000001",
        email: "fixture@example.invalid",
        expiresAt: null,
      },
    }),
  );
  await context.route("**/api/messages?*", (r) => {
    const thread = new URL(r.request().url()).searchParams.has(
      "conversationId",
    );
    if (thread) reads++;
    return r.fulfill({
      status: fail || 200,
      json: fail
        ? { status: fail === 403 ? "forbidden" : "unavailable" }
        : {
            status: "ready",
            value: thread
              ? {
                  conversation: conversation(),
                  entries: [],
                  contexts: [],
                  lastSeq: 0,
                  readThrough: 0,
                  hasOlder: false,
                  hasNewer: false,
                }
              : { items: [conversation()], unreadCount: 0 },
          },
    });
  });
  await context.route("**/images/coaches/fixture.webp", (r) =>
    r.fulfill(
      imageFailed
        ? { status: 503, body: "" }
        : {
            status: 200,
            contentType: "image/png",
            body: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPzYAAAAASUVORK5CYII=",
              "base64",
            ),
          },
    ),
  );
  const open = async () => {
    await page.goto(base + "/messages");
    await expect(page.locator(".mailbox-thread-header h2")).toHaveText(name);
  };
  const refresh = async () => {
    const previous = reads;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => reads).toBeGreaterThan(previous);
  };
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await open();
    const link = page.getByRole("link", {
      name: "View Fixture Coach’s profile",
      exact: true,
    });
    await expect(link).toHaveAttribute("href", "/coaches/fixture-coach");
    assert.equal(await link.getAttribute("target"), null);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await expect
      .poll(() => link.locator("img").evaluate((e) => e.naturalWidth))
      .toBeGreaterThan(0);
    await link.locator("img").click();
    await expect(page).toHaveURL(base + "/@fixture_coach");
    await expect(
      page.getByRole("heading", { name: "Public coach fixture" }),
    ).toBeVisible();
    assert.equal(context.pages().length, 1);
    await page.goBack();
    await expect(link).toBeVisible();
    await link.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(link).toBeFocused();
    assert.equal(
      await link.evaluate((e) => getComputedStyle(e).outlineStyle),
      "solid",
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(base + "/@fixture_coach");
    await page.goBack();
    await expect(link).toBeVisible();
    await page.screenshot({
      path: path.join(evidence, "coach-" + width + ".png"),
    });
    report(
      width +
        " coach photo/name same-tab navigation, canonical redirect fixture, Back and keyboard",
    );
  }
  role = "coach";
  image = null;
  name = "Fixture Athlete";
  href = "/coach/athletes/" + pair;
  await open();
  await page
    .getByRole("link", { name: "View Fixture Athlete’s profile", exact: true })
    .click();
  await expect(page).toHaveURL(base + href);
  await expect(
    page.getByRole("heading", { name: "Private athlete fixture" }),
  ).toBeVisible();
  await page.goBack();
  report("coach opens exact private athlete pair destination");
  href = "/members/ae011500-0000-4000-8000-000000000002";
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await open();
    const memberLink = page.getByRole("link", {
      name: "View Fixture Athlete’s profile",
      exact: true,
    });
    await memberLink.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(memberLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(base + href);
    await expect(
      page.getByRole("heading", { name: "Fixture Athlete", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Profile visible to signed-in MovX members.", {
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(evidence, "member-" + width + ".png"),
    });
    await page.goBack();
    await expect(memberLink).toBeVisible();
  }
  await page.goto(base + href + "?mismatch=1");
  await expect(page.getByRole("status")).toHaveText(
    "Sign in to view this profile.",
  );
  await expect(
    page.getByRole("heading", { name: "Fixture Athlete", exact: true }),
  ).toHaveCount(0);
  report(
    "member profile without connection at desktop/375/320, keyboard/Back, initials and changed-actor guard",
  );
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      base + "/member-unavailable/ae011500-0000-4000-8000-000000000002",
    );
    await expect(page.locator("section[role=alert]")).toContainText(
      "Profile unavailable",
    );
    const retry = page.getByRole("link", { name: "Try again", exact: true });
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Fixture Athlete", exact: true }),
    ).toBeVisible();
  }
  report(
    "actual member server page unavailable state and keyboard retry recover at desktop/375",
  );
  // Playwright interception disables HTTP cache: use a separate un-routed context.
  const warmedPhoto = await fetch(
    base +
      "/api/members/ae011500-0000-4000-8000-000000000002/avatar?v=2026-10-26T12%3A00%3A00.000Z",
  );
  await warmedPhoto.arrayBuffer();
  const cacheContext = await browser.newContext();
  const cachePage = await cacheContext.newPage();
  cachePage.setDefaultNavigationTimeout(90000);
  await cachePage.goto(base + "/fixture-photo");
  await expect(
    cachePage.getByRole("heading", { name: "Isolated photo cache fixture" }),
  ).toBeVisible();
  const photoPath =
    "/api/members/ae011500-0000-4000-8000-000000000002/avatar?v=2026-10-26T12%3A00%3A00.000Z";
  await cacheContext.addCookies([
    { name: "fixture-viewer", value: "first-viewer", url: base },
  ]);
  const photoProbe = () =>
    cachePage.evaluate(async (path) => {
      const start = performance.now();
      const r = await fetch(path);
      const bytes = await r.arrayBuffer();
      return {
        status: r.status,
        bytes: bytes.byteLength,
        downloads: r.headers.get("x-fixture-downloads"),
        conditional: r.headers.get("x-fixture-conditional"),
        cache: r.headers.get("cache-control"),
        ms: performance.now() - start,
      };
    }, photoPath);
  const firstPhoto = await photoProbe();
  const repeatedPhoto = await photoProbe();
  assert.equal(firstPhoto.status, 200);
  assert.equal(repeatedPhoto.status, 200);
  assert.equal(repeatedPhoto.downloads, firstPhoto.downloads);
  assert.equal(repeatedPhoto.conditional, "true");
  assert.equal(repeatedPhoto.cache, "private, no-cache");
  assert.equal(firstPhoto.bytes, repeatedPhoto.bytes);
  await cacheContext.addCookies([
    { name: "fixture-viewer", value: "second-viewer", url: base },
  ]);
  const changedViewerPhoto = await photoProbe();
  assert.equal(
    Number(changedViewerPhoto.downloads),
    Number(firstPhoto.downloads) + 1,
  );
  await cacheContext.clearCookies();
  const signedOutPhoto = await photoProbe();
  assert.equal(signedOutPhoto.status, 401);
  assert.equal(signedOutPhoto.bytes, 0);
  await writeFile(
    path.join(evidence, "photo-performance.json"),
    JSON.stringify(
      {
        fixtureAuthAndStorage: true,
        realServiceAndRoute: true,
        firstPhoto,
        repeatedPhoto,
        changedViewerPhoto,
        signedOutPhoto,
      },
      null,
      2,
    ),
  );
  report(
    "real browser photo revalidation skips unchanged Storage work, isolates viewer and denies signed-out cached reads",
  );
  await cacheContext.close();
  await open();
  href = null;
  await refresh();
  await expect(page.locator("a.mailbox-counterpart")).toHaveCount(0);
  await expect(page.locator(".mailbox-counterpart h2")).toHaveText(name);
  report("fresh revoked projection removes link and retains readable identity");
  href = undefined;
  await open();
  await expect(page.locator("a.mailbox-counterpart")).toHaveCount(0);
  report("older projection without link field stays readable");
  role = "athlete";
  name = "Fixture Coach";
  href = "/coaches/fixture-coach";
  image = "/images/coaches/fixture.webp";
  imageFailed = true;
  await open();
  await expect(page.locator(".mailbox-counterpart img")).toHaveCount(0);
  await expect(page.locator(".mailbox-counterpart .avatar")).toHaveText("FC");
  await expect(page.locator("a.mailbox-counterpart")).toHaveAttribute(
    "href",
    href,
  );
  report(
    "broken photo uses initials while independent profile link remains available",
  );
  fail = 503;
  await refresh();
  await expect(page.locator(".mailbox-thread [role=alert]")).toContainText(
    "unavailable",
  );
  await expect(page.locator("a.mailbox-counterpart")).toHaveCount(1);
  fail = 0;
  await page.getByRole("button", { name: "Refresh conversation" }).click();
  await expect(page.locator(".mailbox-thread [role=alert]")).toHaveCount(0);
  report("transient read error retains verified identity and refresh recovers");
  fail = 403;
  await refresh();
  await expect(page.locator(".mailbox-counterpart")).toHaveCount(0);
  await expect(
    page
      .locator(".mailbox-page [role=alert]")
      .filter({ hasText: "access changed" })
      .first(),
  ).toBeVisible();
  report("message access denial clears identity and profile link");
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, "result.json"),
    JSON.stringify(
      {
        passed: true,
        checks,
        pageErrors: errors,
        scope:
          "actual Mailbox/DTO/Next navigation with explicit transport/Auth/destination fixtures; no real SQL/Auth/permission claim",
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) =>
      server.exitCode !== null ? r() : server.once("close", r),
    );
  }
  await writeFile(path.join(evidence, "server.log"), log);
  await rm(scratch, { recursive: true, force: true });
}
