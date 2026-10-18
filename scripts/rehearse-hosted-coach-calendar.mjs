// DEV0254: explicitly invoked real Auth/runtime/browser validation on hosted dev.
// No email, migration, seed, Docker or application authorization replacement.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
import { chromium, expect as baseExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { hostedDevelopmentConfiguration } from "./lib/hosted-environment.mjs";

const root = process.cwd();
const target = hostedDevelopmentConfiguration(process.env);
assert.equal(target.projectRef, "mdzidiqosxbghmfyxphb");
const base = "http://localhost:3148";
const output = path.join(root, "test-results/dev0254-hosted");
const journal = path.join(output, "fixture-manifest.json");
const baselinePath = path.join(output, "baseline.json");
const recovery = process.argv.includes("--cleanup");
const previous = await readFile(journal, "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
assert.ok(
  recovery || !previous,
  "A fixture manifest already exists; run --cleanup first.",
);
if (recovery)
  assert.ok(
    previous?.ticket === "DEV0254" && previous.project === target.projectRef,
    "Expected exact dev fixture manifest.",
  );
const runId = recovery ? previous.runId : randomUUID();
const cli = path.join(root, "node_modules/.bin/supabase");
const expect = baseExpect.configure({ timeout: 30000 });
const quote = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const json = (v) => quote(JSON.stringify(v)) + "::jsonb";
function cliJson(args) {
  try {
    return JSON.parse(
      execFileSync(cli, [...args, "--output", "json"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 16 * 1024 * 1024,
      }),
    );
  } catch (error) {
    // SQL arguments contain only fixture UUIDs/terms. Never echo CLI key output.
    throw new Error(
      args[0] === "db"
        ? `Hosted fixture SQL failed: ${String(error.stderr ?? error.message).slice(-2000)}`
        : "Could not read operator Auth key.",
    );
  }
}
const query = (sql) =>
  cliJson(["db", "query", "--linked", "--project-ref", target.projectRef, sql])
    .rows;
const keys = cliJson([
  "projects",
  "api-keys",
  "--project-ref",
  target.projectRef,
  "--reveal",
]);
const operatorKey = keys.find((k) => k.type === "secret")?.api_key;
assert.ok(
  operatorKey?.startsWith("sb_secret_"),
  "Expected existing dev operator key.",
);
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, operatorKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const people = recovery ? previous.people : [];
let checkout, server, browser;
let phase = "preflight";
let serverLog = "";
let baseline;
const checks = [];
const record = (message) => {
  checks.push(message);
  console.log("PASS " + message);
};
function fingerprint() {
  return query(`begin; set local statement_timeout='60s';
    create temporary table dev0254_skip(id uuid primary key) on commit drop;
    insert into dev0254_skip select id from auth.users where raw_app_meta_data->>'temporary'='true';
    insert into dev0254_skip select p.id from app.profiles p join auth.users u on u.id=p.auth_user_id where u.raw_app_meta_data->>'temporary'='true' on conflict do nothing;
    create temporary table dev0254_fingerprint(name text,signature jsonb) on commit drop;
    do $$ declare relation record; signature jsonb; added int; total_added int; begin
      loop
        total_added:=0;
        for relation in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attname='id' and a.atttypid='uuid'::regtype where n.nspname='app' and c.relkind='r' loop
          execute format('insert into dev0254_skip select t.id from app.%I t where exists(select 1 from jsonb_each_text(to_jsonb(t)) v join dev0254_skip s on v.value=s.id::text) on conflict do nothing',relation.relname);
          get diagnostics added=row_count; total_added:=total_added+added;
        end loop;
        exit when total_added=0;
      end loop;
      for relation in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relkind='r' order by c.relname loop
        execute format('select coalesce(jsonb_agg(md5(to_jsonb(t)::text) order by md5(to_jsonb(t)::text)),''[]''::jsonb) from app.%I t where not exists(select 1 from jsonb_each_text(to_jsonb(t)) v join dev0254_skip s on v.value=s.id::text)',relation.relname) into signature;
        insert into dev0254_fingerprint values(relation.relname,signature);
      end loop;
    end $$;
    select (select jsonb_object_agg(name,signature) from dev0254_fingerprint) app,
      (select coalesce(jsonb_agg(md5(to_jsonb(u)::text)),'[]'::jsonb) from auth.users u where raw_app_meta_data->>'temporary' is distinct from 'true') auth,
      (select coalesce(jsonb_agg(md5(to_jsonb(o)::text)),'[]'::jsonb) from storage.objects o) storage; commit;`)[0];
}
function assertPreserved(before, after) {
  for (const [name, hashes] of Object.entries(before.app))
    for (const hash of hashes)
      assert.ok(
        after.app[name]?.includes(hash),
        `Existing non-fixture ${name} record changed.`,
      );
  for (const kind of ["auth", "storage"])
    for (const hash of before[kind])
      assert.ok(
        after[kind].includes(hash),
        `Existing non-fixture ${kind} record changed.`,
      );
}
const actor = (p) =>
  `select set_config('app.current_auth_user_id',${quote(p.id)},true),set_config('app.current_profile_id',${quote(p.profileId)},true),set_config('app.current_run_id',${quote(p.runId)},true),set_config('app.current_run_role','member',true);`;
function work(p, sql) {
  return query(
    `begin; set local lock_timeout='3s'; set local statement_timeout='60s'; ${actor(p)} ${sql}; commit;`,
  );
}
function command(p, action, args) {
  return work(
    p,
    `select app.group_session_command(${quote(action)},${json(args)}) result`,
  )[0].result;
}
async function saveJournal() {
  await writeFile(
    journal,
    JSON.stringify(
      {
        ticket: "DEV0254",
        project: target.projectRef,
        runId,
        people: people.map(({ id, profileId }) => ({ id, profileId })),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}
async function person(label) {
  const email = `dev0254-calendar-${runId}-${label}@users.movx.test`;
  const created = await auth.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: {
      movx_test_ticket: "DEV0254",
      temporary: true,
      rehearsal_id: runId,
    },
  });
  assert.equal(created.error, null, "Create tagged Auth account.");
  const p = { label, id: created.data.user.id, cookies: [] };
  people.push(p);
  await saveJournal();
  const generated = await auth.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  assert.equal(generated.error, null, "Generate fixture OTP without delivery.");
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { autoRefreshToken: false },
      cookies: {
        getAll: () => p.cookies,
        setAll: (values) => {
          p.cookies = values.map(({ name, value }) => ({ name, value }));
        },
      },
    },
  );
  const verified = await client.auth.verifyOtp({
    email,
    token: generated.data.properties.email_otp,
    type: "email",
  });
  assert.equal(verified.error, null, "Verify real fixture OTP.");
  p.client = client;
  p.context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  p.context.setDefaultNavigationTimeout(90000);
  await p.context.addCookies(p.cookies.map((c) => ({ ...c, url: base })));
  const session = await p.context.request.get(base + "/api/auth/session");
  assert.equal(session.status(), 200);
  assert.equal((await session.json()).status, "signed-in");
  const enrolled = await p.context.request.post(base + "/api/auth/identity", {
    headers: { origin: base },
    data: {
      displayName: `DEV0254 ${label}`,
      fullName: `DEV0254 ${label}`,
      username: "dev0254_" + p.id.replaceAll("-", "").slice(0, 20),
    },
  });
  assert.equal(enrolled.status(), 200);
  assert.equal((await enrolled.json()).status, "enrolled");
  const [row] = query(
    `select id,run_id from app.profiles p join app.demo_run_participants d on d.profile_id=p.id where p.auth_user_id=${quote(p.id)}::uuid`,
  );
  p.profileId = row.id;
  p.runId = row.run_id;
  await saveJournal();
  return p;
}
async function cleanup() {
  if (!people.length) return;
  const ids = people.map((p) => quote(p.id) + "::uuid").join(",");
  const rows = query(
    `select u.id,p.id profile_id from auth.users u left join app.profiles p on p.auth_user_id=u.id where u.id in (${ids}) and u.raw_app_meta_data->>'rehearsal_id'=${quote(runId)} and u.raw_app_meta_data->>'movx_test_ticket'='DEV0254'`,
  );
  assert.equal(
    rows.length,
    people.length,
    "Cleanup refuses untagged or missing accounts.",
  );
  const profiles = rows
    .filter((r) => r.profile_id)
    .map((r) => quote(r.profile_id) + "::uuid")
    .join(",");
  if (profiles)
    query(`begin; set local lock_timeout='3s'; set local statement_timeout='60s';
    do $$ begin
      if exists(select 1 from app.coach_booking_requests where coach_profile_id in (${profiles}) and client_profile_id not in (${profiles}))
        or exists(select 1 from app.coach_group_registrations r join app.coach_group_sessions s on s.id=r.session_id where s.coach_profile_id in (${profiles}) and r.athlete_profile_id not in (${profiles})) then
        raise exception 'External activity on temporary fixtures requires operator review'; end if;
    end $$;
    delete from app.message_conversations where coach_profile_id in (${profiles}) or athlete_profile_id in (${profiles});
    delete from app.coach_athlete_connection_attempts where pair_id in(select id from app.coach_athlete_connection_pairs where coach_profile_id in (${profiles}) or athlete_profile_id in (${profiles}));
    delete from app.coach_athlete_connection_pairs where coach_profile_id in (${profiles}) or athlete_profile_id in (${profiles});
    delete from app.coach_booking_requests where coach_profile_id in (${profiles}) or client_profile_id in (${profiles});
    delete from app.coach_private_bookings where coach_profile_id in (${profiles}) or client_profile_id in (${profiles});
    delete from app.coach_group_registrations where session_id in(select id from app.coach_group_sessions where coach_profile_id in (${profiles}));
    delete from app.coach_group_sessions where coach_profile_id in (${profiles});
    delete from app.coach_availability_slots where profile_id in (${profiles});
    delete from app.coach_availability_rules where profile_id in (${profiles});
    delete from app.coach_training_locations where profile_id in (${profiles});
    delete from app.coach_profile_disciplines where profile_id in (${profiles});
    delete from app.coach_profiles where profile_id in (${profiles});
    delete from app.coach_application_review_events where profile_id in (${profiles});
    delete from app.coach_applications where profile_id in (${profiles});
    delete from app.demo_run_participants where profile_id in (${profiles});
    delete from app.profiles where id in (${profiles}); commit;`);
  for (const p of people) {
    const result = await auth.auth.admin.deleteUser(p.id);
    assert.equal(result.error, null, "Delete exact tagged Auth account.");
  }
  assert.equal(
    query(`select count(*)::int n from auth.users where id in (${ids})`)[0].n,
    0,
  );
  await rm(journal);
  console.log("PASS exact tagged application/Auth fixtures removed");
}
if (recovery) {
  await cleanup();
  const savedBaseline = await readFile(baselinePath, "utf8")
    .then(JSON.parse)
    .catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
  if (savedBaseline) assertPreserved(savedBaseline, fingerprint());
  console.log("DEV0254 exact manifest recovery cleanup complete.");
  process.exit(0);
}
try {
  await mkdir(output, { recursive: true });
  const [preflight] = query(
    "select current_user,(select json_agg(version order by version) from supabase_migrations.schema_migrations) versions",
  );
  assert.equal(preflight.current_user, "postgres");
  assert.deepEqual(preflight.versions, [
    "20261016000100",
    "20261016000200",
    "20261016000300",
  ]);
  baseline = fingerprint();
  await writeFile(baselinePath, JSON.stringify(baseline, null, 2), {
    mode: 0o600,
  });
  checkout = await mkdtemp(path.join(tmpdir(), "movx-dev0254-hosted-"));
  for (const item of [
    "src",
    "public",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, item), path.join(checkout, item), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(checkout, "node_modules"),
    "dir",
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC/.test(key),
    ),
  );
  Object.assign(env, {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: base,
    NEXT_TELEMETRY_DISABLED: "1",
  });
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "localhost",
      "--port",
      "3148",
    ],
    { cwd: checkout, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const s of [server.stdout, server.stderr])
    s.on("data", (c) => {
      serverLog += c.toString();
    });
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw new Error("Owned Next.js server exited.");
    try {
      const response = await fetch(base + "/api/auth/session");
      if (response.status === 200) break;
    } catch {
      /* startup */
    }
    if (i === 119) throw new Error("Owned server did not start.");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });

  phase = "real Auth and enrollment";
  const owner = await person("owner"),
    other = await person("other"),
    athlete = await person("athlete"),
    applicant = await person("applicant");
  record("four real OTP sessions and restricted-runtime identity enrollments");
  phase = "fixture setup";
  for (const p of [owner, other, applicant]) {
    work(
      p,
      `select app.submit_owned_coach_application(); select app.upsert_owned_coach_profile(${quote("DEV0254 " + p.label)},'Temporary hosted calendar validation; removed after rehearsal.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
    );
    if (p !== applicant)
      query(
        `select app.review_coach_application(${quote(p.profileId)}::uuid,'pending','approved','Tagged temporary calendar validation.','dev0254-rehearsal','movx-identity-application-v1'); update app.coach_profiles set visibility='visible' where profile_id=${quote(p.profileId)}::uuid`,
      );
    p.venueId = query(
      `select id from app.coach_training_locations where profile_id=${quote(p.profileId)}::uuid and is_primary`,
    )[0].id;
  }
  const venueB = work(
    owner,
    "select app.create_owned_coach_training_location('DEV0254 Riverside training deck with a long venue name',null,'Temporary Berlin rehearsal location',52.5,13.4,'manual',null) id",
  )[0].id;
  const hours = query(
    `select json_agg(json_build_object('isoWeekday',d,'localStartTime',h,'locationId',l.id,'locationUpdatedAt',l.updated_at)) hours from app.coach_training_locations l cross join generate_series(1,7)d cross join unnest(array['09:00','10:00','11:00','12:00'])h where l.id=${quote(owner.venueId)}::uuid`,
  )[0].hours;
  const saved = work(
    owner,
    `select app.save_owned_effective_coach_availability(${json({ operationId: randomUUID(), expectedRevision: 0, kind: "weekly", hours })}) result`,
  )[0].result;
  assert.equal(saved.outcome, "saved");
  const today = query(
    "select (clock_timestamp() at time zone 'Europe/Berlin')::date::text today",
  )[0].today;
  const datePlus = (n) =>
    new Date(Date.parse(today + "T12:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
  async function group(
    label,
    day,
    hour = 15,
    coach = owner,
    venue = venueB,
    publish = true,
  ) {
    const id = randomUUID();
    const starts = `(${quote(datePlus(day) + " " + hour + ":00")}::timestamp at time zone 'Europe/Berlin')`;
    work(
      coach,
      `select app.group_session_command('save-draft',${json({ id, expectedRevision: null, title: "DEV0254 " + label, description: "Temporary hosted calendar validation.", discipline: "Boxing", intendedLevel: "All levels", locationId: venue, minimumParticipants: 1, maximumParticipants: 5, priceCents: 0 })} || jsonb_build_object('startsAt',${starts},'endsAt',${starts}+interval '1 hour','decisionDeadlineAt',${starts}-interval '1 hour'));
      ${publish ? `select app.publish_group_session(${quote(id)}::uuid,1);` : ""}`,
    );
    return id;
  }
  const openId = await group("open group", 3);
  const confirmedId = await group("confirmed group", 3, 17);
  command(athlete, "join", { id: confirmedId, registrationId: randomUUID() });
  command(owner, "confirm", { id: confirmedId, expectedRevision: 2 });
  const cancelledId = await group("cancelled group", 4);
  command(owner, "cancel", { id: cancelledId, expectedRevision: 2 });
  const beyondId = await group("beyond horizon", 35);
  const draftId = await group("excluded draft", 5, 15, owner, venueB, false);
  const otherId = await group("other owner", 3, 15, other, other.venueId);
  // Historical states use new fixture-only INSERTs, not clock overrides or
  // changed immutable terms of an existing published session.
  const endedId = randomUUID(),
    deadlineId = randomUUID();
  query(`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,published_at,confirmed_at,confirmed_by_profile_id,published_from_revision)
    select ${quote(endedId)}::uuid,run_id,coach_profile_id,'group-'||replace(${quote(endedId)},'-',''),'DEV0254 ended group',description,discipline,intended_level,training_location_id,venue_snapshot,clock_timestamp()-interval '1 day',clock_timestamp()-interval '23 hours',clock_timestamp()-interval '2 days',1,5,0,'confirmed',clock_timestamp()-interval '4 days',clock_timestamp()-interval '3 days',coach_profile_id,1 from app.coach_group_sessions where id=${quote(openId)}::uuid;
    insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,published_at,published_from_revision)
    select ${quote(deadlineId)}::uuid,run_id,coach_profile_id,'group-'||replace(${quote(deadlineId)},'-',''),'DEV0254 missed deadline',description,discipline,intended_level,training_location_id,venue_snapshot,clock_timestamp()+interval '2 days',clock_timestamp()+interval '49 hours',clock_timestamp()-interval '1 hour',1,5,0,'open',clock_timestamp()-interval '2 days',1 from app.coach_group_sessions where id=${quote(openId)}::uuid`);
  const slots = query(
    `select id,starts_at from app.coach_availability_slots where profile_id=${quote(owner.profileId)}::uuid and status='open' and starts_at>clock_timestamp()+interval '1 day' order by starts_at limit 3`,
  );
  const requestId = work(
    athlete,
    `select * from app.create_coach_booking_request(${quote(slots[0].id)}::uuid)`,
  )[0].request_id;
  const acceptedId = work(
    athlete,
    `select * from app.create_coach_booking_request(${quote(slots[1].id)}::uuid)`,
  )[0].request_id;
  const bookingId = work(
    owner,
    `select * from app.accept_coach_booking_request(${quote(acceptedId)}::uuid)`,
  )[0].booking_id;
  // New elapsed private-history fixtures satisfy the real constraints. These
  // operator INSERTs avoid pretending a browser can fast-forward wall time.
  query(`do $$ declare fixture_status text; slot uuid; booking uuid; starts timestamptz; offset_days int:=3; begin
    foreach fixture_status in array array['confirmed','completed','cancelled'] loop
      slot:=gen_random_uuid(); booking:=gen_random_uuid();
      starts:=(((clock_timestamp() at time zone 'Europe/Berlin')::date-offset_days)+time '12:00') at time zone 'Europe/Berlin';
      insert into app.coach_availability_slots(id,run_id,profile_id,starts_at,ends_at,coach_timezone,status,location_kind,selected_gym_id,gym_name,public_location_label,latitude,longitude,location_source,location_provider,location_confirmed_at,coach_training_location_id,training_location_name)
        select slot,run_id,profile_id,starts,starts+interval '1 hour',coach_timezone,'booked',location_kind,selected_gym_id,gym_name,public_location_label,latitude,longitude,location_source,location_provider,location_confirmed_at,coach_training_location_id,training_location_name from app.coach_availability_slots where id=${quote(slots[1].id)}::uuid;
      insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at,created_at,cancelled_at,completed_at,cancelled_by_profile_id)
        select booking,run_id,slot,coach_profile_id,client_profile_id,fixture_status,starts,starts+interval '1 hour',starts-interval '1 day',starts-interval '1 hour',starts-interval '2 days',case when fixture_status='cancelled' then starts-interval '2 hours' end,case when fixture_status='completed' then starts+interval '2 hours' end,case when fixture_status='cancelled' then coach_profile_id end from app.coach_private_bookings where id=${quote(bookingId)}::uuid;
      offset_days:=offset_days+1;
    end loop;
  end $$`);
  const pendingDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(slots[0].starts_at));
  const liveFeed = query(`begin; ${actor(owner)} set local role app_runtime;
    select app.owned_coach_calendar(${json({ from: today, through: datePlus(41), type: "group", venueId: null, history: true, after: null })}) result; commit;`)[0]
    .result;
  const feedIds = liveFeed.items.map((item) => item.id);
  for (const id of [openId, confirmedId, cancelledId, beyondId, deadlineId])
    assert.ok(feedIds.includes(id));
  for (const id of [draftId, otherId]) assert.ok(!feedIds.includes(id));
  const allowedKeys = [
    "source",
    "id",
    "startsAt",
    "endsAt",
    "status",
    "title",
    "locationId",
    "venueName",
    "venueLabel",
    "venueActive",
    "pendingCount",
  ].sort();
  for (const item of [
    ...liveFeed.items,
    ...liveFeed.days.flatMap((d) => d.previews),
  ])
    assert.deepEqual(Object.keys(item).sort(), allowedKeys);
  record(
    "actual runtime feed excludes drafts/other owners and contains only the declared redacted fields",
  );
  record(
    "real approved coaches, two venues, private request/booking and mixed published groups prepared",
  );
  const page = await owner.context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const calendar = page.getByRole("region", {
    name: "Coach calendar",
    exact: true,
  });
  const agenda = () =>
    page.getByRole("region", { name: "Calendar agenda", exact: true });
  const href = (date, view = "day", extra = "") =>
    `${base}/coach?view=schedule&section=calendar&date=${date}&calendarView=${view}${extra}`;
  async function goto(url) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await expect(calendar).toBeVisible();
    await expect(calendar).toHaveAttribute("aria-busy", "false");
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".coach-calendar button")].some((el) =>
        Object.keys(el).some((key) => key.startsWith("__reactProps$")),
      ),
    );
  }
  async function noOverflow() {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "No horizontal page overflow.",
    );
  }
  phase = "calendar views and request links";
  await goto(base + "/coach");
  await expect(
    page
      .getByRole("navigation", { name: "Calendar views" })
      .getByRole("link", { name: "Week", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await goto(href(pendingDate));
  await expect(
    agenda().getByText("1 pending · time is still open", { exact: true }),
  ).toBeVisible();
  assert.ok(!(await calendar.innerText()).includes("DEV0254 athlete"));
  await agenda().getByRole("button").filter({ hasText: "1 pending" }).click();
  const dialog = page.getByRole("dialog");
  const requestLink = dialog.getByRole("link", {
    name: "View booking requests",
  });
  await expect(requestLink).toHaveAttribute(
    "href",
    `/coach?view=bookings&occurrence=${slots[0].id}#coach-occurrence-${slots[0].id}`,
  );
  await requestLink.click();
  await expect(page.locator(`#coach-occurrence-${slots[0].id}`)).toBeVisible();
  await expect(
    page.getByText("DEV0254 athlete", { exact: true }).first(),
  ).toBeVisible();
  await page.goBack();
  await expect(calendar).toBeVisible();
  await agenda()
    .getByRole("button")
    .filter({ hasText: "Private session" })
    .click();
  await expect(
    dialog.getByRole("link", { name: "View original booking" }),
  ).toHaveAttribute("href", `/coach?view=bookings#coach-booking-${bookingId}`);
  await dialog.getByRole("link", { name: "View original booking" }).click();
  await expect(page.locator(`#coach-booking-${bookingId}`)).toBeVisible();
  await goto(href(pendingDate));
  await agenda().getByRole("button").filter({ hasText: "1 pending" }).click();
  await dialog.getByRole("link", { name: "Edit date hours" }).click();
  await expect(
    page.getByRole("region", { name: "Availability editor", exact: true }),
  ).toBeVisible();
  assert.equal(new URL(page.url()).searchParams.get("date"), pendingDate);
  await expect(
    page.getByRole("button", { name: `Remove ${pendingDate}`, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Weekly hours", exact: true }).click();
  await page
    .getByLabel("Monday range 1 end", { exact: true })
    .selectOption("14:00");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(
    dialog.getByRole("heading", {
      name: "Unsaved availability changes",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(
    page.getByLabel("Monday range 1 end", { exact: true }),
  ).toHaveValue("14:00");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(calendar).toBeVisible();
  record(
    "real Week/Day, coach-only pending count and original request/booking destinations",
  );
  phase = "month paging and lifecycle filters";
  await goto(href(datePlus(3), "month"));
  assert.equal(await page.locator(".coach-calendar-month-day").count(), 42);
  await expect(
    page.getByRole("button", { name: "Load more calendar items" }),
  ).toBeVisible();
  await group("concurrent calendar addition", 6, 18);
  await page.getByRole("button", { name: "Load more calendar items" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "calendar changed while you were browsing" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reload calendar", exact: true })
    .click();
  await expect(calendar).toHaveAttribute("aria-busy", "false");
  while (
    await page.getByRole("button", { name: "Load more calendar items" }).count()
  ) {
    await page
      .getByRole("button", { name: "Load more calendar items" })
      .click();
    await expect(calendar).toHaveAttribute("aria-busy", "false");
  }
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(datePlus(3) + "T12:00:00Z"));
  const cell = page.getByRole("region", { name: dayLabel, exact: true });
  assert.equal(await cell.locator("button").count(), 3);
  await expect(
    cell.getByRole("link", { name: /Show all 6 items/ }),
  ).toBeVisible();
  await cell.getByRole("link", { name: /Show all 6 items/ }).click();
  await expect(agenda().getByRole("button")).toHaveCount(6);
  await expect(
    agenda().getByText(/Group · Awaiting confirmation/),
  ).toBeVisible();
  await expect(agenda().getByText(/Group · Confirmed/)).toBeVisible();
  await page.reload();
  await expect(calendar).toBeVisible();
  await page
    .getByRole("navigation", { name: "Session type filters" })
    .getByRole("link", { name: "Group", exact: true })
    .click();
  await expect(agenda().getByRole("button")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Calendar venue" })
    .selectOption(owner.venueId);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    calendar.getByText("No matching times or sessions", { exact: true }),
  ).toBeVisible();
  await goto(href(datePlus(4), "day", "&type=group&history=1"));
  await expect(
    agenda().getByText("DEV0254 cancelled group", { exact: true }),
  ).toBeVisible();
  await goto(href(datePlus(-1), "day", "&type=group"));
  await expect(agenda().getByText(/Group · Ended/)).toBeVisible();
  for (const [offset, status] of [
    [-3, "Confirmed"],
    [-4, "Completed"],
    [-5, "Cancelled"],
  ]) {
    await goto(href(datePlus(offset), "day", "&type=private&history=1"));
    await expect(
      agenda().getByText(`Private session · ${status}`, { exact: true }),
    ).toBeVisible();
    if (status === "Confirmed") {
      await agenda().getByRole("button").click();
      await expect(
        dialog.getByText(
          /This booking remains Confirmed until you explicitly complete/,
        ),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
  }
  await goto(href(datePlus(2), "day", "&type=group&history=1"));
  await expect(agenda().getByText(/Group · Not confirmed/)).toBeVisible();
  record(
    "42-date Month, complete real pagination, exact More, venue/type/history and elapsed group states",
  );
  phase = "pending deadline and transport recovery";
  await goto(href(pendingDate));
  query(
    `update app.coach_booking_requests set created_at=clock_timestamp()-interval '13 hours',decision_deadline_at=clock_timestamp()-interval '1 second' where id=${quote(requestId)}::uuid and client_profile_id=${quote(athlete.profileId)}::uuid`,
  );
  await page
    .getByRole("button", { name: "Reload calendar", exact: true })
    .click();
  await expect(calendar).toHaveAttribute("aria-busy", "false");
  await expect(
    agenda().getByText("1 pending · time is still open", { exact: true }),
  ).toHaveCount(0);
  await page.route("**/coach?**", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Reload calendar", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "calendar could not be verified" }),
  ).toBeVisible();
  await expect(agenda().getByRole("button").first()).toBeVisible();
  await page.unroute("**/coach?**");
  await page
    .getByRole("button", { name: "Reload calendar", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "calendar could not be verified" }),
  ).toHaveCount(0);
  record(
    "real pending deadline refresh, content-version recovery, selected-date editor and unsaved draft protection; interrupted transport retains data and recovers",
  );
  phase = "owner group destination, horizon, widths and keyboard";
  const before = query(
    `select md5(string_agg(row_to_json(g)::text,'' order by id)) digest from app.coach_group_sessions g where coach_profile_id=${quote(owner.profileId)}::uuid`,
  )[0].digest;
  for (const width of [1440, 375, 430]) {
    await page.setViewportSize({ width, height: 1000 });
    await goto(href(datePlus(35)));
    await expect(agenda().getByRole("button")).toHaveCount(1);
    const item = agenda()
      .getByRole("button")
      .filter({ hasText: "DEV0254 beyond horizon" });
    await item.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    const details = dialog.getByRole("link", { name: "View group details" });
    await expect(details).toHaveAttribute("href", `/coach/events/${beyondId}`);
    await details.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(base + `/coach/events/${beyondId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", {
        name: "DEV0254 beyond horizon",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", {
        name: "Private participant roster",
        exact: true,
      }),
    ).toBeVisible();
    await noOverflow();
    await page.screenshot({
      path: path.join(output, `group-owner-${width}.png`),
      fullPage: true,
      caret: "initial",
    });
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForURL(href(datePlus(35)), {
      waitUntil: "domcontentloaded",
    });
    await expect(calendar).toBeVisible();
    await noOverflow();
    await page.screenshot({
      path: path.join(output, `calendar-${width}.png`),
      fullPage: true,
      caret: "initial",
    });
  }
  const after = query(
    `select md5(string_agg(row_to_json(g)::text,'' order by id)) digest from app.coach_group_sessions g where coach_profile_id=${quote(owner.profileId)}::uuid`,
  )[0].digest;
  assert.equal(after, before, "Navigation does not mutate groups.");
  work(
    owner,
    `select app.deactivate_owned_coach_training_location(id,updated_at,null,null) from app.coach_training_locations where id=${quote(venueB)}::uuid and profile_id=${quote(owner.profileId)}::uuid`,
  );
  await goto(href(datePlus(3), "day", "&type=group"));
  await expect(
    agenda().locator(".coach-calendar-item-venue").filter({
      hasText: "DEV0254 Riverside training deck with a long venue name",
    }),
  ).toHaveCount(2);
  await expect(
    agenda().getByText("· Inactive venue", { exact: true }),
  ).toHaveCount(2);
  record(
    "real original owner group route, browser Back, beyond-horizon truth, desktop/375/430 keyboard and no group mutation",
  );
  phase = "access isolation";
  for (const p of [other, athlete, applicant]) {
    const denied = await p.context.newPage();
    await denied.goto(base + `/coach/events/${confirmedId}`);
    await expect(
      denied.getByRole("heading", {
        name: "DEV0254 confirmed group",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      denied.getByRole("region", {
        name: "Private participant roster",
        exact: true,
      }),
    ).toHaveCount(0);
    await denied.close();
  }
  const signedOut = await browser.newContext();
  const outPage = await signedOut.newPage();
  await outPage.goto(base + `/coach/events/${confirmedId}`);
  await expect(outPage).toHaveURL(/\/sign-in\?returnTo=/);
  await signedOut.close();
  await goto(href(datePlus(3), "day", "&type=group"));
  await owner.context.clearCookies();
  try {
    await page
      .getByRole("button", { name: "Reload calendar" })
      .click({ timeout: 2000 });
  } catch (error) {
    // The real actor refresh can revoke the calendar before this click runs.
    // A missing control is acceptable only when its private calendar is gone.
    if (await calendar.isVisible()) throw error;
  }
  await expect(calendar).not.toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({
        hasText: /Calendar access changed|Your account or coach access changed/,
      })
      .first(),
  ).toBeVisible();
  await owner.context.addCookies(
    owner.cookies.map((c) => ({ ...c, url: base })),
  );
  query(
    `update app.coach_profiles set visibility='hidden' where profile_id=${quote(owner.profileId)}::uuid`,
  );
  await goto(href(datePlus(3), "day", "&type=group"));
  await expect(
    agenda().getByText("DEV0254 confirmed group", { exact: true }),
  ).toBeVisible();
  query(
    `select app.review_coach_application(${quote(owner.profileId)}::uuid,'approved','suspended','Temporary validation suspension.','dev0254-rehearsal','movx-identity-application-v1')`,
  );
  await goto(href(datePlus(3), "day", "&type=group"));
  await expect(
    agenda().getByText("DEV0254 confirmed group", { exact: true }),
  ).toBeVisible();
  assert.equal(
    await calendar.getByRole("link", { name: /Edit.*availability/ }).count(),
    0,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  record(
    "real other-owner/athlete/applicant/signed-out denial, cleared data, hidden/suspended history and zero page errors",
  );
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({ project: target.projectRef, runId, checks }, null, 2),
  );
} catch (error) {
  console.error(
    "DEV0254 hosted rehearsal failed during " + phase + ": " + error.message,
  );
  if (browser)
    for (const [i, c] of browser.contexts().entries())
      for (const p of c.pages())
        await p
          .screenshot({
            path: path.join(output, `failure-${i}.png`),
            fullPage: true,
          })
          .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  }
  try {
    await cleanup();
    if (baseline) {
      assertPreserved(baseline, fingerprint());
      console.log(
        "PASS all baseline non-fixture application/Auth/Storage records preserved",
      );
    }
  } finally {
    if (checkout) await rm(checkout, { recursive: true, force: true });
    // Owned local logs only. They contain no operator key or OTP/session output.
    await writeFile(path.join(output, "server.log"), serverLog, {
      mode: 0o600,
    });
  }
}
