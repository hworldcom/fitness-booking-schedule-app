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

const countsOnly = process.argv.includes("--connection-counts");
const myCoachesOnly = process.argv.includes("--my-coaches") || countsOnly;
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
    import {redirect} from "next/navigation";
    import {signInHref} from "@/auth/return-to";
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
    export async function protectedPageAccess(returnHref:string){const {session,actor}=await initialAuthorizationState(),{fault}=await fixtureScenario();if(session.status==="signed-out")redirect(signInHref(returnHref));if(fault==="workspace-forbidden")redirect(signInHref(returnHref)+"&reason=forbidden");return {status:fault==="workspace-unavailable"?"unavailable":actor.status};}
    export async function currentClientCoachMarketplaceWorkspace(){const {session,actor}=await initialAuthorizationState(),{fault}=await fixtureScenario();if(session.status!=="signed-in"||actor.status!=="authorized")return {status:actor.status};if(fault==="workspace-unavailable")return {status:"unavailable"};return {status:"authorized",subject:session.subject,actorIdentity:[actor.profile.slug,actor.demoRun.slug,actor.role].join(":"),actorProfileId:"profile-id",bookings:[],pendingRequests:[]};}
    export async function currentPendingCoachInvitation(){const {fault}=await fixtureScenario();return fault==="pending-invitation"?{status:"pending",coachName:"Invitation fixture coach"}:fault==="invitation-unavailable"?{status:"unavailable"}:null;}
    export async function sessionNotesCommand(){return {status:"ready",value:{viewerIsCoach:true}};}
  `,
  );
  await writeFile(
    path.join(checkout, "src/tests-fixtures/booking-services.ts"),
    `
    import {cookies} from "next/headers";
    import {fixtureScenario,initialAuthorizationState} from "./schedule-auth";
    const id="20800000-0000-4000-8000-000000000001";
    export async function currentOwnedCoachPendingRequestCount(){const {fault}=await fixtureScenario();return fault==="count-unavailable"?null:Number((await cookies()).get("mov208-count")?.value??55);}
    export async function currentPrivateBookingWorkspace(){return {status:"authorized",coachBookings:[]};}
    export async function currentOwnedCoachBookingRequestPage(){const jar=await cookies(),{fault}=await fixtureScenario();if(fault==="queue-unavailable")return {status:"unavailable"};return {status:"authorized",page:{items:jar.has("mov208-decided")?[]:[{id,slotId:id,clientProfileId:id,clientDisplayName:"Request fixture athlete",clientAvatarUrl:null,status:"pending",scheduledStartAt:"2035-01-01T10:00:00Z",scheduledEndAt:"2035-01-01T11:00:00Z",coachTimezone:"Europe/Berlin",location:{name:"Fixture studio",kind:"independent",gymName:null,publicLabel:"Fixture studio",trainingLocationId:null},decisionDeadlineAt:"2034-12-31T10:00:00Z",createdAt:"2034-12-01T10:00:00Z",updatedAt:"2034-12-01T10:00:00Z",decidedAt:null,acceptedBookingId:null}],nextCursor:null}};}
    async function decide(){const jar=await cookies();jar.set("mov208-count","54");jar.set("mov208-decided","yes");}
    export async function declineCoachBookingRequest(requestId:string){await decide();return {status:"authorized",outcome:"saved",value:{requestId,status:"declined",bookingId:null}};}
    export async function acceptCoachBookingRequest(requestId:string){await decide();return {status:"authorized",outcome:"saved",value:{requestId,status:"accepted",bookingId:id}};}
    export async function closeCoachBookingRequestOccurrence(){await decide();return {status:"authorized",outcome:"saved",value:"withdrawn"};}
    export async function currentClientCoachBookingRequestPage(){throw Error("Not rehearsed");}
    export async function createCoachBookingRequest(){throw Error("Not rehearsed");}
    export async function withdrawCoachBookingRequest(){throw Error("Not rehearsed");}
    export async function cancelDirectPrivateBooking(){throw Error("Not rehearsed");}
    export async function completeDirectPrivateBooking(){throw Error("Not rehearsed");}
  `,
  );
  await writeFile(
    path.join(checkout, "src/tests-fixtures/connection-services.ts"),
    `
    import {cookies} from "next/headers";
    import {fixtureScenario,initialAuthorizationState} from "./schedule-auth";
    const uuid=(n:number)=>"21000000-0000-4000-8000-"+String(n).padStart(12,"0");
    async function rows(){const jar=await cookies(),scenario=await fixtureScenario();const prefix=scenario.actor==="other"?"Other account ":scenario.actor==="dataset"?"Other dataset ":"";
      const row=(n:number,status:string,label:string)=>({id:uuid(n),pairId:uuid(n+100),attemptNumber:1,coachProfileId:uuid(500),athleteProfileId:uuid(n+600),senderProfileId:uuid(n+600),recipientProfileId:uuid(500),status,createdAt:"2026-11-01T10:00:00Z",updatedAt:"2026-11-01T10:00:00Z",decidedAt:status==="pending"?null:"2026-11-01T11:00:00Z",removedAt:null,coachDisplayName:prefix+label.replace("athlete","coach"),athleteDisplayName:prefix+label,coachSlug:"fixture-coach",coachPublic:true,coachPortraitUrl:null,athleteAvatarUrl:null,canAccept:status==="pending",canDecline:status==="pending",canWithdraw:false,canDisconnect:status==="accepted"});
      const decision=jar.get("mov210-incoming")?.value;
      const accepted=jar.has("mov210-disconnected")?[]:[row(1,"accepted","Connected fixture athlete")];
      if(decision==="accept")accepted.push(row(11,"accepted","Incoming fixture athlete"));
      return {accepted,incoming:decision?[]:[row(11,"pending","Incoming fixture athlete")],outgoing:jar.has("mov210-withdrawn")?[]:[{...row(12,"pending","Outgoing fixture athlete"),senderProfileId:uuid(500),recipientProfileId:uuid(612),canAccept:false,canDecline:false,canWithdraw:true}],history:[row(13,"declined","Previous fixture athlete")],row};
    }
    export async function currentConnectionPendingCount(role:any,expectedIdentity:any){const {session,actor}=await initialAuthorizationState(),{fault}=await fixtureScenario();if(session.status!=="signed-in"||actor.status!=="authorized")return {status:"unavailable"};const owner=[session.subject,actor.profile.slug,actor.demoRun.slug,actor.role].join(":");if(expectedIdentity!==owner)return {status:"conflict"};if(fault==="count-unavailable"||fault==="connections-unavailable")return {status:"unavailable"};if(fault==="count-many")return {status:"ready",value:123};if(fault==="count-roles")return {status:"ready",value:role==="athlete"?7:3};const all=await rows();return {status:"ready",value:all.incoming.length};}
    export async function currentConnectionPage(role:any,section:any,options:any={}){const {fault}=await fixtureScenario();if(fault==="connections-unavailable"||(fault==="incoming-unavailable"&&section==="incoming")||(fault==="connection-page-unavailable"&&options.cursor))return {status:"unavailable"};const all=await rows();if(section==="accepted"&&options.cursor)return {status:"ready",value:{items:[all.row(2,"accepted","Older connected athlete")],nextCursor:null}};return {status:"ready",value:{items:all[section as keyof typeof all],nextCursor:section==="accepted"?{createdAt:"2026-11-01T10:00:00Z",id:uuid(1)}:null}};}
    export async function decideCoachAthleteConnection(id:string,action:string){const {fault}=await fixtureScenario();if(fault==="connection-mutation-unavailable")return {status:"unavailable"};const jar=await cookies();if(action==="disconnect")jar.set("mov210-disconnected","yes");else if(action==="withdraw")jar.set("mov210-withdrawn","yes");else jar.set("mov210-incoming",action);if(fault==="connection-mutation-lost")return {status:"unavailable"};const data=await rows();return {status:"ready",value:data.row(id===uuid(1)?1:id===uuid(12)?12:11,action==="accept"?"accepted":action==="disconnect"?"removed":action==="withdraw"?"withdrawn":"declined","Incoming fixture athlete")};}
    export async function sendCoachAthleteConnection(){throw Error("Not rehearsed");}
    export async function currentConnectionHistory(){return {status:"ready",value:{items:[],nextCursor:null}};}
    export async function currentBookingConnectionContext(){return {status:"unavailable"};}
  `,
  );
  await writeFile(
    path.join(checkout, "src/tests-fixtures/schedule-controls.tsx"),
    `"use client";
    import{useAuthSession}from"@/auth/client/session-provider";import{useActor}from"@/auth/client/actor-provider";import{useRef}from"react";
    export function ScheduleControls(){const{refreshSession,session}=useAuthSession();const{refreshActor,actor}=useActor();const latest=useRef(refreshActor);latest.current=refreshActor;return <p data-fixture-state={JSON.stringify({session,actor})} style={{padding:8}}>Isolated schedule fixture — no real Auth, database or email. <button onClick={async()=>{await refreshSession();await new Promise(resolve=>setTimeout(resolve,0));await latest.current()}}>Refresh fixture account</button></p>}
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
    "src/app/coach/workspace-page.tsx",
    "src/app/coach-marketplace-actions.ts",
    "src/app/coach/athletes/page.tsx",
    "src/app/my-coaches/page.tsx",
    "src/app/connections/actions.ts",
    "src/app/api/connections/pending-count/route.ts",
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
        'from "@/server/coaches/booking-request-service"',
        'from "@/tests-fixtures/booking-services"',
      )
      .replaceAll(
        'from "@/server/coaches/booking-service"',
        'from "@/tests-fixtures/booking-services"',
      )
      .replaceAll(
        'from "@/server/coaches/calendar-service"',
        'from "@/tests-fixtures/schedule-services"',
      );
    const myCoachesSource =
      name === "src/app/my-coaches/page.tsx"
        ? source
            .replaceAll(
              'from "@/tests-fixtures/booking-services"',
              'from "@/tests-fixtures/schedule-services"',
            )
            .replaceAll(
              'from "@/server/authorization/page-access"',
              'from "@/tests-fixtures/schedule-services"',
            )
            .replaceAll(
              'from "@/server/external-clients/pending-invitation"',
              'from "@/tests-fixtures/schedule-services"',
            )
        : source;
    await writeFile(
      file,
      myCoachesSource.replaceAll(
        'from "@/server/connections/service"',
        'from "@/tests-fixtures/connection-services"',
      ),
    );
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
  page.setDefaultNavigationTimeout(60_000);
  page.setDefaultTimeout(15_000);
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
  let rosterMode = "off";
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
      request.method() === "GET" &&
      rosterMode !== "off"
    )
      return route.fulfill({
        json:
          rosterMode === "unavailable"
            ? { status: "unavailable" }
            : url.searchParams.has("id")
              ? {
                  status: "ready",
                  detail: {
                    client,
                    invitation: null,
                    sessions: [],
                    nextOffset: null,
                  },
                }
              : {
                  status: "ready",
                  page: {
                    items: rosterMode === "empty" ? [] : [client],
                    next: null,
                  },
                },
      });

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
    if (url.pathname === "/api/connections/pending-count")
      return route.continue();
    if (url.pathname === "/api/notifications")
      return route.fulfill({
        json: { status: "ready", items: [], unreadCount: 0, nextCursor: null },
      });
    if (url.pathname === "/api/messages")
      return route.fulfill({ json: { status: "ready", unreadCount: 0 } });
    return route.fulfill({ status: 503, json: { status: "unavailable" } });
  });
  const nav = () =>
    page.getByRole("navigation", { name: /^(Schedule|Bookings) sections$/ });
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
  if (!myCoachesOnly) {
    const tabs = [
      ["Schedule", "/coach?view=schedule&section=calendar"],
      ["Availability", "/coach?view=schedule&section=availability"],
      ["Session types", "/coach/session-types"],
      ["Schedule a client", "/coach/bookings/new"],
    ];
    const bookingTabs = [
      ["Booked sessions", "/coach?view=bookings"],
      ["Booking requests, 55 pending", "/coach?view=bookings&section=requests"],
      tabs[3],
    ];
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [group, primary] of [
        [tabs.slice(0, 3), "Calendar"],
        [bookingTabs, "Bookings"],
      ]) {
        let reference;
        await open(group[0][1]);
        for (const [index, [name, href]] of group.entries()) {
          if (index) {
            await nav().getByRole("link", { name, exact: true }).focus();
            await page.keyboard.press("Enter");
            await page.waitForURL(base + href);
          }
          await expect(nav().locator('[aria-current="page"]')).toHaveCount(1);
          await expect(
            nav().getByRole("link", { name, exact: true }),
          ).toHaveAttribute("aria-current", "page");
          assert.equal(await nav().getByRole("link").count(), 3);
          await expect(
            page.getByRole("heading", {
              level: 1,
              name: "Run your coaching week.",
            }),
          ).toBeVisible();
          assert.equal(await page.locator("main h1").count(), 1);
          await expect(
            page
              .getByRole("navigation", {
                name: width > 760 ? "Main navigation" : "Mobile navigation",
                exact: true,
              })
              .getByRole("link", { name: primary, exact: true }),
          ).toHaveAttribute("aria-current", "page");
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          );
          const frame = await page
              .locator(".coach-workspace-header")
              .boundingBox(),
            bar = await nav().boundingBox();
          assert.ok(frame && bar);
          if (reference)
            for (const key of ["x", "y", "width", "height"])
              assert.ok(
                Math.abs(frame[key] - reference[key]) < 1,
                `${width} ${name} header ${key}`,
              );
          reference = frame;
          if (name === "Booked sessions") {
            await expect(page.locator("#client-bookings")).toBeVisible();
            await expect(page.locator("#booking-requests")).toHaveCount(0);
          }
          if (name.startsWith("Booking requests")) {
            await expect(page.locator("#booking-requests")).toBeVisible();
            await expect(page.locator("#client-bookings")).toHaveCount(0);
          }
          await page.screenshot({
            path: path.join(
              output,
              `${width}-${name.replaceAll(" ", "-")}.png`,
            ),
            fullPage: true,
          });
        }
        await page.goBack({ waitUntil: "networkidle" });
        await expect(
          nav().getByRole("link", { name: group[1][0], exact: true }),
        ).toHaveAttribute("aria-current", "page");
        await page.goForward({ waitUntil: "networkidle" });
        await expect(
          nav().getByRole("link", { name: group[2][0], exact: true }),
        ).toHaveAttribute("aria-current", "page");
      }
      record(
        `${width}px ordered Calendar/Bookings sections, default sessions, one panel, active primary, frame, keyboard, history, overflow`,
      );
    }
    const occurrence = "20800000-0000-4000-8000-000000000001";
    for (const href of [
      `/coach?view=bookings&occurrence=${occurrence}#coach-occurrence-${occurrence}`,
      `/coach?view=bookings&section=requests&occurrence=${occurrence}#coach-occurrence-${occurrence}`,
      "/coach?view=bookings#booking-requests",
    ]) {
      await open(href);
      await expect(page.locator("#booking-requests")).toBeVisible();
      await expect(
        nav().getByRole("link", {
          name: "Booking requests, 55 pending",
          exact: true,
        }),
      ).toHaveAttribute("aria-current", "page");
    }
    for (const action of ["Decline", "Accept", "Close occurrence"]) {
      await page.context().clearCookies({ name: /^mov208-/ });
      await open(bookingTabs[1][1]);
      if (action === "Close occurrence")
        await page
          .getByRole("button", { name: "Close this occurrence", exact: true })
          .click();
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(
        nav().getByRole("link", {
          name: "Booking requests, 54 pending",
          exact: true,
        }),
      ).toBeVisible();
    }
    await page.context().clearCookies({ name: /^mov208-/ });
    for (const fault of ["count-unavailable", "queue-unavailable"]) {
      await cookie("owner", fault);
      await open(bookingTabs[1][1]);
      if (fault === "count-unavailable")
        await expect(
          nav().getByRole("link", {
            name: "Booking requests, pending count unavailable",
            exact: true,
          }),
        ).toBeVisible();
      else {
        await expect(
          nav().getByRole("link", {
            name: "Booking requests, 55 pending",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByText("Your request queue cannot be verified right now.", {
            exact: true,
          }),
        ).toBeVisible();
      }
    }
    await cookie("suspended");
    await open(bookingTabs[0][1]);
    await expect(nav()).toBeVisible();
    await expect(page.locator("#client-bookings")).toBeVisible();
    await open(bookingTabs[1][1]);
    await expect(nav()).toBeVisible();
    await cookie("other");
    await refresh();
    await expect(nav()).toHaveCount(0);
    await cookie();
    record(
      "legacy/explicit request links, three decision refreshes, independent read failures, suspended history and owner fencing",
    );
    for (const [, href] of tabs.slice(2)) {
      await open(href);
      await expect(nav()).toBeVisible();
    }
    await open(`/coach/bookings/new?externalClientId=${id}`);
    await expect(page.getByLabel("Athlete type", { exact: true })).toHaveValue(
      "external",
    );
    await expect(
      page.getByLabel("External athlete", { exact: true }),
    ).toHaveValue(id);
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
        name: "External athlete selection",
        exact: true,
      });
    const addClient = () =>
      picker().getByRole("button", {
        name: "Add a new external athlete",
        exact: true,
      });
    const closeClient = () =>
      picker().getByRole("button", {
        name: "Close new athlete form",
        exact: true,
      });
    const manageClients = () =>
      picker().getByRole("link", {
        name: "Manage external athletes",
        exact: true,
      });
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 1000 });
      emptyClients = true;
      await open(tabs[3][1]);
      await page
        .getByLabel("Athlete type", { exact: true })
        .selectOption("external");
      await expect(
        picker().getByText(
          "No saved external athletes yet. Add your first athlete to get started.",
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
    await page
      .getByRole("button", { name: "Save athlete", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry exact save", exact: true }),
    ).toBeVisible();
    await expect(closeClient()).toBeDisabled();
    await expect(manageClients()).toHaveAttribute("aria-disabled", "true");
    await expect(
      page.getByLabel("External athlete", { exact: true }),
    ).toBeDisabled();
    const pendingUrl = page.url();
    await manageClients().dispatchEvent("click");
    assert.equal(page.url(), pendingUrl);
    clientSave = "ready";
    await page
      .getByRole("button", { name: "Retry exact save", exact: true })
      .click();
    await expect(
      page.getByLabel("External athlete", { exact: true }),
    ).toHaveValue("20700000-0000-4000-8000-000000000001");
    await expect(
      page.getByLabel("External athlete", { exact: true }),
    ).toBeFocused();
    await expect(addClient()).toBeEnabled();
    await expect(manageClients()).not.toHaveAttribute("aria-disabled", "true");
    assert.equal(clientWrites.length, 2);
    assert.deepEqual(clientWrites[1], clientWrites[0]);
    moreClients = true;
    await open(`/coach/bookings/new?externalClientId=${id}`);
    await picker()
      .getByRole("button", { name: "Load more athletes", exact: true })
      .click();
    await expect(
      picker().getByText("More athletes could not be loaded. Try again.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(addClient()).toBeEnabled();
    await expect(manageClients()).toBeVisible();
    moreClients = false;
    record(
      "external-client unknown save retains exact retry,blocks conflicting navigation,selects saved athlete; paging errors preserve actions",
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
    await page
      .getByLabel("Name", { exact: true })
      .fill("Retained layout draft");
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

    const athletesNav = () =>
      page.getByRole("navigation", {
        name: "My athletes sections",
        exact: true,
      });
    const athleteTabs = [
      ["Connected athletes", "/coach/athletes"],
      ["External athletes", "/coach/athletes/external"],
      ["Connection requests", "/coach/athletes?section=requests"],
    ];
    rosterMode = "ready";
    for (const width of [1440, 375, 320]) {
      await cookie();
      await page.context().clearCookies({ name: /^mov210-/ });
      await page.setViewportSize({ width, height: 1000 });
      await open(athleteTabs[0][1]);
      let reference;
      for (const [index, [name, href]] of athleteTabs.entries()) {
        if (index) {
          await athletesNav()
            .getByRole("link", {
              name:
                name === "Connection requests" ? /^Connection requests,/ : name,
              exact: true,
            })
            .focus();
          await page.keyboard.press("Enter");
          await page.waitForURL(base + href);
        }
        await expect(
          athletesNav().locator('[aria-current="page"]'),
        ).toHaveCount(1);
        await expect(
          athletesNav().getByRole("link", {
            name:
              name === "Connection requests" ? /^Connection requests,/ : name,
            exact: true,
          }),
        ).toHaveAttribute("aria-current", "page");
        await expect(
          page.getByRole("heading", {
            name: "My athletes",
            level: 1,
            exact: true,
          }),
        ).toBeVisible();
        assert.equal(await page.locator("main h1").count(), 1);
        await expect(
          page
            .getByRole("navigation", {
              name: width > 760 ? "Main navigation" : "Mobile navigation",
              exact: true,
            })
            .getByRole("link", { name: "My athletes", exact: true }),
        ).toHaveAttribute("aria-current", "page");
        const frame = await page
          .locator(".coach-workspace-header")
          .boundingBox();
        assert.ok(frame);
        if (reference)
          for (const key of ["x", "y", "width", "height"])
            assert.ok(
              Math.abs(frame[key] - reference[key]) < 1,
              `${width} ${name} frame ${key}`,
            );
        reference = frame;
        if (index === 0) {
          await expect(
            page.getByText("Connected fixture athlete", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText("Incoming fixture athlete", { exact: true }),
          ).toHaveCount(0);
        }
        if (index === 1) {
          await expect(
            page.getByRole("button", { name: "Save athlete", exact: true }),
          ).toBeVisible();
          await expect(page.locator("#my-athletes")).toHaveCount(0);
        }
        if (index === 2) {
          for (const text of [
            "Incoming fixture athlete",
            "Outgoing fixture athlete",
            "Previous fixture athlete",
          ])
            await expect(page.getByText(text, { exact: true })).toBeVisible();
          await expect(
            page.getByText("Connected fixture athlete", { exact: true }),
          ).toHaveCount(0);
        }
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.screenshot({
          path: path.join(output, `${width}-athletes-${index}.png`),
          fullPage: true,
        });
      }
      await page.goBack({ waitUntil: "networkidle" });
      await expect(
        athletesNav().getByRole("link", {
          name: "External athletes",
          exact: true,
        }),
      ).toHaveAttribute("aria-current", "page");
      await page.goForward({ waitUntil: "networkidle" });
      await expect(
        athletesNav().getByRole("link", {
          name: /^Connection requests,/,
          exact: true,
        }),
      ).toHaveAttribute("aria-current", "page");
      record(
        `${width}px My athletes ordered tabs/default, matching frame, one H1/panel/primary, keyboard/history/overflow`,
      );
    }
    await open(athleteTabs[0][1]);
    await page
      .getByRole("button", { name: "Load more athletes", exact: true })
      .click();
    await expect(
      page.getByText("Older connected athlete", { exact: true }),
    ).toBeVisible();
    await cookie("owner", "incoming-unavailable");
    await open(athleteTabs[2][1]);
    await expect(
      page.getByText(
        "Incoming connection requests could not be verified. No connection data is shown.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Outgoing fixture athlete", { exact: true }),
    ).toBeVisible();
    await cookie();
    await page
      .getByRole("button", {
        name: "Retry incoming connection requests",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Incoming fixture athlete", { exact: true }),
    ).toBeVisible();
    for (const action of [
      "Decline connection",
      "Accept connection",
      "Withdraw request",
    ]) {
      await page.context().clearCookies({ name: /^mov210-/ });
      await open(athleteTabs[2][1]);
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(page.locator(".coach-connection-feedback")).toContainText(
        action === "Accept connection"
          ? "Connected."
          : action === "Decline connection"
            ? "declined"
            : "withdrawn",
      );
      if (action === "Accept connection") {
        await athletesNav()
          .getByRole("link", { name: "Connected athletes", exact: true })
          .click();
        await expect(
          page.getByText("Incoming fixture athlete", { exact: true }),
        ).toBeVisible();
      }
    }
    await page.context().clearCookies({ name: /^mov210-/ });
    await open(athleteTabs[0][1]);
    await page
      .getByRole("button", { name: /Disconnect/, exact: false })
      .click();
    await page
      .getByRole("button", { name: "Stay connected", exact: true })
      .click();
    await expect(
      page.getByText("Connected fixture athlete", { exact: true }),
    ).toBeVisible();
    for (const href of [athleteTabs[0][1], athleteTabs[2][1]]) {
      await cookie();
      await open(href);
      await cookie("owner", "checking");
      await refresh();
      await expect(athletesNav()).toBeHidden();
      await cookie();
      await refresh();
      await expect(athletesNav()).toBeVisible();
      await cookie("dataset");
      await refresh();
      await expect(athletesNav()).toHaveCount(0);
    }
    await cookie("suspended");
    await open(athleteTabs[2][1]);
    await expect(athletesNav()).toBeVisible();
    assert.equal(await page.locator("main h1").count(), 1);
    await expect(
      page.getByRole("button", { name: "Accept connection", exact: true }),
    ).toHaveCount(0);
    await cookie("signed-out");
    await open(athleteTabs[2][1]);
    assert.equal(
      new URL(page.url()).searchParams.get("returnTo"),
      athleteTabs[2][1],
    );
    await cookie();
    record(
      "My athletes scoped paging/partial error/retry/three decisions/disconnect cancel and suspended/guest/account fences",
    );
    rosterMode = "empty";
    await open(athleteTabs[1][1]);
    await expect(
      page.getByText("No external athletes yet.", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Name", { exact: true })
      .fill("Roster pending athlete");
    clientSave = "unavailable";
    await page
      .getByRole("button", { name: "Save athlete", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry exact save", exact: true }),
    ).toBeVisible();
    for (const link of await athletesNav().getByRole("link").all())
      await expect(link).toHaveAttribute("aria-disabled", "true");
    const pendingRosterUrl = page.url();
    await athletesNav()
      .getByRole("link", { name: "Connected athletes", exact: true })
      .dispatchEvent("click");
    assert.equal(page.url(), pendingRosterUrl);
    clientSave = "ready";
    await page
      .getByRole("button", { name: "Retry exact save", exact: true })
      .click();
    await expect(
      athletesNav().getByRole("link", {
        name: "Connected athletes",
        exact: true,
      }),
    ).not.toHaveAttribute("aria-disabled", "true");
    assert.deepEqual(clientWrites.at(-1), clientWrites.at(-2));
    rosterMode = "unavailable";
    await open(athleteTabs[1][1]);
    await expect(
      page.getByText(
        "Athlete records could not be verified. Reload to try again.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(athletesNav()).toBeVisible();
    rosterMode = "ready";
    await open(`/coach/athletes/external/${id}`);
    await expect(athletesNav()).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "← External athletes", exact: true }),
    ).toHaveAttribute("href", athleteTabs[1][1]);
    record(
      "embedded external roster keeps empty/unavailable states, exact pending-save navigation fence/retry and standalone details",
    );
  }

  const coachesNav = () =>
    page.getByRole("navigation", { name: "My coaches sections", exact: true });
  const coachTabs = [
    ["Connected coaches", "/my-coaches"],
    ["Connection requests", "/my-coaches?section=requests"],
  ];
  if (!countsOnly) {
    for (const width of [1440, 375, 320]) {
      await cookie("athlete");
      await page.context().clearCookies({ name: /^mov210-/ });
      await page.setViewportSize({ width, height: 1000 });
      await open(coachTabs[0][1]);
      let reference;
      for (const [index, [name, href]] of coachTabs.entries()) {
        if (index) {
          await coachesNav()
            .getByRole("link", {
              name:
                name === "Connection requests" ? /^Connection requests,/ : name,
              exact: true,
            })
            .focus();
          await page.keyboard.press("Enter");
          await page.waitForURL(base + href);
        }
        assert.equal(await coachesNav().getByRole("link").count(), 2);
        await expect(
          coachesNav().getByRole("link", {
            name:
              name === "Connection requests" ? /^Connection requests,/ : name,
            exact: true,
          }),
        ).toHaveAttribute("aria-current", "page");
        assert.equal(await page.locator("main h1").count(), 1);
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "My coaches",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page
            .getByRole("navigation", {
              name: width > 760 ? "Main navigation" : "Mobile navigation",
              exact: true,
            })
            .getByRole("link", { name: "My coaches", exact: true }),
        ).toHaveAttribute("aria-current", "page");
        const frame = await page
          .locator(".coach-workspace-header")
          .boundingBox();
        assert.ok(frame);
        if (reference)
          for (const key of ["x", "y", "width", "height"])
            assert.ok(Math.abs(frame[key] - reference[key]) < 1);
        reference = frame;
        if (index === 0) {
          await expect(
            page.getByText("Connected fixture coach", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText("Incoming fixture coach", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByRole("link", {
              name: "View Connected fixture coach’s coach profile",
              exact: true,
            }),
          ).toHaveAttribute("href", "/coaches/fixture-coach");
        } else {
          for (const label of [
            "Incoming fixture coach",
            "Outgoing fixture coach",
            "Previous fixture coach",
          ])
            await expect(page.getByText(label, { exact: true })).toBeVisible();
          await expect(
            page.getByText("Connected fixture coach", { exact: true }),
          ).toHaveCount(0);
        }
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.screenshot({
          path: path.join(output, `${width}-my-coaches-${index}.png`),
          fullPage: true,
        });
      }
      await page.goBack({ waitUntil: "networkidle" });
      await expect(
        coachesNav().getByRole("link", { name: coachTabs[0][0], exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await page.goForward({ waitUntil: "networkidle" });
      await expect(
        coachesNav().getByRole("link", {
          name: /^Connection requests,/,
          exact: true,
        }),
      ).toHaveAttribute("aria-current", "page");
      record(
        `${width}px My coaches two tabs/default, matching heading, selected panel/sidebar, keyboard/history/public profile/overflow`,
      );
    }
    await open(coachTabs[0][1]);
    await page
      .getByRole("button", { name: "Load more coaches", exact: true })
      .click();
    await expect(
      page.getByText("Older connected coach", { exact: true }),
    ).toBeVisible();
    await cookie("athlete", "incoming-unavailable");
    await open(coachTabs[1][1]);
    await expect(
      page.getByText(
        "Incoming connection requests could not be verified. No connection data is shown.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Outgoing fixture coach", { exact: true }),
    ).toBeVisible();
    await cookie("athlete");
    await page
      .getByRole("button", {
        name: "Retry incoming connection requests",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Incoming fixture coach", { exact: true }),
    ).toBeVisible();
    for (const action of [
      "Decline connection",
      "Accept connection",
      "Withdraw request",
    ]) {
      await page.context().clearCookies({ name: /^mov210-/ });
      await open(coachTabs[1][1]);
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(page.locator(".coach-connection-feedback")).toContainText(
        action === "Accept connection"
          ? "Connected."
          : action === "Decline connection"
            ? "declined"
            : "withdrawn",
      );
      if (action === "Accept connection") {
        await coachesNav()
          .getByRole("link", { name: "Connected coaches", exact: true })
          .click();
        await expect(
          page.getByText("Incoming fixture coach", { exact: true }),
        ).toBeVisible();
      }
    }
    await page.context().clearCookies({ name: /^mov210-/ });
    await open(coachTabs[0][1]);
    await page
      .getByRole("button", { name: "View shared history", exact: true })
      .click();
    await expect(page.locator(".coach-connection-history")).toBeVisible();
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await page
      .getByRole("button", { name: "Stay connected", exact: true })
      .click();
    await expect(
      page.getByText("Connected fixture coach", { exact: true }),
    ).toBeVisible();
    record(
      "My coaches scoped paging/partial failure/retry/three decisions and accepted history/disconnect cancellation",
    );
    for (const fault of ["pending-invitation", "invitation-unavailable"]) {
      await cookie("athlete", fault);
      for (const [, href] of coachTabs) {
        await open(href);
        await expect(
          page.getByRole("complementary", {
            name: "Coach invitation",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Review invitation", exact: true }),
        ).toHaveAttribute("href", "/invitations");
      }
    }
    record(
      "pending and unavailable coach invitation reminders remain reachable on both tabs, without consent or sends",
    );
    for (const actor of ["owner", "suspended"]) {
      await cookie(actor);
      await open(coachTabs[0][1]);
      await expect(coachesNav()).toBeVisible();
      await expect(
        page.getByText("Connected fixture coach", { exact: true }),
      ).toBeVisible();
    }
    for (const [, href] of coachTabs) {
      await cookie("athlete");
      await open(href);
      await cookie("athlete", "checking");
      await refresh();
      await expect(coachesNav()).toBeHidden();
      await cookie("athlete");
      await refresh();
      await expect(coachesNav()).toBeVisible();
      for (const actor of ["other", "dataset", "signed-out"]) {
        await cookie("athlete");
        await open(href);
        await cookie(actor);
        await refresh();
        await expect(
          coachesNav(),
          `${href}: switched to ${actor}; ${await page.locator("[data-fixture-state]").getAttribute("data-fixture-state")}`,
        ).toHaveCount(0);
        await expect(
          page.getByText("Connected fixture coach", { exact: true }),
        ).toHaveCount(0);
      }
    }
    await cookie("signed-out");
    await open(coachTabs[1][1]);
    assert.equal(
      new URL(page.url()).searchParams.get("returnTo"),
      coachTabs[1][1],
    );
    await cookie("athlete", "workspace-unavailable");
    await open(coachTabs[1][1]);
    await expect(coachesNav()).toHaveCount(0);
    await cookie();
    record(
      "My coaches temporary verification, account/dataset/sign-out/unavailable/query-return fences and coach-as-athlete capability",
    );
  }
  for (const [actor, rootHref, requestsHref, navLabel] of [
    [
      "owner",
      "/coach/athletes",
      "/coach/athletes?section=requests",
      "My athletes sections",
    ],
    [
      "athlete",
      "/my-coaches",
      "/my-coaches?section=requests",
      "My coaches sections",
    ],
  ]) {
    const requestLink = () =>
      page
        .getByRole("navigation", { name: navLabel, exact: true })
        .getByRole("link", { name: /^Connection requests,/ });
    const count = () => requestLink().locator(".workspace-section-count");
    for (const width of [1440, 375, 320]) {
      await cookie(actor, "count-many");
      await page.setViewportSize({ width, height: 1000 });
      await open(rootHref);
      await expect(count()).toHaveText("123", { timeout: 20_000 });
      await expect(requestLink()).toHaveAccessibleName(
        "Connection requests, 123 pending incoming",
      );
      await requestLink().focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(base + requestsHref);
      await expect(count()).toHaveText("123", { timeout: 20_000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: path.join(output, `${width}-${actor}-connection-count.png`),
        fullPage: true,
      });
      record(
        `${actor} ${width}px pending count, keyboard requests navigation and overflow`,
      );
    }
    await cookie(actor);
    await page.context().clearCookies({ name: /^mov210-/ });
    for (const decision of [
      "Accept connection",
      "Decline connection",
      "Withdraw request",
    ]) {
      await page.context().clearCookies({ name: /^mov210-/ });
      await open(requestsHref);
      await expect(count()).toHaveText("1");
      await page.getByRole("button", { name: decision, exact: true }).click();
      await expect(count()).toHaveText(
        decision === "Withdraw request" ? "1" : "0",
      );
    }
    for (const fault of [
      "connection-mutation-unavailable",
      "connection-mutation-lost",
    ]) {
      await page.context().clearCookies({ name: /^mov210-/ });
      await cookie(actor, fault);
      await open(requestsHref);
      await expect(count()).toHaveText("1");
      await page
        .getByRole("button", { name: "Accept connection", exact: true })
        .click();
      await expect(page.locator(".coach-connection-feedback")).toContainText(
        "could not verify",
      );
      await expect(count()).toHaveText(
        fault === "connection-mutation-lost" ? "0" : "1",
      );
    }
    await page.context().clearCookies({ name: /^mov210-/ });
    await cookie(actor, "count-unavailable");
    await open(requestsHref);
    await expect(count()).toHaveText("—");
    await expect(requestLink()).toHaveAccessibleName(
      "Connection requests, pending count unavailable",
    );
    await expect(
      page.getByText(
        actor === "owner"
          ? "Incoming fixture athlete"
          : "Incoming fixture coach",
        { exact: true },
      ),
    ).toBeVisible();
    await cookie(actor, "none");
    const retry = page.getByRole("button", {
      name: "Retry pending count",
      exact: true,
    });
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(count()).toHaveText("1");
    await page
      .context()
      .addCookies([{ name: "mov210-incoming", value: "decline", url: base }]);
    await page
      .getByRole("button", { name: "Refresh connections", exact: true })
      .click();
    await expect(count()).toHaveText("0");
    record(
      `${actor} count123 desktop/375/320/keyboard, exact incoming decisions/withdraw, zero, independent unavailable/retry/refresh`,
    );
  }
  await cookie("owner", "count-roles");
  await open("/coach/athletes/external");
  await expect(page.locator(".workspace-section-count")).toHaveText("3");
  await cookie("athlete", "count-roles");
  await open("/my-coaches");
  await expect(page.locator(".workspace-section-count")).toHaveText("7");
  record(
    "correct coach/athlete perspective and external-athlete sibling tab count",
  );

  // Delay the old owner's read while the verified account changes. The
  // component must discard/abort the old result rather than display it later.
  let releaseCount;
  const gate = new Promise((resolve) => {
    releaseCount = resolve;
  });
  let countReadStarted;
  const started = new Promise((resolve) => {
    countReadStarted = resolve;
  });
  let firstRead = true;
  const countPattern = "**/api/connections/pending-count?*";
  await page.route(countPattern, async (route) => {
    if (firstRead) {
      firstRead = false;
      countReadStarted();
      await gate;
      try {
        await route.fulfill({ json: { status: "ready", value: 987 } });
      } catch {}
    } else await route.continue();
  });
  await cookie("athlete");
  await page.goto(base + "/my-coaches", { waitUntil: "domcontentloaded" });
  await started;
  await cookie("other");
  await refresh();
  releaseCount();
  await expect(
    page.getByText(
      "Your account or workspace changed. Reload My coaches to continue.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "My coaches sections", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("987", { exact: true })).toHaveCount(0);
  await page.unroute(countPattern);
  record("late old-owner pending count is removed during account change");
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  record("no unexpected mutation requests or browser errors");
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
