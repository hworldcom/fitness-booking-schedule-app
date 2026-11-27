// MOV-81: actual shared headers/controller, isolated Auth/API fixtures only.
// No environment files, real accounts, databases or external delivery.
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
import { randomUUID } from "node:crypto";
import { chromium, expect as baseExpect } from "@playwright/test";

const root = process.cwd(),
  checkout = await mkdtemp(path.join(tmpdir(), "mov81-notifications-ui-"));
const output = path.join(root, "test-results/notifications");
const base = "http://127.0.0.1:3168";
const bookingLoadBaseline = process.argv.includes("--booking-load-baseline");
const bookingLoad =
  bookingLoadBaseline || process.argv.includes("--booking-load-performance");
const expect = baseExpect.configure({ timeout: bookingLoad ? 20000 : 5000 });
let pageForFailure;
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
  if (bookingLoadBaseline) {
    for (const file of [
      "src/app/coach/sessions/[bookingId]/page.tsx",
      "src/app/api/session-bookings/route.ts",
      "src/server/coaches/typed-session-service.ts",
      "src/features/session-types/booking-editor.tsx",
      "src/features/session-types/actor-boundary.tsx",
      "src/domain/typed-sessions.ts",
    ])
      await writeFile(
        path.join(checkout, file),
        execFileSync("git", [
          "show",
          `75fa0fe954a95ff9e8ea0baeb668285f116481e7:${file}`,
        ]),
      );
  }
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
    auth
      .replaceAll("dev0239-actor", "mov81-actor")
      .replaceAll("dev0239-fault", "mov81-fault")
      .replace(
        'slug: "fixture",',
        'slug: actor === "other-run" ? "another-run" : "fixture",',
      )
      .replace(
        'role: "member",',
        'role: actor === "operator" ? "operator" : "member",',
      ),
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
    import {useAuthSession} from "@/auth/client/session-provider";
    export function Controls(){const {actor}=useActor();const {refreshSession}=useAuthSession();return <><span data-testid="fixture-current-actor">{actor.status==="authorized"?actor.profile.slug:actor.status}</span><button onClick={()=>{document.cookie="mov81-actor=other; path=/";void refreshSession();}}>Switch fixture actor</button></>}`,
  );
  for (const route of ["explore", "coach", "messages", "account", "profile"]) {
    await writeFile(
      path.join(checkout, `src/app/${route}/page.tsx`),
      `import {Controls} from "@/tests-fixtures/controls";export default function Fixture(){return <><h1>Explicit notification UI fixture</h1><p>No real Auth, database writes or email.</p><Controls/></>}`,
    );
  }
  if (bookingLoad) {
    const configFile = path.join(checkout, "next.config.ts");
    await writeFile(
      configFile,
      (await readFile(configFile, "utf8")).replace(
        "const nextConfig: NextConfig = {",
        "const nextConfig: NextConfig = { reactStrictMode: false,",
      ),
    );
    const notesRoute = path.join(
      checkout,
      "src/app/api/session-notes/route.ts",
    );
    await writeFile(
      notesRoute,
      (await readFile(notesRoute, "utf8")).replace(
        'from "@/app/api/coach/website/_http"',
        'from "@/tests-fixtures/booking-load-authorization"',
      ),
    );
    await writeFile(
      path.join(checkout, "src/tests-fixtures/booking-load-authorization.ts"),
      (
        await readFile(
          path.join(root, "tests/fixtures/booking-load-authorization.ts"),
          "utf8",
        )
      ).replace('"./coach-events-auth"', '"./notification-auth"'),
    );
    for (const file of [
      "src/server/coaches/typed-session-service.ts",
      "src/server/notes/service.ts",
      "src/app/coach/sessions/[bookingId]/page.tsx",
    ]) {
      const target = path.join(checkout, file);
      await writeFile(
        target,
        (await readFile(target, "utf8")).replaceAll(
          'from "@/server/authorization/service"',
          'from "@/tests-fixtures/booking-load-authorization"',
        ),
      );
    }
    await mkdir(path.join(checkout, "src/app/api/booking-load-fixture"), {
      recursive: true,
    });
    await writeFile(
      path.join(checkout, "src/app/api/booking-load-fixture/route.ts"),
      `import {counts,reset} from "@/tests-fixtures/booking-load-authorization"; export const dynamic="force-dynamic"; export async function GET(request:Request){if(new URL(request.url).searchParams.has("reset"))reset();return Response.json(counts());}`,
    );
    await writeFile(
      path.join(checkout, "src/tests-fixtures/booking-load-controls.tsx"),
      `"use client";import {useEffect} from "react";import {useRouter} from "next/navigation";import {useActor} from "@/auth/client/actor-provider";import {useAuthSession} from "@/auth/client/session-provider";export function Controls(){const {actor,refreshActor}=useActor(),{refreshSession}=useAuthSession(),router=useRouter();useEffect(()=>{const a=()=>void refreshActor(),s=()=>void refreshSession(),r=()=>router.refresh();window.addEventListener("mov279-refresh",a);window.addEventListener("mov279-session",s);window.addEventListener("mov279-page",r);return()=>{window.removeEventListener("mov279-refresh",a);window.removeEventListener("mov279-session",s);window.removeEventListener("mov279-page",r);};},[refreshActor,refreshSession,router]);return <><span data-testid="booking-load-identity">{actor.status==="authorized"?[actor.profile.slug,actor.demoRun.slug,actor.role].join(":"):actor.status}</span><button onClick={()=>router.push("/explore")}>Back to fixture explore</button></>;}export function Navigation(){const router=useRouter();return <button onClick={()=>router.push("/coach/sessions/19700000-0000-4000-8000-000000000001?probe="+crypto.randomUUID()+"#reschedule")}>Open fixture session</button>;}`,
    );
    await writeFile(
      path.join(checkout, "src/app/explore/page.tsx"),
      `import {Navigation} from "@/tests-fixtures/booking-load-controls";export default function Fixture(){return <><h1>Explicit booking load fixture</h1><Navigation/></>}`,
    );
    await mkdir(path.join(checkout, "src/app/coach/sessions"), {
      recursive: true,
    });
    await writeFile(
      path.join(checkout, "src/app/coach/sessions/layout.tsx"),
      `import {Controls} from "@/tests-fixtures/booking-load-controls";export default function Layout({children}:{children:React.ReactNode}){return <><Controls/>{children}</>}`,
    );
  }
  const bookingActions = process.argv.includes("--booking-actions");
  const startPicker = process.argv.includes("--booking-start-picker");
  const manualBooking = process.argv.includes("--manual-client-booking");
  if (manualBooking) {
    await mkdir(path.join(checkout, "src/app/coach/manual-booking-fixture"), {
      recursive: true,
    });
    await cp(
      path.join(root, "tests/fixtures/manual-client-booking-page.tsx"),
      path.join(checkout, "src/app/coach/manual-booking-fixture/page.tsx"),
    );
  }
  if (startPicker) {
    await mkdir(path.join(checkout, "src/app/coach/booking-picker-fixture"), {
      recursive: true,
    });
    await cp(
      path.join(root, "tests/fixtures/booking-start-picker-page.tsx"),
      path.join(checkout, "src/app/coach/booking-picker-fixture/page.tsx"),
    );
  }
  const cardIds = Array.from(
    { length: 6 },
    (_, i) => `18700000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  );
  if (bookingActions) {
    await mkdir(path.join(checkout, "src/app/coach/booking-actions-fixture"), {
      recursive: true,
    });
    await writeFile(
      path.join(checkout, "src/app/coach/booking-actions-fixture/page.tsx"),
      `
      import {CoachClientCards} from "@/features/coaches/coach-client-cards";
      import type {PrivateBookingProjection} from "@/domain/coach-bookings";
      const ids=${JSON.stringify(cardIds)};
      const base:PrivateBookingProjection={id:ids[0],slotId:ids[0],coachProfileId:ids[0],coachDisplayName:"Fixture coach",coachSlug:"fixture",coachPortraitUrl:null,clientProfileId:ids[1],clientDisplayName:"Future athlete",clientAvatarUrl:null,athleteProfileHref:null,status:"confirmed",scheduledStartAt:"2026-11-09T09:00:00Z",scheduledEndAt:"2026-11-09T10:00:00Z",coachTimezone:"Europe/Berlin",location:{trainingLocationId:null,name:"Fixture studio",kind:"independent",gymName:null,publicLabel:"Fixture studio"},cancelledBy:null,cancelledAt:null,completedAt:null,createdAt:"2026-11-01T10:00:00Z",title:"",titleRevision:0,canEditTitle:false,hasSessionDetails:true};
      const cards:PrivateBookingProjection[]=[base,{...base,id:ids[1],clientDisplayName:"Past athlete",scheduledStartAt:"2026-11-06T09:00:00Z",scheduledEndAt:"2026-11-06T10:00:00Z"},{...base,id:ids[2],clientDisplayName:"Cancelled athlete",status:"cancelled",cancelledBy:"coach",cancelledAt:"2026-11-07T09:00:00Z"},{...base,id:ids[3],clientDisplayName:"Completed athlete",status:"completed",scheduledStartAt:"2026-11-06T09:00:00Z",scheduledEndAt:"2026-11-06T10:00:00Z",completedAt:"2026-11-06T11:00:00Z"},{...base,id:ids[4],clientDisplayName:"Unsupported athlete",hasSessionDetails:undefined}];
      export default function Fixture(){return <><h1>Explicit booking action fixtures</h1><p>No real booking or database.</p><div className="coach-bookings-workspace"><CoachClientCards bookings={cards} referenceTime="2026-11-07T10:00:00Z"/></div><h2>Shared athlete layout</h2><CoachClientCards bookings={[{...base,id:ids[5]}]} referenceTime="2026-11-07T10:00:00Z"/></>}
    `,
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
  pageForFailure = page;
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
  if (!bookingLoad) {
    for (const route of [
      "explore",
      "coach",
      "messages",
      "account",
      "profile",
    ]) {
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
    await expect(bell()).toHaveAttribute(
      "aria-label",
      "Notifications, 0 unread",
    );
    assert.ok(writes.at(-1).args.throughAt);
    await dialog().getByRole("button", { name: "Unread", exact: true }).click();
    await expect(dialog()).toContainText("You’re all caught up");
    console.log(
      "PASS explicit read controls, bounded paging, stable focus refresh, unavailable and mutation retry states",
    );
    await dialog().getByRole("button", { name: "All", exact: true }).click();
    await expect(dialog().getByRole("link")).toHaveCount(20);
    // MOV-85: mixed booking/text history uses the same controller and recovery.
    const bookingSlot = randomUUID();
    items[0] = {
      id: items[0].id,
      createdAt: items[0].createdAt,
      readAt: null,
      kind: "booking",
      event: "requested",
      sourceKind: "request",
      sourceId: randomUUID(),
      slotId: bookingSlot,
      recipientRole: "coach",
      startsAt: "2026-10-26T09:00:00.000Z",
      endsAt: "2026-10-26T10:15:00.000Z",
      venueName: "Berlin training studio",
    };
    await page.keyboard.press("Escape");
    await bell().click();
    await expect(
      dialog().getByRole("link", { name: /Booking request submitted/ }),
    ).toHaveAttribute(
      "href",
      `/coach?view=bookings&section=requests&occurrence=${bookingSlot}#coach-occurrence-${bookingSlot}`,
    );
    await expect(dialog()).toContainText("75 min · Berlin training studio");
    await dialog()
      .getByRole("button", {
        name: "Mark booking request submitted notification as read",
        exact: true,
      })
      .click();
    await expect(bell()).toHaveAttribute(
      "aria-label",
      "Notifications, 0 unread",
    );
    console.log(
      "PASS booking event title/snapshot/safe destination and explicit read in mixed history",
    );
    // MOV-185: affected athletes share the existing bell/read controller.
    const athleteBooking = randomUUID();
    for (const [event, title, width] of [
      ["confirmed", "Booking confirmed", 1440],
      ["changed", "Booking rescheduled", 375],
      ["cancelled", "Booking cancelled", 320],
    ]) {
      items[0] = {
        ...items[0],
        event,
        sourceKind: "booking",
        sourceId: athleteBooking,
        recipientRole: "athlete",
        readAt: null,
      };
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width, height: 900 });
      await bell().click();
      await expect(
        dialog().getByRole("link", { name: new RegExp(title) }),
      ).toHaveAttribute("href", `/sessions#athlete-booking-${athleteBooking}`);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const mark = dialog().getByRole("button", {
        name: `Mark ${title.toLowerCase()} notification as read`,
        exact: true,
      });
      await mark.focus();
      await page.keyboard.press("Enter");
      await expect(bell()).toHaveAttribute(
        "aria-label",
        "Notifications, 0 unread",
      );
    }
    console.log(
      "PASS athlete confirmed/rescheduled/cancelled entries:1440/375/320 layout, correct private destination and keyboard mark-read",
    );
    // MOV-86: group notices use the same recipient/read/recovery controller.
    const groupId = randomUUID();
    items[0] = {
      id: items[0].id,
      createdAt: items[0].createdAt,
      readAt: null,
      kind: "group",
      event: "approval-expired",
      sessionId: groupId,
      recipientRole: "coach",
      title: "Group practice",
      startsAt: "2026-10-29T17:00:00.000Z",
      endsAt: "2026-10-29T18:00:00.000Z",
      venueName: "Berlin studio",
      eventStatus: "confirmed",
      participationStatus: null,
      affectedCount: 12,
    };
    await page.keyboard.press("Escape");
    await bell().click();
    await expect(
      dialog().getByRole("link", { name: /Group approval deadline passed/ }),
    ).toHaveAttribute("href", `/coach/events/${groupId}`);
    await expect(dialog()).toContainText("Group practice");
    await dialog()
      .getByRole("button", {
        name: "Mark group approval deadline passed notification as read",
        exact: true,
      })
      .click();
    await expect(bell()).toHaveAttribute(
      "aria-label",
      "Notifications, 0 unread",
    );
    console.log(
      "PASS group title/snapshot/owner destination and explicit read in mixed history",
    );
    // MOV-253: both recipient roles use the same bell and independent read controls.
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      for (const recipientRole of ["coach", "athlete"]) {
        const senderName =
          recipientRole === "coach"
            ? "Athlete request sender"
            : "Coach request sender";
        items[0] = {
          id: items[0].id,
          createdAt: items[0].createdAt,
          readAt: null,
          kind: "connection-request",
          requestId: randomUUID(),
          senderName,
          recipientRole,
        };
        const beforeWrites = writes.length;
        await page.keyboard.press("Escape");
        await bell().click();
        const link = dialog().getByRole("link", {
          name: new RegExp("Connection request from " + senderName),
        });
        await expect(link).toHaveAttribute(
          "href",
          recipientRole === "coach"
            ? "/coach/athletes?section=requests"
            : "/my-coaches?section=requests",
        );
        await expect(link).toContainText("They sent you a connection request.");
        await expect(bell()).toHaveAttribute(
          "aria-label",
          "Notifications, 1 unread",
        );
        assert.equal(
          writes.length,
          beforeWrites,
          "Opening connection notice must not mark it read or accept it",
        );
        await link.focus();
        await page.keyboard.press("Tab");
        const mark = dialog().getByRole("button", {
          name: "Mark connection request from " + senderName + " as read",
          exact: true,
        });
        await expect(mark).toBeFocused();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await dialog().screenshot({
          path: path.join(
            output,
            `connection-request-${recipientRole}-${width}.png`,
          ),
        });
        await page.keyboard.press("Enter");
        await expect(bell()).toHaveAttribute(
          "aria-label",
          "Notifications, 0 unread",
        );
        assert.deepEqual(writes.at(-1), {
          action: "read",
          args: { id: items[0].id },
        });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log(
      "PASS connection request bell in mixed history: both recipient destinations, sender/title, no auto-read/decision, keyboard read and1440/375/320 bounds",
    );
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
    await expect(bell()).toHaveAttribute(
      "aria-label",
      "Notifications, 0 unread",
    );
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
    await expect(page.getByTestId("fixture-current-actor")).toHaveText(
      "fixture-other",
    );
    await expect(bell()).toHaveAttribute(
      "aria-label",
      "Notifications, 0 unread",
    );
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
  }
  if (bookingActions) {
    await context.addCookies([
      { name: "mov81-actor", value: "owner", url: base },
    ]);
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + "/coach/booking-actions-fixture");
      for (const i of [0, 5]) {
        const card = page.locator("#coach-booking-" + cardIds[i]);
        const details = card.getByRole("link", {
            name: "Session details",
            exact: true,
          }),
          reschedule = card.getByRole("link", {
            name: "Reschedule",
            exact: true,
          }),
          cancel = card.getByRole("button", {
            name: "Cancel session",
            exact: true,
          });
        await expect(reschedule).toHaveAttribute(
          "href",
          `/coach/sessions/${cardIds[i]}#reschedule`,
        );
        await expect(details).toBeVisible();
        await expect(cancel).toBeVisible();
        await details.focus();
        await page.keyboard.press("Tab");
        await expect(reschedule).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(cancel).toBeFocused();
        await card.screenshot({
          path: path.join(output, `booking-actions-${i}-${width}.png`),
        });
      }
      for (const i of [1, 2, 3, 4])
        await expect(
          page
            .locator("#coach-booking-" + cardIds[i])
            .getByRole("link", { name: "Reschedule", exact: true }),
        ).toHaveCount(0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    console.log(
      "PASS direct Reschedule action, details/reschedule/cancel keyboard order,1440/375/320 Bookings/shared athlete layouts and no past/cancelled/completed/unsupported shortcut",
    );
  }
  if (manualBooking) {
    const fixtureId = "25100000-0000-4000-8000-000000000001";
    const posts = [];
    let outcome = "conflict";
    await page.route("**/api/session-bookings?*", (route) => {
      if (route.request().method() === "POST") {
        posts.push(route.request().postDataJSON());
        return route.fulfill({
          status: outcome === "conflict" ? 409 : 503,
          json: { status: outcome },
        });
      }
      return route.fulfill({
        json: {
          status: "ready",
          types: [
            {
              id: fixtureId,
              format: "private",
              name: "Manual fixture",
              durationMinutes: 60,
              defaultLocationId: fixtureId,
              archived: false,
              bookable: true,
              revision: 0,
            },
          ],
          locations: [{ id: fixtureId, name: "Fixture studio" }],
          athletes: {
            items: [
              {
                id: fixtureId,
                athleteProfileId: fixtureId,
                athleteDisplayName: "Connected fixture",
              },
            ],
            nextCursor: null,
          },
          externalClients: {
            items: [
              {
                id: fixtureId,
                name: "External fixture",
                email: null,
                linkedProfileId: null,
                revision: 0,
              },
            ],
            next: null,
          },
        },
      });
    });
    await context.addCookies([
      { name: "mov81-actor", value: "owner", url: base },
    ]);
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      for (const kind of ["platform", "external"]) {
        posts.length = 0;
        outcome = "conflict";
        await page.goto(base + "/coach/manual-booking-fixture");
        await expect(
          page.getByText("You don’t need to set working hours first.", {
            exact: false,
          }),
        ).toBeVisible();
        await expect(
          page.getByLabel("Athlete type", { exact: true }),
        ).toHaveCount(0);
        const athlete = page.getByLabel("Athlete", { exact: true });
        await expect(athlete.locator('option[value=""]')).toHaveText(
          "Choose athlete",
        );
        await expect(
          athlete.getByRole("option", {
            name: "Add external athlete",
            exact: true,
          }),
        ).toHaveAttribute("value", "external");
        assert.equal(
          await athlete.evaluate(
            (el) =>
              el.validity.valueMissing &&
              el.form?.getAttribute("aria-labelledby") ===
                "booking-change-heading",
          ),
          true,
          "Empty athlete selection participates in native booking-form validation",
        );
        await athlete.selectOption(
          kind === "platform" ? fixtureId : "external",
        );
        if (kind === "external")
          await page
            .getByLabel("External athlete", { exact: true })
            .selectOption(fixtureId);
        assert.equal(await page.locator("form form").count(), 0);
        await page
          .getByLabel("Session type", { exact: true })
          .selectOption(fixtureId);
        await page
          .getByRole("button", { name: "Start · Berlin time", exact: true })
          .click();
        const picker = page.getByRole("dialog", {
          name: "Choose session date and time",
          exact: true,
        });
        await expect(picker.getByRole("radio", { checked: true })).toHaveCount(
          0,
        );
        await expect(picker.locator(".booking-start-selection")).toContainText(
          "Choose a time",
        );
        await picker.getByLabel("Date", { exact: true }).fill("2030-11-09");
        await picker
          .getByRole("button", { name: "Apply date and time", exact: true })
          .click();
        await expect(
          picker
            .getByRole("group", { name: "Hour", exact: true })
            .getByRole("radio", { name: "00", exact: true }),
        ).toBeFocused();
        await expect(picker.getByRole("radio", { checked: true })).toHaveCount(
          0,
        );
        await picker
          .getByRole("group", { name: "Hour", exact: true })
          .getByRole("radio", { name: "12", exact: true })
          .check();
        await picker
          .getByRole("button", { name: "Apply date and time", exact: true })
          .click();
        await expect(
          picker
            .getByRole("group", { name: "Minutes", exact: true })
            .getByRole("radio", { name: "00", exact: true }),
        ).toBeFocused();
        await expect(
          picker
            .getByRole("group", { name: "Minutes", exact: true })
            .getByRole("radio", { checked: true }),
        ).toHaveCount(0);
        await picker
          .getByRole("group", { name: "Minutes", exact: true })
          .getByRole("radio", { name: "30", exact: true })
          .check();
        await picker
          .getByRole("button", { name: "Apply date and time", exact: true })
          .click();
        const confirm = page.getByRole("button", {
          name: "Schedule session",
          exact: true,
        });
        await expect(page.getByRole("checkbox")).toHaveCount(0);
        assert.equal(posts.length, 0, "Selecting terms must not submit");
        // Changing the selected participant must not submit a booking.
        await athlete.selectOption(
          kind === "platform" ? "external" : fixtureId,
        );
        assert.equal(
          posts.length,
          0,
          "Switching athletes must not create contacts or bookings",
        );
        await athlete.selectOption(
          kind === "platform" ? fixtureId : "external",
        );
        if (kind === "external")
          await page
            .getByLabel("External athlete", { exact: true })
            .selectOption(fixtureId);
        await confirm.focus();
        await page.keyboard.press("Enter");
        await expect(
          page.getByRole("status").filter({
            hasText: "The class, connection, booking or time changed.",
          }),
        ).toBeFocused();
        assert.equal(posts.length, 1);
        assert.equal(posts[0].action, "create");
        assert.equal(
          posts[0][kind === "platform" ? "athleteId" : "externalClientId"],
          fixtureId,
        );
        assert.equal(
          posts[0][kind === "platform" ? "externalClientId" : "athleteId"],
          undefined,
          "Only the selected participant kind is sent",
        );
        assert.equal(posts[0].outsideHoursConfirmed, undefined);
        await expect(
          page.getByRole("button", {
            name: "Start · Berlin time",
            exact: true,
          }),
        ).toContainText("12:30");
        outcome = "unavailable";
        await confirm.click();
        const retry = page.getByRole("button", {
          name: "Retry same session",
          exact: true,
        });
        await expect(retry).toBeVisible();
        await expect(athlete).toBeDisabled();
        await retry.click();
        await expect.poll(() => posts.length).toBe(3);
        assert.deepEqual(
          posts[2],
          posts[1],
          "unknown recovery retains the exact submitted command",
        );
        await expect(retry).toBeEnabled();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.screenshot({
          path: path.join(output, `manual-booking-${kind}-${width}.png`),
          fullPage: true,
        });
      }
    }
    console.log(
      "PASS manual connected/external form guidance, no hours acknowledgement, direct keyboard submission, conflict draft retention and exact unknown retry at1440/375/320 (explicit fixtures only)",
    );
  }
  if (startPicker) {
    const fixtureId = "19700000-0000-4000-8000-000000000001";
    const type = {
      id: fixtureId,
      format: "private",
      name: "Picker fixture",
      description: "",
      color: "#123456",
      durationMinutes: 75,
      defaultLocationId: fixtureId,
      bookable: true,
      archived: false,
      revision: 0,
    };
    const posts = [];
    await page.route("**/api/session-notes*", (route) =>
      route.fulfill({ status: 503, json: { status: "unavailable" } }),
    );
    await page.route("**/api/session-bookings?*", (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        posts.push(request.postDataJSON());
        return route.fulfill({ status: 503, json: { status: "unavailable" } });
      }
      if (request.headers().cookie?.includes("mov81-actor=other"))
        return route.fulfill({ status: 403, json: { status: "forbidden" } });
      if (new URL(request.url()).searchParams.has("options"))
        return route.fulfill({
          json: {
            status: "ready",
            types: [type],
            locations: [{ id: fixtureId, name: "Fixture studio" }],
            athletes: { items: [], nextCursor: null },
            externalClients: { items: [], nextCursor: null },
          },
        });
      return route.fulfill({
        json: {
          status: "ready",
          detail: {
            bookingId: fixtureId,
            revision: 0,
            status: "confirmed",
            startsAt: "2030-11-09T17:00:00Z",
            endsAt: "2030-11-09T18:15:00Z",
            locationId: fixtureId,
            venueName: "Fixture studio",
            sessionType: type,
            athleteId: null,
            externalClient: null,
            viewerIsCoach: true,
            historyTotal: 0,
            nextHistoryRevision: null,
            changes: [],
          },
        },
      });
    });
    const trigger = () =>
      page.getByRole("button", { name: "Start · Berlin time", exact: true });
    const picker = () =>
      page.getByRole("dialog", {
        name: "Choose session date and time",
        exact: true,
      });
    const apply = () =>
      picker().getByRole("button", {
        name: "Apply date and time",
        exact: true,
      });
    const cancel = () =>
      picker().getByRole("button", {
        name: "Cancel date and time selection",
        exact: true,
      });
    for (const width of [1440, 375, 320]) {
      await context.addCookies([
        { name: "mov81-actor", value: "owner", url: base },
      ]);
      await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
      await page.goto(base + "/coach/booking-picker-fixture", {
        timeout: 120000,
      });
      await expect(trigger()).toContainText("18:00");
      await trigger().focus();
      await page.keyboard.press("Enter");
      await expect(picker()).toBeVisible();
      const hours = picker().getByRole("group", { name: "Hour", exact: true });
      const minutes = picker().getByRole("group", {
        name: "Minutes",
        exact: true,
      });
      await expect(minutes).toBeVisible();
      assert.deepEqual(
        await picker()
          .getByRole("group", { name: "Minutes", exact: true })
          .getByRole("radio")
          .evaluateAll((items) => items.map((x) => x.value).filter(Boolean)),
        ["00", "15", "30", "45"],
      );
      await expect(hours.getByRole("radio")).toHaveCount(24);
      await expect(picker().getByRole("combobox")).toHaveCount(0);
      await expect(
        hours.getByRole("radio", { name: "18", exact: true }),
      ).toBeChecked();
      await expect(
        minutes.getByRole("radio", { name: "00", exact: true }),
      ).toBeChecked();
      assert.equal(
        await picker()
          .getByRole("radio")
          .evaluateAll((items) =>
            items.every((item) => {
              const bounds = item.getBoundingClientRect();
              return bounds.width >= 44 && bounds.height >= 44;
            }),
          ),
        true,
        "Every time choice has a 44px touch target",
      );
      await picker()
        .getByRole("group", { name: "Hour", exact: true })
        .getByRole("radio", { name: "19", exact: true })
        .check();
      await picker()
        .getByRole("group", { name: "Minutes", exact: true })
        .getByRole("radio", { name: "30", exact: true })
        .check();
      await expect(trigger()).toContainText("18:00");
      await expect(picker().locator(".booking-start-selection")).toContainText(
        "19:30",
      );
      await expect(picker().locator(".booking-start-selection")).toContainText(
        "9 November 2030",
      );
      await hours.getByRole("radio", { name: "19", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(
        hours.getByRole("radio", { name: "20", exact: true }),
      ).toBeChecked();
      await page.keyboard.press("ArrowLeft");
      await expect(
        hours.getByRole("radio", { name: "19", exact: true }),
      ).toBeChecked();
      await page.keyboard.press("Tab");
      await expect(
        minutes.getByRole("radio", { name: "30", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(
        minutes.getByRole("radio", { name: "45", exact: true }),
      ).toBeChecked();
      await page.keyboard.press("ArrowLeft");
      await expect(
        minutes.getByRole("radio", { name: "30", exact: true }),
      ).toBeChecked();
      await expect(picker().locator(".booking-start-selection")).toContainText(
        "19:30",
      );
      await expect(apply()).toBeInViewport({ ratio: 1 });
      await expect(cancel()).toBeInViewport({ ratio: 1 });
      await expect(picker().locator(".booking-start-selection")).toBeInViewport(
        { ratio: 1 },
      );
      assert.equal(await page.locator("form form").count(), 0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: path.join(output, "booking-start-picker-" + width + ".png"),
      });
      await apply().focus();
      await page.keyboard.press("Tab");
      await expect(
        picker().getByRole("button", { name: "Close dialog", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(apply()).toBeFocused();
      await cancel().click();
      await expect(picker()).toHaveCount(0);
      await expect(trigger()).toBeFocused();
      await expect(trigger()).toContainText("18:00");
      for (const method of ["Escape", "close", "backdrop"]) {
        await trigger().click();
        await picker()
          .getByRole("group", { name: "Hour", exact: true })
          .getByRole("radio", { name: "22", exact: true })
          .check();
        if (method === "Escape") await page.keyboard.press("Escape");
        else if (method === "close")
          await picker()
            .getByRole("button", { name: "Close dialog", exact: true })
            .click();
        else await page.mouse.click(2, 2);
        await expect(picker()).toHaveCount(0);
        await expect(trigger()).toBeFocused();
        await expect(trigger()).toContainText("18:00");
      }
      await trigger().click();
      await picker()
        .getByRole("group", { name: "Hour", exact: true })
        .getByRole("radio", { name: "19", exact: true })
        .check();
      await picker()
        .getByRole("group", { name: "Minutes", exact: true })
        .getByRole("radio", { name: "15", exact: true })
        .check();
      await apply().focus();
      await page.keyboard.press("Enter");
      await expect(picker()).toHaveCount(0);
      await expect(trigger()).toBeFocused();
      await expect(trigger()).toContainText("19:15");
      await expect(
        page.getByRole("region", {
          name: "Review booking change",
          exact: true,
        }),
      ).toHaveCount(0);
      await trigger().click();
      await expect(
        picker()
          .getByRole("group", { name: "Minutes", exact: true })
          .getByRole("radio", { name: "15", exact: true }),
      ).toBeChecked();
      await cancel().click();
      assert.equal(posts.length, 0);
    }
    // Invalid and ambiguous local dates cannot be applied. Off-grid API rejection
    // remains covered by the server contracts and rescheduling integration.
    await trigger().click();
    await picker().getByLabel("Date", { exact: true }).fill("");
    await apply().click();
    await expect(picker().getByLabel("Date", { exact: true })).toBeFocused();
    await expect(trigger()).toContainText("19:15");
    await picker().getByLabel("Date", { exact: true }).fill("2030-11-09");
    await expect(
      picker()
        .getByRole("group", { name: "Minutes", exact: true })
        .getByRole("radio", { name: "20", exact: true }),
    ).toHaveCount(0);
    await picker()
      .getByRole("group", { name: "Minutes", exact: true })
      .getByRole("radio", { name: "15", exact: true })
      .check();
    for (const date of ["2027-03-28", "2027-10-31"]) {
      await picker().getByLabel("Date", { exact: true }).fill(date);
      await picker()
        .getByRole("group", { name: "Hour", exact: true })
        .getByRole("radio", { name: "02", exact: true })
        .check();
      await apply().click();
      await expect(picker().getByRole("alert")).toContainText(
        "valid, unambiguous Berlin",
      );
      await expect(picker().getByRole("alert")).toBeInViewport({ ratio: 1 });
      await expect(apply()).toBeInViewport({ ratio: 1 });
      await expect(cancel()).toBeInViewport({ ratio: 1 });
      await expect(picker().locator(".booking-start-selection")).toBeInViewport(
        { ratio: 1 },
      );
      await expect(trigger()).toContainText("19:15");
    }
    await picker().getByLabel("Date", { exact: true }).fill("2030-11-09");
    await picker()
      .getByRole("group", { name: "Hour", exact: true })
      .getByRole("radio", { name: "19", exact: true })
      .check();
    await picker()
      .getByRole("group", { name: "Minutes", exact: true })
      .getByRole("radio", { name: "30", exact: true })
      .check();
    // Actual provider revalidation suspends the top layer but retains the same actor's draft.
    await page.route("**/api/auth/actor", (route) =>
      route.fulfill({ status: 503, json: { status: "unavailable" } }),
    );
    await page.evaluate(() =>
      window.dispatchEvent(new Event("mov197-refresh")),
    );
    await expect(picker()).toHaveCount(0);
    await expect(
      page.getByText("Checking your account…", { exact: true }).first(),
    ).toBeVisible();
    await page.unroute("**/api/auth/actor");
    await page.evaluate(() =>
      window.dispatchEvent(new Event("mov197-refresh")),
    );
    await expect(picker()).toBeVisible();
    await expect(
      picker()
        .getByRole("group", { name: "Minutes", exact: true })
        .getByRole("radio", { name: "30", exact: true }),
    ).toBeChecked();
    await cancel().click();
    await expect(trigger()).toBeFocused();
    await expect(trigger()).toContainText("19:15");
    await trigger().click();
    await picker()
      .getByRole("group", { name: "Minutes", exact: true })
      .getByRole("radio", { name: "45", exact: true })
      .check();
    await context.addCookies([
      { name: "mov81-actor", value: "other", url: base },
    ]);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("mov197-session")),
    );
    await expect(picker()).toHaveCount(0);
    await expect(trigger()).toHaveCount(0);
    await expect(
      page.getByText(
        "This session could not be verified for your account. Reload to try again.",
        { exact: false },
      ),
    ).toBeVisible();
    await context.addCookies([
      { name: "mov81-actor", value: "owner", url: base },
    ]);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("mov197-session")),
    );
    await expect(trigger()).toContainText("18:00");
    await trigger().click();
    await expect(
      picker()
        .getByRole("group", { name: "Minutes", exact: true })
        .getByRole("radio", { name: "00", exact: true }),
    ).toBeChecked();
    await context.addCookies([
      { name: "mov81-actor", value: "signed-out", url: base },
    ]);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("mov197-session")),
    );
    await expect(picker()).toHaveCount(0);
    await expect(trigger()).toHaveCount(0);
    await expect(
      page.getByText("Sign in with the appropriate account to continue.", {
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(posts.length, 0);
    await context.addCookies([
      { name: "mov81-actor", value: "owner", url: base },
    ]);
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto(base + "/coach/booking-picker-fixture");
    await trigger().click();
    await picker().getByLabel("Date", { exact: true }).fill("2027-03-28");
    await picker()
      .getByRole("group", { name: "Hour", exact: true })
      .getByRole("radio", { name: "02", exact: true })
      .check();
    await picker()
      .getByRole("group", { name: "Minutes", exact: true })
      .getByRole("radio", { name: "45", exact: true })
      .check();
    await apply().click();
    await expect(picker().getByRole("alert")).toBeInViewport({ ratio: 1 });
    await expect(apply()).toBeInViewport({ ratio: 1 });
    await expect(cancel()).toBeInViewport({ ratio: 1 });
    await expect(picker().locator(".booking-start-selection")).toBeInViewport({
      ratio: 1,
    });
    await picker()
      .getByRole("group", { name: "Hour", exact: true })
      .getByRole("radio", { name: "23", exact: true })
      .check();
    await expect(
      picker()
        .getByRole("group", { name: "Hour", exact: true })
        .getByRole("radio", { name: "23", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: path.join(output, "booking-start-picker-landscape.png"),
    });
    await cancel().click();
    await expect(trigger()).toContainText("18:00");
    assert.equal(posts.length, 0);
    console.log(
      "PASS real booking picker: 24 hours/four quarter-hours, 44px targets, summary, native keyboard arrows/Tab, Apply/Cancel/Escape/close/backdrop, focus/viewport 1440/375/320x568/568x320, invalid/DST refusal, actual account-check draft suspension/resume and actor/sign-out clearing; zero Review/Save traffic",
    );
  }
  if (bookingLoad) {
    const id = "19700000-0000-4000-8000-000000000001";
    const href = base + "/coach/sessions/" + id;
    const visit = async (url) => {
      await page.goto(base + "/explore");
      return page.goto(url);
    };
    const summary = () =>
      page.getByRole("heading", { name: "Booking load fixture", exact: true });
    const start = () =>
      page.getByRole("button", { name: "Start · Berlin time", exact: true });
    const cookie = async (actor = "owner", fault = "none") =>
      context.addCookies([
        { name: "mov81-actor", value: actor, url: base },
        { name: "mov81-fault", value: fault, url: base },
      ]);
    const counter = async (reset = false) =>
      (
        await context.request.get(
          base + "/api/booking-load-fixture" + (reset ? "?reset=1" : ""),
        )
      ).json();
    const event = async (name) =>
      page.evaluate((name) => window.dispatchEvent(new Event(name)), name);
    const detailGets = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname === "/api/session-bookings" &&
        request.method() === "GET" &&
        url.searchParams.has("bookingId")
      )
        detailGets.push(request.url());
    });
    await cookie();
    const actorReady = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/auth/actor",
    );
    await visit(href);
    await actorReady;
    await expect(start()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add a note", exact: true }),
    ).toBeEnabled();
    // Warm the actual SPA transition too: its first RSC/chunk compilation is
    // development overhead, not the controlled read waterfall being measured.
    await page
      .getByRole("button", { name: "Back to fixture explore", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open fixture session", exact: true })
      .click();
    await expect(start()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add a note", exact: true }),
    ).toBeEnabled();
    const results = [];
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page
        .getByRole("button", { name: "Back to fixture explore", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Open fixture session", exact: true }),
      ).toBeVisible();
      await counter(true);
      detailGets.length = 0;
      const began = performance.now();
      await page
        .getByRole("button", { name: "Open fixture session", exact: true })
        .click();
      await expect(summary()).toBeVisible();
      const summaryMs = performance.now() - began;
      await expect(start()).toBeVisible();
      await expect(page.locator("#reschedule")).toBeFocused();
      const editorMs = performance.now() - began;
      await expect(
        page.getByRole("button", { name: "Add a note", exact: true }),
      ).toBeEnabled();
      const c = await counter();
      assert.equal(c.detail, 1);
      assert.equal(detailGets.length, bookingLoadBaseline ? 1 : 0);
      assert.equal(c.notes, bookingLoadBaseline ? 2 : 1);
      assert.equal(c.externalClients ?? 0, bookingLoadBaseline ? 1 : 0);
      assert.equal(c.athletes ?? 0, bookingLoadBaseline ? 1 : 0);
      assert.equal(c.authorization, bookingLoadBaseline ? 4 : 3);
      assert.equal(c.pageActor ?? 0, bookingLoadBaseline ? 1 : 0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: path.join(
          output,
          `booking-load-${bookingLoadBaseline ? "baseline" : "current"}-${width}.png`,
        ),
      });
      results.push({
        width,
        summaryMs,
        editorMs,
        detailGets: detailGets.length,
        counts: c,
      });
    }
    await writeFile(
      path.join(
        output,
        `booking-load-${bookingLoadBaseline ? "baseline" : "current"}.json`,
      ),
      JSON.stringify(results, null, 2),
    );
    console.log("TIMING controlled booking load", JSON.stringify(results));
    if (!bookingLoadBaseline) {
      // Notes and edit-options reads cannot gate the canonical summary.
      let release;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      await page.route(
        "**/api/session-bookings?options=edit",
        async (route) => {
          await held;
          await route.continue();
        },
      );
      await page.route("**/api/session-notes", (route) =>
        route.fulfill({ status: 503, json: { status: "unavailable" } }),
      );
      await visit(href);
      await expect(summary()).toBeVisible();
      await expect(
        page.getByText("Loading booking options…", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Session notes could not be loaded. Try again.", {
          exact: true,
        }),
      ).toBeVisible();
      release();
      await expect(start()).toBeVisible();
      await page.unroute("**/api/session-bookings?options=edit");
      await page.unroute("**/api/session-notes");
      await cookie("owner", "options");
      await visit(href);
      await expect(summary()).toBeVisible();
      await expect(
        page.getByText(
          "Coach scheduling options are unavailable. Check your access and reload.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add a note", exact: true }),
      ).toBeEnabled();
      // Real page denial/error boundaries use the actual service and repositories.
      for (const actor of ["other", "athlete", "signed-out"]) {
        await cookie(actor);
        const response = await visit(href);
        assert.equal(
          response.status(),
          404,
          actor + " cannot open the coach page",
        );
        await expect(summary()).toHaveCount(0);
      }
      await cookie("athlete");
      await counter(true);
      detailGets.length = 0;
      await visit(base + "/sessions/" + id);
      await expect(summary()).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add a note", exact: true }),
      ).toBeEnabled();
      await expect(start()).toHaveCount(0);
      assert.equal(
        detailGets.length,
        1,
        "Nonseeded athlete detail retains its authorized GET",
      );
      assert.equal(
        (await counter()).types ?? 0,
        0,
        "Athlete detail never loads coach edit options",
      );
      console.log(
        "PASS nonseeded athlete detail: one authorized GET, no coach options, independent notes",
      );
      await cookie("owner", "booking");
      await visit(href);
      await expect(
        page.getByRole("heading", { name: "Session unavailable", exact: true }),
      ).toBeVisible();
      await expect(summary()).toHaveCount(0);
      await cookie();
      for (const suffix of [
        "invalid",
        "19700000-0000-4000-8000-000000000002",
      ]) {
        const response = await visit(base + "/coach/sessions/" + suffix);
        assert.equal(response.status(), 404);
        await expect(summary()).toHaveCount(0);
      }
      await counter(true);
      const invalid = await context.request.get(
        base + "/api/session-bookings?options=edit&cursor=null",
      );
      assert.equal(invalid.status(), 400);
      assert.equal((await counter()).authorization ?? 0, 0);
      for (const actor of ["athlete", "suspended", "signed-out"]) {
        await cookie(actor);
        const r = await context.request.get(
          base + "/api/session-bookings?options=edit",
        );
        assert.equal(r.status(), actor === "signed-out" ? 401 : 403);
      }
      // Seeded editor drafts survive same-actor verification and fresh page props.
      await cookie();
      await visit(href);
      await expect(start()).toContainText("18:00");
      await expect(
        page.getByRole("button", { name: "Add a note", exact: true }),
      ).toBeEnabled();
      detailGets.length = 0;
      await start().click();
      const picker = page.getByRole("dialog", {
        name: "Choose session date and time",
        exact: true,
      });
      await picker
        .getByRole("group", { name: "Hour", exact: true })
        .getByRole("radio", { name: "19", exact: true })
        .check();
      await picker
        .getByRole("group", { name: "Minutes", exact: true })
        .getByRole("radio", { name: "30", exact: true })
        .check();
      await picker
        .getByRole("button", { name: "Apply date and time", exact: true })
        .click();
      await page.route("**/api/auth/actor", (route) =>
        route.fulfill({ status: 503, json: { status: "unavailable" } }),
      );
      await event("mov279-refresh");
      await expect(
        page.getByText("Checking your account…", { exact: true }).first(),
      ).toBeVisible();
      await expect(summary()).toHaveCount(0);
      await page.unroute("**/api/auth/actor");
      await event("mov279-refresh");
      await expect(start()).toContainText("19:30");
      assert.equal(detailGets.length, 0);
      await cookie("owner", "changed");
      const refreshed = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/coach/sessions/" + id &&
          response.request().headers()["rsc"] === "1",
      );
      await event("mov279-page");
      await (await refreshed).finished();
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await expect
        .poll(async () => (await counter()).detail)
        .toBeGreaterThanOrEqual(2);
      await expect(start()).toContainText("19:30");
      // Once the actor/dataset/role leaves, even the original actor must fetch.
      for (const actor of ["other", "other-run", "operator", "signed-out"]) {
        detailGets.length = 0;
        await cookie(actor, "changed");
        await event("mov279-session");
        await expect(page.getByTestId("booking-load-identity")).toHaveText(
          actor === "signed-out"
            ? "signed-out"
            : actor === "other"
              ? "fixture-other:fixture:member"
              : actor === "other-run"
                ? "fixture-owner:another-run:member"
                : "fixture-owner:fixture:operator",
        );
        if (actor === "operator") {
          await expect(start()).toContainText("20:00");
          assert.ok(
            detailGets.length > 0,
            "Role changes cannot reuse the original snapshot",
          );
        } else await expect(summary()).toHaveCount(0);
        await cookie("owner", "changed");
        await event("mov279-session");
        await expect(page.getByTestId("booking-load-identity")).toHaveText(
          "fixture-owner:fixture:member",
        );
        await expect(start()).toContainText("20:00");
        assert.ok(
          detailGets.length > 0,
          "Returning to the original identity must read current details",
        );
      }
      console.log(
        "PASS seeded coach page: real service/repository counters, no client detail request/unused lists/duplicate notes; summary independent of options/notes errors; owner/guest/athlete/other access; invalid edit cursor; initial data fenced across actor/dataset/role/sign-out and page refresh; keyboard/mobile",
      );
    }
  }
  console.log(
    "PASS desktop/mobile bounds, keyboard containment, stale actor response isolation and signed-out exclusion",
  );
} catch (error) {
  console.error(error.stack ?? error);
  if (bookingLoad && pageForFailure) {
    await pageForFailure
      .screenshot({ path: path.join(output, "booking-load-failure.png") })
      .catch(() => {});
    console.error(
      (
        await pageForFailure
          .locator("main")
          .innerText()
          .catch(() => "")
      ).slice(0, 2000),
    );
  }
  console.error(log.slice(-2500));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  if (server?.exitCode === null)
    await new Promise((resolve) => server.once("exit", resolve));
  await rm(checkout, { recursive: true, force: true });
}
