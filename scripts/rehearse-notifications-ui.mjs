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
    import {useAuthSession} from "@/auth/client/session-provider";
    export function Controls(){const {actor}=useActor();const {refreshSession}=useAuthSession();return <><span data-testid="fixture-current-actor">{actor.status==="authorized"?actor.profile.slug:actor.status}</span><button onClick={()=>{document.cookie="mov81-actor=other; path=/";void refreshSession();}}>Switch fixture actor</button></>}`,
  );
  for (const route of ["explore", "coach", "messages", "account", "profile"]) {
    await writeFile(
      path.join(checkout, `src/app/${route}/page.tsx`),
      `import {Controls} from "@/tests-fixtures/controls";export default function Fixture(){return <><h1>Explicit notification UI fixture</h1><p>No real Auth, database writes or email.</p><Controls/></>}`,
    );
  }
  const bookingActions = process.argv.includes("--booking-actions");
  const startPicker = process.argv.includes("--booking-start-picker");
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
    `/coach?view=bookings&occurrence=${bookingSlot}#coach-occurrence-${bookingSlot}`,
  );
  await expect(dialog()).toContainText("75 min · Berlin training studio");
  await dialog()
    .getByRole("button", {
      name: "Mark booking request submitted notification as read",
      exact: true,
    })
    .click();
  await expect(bell()).toHaveAttribute("aria-label", "Notifications, 0 unread");
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
  await expect(bell()).toHaveAttribute("aria-label", "Notifications, 0 unread");
  console.log(
    "PASS group title/snapshot/owner destination and explicit read in mixed history",
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
  await expect(page.getByTestId("fixture-current-actor")).toHaveText(
    "fixture-other",
  );
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
      await expect(
        picker().getByLabel("Minute", { exact: true }),
      ).toBeVisible();
      assert.deepEqual(
        await picker()
          .getByLabel("Minute", { exact: true })
          .locator("option")
          .evaluateAll((items) => items.map((x) => x.value).filter(Boolean)),
        ["00", "15", "30", "45"],
      );
      assert.equal(
        await picker()
          .getByLabel("Hour", { exact: true })
          .locator("option")
          .count(),
        25,
      );
      await picker().getByLabel("Hour", { exact: true }).selectOption("19");
      await picker().getByLabel("Minute", { exact: true }).selectOption("30");
      await expect(trigger()).toContainText("18:00");
      await expect(apply()).toBeInViewport({ ratio: 1 });
      await expect(cancel()).toBeInViewport({ ratio: 1 });
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
        await picker().getByLabel("Hour", { exact: true }).selectOption("22");
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
      await picker().getByLabel("Hour", { exact: true }).selectOption("19");
      await picker().getByLabel("Minute", { exact: true }).selectOption("15");
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
      await expect(picker().getByLabel("Minute", { exact: true })).toHaveValue(
        "15",
      );
      await cancel().click();
      assert.equal(posts.length, 0);
    }
    // Invalid and ambiguous local dates cannot be applied, even with forged DOM options.
    await trigger().click();
    await picker().getByLabel("Date", { exact: true }).fill("");
    await apply().click();
    await expect(picker().getByLabel("Date", { exact: true })).toBeFocused();
    await expect(trigger()).toContainText("19:15");
    await picker().getByLabel("Date", { exact: true }).fill("2030-11-09");
    await picker()
      .getByLabel("Minute", { exact: true })
      .evaluate((el) => {
        el.add(new Option("20", "20"));
      });
    await picker().getByLabel("Minute", { exact: true }).selectOption("20");
    await apply().click();
    await expect(picker().getByRole("alert")).toContainText(
      "valid, unambiguous Berlin",
    );
    await expect(picker().getByRole("alert")).toBeInViewport({ ratio: 1 });
    await expect(apply()).toBeInViewport({ ratio: 1 });
    await expect(cancel()).toBeInViewport({ ratio: 1 });
    await expect(trigger()).toContainText("19:15");
    await picker().getByLabel("Minute", { exact: true }).selectOption("15");
    for (const date of ["2027-03-28", "2027-10-31"]) {
      await picker().getByLabel("Date", { exact: true }).fill(date);
      await picker().getByLabel("Hour", { exact: true }).selectOption("02");
      await apply().click();
      await expect(picker().getByRole("alert")).toBeVisible();
    }
    await picker().getByLabel("Date", { exact: true }).fill("2030-11-09");
    await picker().getByLabel("Hour", { exact: true }).selectOption("19");
    await picker().getByLabel("Minute", { exact: true }).selectOption("30");
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
    await expect(picker().getByLabel("Minute", { exact: true })).toHaveValue(
      "30",
    );
    await cancel().click();
    await expect(trigger()).toBeFocused();
    await expect(trigger()).toContainText("19:15");
    await trigger().click();
    await picker().getByLabel("Minute", { exact: true }).selectOption("45");
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
        { exact: true },
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
    await expect(picker().getByLabel("Minute", { exact: true })).toHaveValue(
      "00",
    );
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
    console.log(
      "PASS real booking picker: quarter-hour options, Apply/Cancel/Escape/close/backdrop, keyboard/focus/viewport1440/375/320x568, invalid/DST refusal, actual account-check draft suspension/resume and actor/sign-out clearing; zero Review/Save traffic",
    );
  }
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
