// DEV0239: real Auth/runtime/browser verification on explicitly selected hosted dev.
// Admin-generated OTPs send no email. Secrets/cookies stay in memory, never in evidence.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium, expect as playwrightExpect } from "@playwright/test";
import postgres from "postgres";
import { hostedDevelopmentConfiguration } from "./lib/hosted-environment.mjs";
import { berlinLocalInput } from "../src/features/coach-events/contract.ts";

const args = process.argv.slice(2);
assert.deepEqual(
  args.slice(0, 2),
  ["--environment", "dev"],
  "Select hosted dev explicitly.",
);
assert.ok(
  args.length === 3 && ["--check", "--run"].includes(args[2]),
  "Use --environment dev --check|--run.",
);
const configuration = hostedDevelopmentConfiguration(process.env);
assert.equal(configuration.projectRef, "mdzidiqosxbghmfyxphb");
const root = process.cwd(),
  base = "http://localhost:3143";
const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const work = mkdtempSync(join(tmpdir(), "dev0239-hosted-"));
const checkout = join(work, "app"),
  evidence = resolve(root, "test-results/dev0239-hosted");
const runId = randomUUID(),
  people = [],
  secrets = new Set([
    configuration.connectionString,
    new URL(configuration.connectionString).password,
  ]);
const expect = playwrightExpect.configure({ timeout: 30000 });
const sql = postgres(configuration.connectionString, {
  max: 4,
  prepare: false,
  ssl: "require",
  connect_timeout: 15,
  idle_timeout: 5,
  onnotice: () => {},
});
let admin,
  server,
  browser,
  baseline,
  phase = "preflight",
  succeeded = false,
  cleanupFailed = false;
const manifest = join(work, "recovery-ids.json");
mkdirSync(join(work, "supabase"));
writeFileSync(
  join(work, "supabase/config.toml"),
  'project_id = "dev0239_live"\n',
  { mode: 0o600 },
);
const cli = (argv) =>
  execFileSync(join(root, "node_modules/.bin/supabase"), argv, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  });
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const uuid = (value) => {
  assert.match(
    value,
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
  return `${literal(value)}::uuid`;
};
const report = (value) => {
  phase = value;
  console.log("DEV0239 live: " + value);
};
const redact = (value) => {
  let text = String(value);
  for (const secret of secrets)
    if (secret) text = text.replaceAll(secret, "[redacted]");
  return text
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted JWT]",
    )
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted key]");
};
function ownerQuery(body) {
  const file = join(work, `query-${randomUUID()}.sql`);
  writeFileSync(file, body, { mode: 0o600 });
  try {
    const result = JSON.parse(
      cli([
        "db",
        "query",
        "--linked",
        "--project-ref",
        configuration.projectRef,
        "--workdir",
        work,
        "--file",
        file,
        "--output",
        "json",
      ]),
    );
    assert.ok(
      Array.isArray(result.rows),
      "Unexpected management query envelope",
    );
    return result.rows;
  } catch {
    throw new Error("Explicit-dev owner query failed during " + phase);
  } finally {
    rmSync(file, { force: true });
  }
}
function saveManifest() {
  writeFileSync(
    manifest,
    JSON.stringify({
      ticket: "DEV0239",
      projectRef: configuration.projectRef,
      runId,
      people: people.map(({ id, profileId, runId: dataset }) => ({
        id,
        profileId,
        runId: dataset,
      })),
    }),
    { mode: 0o600 },
  );
}
function fingerprint() {
  return ownerQuery(`create temporary table dev0239_test_ids(id uuid primary key);
    insert into dev0239_test_ids select id from auth.users where raw_app_meta_data->>'temporary'='true' and raw_app_meta_data->>'movx_test_ticket' ~ '^DEV[0-9]{4}$';
    insert into dev0239_test_ids select id from app.profiles where auth_user_id in(select id from dev0239_test_ids) on conflict do nothing;
    -- Exclude another administratively tagged test namespace in both snapshots.
    -- Its row graph is read only, never restored or removed by this runner.
    do $$ declare t record; changed integer; inserted integer; pass integer; begin
      for pass in 1..12 loop
        changed:=0;
        for t in select tablename from pg_tables where schemaname='app' order by tablename loop
          execute format('insert into pg_temp.dev0239_test_ids select distinct (to_jsonb(r)->>''id'')::uuid from app.%I r where (to_jsonb(r)->>''id'') ~ ''^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'' and exists(select 1 from pg_temp.dev0239_test_ids i where position(i.id::text in to_jsonb(r)::text)>0) on conflict do nothing',t.tablename);
          get diagnostics inserted=row_count;changed:=changed+inserted;
        end loop;
        exit when changed=0;
      end loop;
      if changed<>0 then raise exception 'temporary test row graph exceeded the bounded traversal'; end if;
    end $$;
    create temporary table dev0239_digests(name text,n bigint,digest text);
    do $$ declare t record; n bigint; digest text; begin
      for t in select tablename from pg_tables where schemaname='app' order by tablename loop
        execute format('select count(*),md5(coalesce(string_agg(to_jsonb(r)::text,chr(10) order by to_jsonb(r)::text),'''')) from app.%I r where not exists(select 1 from pg_temp.dev0239_test_ids i where position(i.id::text in to_jsonb(r)::text)>0)',t.tablename) into n,digest;
        insert into dev0239_digests values(t.tablename,n,digest);
      end loop; end $$;
    select jsonb_build_object('tables',(select jsonb_object_agg(name,jsonb_build_object('n',n,'digest',digest)) from dev0239_digests),'authUsers',(select count(*) from auth.users where id not in(select id from dev0239_test_ids)),'authDigest',(select md5(coalesce(string_agg(to_jsonb(u)::text,chr(10) order by id),'')) from auth.users u where id not in(select id from dev0239_test_ids)),'storage',(select count(*) from storage.objects)) result;`)[0]
    .result;
}
async function asActor(person, workFn) {
  assert.ok(people.includes(person) && person.profileId && person.runId);
  return sql.begin(async (tx) => {
    await tx`select set_config('app.current_auth_user_id',${person.id},true),set_config('app.current_profile_id',${person.profileId},true),set_config('app.current_run_id',${person.runId},true),set_config('app.current_run_role','member',true)`;
    return workFn(tx);
  });
}
async function command(person, action, input) {
  return asActor(
    person,
    async (tx) =>
      (
        await tx`select app.group_session_command(${action},${tx.json(input)}) result`
      )[0].result,
  );
}
async function person(label, coach = false) {
  assert.ok(people.length < 5);
  const p = {
    id: randomUUID(),
    email: `dev0239-${runId}-${label.toLowerCase()}@users.movx.test`,
    label,
    cookies: [],
  };
  people.push(p);
  saveManifest();
  const made = await admin.auth.admin.createUser({
    id: p.id,
    email: p.email,
    email_confirm: true,
    app_metadata: {
      movx_test_ticket: "DEV0239",
      movx_test_run: runId,
      temporary: true,
    },
  });
  assert.ok(
    !made.error && made.data.user?.id === p.id,
    "Could not create exact tagged Auth account",
  );
  const [row] =
    await sql`select * from app.enroll_application_identity(${p.id}::uuid,${`DEV0239 ${runId.slice(0, 8)} ${label}`})`;
  assert.ok(row?.identity_profile_id, "Could not enrol isolated test profile");
  Object.assign(p, {
    profileId: row.identity_profile_id,
    runId: row.identity_run_id,
    slug: row.identity_profile_slug,
  });
  saveManifest();
  if (coach) {
    await asActor(p, async (tx) => {
      await tx`select app.submit_owned_coach_application()`;
      await tx`select app.upsert_owned_coach_profile(${`DEV0239 ${runId.slice(0, 8)} ${label}`},'Temporary tagged hosted Events rehearsal; removed after validation.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
    });
    if (label !== "Applicant")
      ownerQuery(
        `begin; set local lock_timeout='3s'; select app.review_coach_application(${uuid(p.profileId)},'pending','approved','Exact tagged DEV0239 hosted UI validation.','dev0239-rehearsal','movx-identity-application-v1'); update app.coach_profiles set visibility='visible' where profile_id=${uuid(p.profileId)};commit;select true as prepared;`,
      );
    p.venue = ownerQuery(
      `select id from app.coach_training_locations where profile_id=${uuid(p.profileId)} and is_primary;`,
    )[0].id;
  }
  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: p.email,
  });
  assert.ok(
    !generated.error &&
      generated.data.user?.id === p.id &&
      generated.data.properties?.email_otp,
    "Could not generate in-memory verification code",
  );
  const otp = generated.data.properties.email_otp;
  secrets.add(otp);
  secrets.add(generated.data.properties.hashed_token);
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => p.cookies,
        setAll: (values) => {
          p.cookies = values.map(({ name, value }) => ({ name, value }));
          for (const item of p.cookies) secrets.add(item.value);
        },
      },
    },
  );
  const verified = await client.auth.verifyOtp({
    email: p.email,
    token: otp,
    type: "email",
  });
  assert.ok(
    !verified.error && verified.data.user?.id === p.id && verified.data.session,
    "Real hosted email-code verification failed",
  );
  secrets.add(verified.data.session.access_token);
  secrets.add(verified.data.session.refresh_token);
  p.authClient = client;
  return p;
}
async function openPerson(p, javaScriptEnabled = true) {
  const context = await browser.newContext({
    javaScriptEnabled,
    viewport: { width: 1440, height: 1050 },
  });
  await context.addCookies(
    p.cookies.map((cookie) => ({ ...cookie, url: base, sameSite: "Lax" })),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);
  return { context, page };
}
function future(days = 3, hour = 18) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour - 1, 0, 0, 0);
  return date.toISOString();
}
function draft(p, title, days = 3, priceCents = 0, minimum = 2) {
  const starts = future(days);
  return {
    id: randomUUID(),
    expectedRevision: null,
    title: `DEV0239 ${runId.slice(0, 8)} ${title}`,
    description: "Tagged rehearsal. Literal <script>text</script>.",
    discipline: "Boxing",
    intendedLevel: "All levels",
    locationId: p.venue,
    startsAt: starts,
    endsAt: new Date(Date.parse(starts) + 3600000).toISOString(),
    decisionDeadlineAt: new Date(Date.parse(starts) - 3600000).toISOString(),
    minimumParticipants: minimum,
    maximumParticipants: 8,
    priceCents,
  };
}
async function decision(page, label) {
  const path = new URL(page.url()).pathname;
  const button = page.getByRole("button", { name: label, exact: true });
  await page
    .locator("form")
    .filter({ has: button })
    .getByRole("checkbox")
    .check();
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).origin === base &&
        new URL(response.url()).pathname === path,
      { timeout: 90000 },
    ),
    button.click({ timeout: 90000 }),
  ]);
  await response.finished();
}
async function fillDraft(page, input) {
  for (const [label, value] of [
    ["Session title", input.title],
    ["Description", input.description],
    ["Intended level", input.intendedLevel],
    ["Starts at", berlinLocalInput(input.startsAt)],
    ["Ends at", berlinLocalInput(input.endsAt)],
    ["Coach decision deadline", berlinLocalInput(input.decisionDeadlineAt)],
    ["Minimum participants", String(input.minimumParticipants)],
    ["Maximum participants", String(input.maximumParticipants)],
    ["Price per person (EUR)", (input.priceCents / 100).toFixed(2)],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
}
async function diagnoseFailure() {
  // Only this run's pages and group rows; never collect headers, cookies or Auth data.
  if (browser) {
    mkdirSync(evidence, { recursive: true });
    let index = 0;
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (!page.url().startsWith(base + "/")) continue;
        const url = new URL(page.url());
        console.error(
          "DEV0239 diagnostic: " +
            redact(
              JSON.stringify({
                page: index,
                path: url.pathname,
                issue: url.searchParams.get("issue"),
                heading: await page.locator("h1").allTextContents(),
                alerts: await page.getByRole("alert").allTextContents(),
                decisions: await page.locator("main button").allTextContents(),
              }),
            ),
        );
        await page
          .screenshot({
            path: join(evidence, `failure-${runId}-${index++}.png`),
            fullPage: true,
            timeout: 5000,
          })
          .catch(() => {});
      }
    }
  }
  const owners = people
    .filter((p) => p.profileId)
    .map((p) => uuid(p.profileId));
  if (owners.length) {
    console.error(
      "DEV0239 fixture state: " +
        JSON.stringify(
          ownerQuery(`
      select s.id, s.status, s.revision,
        s.minimum_participants,
        (select count(*)::integer from app.coach_group_registrations r
          where r.session_id=s.id and r.status='active') as active,
        s.decision_deadline_at > now() as before_deadline
      from app.coach_group_sessions s
      where s.coach_profile_id in (${owners.join(",")}) order by s.id
    `),
        ),
    );
  }
}
async function cleanup() {
  if (!people.length) return;
  // A recovery attempt never selects a different run or trusts a display-name prefix alone.
  const verified = [];
  for (const p of people) {
    const got = await admin.auth.admin.getUserById(p.id);
    if (got.error && got.error.status === 404) continue;
    assert.ok(
      !got.error &&
        got.data.user?.app_metadata.movx_test_ticket === "DEV0239" &&
        got.data.user.app_metadata.movx_test_run === runId &&
        got.data.user.app_metadata.temporary === true &&
        got.data.user.email === p.email,
      "Cleanup ownership changed; refusing deletion",
    );
    verified.push(p);
  }
  if (!verified.length) return;
  const ids = verified.map((p) => uuid(p.id)).join(",");
  ownerQuery(`begin;set local lock_timeout='5s';set local statement_timeout='30s';
    create temporary table dev0239_owned as select p.id from app.profiles p join auth.users u on u.id=p.auth_user_id where u.id in (${ids}) and u.raw_app_meta_data->>'movx_test_ticket'='DEV0239' and u.raw_app_meta_data->>'movx_test_run'=${literal(runId)} and u.raw_app_meta_data->>'temporary'='true';
    delete from app.coach_group_registrations where athlete_profile_id in(select id from dev0239_owned) or session_id in(select id from app.coach_group_sessions where coach_profile_id in(select id from dev0239_owned));
    delete from app.coach_group_sessions where coach_profile_id in(select id from dev0239_owned);
    delete from app.coach_booking_requests where coach_profile_id in(select id from dev0239_owned) or client_profile_id in(select id from dev0239_owned);
    delete from app.coach_private_bookings where coach_profile_id in(select id from dev0239_owned) or client_profile_id in(select id from dev0239_owned);
    delete from app.coach_availability_slots where profile_id in(select id from dev0239_owned);
    delete from app.coach_availability_rules where profile_id in(select id from dev0239_owned);
    update app.coach_profiles set visibility='hidden' where profile_id in(select id from dev0239_owned) and visibility<>'hidden';
    delete from app.coach_training_locations where profile_id in(select id from dev0239_owned);
    delete from app.coach_profile_disciplines where profile_id in(select id from dev0239_owned);
    delete from app.coach_profiles where profile_id in(select id from dev0239_owned);
    delete from app.coach_application_review_events where profile_id in(select id from dev0239_owned);
    delete from app.coach_applications where profile_id in(select id from dev0239_owned);
    delete from app.demo_run_participants where profile_id in(select id from dev0239_owned);
    delete from app.profiles where id in(select id from dev0239_owned);commit;select true as exact_fixture_rows_removed;`);
  for (const p of verified)
    assert.ok(
      !(await admin.auth.admin.deleteUser(p.id)).error,
      "Exact temporary Auth account cleanup failed",
    );
  const [left] = ownerQuery(
    `select count(*)::int n from auth.users where id in (${ids});`,
  );
  assert.equal(left.n, 0);
}

try {
  const keys = JSON.parse(
    cli([
      "projects",
      "api-keys",
      "--project-ref",
      configuration.projectRef,
      "--output",
      "json",
      "--reveal",
    ]),
  );
  const key =
    keys.find((row) => row.name === "service_role")?.api_key ??
    keys.find((row) => row.type === "secret")?.api_key;
  assert.ok(
    typeof key === "string" && key.length > 40,
    "No in-memory dev admin credential available",
  );
  secrets.add(key);
  admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [runtime] =
    await sql`select current_user name,has_function_privilege(current_user,'app.publish_group_session(uuid,integer)','execute') publication,has_table_privilege(current_user,'app.coach_group_sessions','select') direct_read`;
  assert.equal(runtime.name, configuration.runtimeUser);
  assert.ok(runtime.publication && !runtime.direct_read);
  const [catalog] = ownerQuery(
    "select current_user executor, to_regprocedure('app.group_session_command(text,jsonb)') is not null groups, (select count(*) from supabase_migrations.schema_migrations)::int migrations, exists(select 1 from app.demo_runs where status='active' and catalogue_visibility='public') dataset;",
  );
  assert.equal(catalog.executor, "postgres");
  assert.ok(catalog.groups && catalog.dataset);
  assert.equal(catalog.migrations, 3);
  report(
    "explicit dev project, three migrations and restricted runtime authority verified; no credentials displayed",
  );
  if (args[2] === "--check") succeeded = true;
  else {
    baseline = fingerprint();
    const coach = await person("Owner", true),
      other = await person("Other", true),
      athlete = await person("Athlete"),
      athleteTwo = await person("AthleteTwo"),
      applicant = await person("Applicant", true);
    report(
      "five exact tagged accounts verified through real hosted OTP Auth; only new profiles enrolled and no email sent",
    );
    mkdirSync(checkout);
    execFileSync("tar", ["-xf", "-", "-C", checkout], {
      input: execFileSync("git", ["archive", sourceRevision], {
        cwd: root,
        maxBuffer: 100 * 1024 * 1024,
      }),
    });
    symlinkSync(
      join(root, "node_modules"),
      join(checkout, "node_modules"),
      "dir",
    );
    report(
      "owned application snapshot uses committed source " +
        sourceRevision.slice(0, 8),
    );
    execFileSync(process.execPath, ["scripts/prepare-maplibre-worker.mjs"], {
      cwd: checkout,
      stdio: "ignore",
    });
    const env = {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: base,
      NEXT_TELEMETRY_DISABLED: "1",
    };
    server = spawn(
      process.execPath,
      [
        join(root, "node_modules/next/dist/bin/next"),
        "dev",
        "--webpack",
        "--hostname",
        "localhost",
        "--port",
        "3143",
      ],
      { cwd: checkout, env, stdio: ["ignore", "ignore", "ignore"] },
    );
    for (let n = 0; n < 90; n++) {
      assert.equal(server.exitCode, null, "Owned app exited before readiness");
      try {
        if (
          (await fetch(base + "/coach/events", { redirect: "manual" })).status <
          500
        )
          break;
      } catch {}
      if (n === 89) throw new Error("Owned app readiness timed out");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
    mkdirSync(evidence, { recursive: true });
    const owner = await openPerson(coach),
      a = await openPerson(athlete),
      b = await openPerson(athleteTwo),
      stranger = await openPerson(other),
      pending = await openPerson(applicant),
      page = owner.page;
    await page.goto(base + "/coach/events");
    await expect(
      page.getByRole("heading", { name: "Events", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Create group session", exact: true })
      .click();
    await page.waitForURL(/draftId=/);
    const input = draft(coach, "paid UI session", 3, 1550);
    input.id = new URL(page.url()).searchParams.get("draftId");
    await fillDraft(page, input);
    await page
      .getByRole("button", { name: "Save draft and review", exact: true })
      .click();
    const detail = base + `/coach/events/${input.id}`;
    await page.waitForURL(detail);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Publication review", exact: true }),
    ).toBeVisible();
    assert.match(await page.locator("main").innerText(), /€15.50 per person/);
    assert.equal(
      (await command(coach, "detail", { id: input.id })).session.priceCents,
      1550,
    );
    report(
      "real owner Server Action saved a stable paid draft; reload and runtime read preserve reviewed venue/time/price",
    );
    await page.getByRole("link", { name: "Edit draft", exact: true }).click();
    await page
      .getByLabel("Session title", { exact: true })
      .fill(input.title + " reviewed");
    await page
      .getByRole("button", { name: "Save draft and review", exact: true })
      .click();
    await page.waitForURL(detail);
    ownerQuery(
      `update app.coach_training_locations set public_name='DEV0239 updated fixture venue',updated_at=clock_timestamp() where id=${uuid(coach.venue)} and profile_id=${uuid(coach.profileId)};select true changed;`,
    );
    await decision(page, "Publish session");
    await page.waitForURL(/issue=venue-changed/);
    await expect(
      page.getByRole("alert").filter({ hasText: "venue changed" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Edit draft", exact: true }).click();
    await page
      .getByRole("button", { name: "Save draft and review", exact: true })
      .click();
    await page.waitForURL(detail);
    const changed = (await command(coach, "detail", { id: input.id })).session;
    await command(coach, "save-draft", {
      ...input,
      title: input.title + " newer revision",
      expectedRevision: changed.revision,
    });
    await decision(page, "Publish session");
    await page.waitForURL(/issue=draft-changed/);
    await expect(
      page.getByRole("alert").filter({ hasText: "draft changed" }),
    ).toBeVisible();
    await page.goto(detail);
    await decision(page, "Publish session");
    await page.waitForURL(detail);
    await expect(
      page.getByText("Waiting for coach confirmation", { exact: true }),
    ).toBeVisible();
    await page.goto(detail + "/edit");
    await page.waitForURL(detail);
    assert.equal(
      await page.getByRole("link", { name: "Edit draft", exact: true }).count(),
      0,
    );
    report(
      "real venue/stale-revision conflicts require renewed review; publication freezes terms and blocks editing",
    );
    const publicHref = base + `/events/group-${input.id.replaceAll("-", "")}`;
    for (const tab of [a.page, b.page]) {
      await tab.goto(publicHref);
      await tab
        .getByRole("button", { name: "Reserve a seat", exact: true })
        .click();
      await expect(
        tab.getByText("Seat reserved", { exact: true }).first(),
      ).toBeVisible();
    }
    await page.goto(detail);
    await expect(
      page.getByRole("button", { name: "Confirm session", exact: true }),
    ).toBeVisible();
    report(
      "confirming the real published session after two visible athlete reservations",
    );
    await decision(page, "Confirm session");
    await expect(
      page.getByText("Confirmed by coach", { exact: true }),
    ).toBeVisible();
    await a.page.reload();
    await a.page
      .getByRole("button", { name: "Withdraw my seat", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByText("Confirmed by coach", { exact: true }),
    ).toBeVisible();
    assert.equal(
      (await command(coach, "detail", { id: input.id })).session
        .participantCount,
      1,
    );
    report(
      "two real athlete reservations enable explicit owner confirmation; later withdrawal leaves confirmation stable",
    );
    for (const tab of [stranger.page, pending.page, b.page]) {
      await tab.goto(detail);
      await expect(
        tab.getByRole("heading", {
          name: "This coach event is not available to this account",
          exact: true,
        }),
      ).toBeVisible();
      assert.equal(await tab.locator(".coach-event-roster").count(), 0);
    }
    for (let n = 0; n < 52; n++) {
      const attempt = randomUUID();
      await command(athlete, "join", { id: input.id, registrationId: attempt });
      await command(athlete, "withdraw", {
        id: input.id,
        registrationId: attempt,
      });
    }
    await page.reload();
    assert.equal(await page.locator(".coach-event-roster li").count(), 50);
    assert.equal(await page.locator(".coach-event-roster img").count(), 0);
    assert.doesNotMatch(
      await page.locator(".coach-event-roster").innerText(),
      /@/,
    );
    await page
      .getByRole("link", { name: "More participants", exact: true })
      .click();
    await page.waitForURL(/afterAt=/);
    assert.ok((await page.locator(".coach-event-roster li").count()) > 0);
    report(
      "owner-only actual roster covers retained attempts beyond 50; unrelated approved, applicant and participant accounts get no roster",
    );
    // Additional real authority/race/transport/native scenarios are below.
    await runRemaining({
      coach,
      other,
      athlete,
      athleteTwo,
      owner,
      a,
      b,
      stranger,
      input,
      detail,
      page,
    });
    succeeded = true;
  }
} catch (error) {
  console.error(
    "DEV0239 live failed during " +
      phase +
      ": " +
      redact(error instanceof Error ? error.message : "unknown failure"),
  );
  await diagnoseFailure().catch((diagnosticError) =>
    console.error(
      "DEV0239 diagnostic unavailable: " + redact(diagnosticError.message),
    ),
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  try {
    if (admin) await cleanup();
    if (baseline) {
      const after = fingerprint();
      const changed = Object.keys(baseline.tables).filter(
        (name) =>
          JSON.stringify(after.tables[name]) !==
          JSON.stringify(baseline.tables[name]),
      );
      for (const key of ["authUsers", "authDigest", "storage"])
        if (after[key] !== baseline[key]) changed.push(key);
      assert.equal(
        changed.length,
        0,
        "Protected non-test data changed in " +
          changed.join(", ") +
          "; no unrelated data will be restored automatically",
      );
    }
    if (people.length)
      report(
        "exact account/application fixtures removed; protected non-test application/Auth-user fingerprints and Storage counts preserved",
      );
  } catch (error) {
    cleanupFailed = true;
    process.exitCode = 1;
    console.error(
      "DEV0239 cleanup/preservation needs review: " +
        redact(error instanceof Error ? error.message : "unknown failure") +
        ". UUID-only recovery manifest: " +
        manifest,
    );
  }
  await sql.end({ timeout: 5 });
  if (!cleanupFailed) rmSync(work, { recursive: true, force: true });
  if (succeeded && !cleanupFailed)
    console.log(
      args[2] === "--check"
        ? "DEV0239 hosted preflight passed; no fixture account or application row created."
        : "DEV0239 hosted live rehearsal passed. No email, schema migration, production change or retained Docker operation.",
    );
}

async function runRemaining({
  coach,
  other,
  athlete,
  athleteTwo,
  owner,
  b,
  input,
  detail,
  page,
}) {
  const inventory = [];
  await asActor(coach, async (tx) => {
    for (let n = 0; n < 21; n++) {
      const value = draft(coach, `inventory ${n}`, 10 + n);
      await tx`select app.group_session_command('save-draft',${tx.json(value)})`;
      inventory.push(value);
    }
  });
  await page.goto(base + "/coach/events");
  assert.equal(await page.locator(".group-history-card").count(), 20);
  await page.getByRole("link", { name: "More sessions", exact: true }).click();
  await page.waitForURL(/afterAt=/);
  assert.ok((await page.locator(".group-history-card").count()) > 0);
  await page.goto(base + `/coach/events/${inventory[0].id}`);
  await decision(page, "Delete draft");
  await page.waitForURL(base + "/coach/events");
  await assert.rejects(
    command(coach, "detail", { id: inventory[0].id }),
    (error) => error.code === "P0001",
  );
  report(
    "actual owner inventory reaches the second page; acknowledged draft deletion removes only its original draft",
  );

  const stale = inventory[1],
    staleUrl = base + `/coach/events/${stale.id}`;
  await page.goto(staleUrl + "/edit");
  await page
    .getByLabel("Session title", { exact: true })
    .fill(stale.title + " proposed");
  await command(coach, "save-draft", {
    ...stale,
    title: stale.title + " concurrent",
    expectedRevision: 1,
  });
  await page
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "session, roster" }),
  ).toBeVisible();
  assert.equal(
    await page.getByLabel("Session title", { exact: true }).inputValue(),
    stale.title + " proposed",
  );
  assert.equal(
    (await command(coach, "detail", { id: stale.id })).session.title,
    stale.title + " concurrent",
  );
  await page.goto(staleUrl + "/edit");
  await page
    .getByLabel("Session title", { exact: true })
    .fill(stale.title + " wrong account");
  await owner.context.clearCookies();
  await owner.context.addCookies(
    other.cookies.map((cookie) => ({ ...cookie, url: base, sameSite: "Lax" })),
  );
  await page
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "signed-in account changed" }),
  ).toBeVisible();
  assert.equal(
    await page.getByLabel("Session title", { exact: true }).count(),
    0,
  );
  await owner.context.clearCookies();
  await owner.context.addCookies(
    coach.cookies.map((cookie) => ({ ...cookie, url: base, sameSite: "Lax" })),
  );
  await page.goto(staleUrl);
  assert.equal(
    (await command(coach, "detail", { id: stale.id })).session.title,
    stale.title + " concurrent",
  );
  report(
    "actual stale revision retains proposed input and old-account form replay cannot mutate the new account or original draft",
  );

  const overlap = draft(coach, "private conflict", 6);
  const local = berlinLocalInput(overlap.startsAt),
    date = local.slice(0, 10);
  const location = ownerQuery(
    `select to_jsonb(updated_at)#>>'{}' updated from app.coach_training_locations where id=${uuid(coach.venue)} and profile_id=${uuid(coach.profileId)};`,
  )[0];
  const slot = await asActor(coach, async (tx) => {
    const [policy] =
      await tx`select app.owned_effective_coach_availability(${date}::date,${date}::date) result`;
    const change = {
      operationId: randomUUID(),
      expectedRevision: policy.result.revision,
      kind: "dates",
      dates: [
        {
          date,
          mode: "custom",
          hours: [
            {
              localStartTime: local.slice(11),
              locationId: coach.venue,
              locationUpdatedAt: location.updated,
            },
          ],
        },
      ],
    };
    const [saved] =
      await tx`select app.save_owned_effective_coach_availability(${tx.json(change)}) result`;
    assert.equal(saved.result.outcome, "saved");
    const query = {
      from: date,
      through: date,
      type: "private",
      venueId: null,
      history: false,
      after: null,
    };
    const [calendar] =
      await tx`select app.owned_coach_calendar(${tx.json(query)}) result`;
    const occurrence = calendar.result.items.find(
      (item) =>
        item.source === "availability" &&
        item.status === "available" &&
        Date.parse(item.startsAt) === Date.parse(overlap.startsAt),
    );
    assert.ok(
      occurrence,
      "Current dated policy must expose the real private conflict occurrence",
    );
    return occurrence.id;
  });
  await command(coach, "save-draft", overlap);
  const overlapUrl = base + `/coach/events/${overlap.id}`;
  await page.goto(overlapUrl);
  await decision(page, "Publish session");
  await page.waitForURL(/issue=schedule-conflict/);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "overlaps your private availability" }),
  ).toBeVisible();
  assert.equal(
    (await command(coach, "detail", { id: overlap.id })).session.status,
    "draft",
  );
  await asActor(
    coach,
    (tx) => tx`select app.withdraw_owned_coach_availability(${slot}::uuid)`,
  );
  await page.goto(overlapUrl);
  await decision(page, "Publish session");
  await page.waitForURL(overlapUrl);
  assert.equal(
    (await command(coach, "detail", { id: overlap.id })).session.status,
    "open",
  );
  report(
    "real private time prevents publication; explicit original-slot withdrawal allows renewed reviewed publication without overwriting bookings",
  );

  const race = draft(coach, "minimum race", 7);
  await command(coach, "save-draft", race);
  const [publication] = await asActor(
    coach,
    (tx) => tx`select app.publish_group_session(${race.id}::uuid,1) result`,
  );
  assert.equal(publication.result.outcome, "published");
  const one = randomUUID(),
    two = randomUUID();
  await command(athlete, "join", { id: race.id, registrationId: one });
  await page.goto(base + `/coach/events/${race.id}`);
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm session", exact: true })
      .count(),
    0,
  );
  await command(athleteTwo, "join", { id: race.id, registrationId: two });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Confirm session", exact: true }),
  ).toBeVisible();
  const outcomes = await Promise.allSettled([
    command(coach, "confirm", { id: race.id }),
    command(athlete, "withdraw", { id: race.id, registrationId: one }),
  ]);
  for (const result of outcomes)
    if (result.status === "rejected")
      assert.ok(["P0001", "40001"].includes(result.reason.code));
  const winning = (await command(coach, "detail", { id: race.id })).session;
  assert.ok(["open", "confirmed"].includes(winning.status));
  assert.equal(winning.participantCount, 1);
  await page.reload();
  if (winning.status === "confirmed")
    await expect(
      page.getByText("Confirmed by coach", { exact: true }),
    ).toBeVisible();
  else
    assert.equal(
      await page
        .getByRole("button", { name: "Confirm session", exact: true })
        .count(),
      0,
    );
  report(
    "real under-minimum UI and simultaneous confirm/withdraw settle to one truthful locked state",
  );

  for (let attempt = 0; attempt < 2; attempt++) {
    const probe = draft(
      coach,
      `confirmation response ${attempt}`,
      35 + attempt,
    );
    await command(coach, "save-draft", probe);
    const [published] = await asActor(
      coach,
      (tx) => tx`select app.publish_group_session(${probe.id}::uuid,1) result`,
    );
    assert.equal(published.result.outcome, "published");
    for (const participant of [athlete, athleteTwo])
      await command(participant, "join", {
        id: probe.id,
        registrationId: randomUUID(),
      });
    await page.goto(base + `/coach/events/${probe.id}`);
    await decision(page, "Confirm session");
    await expect(
      page.getByText("Confirmed by coach", { exact: true }),
    ).toBeVisible();
    assert.equal(
      (await command(coach, "detail", { id: probe.id })).session.status,
      "confirmed",
    );
  }
  report(
    "two additional real confirmation submissions finish before matching UI/database assertions; no mutation retry used",
  );

  const transport = inventory[2],
    transportUrl = base + `/coach/events/${transport.id}`;
  await page.goto(transportUrl + "/edit");
  const transportedTitle = transport.title + " saved before lost response";
  await page
    .getByLabel("Session title", { exact: true })
    .fill(transportedTitle);
  let forwarded = false;
  await page.route(transportUrl + "/edit", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch({ maxRedirects: 0 });
    forwarded = true;
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Coach Events could not be verified",
      exact: true,
    }),
  ).toBeVisible();
  assert.ok(forwarded);
  await page.unroute(transportUrl + "/edit");
  await page.goto(transportUrl);
  await expect(
    page.getByRole("heading", { name: transportedTitle, exact: true }),
  ).toBeVisible();
  assert.equal(
    (await command(coach, "detail", { id: transport.id })).session.revision,
    2,
  );
  report(
    "a real committed save with its browser response interrupted recovers from authoritative original detail without a duplicate draft",
  );

  const expired = randomUUID();
  ownerQuery(`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,created_at,published_at)
    select ${uuid(expired)},run_id,coach_profile_id,${literal("group-" + expired.replaceAll("-", ""))},${literal("DEV0239 " + runId.slice(0, 8) + " missed deadline")},description,discipline,intended_level,training_location_id,venue_snapshot,starts_at+interval '40 days',ends_at+interval '40 days',clock_timestamp()-interval '1 hour',minimum_participants,maximum_participants,price_cents,'open',clock_timestamp()-interval '3 hours',clock_timestamp()-interval '2 hours' from app.coach_group_sessions where id=${uuid(input.id)} and coach_profile_id=${uuid(coach.profileId)};select true as exact_expired_fixture_created;`);
  await page.goto(base + `/coach/events/${expired}`);
  await expect(page.getByText("Not confirmed", { exact: true })).toBeVisible();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm session", exact: true })
      .count(),
    0,
  );
  assert.equal(
    (await command(coach, "detail", { id: expired })).session.status,
    "not-confirmed",
  );
  report(
    "actual database-time reconciliation closes an undecided published fixture without a confirmation action",
  );

  for (const width of [375, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const target of [base + "/coach/events", detail, staleUrl + "/edit"]) {
      await page.goto(target);
      await expect(
        page.getByRole("navigation", { name: "Coach workspace", exact: true }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${width} overflow`,
      );
    }
    await page.goto(detail);
    await page.screenshot({
      path: join(evidence, `owner-${width}.png`),
      fullPage: true,
    });
  }
  await page.reload();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "main-content",
  );
  const native = await openPerson(coach, false);
  await native.page.goto(base + "/coach/events/new");
  const free = draft(coach, "native Free", 9, 0);
  await fillDraft(native.page, free);
  await native.page
    .getByRole("button", { name: "Save draft and review", exact: true })
    .focus();
  await native.page.keyboard.press("Enter");
  await native.page.waitForURL(/\/coach\/events\/[a-f0-9-]{36}$/);
  await expect(
    native.page.getByRole("heading", {
      name: "Publication review",
      exact: true,
    }),
  ).toBeVisible();
  assert.match(await native.page.locator("main").innerText(), /Free/);
  await decision(native.page, "Publish session");
  await expect(
    native.page.getByRole("heading", {
      name: "Published session",
      exact: true,
    }),
  ).toBeVisible();
  await decision(native.page, "Cancel session");
  await expect(
    native.page.getByText("Cancelled", { exact: true }),
  ).toBeVisible();
  await native.context.close();
  report(
    "real authenticated four-width/keyboard flows and JavaScript-free Free draft/review/publication/cancellation passed",
  );

  ownerQuery(
    `update app.coach_profiles set visibility='hidden' where profile_id=${uuid(coach.profileId)};select true as exact_owner_hidden;`,
  );
  await page.goto(detail);
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm session", exact: true })
      .count(),
    0,
  );
  await expect(
    page.getByRole("button", { name: "Cancel session", exact: true }),
  ).toBeVisible();
  await b.page.goto(base + `/events/group-${input.id.replaceAll("-", "")}`);
  await expect(
    b.page.getByText("Seat reserved", { exact: true }).first(),
  ).toBeVisible();
  ownerQuery(
    `select app.review_coach_application(${uuid(coach.profileId)},'approved','suspended','Exact DEV0239 temporary suspension case.','dev0239-rehearsal','movx-identity-application-v1');`,
  );
  await page.reload();
  await decision(page, "Cancel session");
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await b.page.reload();
  await expect(
    b.page.getByText("Session cancelled", { exact: true }).first(),
  ).toBeVisible();
  const isolated = ownerQuery(
    `select (select count(*) from app.message_conversations where coach_profile_id=${uuid(coach.profileId)} or athlete_profile_id in (${uuid(athlete.profileId)},${uuid(athleteTwo.profileId)}))::int messages,(select count(*) from app.coach_athlete_connection_pairs where coach_profile_id=${uuid(coach.profileId)})::int pairs;`,
  )[0];
  assert.equal(isolated.messages, 0);
  assert.equal(isolated.pairs, 0);
  ownerQuery(
    `update app.demo_run_participants set status='revoked',revoked_at=clock_timestamp() where run_id=${uuid(coach.runId)} and profile_id=${uuid(coach.profileId)};select true as exact_actor_revoked;`,
  );
  await page.goto(detail);
  await expect(
    page.getByRole("heading", {
      name: "This coach event is not available to this account",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(await page.locator(".coach-event-roster").count(), 0);
  report(
    "hidden/suspended history and cancellation remain exact-participant scoped; revocation denies owner data and no group-derived messages/connections exist",
  );
}
