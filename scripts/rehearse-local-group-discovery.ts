import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium, expect as baseExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import postgres from "postgres";
import { LOCAL_SUPABASE_DATABASE_CONTAINER } from "./lib/local-supabase-project.mjs";
import {
  assertLoopbackSupabaseTargets,
  parseLocalSupabaseStatus,
} from "./lib/local-coach-accounts";
import type {
  GroupDraftInput,
  GroupSession,
} from "../src/domain/group-sessions";

// All schema/seed writes go to a new, uniquely named database. Supabase Auth
// receives only this run's exact tagged temporary users; no other user is read.
const root = process.cwd();
const base = "http://localhost:3113";
const container = LOCAL_SUPABASE_DATABASE_CONTAINER;
const databaseName = "dev0240_ui_" + randomUUID().replaceAll("-", "");
assert.match(databaseName, /^dev0240_ui_[a-f0-9]{32}$/);
const evidence = resolve(root, "test-results/group-discovery-rehearsal");
const expect = baseExpect.configure({ timeout: 30000 });
const run = (file: string, args: string[], input?: string) =>
  execFileSync(file, args, {
    cwd: root,
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
const docker = (args: string[], input?: string) =>
  run(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    input,
  );
const psql = (sql: string) =>
  docker(
    [
      "psql",
      "-X",
      "-qAt",
      "-U",
      "postgres",
      "-d",
      databaseName,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    sql,
  );
const status = parseLocalSupabaseStatus(
  run("node_modules/.bin/supabase", ["status", "-o", "env"]),
);
assertLoopbackSupabaseTargets(status);
const auth = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ownerUrl = new URL(status.databaseUrl);
ownerUrl.pathname = "/" + databaseName;
const runtimeUrl = new URL(ownerUrl);
runtimeUrl.username = "repx_runtime_login";
runtimeUrl.password = "postgres";
const env = {
  ...process.env,
  DATABASE_URL: runtimeUrl.toString(),
  NEXT_PUBLIC_SUPABASE_URL: status.apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.publishableKey,
  NEXT_PUBLIC_SITE_URL: base,
  NEXT_TELEMETRY_DISABLED: "1",
};
Object.assign(process.env, env);
const people: string[] = [];
let madeDatabase = false,
  snapshot: string | undefined,
  app: ChildProcess | undefined;
let db: ReturnType<typeof postgres> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let phase = "isolated setup";
let appOutput = "";
const log = (value: string) => {
  phase = value;
  console.log("DEV0240: " + value);
};
try {
  docker(["createdb", "-U", "supabase_admin", "-O", "postgres", databaseName]);
  madeDatabase = true;
  const infrastructure = docker([
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "--schema-only",
  ]);
  const policies = [
    ...infrastructure.matchAll(/^CREATE POLICY (\S+) ON storage\.objects/gm),
  ]
    .map((m) => m[1])
    .filter((name) =>
      /^(?:account_avatars_|coach_portraits_)[a-z_]+$/.test(name),
    );
  docker(
    [
      "psql",
      "-X",
      "-qAt",
      "-U",
      "supabase_admin",
      "-d",
      databaseName,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    infrastructure +
      "\nSET row_security=on; DROP SCHEMA IF EXISTS app CASCADE;\n" +
      policies
        .map((p) => `DROP POLICY IF EXISTS ${p} ON storage.objects;`)
        .join("\n"),
  );
  const revision = run("git", ["rev-parse", "HEAD"]).trim();
  const migrations = run("git", [
    "ls-tree",
    "-r",
    "--name-only",
    revision,
    "supabase/migrations",
  ])
    .trim()
    .split("\n")
    .filter((p) => p.endsWith(".sql"))
    .sort();
  for (const path of migrations)
    psql(
      "BEGIN;\n" + run("git", ["show", `${revision}:${path}`]) + "\nCOMMIT;",
    );
  // Include a concurrent additive availability migration only in this isolated
  // database when its new repository fields are present in the app snapshot.
  const pending =
    "supabase/migrations/20261016000200_effective_coach_availability.sql";
  if (existsSync(pending) && !migrations.includes(pending))
    psql("BEGIN;\n" + readFileSync(pending, "utf8") + "\nCOMMIT;");
  psql("BEGIN;\n" + readFileSync("supabase/seed.sql", "utf8") + "\nCOMMIT;");
  db = postgres(ownerUrl.toString(), {
    prepare: false,
    max: 4,
    onnotice: () => {},
  });
  await db`update app.demo_runs set ends_at=clock_timestamp()+interval '1 year' where status='active' and catalogue_visibility='public'`;
  log(
    `replayed ${migrations.length} committed migrations and seed into owned disposable database`,
  );
  type Person = {
    id: string;
    profileId: string;
    runId: string;
    cookies: { name: string; value: string }[];
  };
  async function person(name: string): Promise<Person> {
    const email = `dev0240-groups-${randomUUID()}@users.movx.test`,
      password = randomUUID();
    const user = await auth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { movx_test_ticket: "DEV0240", temporary: true },
    });
    assert.ok(
      !user.error && user.data.user,
      "Could not create an exact tagged local test identity.",
    );
    const id = user.data.user.id;
    people.push(id);
    await db!`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
    const [row] =
      await db!`select * from app.enroll_application_identity(${id}::uuid,${name})`;
    const entry: Person = {
      id,
      profileId: row.identity_profile_id,
      runId: row.identity_run_id,
      cookies: [],
    };
    const client = createServerClient(status.apiUrl, status.publishableKey, {
      cookies: {
        getAll: () => entry.cookies,
        setAll: (values) => {
          entry.cookies = values.map(({ name, value }) => ({ name, value }));
        },
      },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    assert.equal(
      signed.error,
      null,
      "Could not authenticate the tagged test identity.",
    );
    return entry;
  }
  async function command(p: Person, action: string, args: unknown) {
    return db!.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      await tx`select set_config('app.current_auth_user_id',${p.id},true),set_config('app.current_profile_id',${p.profileId},true),set_config('app.current_run_id',${p.runId},true),set_config('app.current_run_role','member',true)`;
      return (
        await tx`select app.group_session_command(${action},${tx.json(args as postgres.JSONValue)}) result`
      )[0].result;
    }) as Promise<{ session: GroupSession; registration?: { id: string } }>;
  }
  const coach = await person("DEV0240 Coach"),
    athlete = await person("DEV0240 Athlete"),
    other = await person("DEV0240 Other athlete");
  const { withActorDatabaseContext } =
    await import("../src/server/db/authorization/repository");
  const { submitOwnedCoachApplicationRecord } =
    await import("../src/server/db/coaches/application-repository");
  const { upsertOwnedCoachProfileRecord } =
    await import("../src/server/db/coaches/repository");
  const actor = {
    authUserId: coach.id,
    profileId: coach.profileId,
    runId: coach.runId,
    runRole: "member" as const,
  };
  await withActorDatabaseContext(actor, submitOwnedCoachApplicationRecord);
  await withActorDatabaseContext(actor, (tx) =>
    upsertOwnedCoachProfileRecord(tx, {
      displayName: "DEV0240 Coach",
      bio: "Temporary local group discovery test coach, removed after verification.",
      disciplines: ["Boxing", "Muay Thai"],
      timezone: "Europe/Berlin",
      visibility: "hidden",
      selectedGymId: "40000000-0000-4000-8000-000000000001",
      independentLocation: null,
    }),
  );
  await db`select app.review_coach_application(${coach.profileId}::uuid,'pending','approved','Tagged local Events interface rehearsal.','local-test','movx-identity-application-v1')`;
  await db`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
  const otherActor = {
    authUserId: other.id,
    profileId: other.profileId,
    runId: other.runId,
    runRole: "member" as const,
  };
  await withActorDatabaseContext(otherActor, submitOwnedCoachApplicationRecord);
  await withActorDatabaseContext(otherActor, (tx) =>
    upsertOwnedCoachProfileRecord(tx, {
      displayName: "DEV0240 Other coach",
      bio: "A second temporary coach participating as an athlete in another coach's group training.",
      disciplines: ["Boxing"],
      timezone: "Europe/Berlin",
      visibility: "hidden",
      selectedGymId: "40000000-0000-4000-8000-000000000001",
      independentLocation: null,
    }),
  );
  await db`select app.review_coach_application(${other.profileId}::uuid,'pending','approved','Tagged coach-as-athlete Events test.','local-test','movx-identity-application-v1')`;
  const [location] =
    await db`select id from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary and status='active'`;
  async function event(
    title: string,
    days: number,
    priceCents = 0,
    capacity = 4,
  ) {
    const starts = new Date();
    starts.setUTCDate(starts.getUTCDate() + days);
    starts.setUTCHours(9, 0, 0, 0);
    const draft: GroupDraftInput = {
      id: randomUUID(),
      expectedRevision: null,
      title,
      description:
        "Practice together. <script>This stays literal text.</script>",
      discipline: "Boxing",
      intendedLevel: "All levels",
      locationId: location.id,
      startsAt: starts.toISOString(),
      endsAt: new Date(+starts + 3600000).toISOString(),
      decisionDeadlineAt: new Date(+starts - 3600000).toISOString(),
      minimumParticipants: 1,
      maximumParticipants: capacity,
      priceCents,
    };
    const saved = await command(coach, "save-draft", draft);
    const published = await db!.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      await tx`select set_config('app.current_auth_user_id',${coach.id},true),set_config('app.current_profile_id',${coach.profileId},true),set_config('app.current_run_id',${coach.runId},true),set_config('app.current_run_role','member',true)`;
      return (
        await tx`select app.publish_group_session(${draft.id}::uuid,${saved.session.revision}::integer) result`
      )[0].result;
    });
    assert.equal(published.outcome, "published");
    return published.session as GroupSession;
  }
  const free = await event("DEV0240 Free footwork", 2),
    paid = await event("DEV0240 Paid practice", 3, 1550),
    full = await event("DEV0240 Full session", 4, 0, 1),
    cancelled = await event("DEV0240 Cancelled session", 5);
  await command(other, "join", { id: full.id, registrationId: randomUUID() });
  await command(athlete, "join", {
    id: cancelled.id,
    registrationId: randomUUID(),
  });
  await command(coach, "cancel", { id: cancelled.id });
  for (let n = 0; n < 21; n++)
    await event(`DEV0240 Later training ${n}`, n + 6);
  log("created guarded Free/paid/full/cancelled and pagination fixtures");
  snapshot = mkdtempSync(resolve(tmpdir(), "movx-dev0240-"));
  for (const path of [
    "src",
    "public",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next-env.d.ts",
    "postcss.config.mjs",
  ])
    if (existsSync(path))
      cpSync(resolve(root, path), resolve(snapshot, path), { recursive: true });
  symlinkSync(
    resolve(root, "node_modules"),
    resolve(snapshot, "node_modules"),
    "dir",
  );
  app = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "localhost",
      "--port",
      "3113",
    ],
    { cwd: snapshot, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [app.stdout, app.stderr])
    stream?.on("data", (data) => {
      appOutput = (appOutput + String(data)).slice(-16000);
    });
  for (let n = 0; n < 90; n++) {
    if (app.exitCode !== null)
      throw new Error("The isolated preview stopped before becoming ready.");
    try {
      if ((await fetch(base + "/events")).ok) break;
    } catch {
      /* waiting for the owned app */
    }
    if (n === 89) throw new Error("The isolated preview did not become ready.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(
    appOutput.includes("Ready in"),
    "The owned preview did not report readiness.",
  );
  log("isolated app snapshot is ready on localhost:3113");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors: string[] = [];
  async function context(p?: Person, javaScriptEnabled = true) {
    const c = await browser!.newContext({
      javaScriptEnabled,
      viewport: { width: 1440, height: 1040 },
    });
    c.setDefaultTimeout(30000);
    c.setDefaultNavigationTimeout(60000);
    if (p) await c.addCookies(p.cookies.map((v) => ({ ...v, url: base })));
    await c.route("https://**", (route) => route.abort());
    const page = await c.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    return { c, page };
  }
  const guest = await context(),
    member = await context(athlete),
    second = await context(other),
    owner = await context(coach);
  await guest.page.goto(base + "/events");
  await expect(
    guest.page.getByRole("heading", { name: "Train together." }),
  ).toBeVisible();
  await expect(guest.page.locator(".event-card")).toHaveCount(20);
  await guest.page.getByRole("link", { name: "Next sessions →" }).click();
  await expect(guest.page.locator(".event-card")).toHaveCount(4);
  await guest.page.getByRole("link", { name: "Back to first page" }).click();
  await guest.page.getByLabel("Training place").fill("Absent place");
  await guest.page.getByRole("button", { name: "Find sessions" }).click();
  await expect(
    guest.page.getByRole("heading", { name: "No upcoming sessions here yet" }),
  ).toBeVisible();
  await guest.page.goBack();
  await expect(guest.page.locator(".event-card")).toHaveCount(20);
  await guest.page.goto(base + "/events?discipline=forged");
  await expect(
    guest.page.getByRole("heading", {
      name: /filters or page details are invalid/,
    }),
  ).toBeVisible();
  await guest.page.goto(base + `/events/${free.slug}`);
  await expect(
    guest.page.getByText(
      "Practice together. <script>This stays literal text.</script>",
      { exact: true },
    ),
  ).toBeVisible();
  await guest.page
    .getByRole("link", { name: "Sign in to join", exact: true })
    .click();
  await expect(guest.page).toHaveURL(/\/sign-in\?returnTo=/);
  assert.equal(
    new URL(guest.page.url()).searchParams.get("returnTo"),
    `/events/${free.slug}`,
  );
  assert.equal(
    (await command(coach, "detail", { id: free.id })).session.participantCount,
    0,
  );
  log(
    "guest filters/paging/history, literal text and sign-in return passed without creating a seat",
  );
  log("testing member registration lifecycle");
  await member.page.goto(base + `/events/${free.slug}`);
  await member.page
    .getByRole("button", { name: "Reserve a seat", exact: true })
    .click();
  await expect(
    member.page.getByText(
      "Your seat is reserved. The coach has not yet confirmed this session. Check the status here before travelling.",
    ),
  ).toBeVisible();
  await expect(
    member.page.getByRole("button", { name: "Withdraw my seat" }),
  ).toBeVisible();
  const joined = await command(athlete, "detail", { id: free.id });
  assert.ok(joined.registration?.id);
  await member.page.reload();
  assert.equal(
    (await command(athlete, "detail", { id: free.id })).registration?.id,
    joined.registration.id,
  );
  await command(coach, "confirm", { id: free.id });
  await member.page.reload();
  await expect(
    member.page.getByText(
      "Your seat is reserved and the coach has confirmed the session.",
      { exact: true },
    ),
  ).toBeVisible();
  await member.page.getByRole("button", { name: "Withdraw my seat" }).click();
  await expect(
    member.page.getByText("You withdrew", { exact: true }),
  ).toBeVisible();
  assert.equal(
    (await command(coach, "detail", { id: free.id })).session.status,
    "confirmed",
  );
  await member.page
    .getByRole("button", { name: "Reserve a seat", exact: true })
    .click();
  await expect(
    member.page.getByRole("button", { name: "Withdraw my seat" }),
  ).toBeVisible();
  const rejoined = await command(athlete, "detail", { id: free.id });
  assert.notEqual(rejoined.registration?.id, joined.registration.id);
  await command(athlete, "withdraw", {
    id: free.id,
    registrationId: joined.registration.id,
  });
  assert.equal(
    (await command(athlete, "detail", { id: free.id })).registration?.id,
    rejoined.registration?.id,
  );
  log(
    "real join/refresh/confirm/withdraw/rejoin preserved exact attempt identities and manual confirmation",
  );
  await member.page.goto(base + `/events/${paid.slug}`);
  await expect(
    member.page
      .getByRole("definition")
      .filter({ hasText: "€15.50 per person" }),
  ).toBeVisible();
  await expect(
    member.page.getByText(/Pay at session\. Includes required venue/),
  ).toBeVisible();
  await member.page
    .getByRole("button", { name: "Reserve a seat", exact: true })
    .click();
  await expect(
    member.page.getByRole("button", { name: "Withdraw my seat" }),
  ).toBeVisible();
  await member.page.goto(base + "/sessions/groups");
  await expect(
    member.page.getByRole("heading", { name: paid.title, exact: true }),
  ).toBeVisible();
  await expect(
    member.page.getByRole("heading", {
      name: "DEV0240 Cancelled session",
      exact: true,
    }),
  ).toBeVisible();
  assert.ok(!(await member.page.content()).includes("DEV0240 Other athlete"));
  const anotherPage = await second.c.newPage();
  await anotherPage.goto(base + "/sessions/groups");
  await expect(
    anotherPage.getByRole("heading", {
      name: "DEV0240 Paid practice",
      exact: true,
    }),
  ).toHaveCount(0);
  await owner.page.goto(base + `/events/${paid.slug}`);
  await expect(
    owner.page.getByRole("button", { name: "Reserve a seat" }),
  ).toHaveCount(0);
  await member.page.goto(base + `/events/${full.slug}`);
  await expect(
    member.page.getByText("This session is full. There is no waitlist."),
  ).toBeVisible();
  log(
    "paid terms, own-history privacy, cancelled history, owner exclusion and full-capacity recovery passed",
  );
  // A form rendered for one account cannot mutate another after a cookie switch.
  const switchEvent = await event("DEV0240 Account switch", 40);
  await member.page.goto(base + `/events/${switchEvent.slug}`);
  await member.c.clearCookies();
  await member.c.addCookies(other.cookies.map((v) => ({ ...v, url: base })));
  await member.page
    .getByRole("button", { name: "Reserve a seat", exact: true })
    .click();
  await expect(
    member.page.getByText(/signed-in account changed/),
  ).toBeVisible();
  assert.equal(
    (await command(coach, "detail", { id: switchEvent.id })).session
      .participantCount,
    0,
  );
  log("old-account form replay was rejected before mutating the new account");
  await member.page.reload();
  await member.page
    .getByRole("button", { name: "Reserve a seat", exact: true })
    .click();
  await expect(
    member.page.getByRole("button", { name: "Withdraw my seat" }),
  ).toBeVisible();
  assert.ok(
    (await command(other, "detail", { id: switchEvent.id })).registration?.id,
  );
  log(
    "an approved coach can participate as an athlete in another coach's group session",
  );

  const recovery = await event("DEV0240 Recovery session", 42);
  await member.page.goto(base + `/events/${recovery.slug}`);
  const operation = await member.page
    .locator('input[name="registrationId"]')
    .inputValue();
  await db`revoke execute on function app.group_session_command(text,jsonb) from app_runtime`;
  await member.page
    .getByRole("button", { name: "Reserve a seat", exact: true })
    .click();
  await expect(
    member.page.getByText(/could not verify the outcome/),
  ).toBeVisible();
  await expect(
    member.page.getByRole("heading", { name: "Registration unavailable" }),
  ).toBeVisible();
  await db`grant execute on function app.group_session_command(text,jsonb) to app_runtime`;
  await member.page
    .getByRole("link", { name: "Refresh session status", exact: true })
    .click();
  const retryOperation = await member.page
    .locator('input[name="registrationId"]')
    .inputValue();
  await member.page
    .getByRole("button", { name: "Reserve a seat", exact: true })
    .click();
  await expect(
    member.page.getByRole("button", { name: "Withdraw my seat" }),
  ).toBeVisible();
  const recovered = await command(other, "detail", { id: recovery.id });
  assert.equal(recovered.registration?.id, retryOperation);
  assert.equal(
    (
      await command(other, "join", {
        id: recovery.id,
        registrationId: operation,
      })
    ).registration?.id,
    retryOperation,
  );
  assert.equal(recovered.session.participantCount, 1);
  await db`revoke execute on function app.public_group_sessions(text,jsonb) from app_runtime`;
  await guest.page.goto(base + "/events");
  await expect(
    guest.page.getByRole("heading", {
      name: "Group sessions are unavailable right now",
    }),
  ).toBeVisible();
  await expect(
    guest.page.getByRole("heading", { name: "No upcoming sessions here yet" }),
  ).toHaveCount(0);
  await db`grant execute on function app.public_group_sessions(text,jsonb) to app_runtime`;
  log(
    "temporary read/write failures reconcile current status and recover one active registration",
  );

  const expiredId = randomUUID();
  await db`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,created_at,published_at)
    select ${expiredId}::uuid,run_id,coach_profile_id,${"group-" + expiredId.replaceAll("-", "")},'DEV0240 Missed deadline',description,discipline,intended_level,training_location_id,venue_snapshot,starts_at+interval '60 days',ends_at+interval '60 days',clock_timestamp()-interval '1 hour',minimum_participants,maximum_participants,price_cents,'open',clock_timestamp()-interval '3 hours',clock_timestamp()-interval '2 hours' from app.coach_group_sessions where id=${paid.id}::uuid`;
  await guest.page.goto(
    base + `/events/group-${expiredId.replaceAll("-", "")}`,
  );
  await expect(
    guest.page.getByText("Not confirmed", { exact: true }),
  ).toBeVisible();
  await expect(
    guest.page.getByRole("link", { name: "Sign in to join", exact: true }),
  ).toHaveCount(0);
  log(
    "a missed decision deadline reconciles to Not confirmed with no guest join invitation",
  );

  const history = await event("DEV0240 Attempt history", 43);
  for (let n = 0; n < 21; n++) {
    const attempt = await command(athlete, "join", {
      id: history.id,
      registrationId: randomUUID(),
    });
    await command(athlete, "withdraw", {
      id: history.id,
      registrationId: attempt.registration!.id,
    });
  }
  const historyProof = await context(athlete, false);
  await historyProof.page.goto(base + "/sessions/groups");
  await expect(historyProof.page.locator(".group-history-card")).toHaveCount(
    20,
  );
  await historyProof.page
    .getByRole("link", { name: "Older registrations →" })
    .click();
  await expect(
    historyProof.page.getByRole("heading", {
      name: "DEV0240 Cancelled session",
      exact: true,
    }),
  ).toBeVisible();
  await historyProof.c.close();
  log(
    "bounded own-registration paging retains earlier withdrawal/rejoin attempts and terminal history",
  );
  const native = await context(athlete, false);
  await native.page.goto(base + "/events?discipline=Muay+Thai");
  await expect(
    native.page.getByRole("heading", { name: "No upcoming sessions here yet" }),
  ).toBeVisible();
  await native.page.getByLabel("Discipline").selectOption("Boxing");
  await native.page
    .getByRole("button", { name: "Find sessions" })
    .press("Enter");
  await expect(native.page.locator(".event-card")).toHaveCount(20);
  const nativeEvent = await event("DEV0240 No JavaScript", 41);
  await native.page.goto(base + `/events/${nativeEvent.slug}`);
  await native.page
    .getByRole("button", { name: "Reserve a seat", exact: true })
    .press("Enter");
  await expect(
    native.page.getByRole("button", { name: "Withdraw my seat" }),
  ).toBeVisible();
  await native.page
    .getByRole("button", { name: "Withdraw my seat" })
    .press("Enter");
  await expect(
    native.page.getByRole("button", { name: "Reserve a seat", exact: true }),
  ).toBeVisible();
  log(
    "native GET filters and join/withdraw forms passed with JavaScript disabled",
  );
  mkdirSync(evidence, { recursive: true });
  for (const width of [375, 430, 768, 1440]) {
    await guest.page.setViewportSize({ width, height: 1000 });
    await guest.page.goto(base + "/events");
    assert.ok(
      await guest.page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `Events overflow at ${width}`,
    );
    await guest.page.keyboard.press("Tab");
    await expect(
      guest.page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await guest.page.keyboard.press("Enter");
    await expect(guest.page.locator("#main-content")).toBeFocused();
    await guest.page.screenshot({
      path: resolve(evidence, `events-${width}.png`),
      fullPage: true,
    });
    await guest.page.screenshot({
      path: resolve(evidence, `events-viewport-${width}.png`),
    });
    await native.page.setViewportSize({ width, height: 1000 });
    await native.page.goto(base + `/events/${paid.slug}`);
    assert.ok(
      await native.page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `Detail overflow at ${width}`,
    );
    await native.page.screenshot({
      path: resolve(evidence, `detail-${width}.png`),
      fullPage: true,
    });
    await native.page.screenshot({
      path: resolve(evidence, `detail-viewport-${width}.png`),
    });
    await native.page.goto(base + "/sessions/groups");
    assert.ok(
      await native.page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `History overflow at ${width}`,
    );
  }
  log("desktop/mobile widths and keyboard entry passed; screenshots captured");
  for (const path of ["/", "/explore?discipline=Boxing", "/sessions"]) {
    await native.page.goto(base + path);
    await expect(native.page.locator("h1").first()).toBeVisible();
    if (path === "/sessions")
      await expect(
        native.page
          .getByRole("navigation", { name: "Session type" })
          .getByRole("link", { name: "Group sessions Train with a group" }),
      ).toBeVisible();
  }
  await db`update app.coach_profiles set visibility='hidden' where profile_id=${coach.profileId}::uuid`;
  await guest.page.goto(base + `/events/${paid.slug}`);
  await expect(
    guest.page.getByRole("heading", { name: paid.title, exact: true }),
  ).toHaveCount(0);
  await native.page.goto(base + `/events/${paid.slug}`);
  await expect(
    native.page.getByRole("button", { name: "Withdraw my seat" }),
  ).toBeVisible();
  await db`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
  await db`select app.review_coach_application(${coach.profileId}::uuid,'approved','suspended','Tagged Events suspension recovery case.','local-test','movx-identity-application-v1')`;
  await native.page.reload();
  await native.page.getByRole("button", { name: "Withdraw my seat" }).click();
  await expect(
    native.page.getByText("You withdrew", { exact: true }),
  ).toBeVisible();
  await expect(
    native.page.getByRole("button", { name: "Reserve a seat", exact: true }),
  ).toHaveCount(0);
  log(
    "hidden/suspended coaches lose public discovery while exact participants retain history and withdrawal",
  );
  // Deny the owned actor: no former registration data should survive a fresh read.
  await db`update app.demo_run_participants set status='revoked',revoked_at=clock_timestamp() where profile_id=${athlete.profileId}::uuid and run_id=${athlete.runId}::uuid`;
  await native.page.goto(base + "/sessions/groups");
  assert.ok(new URL(native.page.url()).pathname === "/sign-in");
  assert.ok(!(await native.page.content()).includes("DEV0240 Paid practice"));
  assert.deepEqual(errors, []);
  log(
    "Home/Explore/private-session links and access-revocation isolation passed",
  );
  console.log(
    "DEV0240 rehearsal passed. Shared development database schema/data were not reset, migrated or seeded.",
  );
} catch (error) {
  console.error(`DEV0240 failed during ${phase}.`);
  console.error(
    appOutput
      .split("\n")
      .filter((line) => /Error|error|POST|origin|action/.test(line))
      .slice(-30)
      .join("\n"),
  );
  mkdirSync(evidence, { recursive: true });
  if (browser) {
    let n = 0;
    for (const context of browser.contexts())
      for (const page of context.pages()) {
        try {
          await page.screenshot({
            path: resolve(evidence, `failure-${n++}.png`),
            fullPage: true,
            timeout: 3000,
          });
        } catch {
          /* keep cleanup available even when a page crashed */
        }
      }
  }
  throw error;
} finally {
  await browser?.close();
  if (app && app.exitCode === null) {
    app.kill("SIGTERM");
    await new Promise((resolve) => {
      app!.once("exit", resolve);
      setTimeout(resolve, 5000);
    });
  }
  await db?.end({ timeout: 2 });
  let cleanupFailed = false;
  for (const id of people) {
    const result = await auth.auth.admin.deleteUser(id);
    if (result.error) {
      cleanupFailed = true;
      console.error("Could not remove exact tagged DEV0240 Auth fixture:", id);
    }
  }
  if (madeDatabase)
    docker(["dropdb", "-U", "supabase_admin", "--force", databaseName]);
  if (snapshot) rmSync(snapshot, { recursive: true, force: true });
  if (cleanupFailed)
    throw new Error(
      "DEV0240 Auth fixture cleanup is incomplete; remove only the exact tagged IDs reported above.",
    );
  console.log("DEV0240 owned app/database/Auth fixtures cleaned up.");
}
