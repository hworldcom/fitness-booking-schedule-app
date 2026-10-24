// MOV-77/MOV-86: shared real approval/notification QA in a wholly disposable stack.
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect as baseExpect } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 20000 });
const root = process.cwd();
assert.ok(
  process.argv
    .slice(2)
    .every((arg) =>
      ["--webpack", "--diagnose-storage", "--group-notifications"].includes(
        arg,
      ),
    ),
);
const groupNotifications = process.argv.includes("--group-notifications");
const diagnoseStorage = process.argv.includes("--diagnose-storage");
const webpack = process.argv.includes("--webpack");
const tag = randomUUID().replaceAll("-", "").slice(0, 10);
const project = `${groupNotifications ? "mov86-group-notification-qa" : "mov77-group-approval-qa"}-${tag}`;
const checkout = await mkdtemp(path.join(tmpdir(), `${project}-`));
const output = path.join(
  root,
  groupNotifications
    ? "test-results/group-notifications-integration"
    : "test-results/group-approvals-integration",
  tag,
);
const base = "http://localhost:3169";
const cli = path.join(root, "node_modules/.bin/supabase");
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|RESEND|NOTIFICATION|CRON_SECRET|SMTP|OPENAI_API_KEY/.test(
        key,
      ),
  ),
);
cleanEnv.NEXT_TELEMETRY_DISABLED = "1";
const secrets = [];
const redact = (value) =>
  secrets.reduce(
    (text, secret) => text.replaceAll(secret, "[redacted]"),
    String(value),
  );
const results = [];
const pass = (name, details = {}) => {
  results.push({ name, ...details });
  console.log(`PASS ${name}`);
};
let server,
  browser,
  database,
  started = false,
  serverLog = "",
  phase = "setup";
let retainedBefore;
const fingerprints = `select jsonb_object_agg(name,hash) from (
 select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format(
 'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',
 schemaname,tablename),false,true,'')))[1]::text hash from pg_tables
 where schemaname='app' or (schemaname='auth' and tablename='users')
 or (schemaname='storage' and tablename in ('buckets','objects'))) hashes;`;
function retainedFingerprint() {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_movx-club-local",
      "psql",
      "-X",
      "-qAt",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    {
      input: "set transaction read only;" + fingerprints,
      encoding: "utf8",
    },
  );
}
async function command(executable, args, env = cleanEnv, cwd = checkout) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (data) => {
        log += data.toString();
        for (const line of data.toString().split(/\r?\n/))
          if (
            /^(?:Starting database|Starting containers|Applying migration|Initialising schema|.*: Pulling from supabase\/)/.test(
              line,
            )
          )
            console.log(redact(line));
      });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve(log)
        : reject(
            Error(
              redact(
                `${path.basename(executable)} ${args[0]} exited ${code}\n${log.slice(-7000)}`,
              ),
            ),
          ),
    );
  });
}
async function waitUntil(check, timeout = 30000) {
  const end = Date.now() + timeout;
  do {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  } while (Date.now() < end);
  throw Error(`Timed out in ${phase}`);
}
try {
  await mkdir(output, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(output, "recovery.json"),
    JSON.stringify(
      { project, checkout, ports: [55421, 55422, 55424, 3169] },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  retainedBefore = retainedFingerprint();
  // No populated environment files, CLI links, retained rows or secrets are copied.
  const sourceFiles = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(
      (name) =>
        name &&
        !name.startsWith("supabase/") &&
        (!name.startsWith(".env") || name.endsWith(".example")),
    );
  for (const name of sourceFiles) {
    await mkdir(path.dirname(path.join(checkout, name)), { recursive: true });
    await cp(path.join(root, name), path.join(checkout, name));
  }
  await mkdir(path.join(checkout, "supabase"));
  for (const name of ["migrations", "templates", "seed.sql"])
    await cp(
      path.join(root, "supabase", name),
      path.join(checkout, "supabase", name),
      { recursive: true },
    );
  let config = await readFile(path.join(root, "supabase/config.toml"), "utf8");
  assert.match(config, /project_id = "movx-club-local"/);
  config = config
    .replace('project_id = "movx-club-local"', `project_id = "${project}"`)
    .replaceAll("5532", "5542")
    .replaceAll("http://localhost:3100", base);
  await writeFile(path.join(checkout, "supabase/config.toml"), config);
  // Match the retained stack's actual installed images without copying its
  // linked-project, credentials or rows, or silently upgrading infrastructure.
  await mkdir(path.join(checkout, "supabase/.temp"));
  for (const [container, file] of [
    ["db", "postgres"],
    ["auth", "gotrue"],
    ["storage", "storage"],
  ]) {
    const image = execFileSync(
      "docker",
      [
        "inspect",
        `supabase_${container}_movx-club-local`,
        "--format",
        "{{.Config.Image}}",
      ],
      { encoding: "utf8" },
    ).trim();
    const version = image.split(":").at(-1);
    assert.match(version, /^v?\d+[.\d]+$/);
    await writeFile(
      path.join(checkout, `supabase/.temp/${file}-version`),
      version,
    );
  }
  console.log(`Owned project ${project}; evidence ${output}`);
  phase = "isolated Supabase startup";
  started = true;
  const startup = await command(cli, [
    "start",
    ...(diagnoseStorage ? ["--ignore-health-check"] : []),
    "--workdir",
    checkout,
    "--exclude",
    "realtime,imgproxy,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
  ]);
  await writeFile(
    path.join(output, "startup.log"),
    redact(
      startup.replace(
        /^(?:.*(?:KEY|SECRET|PASSWORD|JWT).*|.*postgresql:\/\/.*)$/gim,
        "[private configuration omitted]",
      ),
    ),
  );
  const statusText = await command(cli, [
    "status",
    "--workdir",
    checkout,
    "-o",
    "env",
  ]);
  const status = Object.fromEntries(
    statusText.split(/\r?\n/).flatMap((line) => {
      const match = /^([A-Z_]+)="(.*)"$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  const api = status.API_URL,
    dbUrl = status.DB_URL,
    mail = status.MAILPIT_URL ?? status.INBUCKET_URL;
  assert.equal(new URL(api).port, "55421");
  assert.equal(new URL(dbUrl).port, "55422");
  assert.equal(new URL(mail).port, "55424");
  secrets.push(
    ...Object.entries(status)
      .filter(([key]) => /KEY|SECRET|JWT/.test(key))
      .map(([, value]) => value),
  );
  if (diagnoseStorage) {
    phase = "isolated Storage diagnostics";
    // Fresh vector-store migrations can outlast the CLI's initial health window.
    // The diagnostic mode grants more startup time, never permission to test unhealthy services.
    await waitUntil(
      async () =>
        execFileSync(
          "docker",
          [
            "inspect",
            `supabase_storage_${project}`,
            "--format",
            "{{.State.Health.Status}}",
          ],
          { encoding: "utf8" },
        ).trim() === "healthy",
      60000,
    ).catch(() => {});
    const health = Object.fromEntries(
      ["db", "auth", "kong", "inbucket", "storage"].map((service) => [
        service,
        execFileSync(
          "docker",
          [
            "inspect",
            `supabase_${service}_${project}`,
            "--format",
            "{{.State.Health.Status}}",
          ],
          { encoding: "utf8" },
        ).trim(),
      ]),
    );
    await writeFile(
      path.join(output, "service-health.json"),
      JSON.stringify(health, null, 2),
    );
    if (health.storage !== "healthy") {
      const logs = spawnSync(
        "docker",
        ["logs", "--tail", "100", `supabase_storage_${project}`],
        { encoding: "utf8" },
      );
      const safe = redact(String(logs.stdout || "") + String(logs.stderr || ""))
        .replace(
          /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
          "[redacted JWT]",
        )
        .replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[redacted database URL]");
      await writeFile(path.join(output, "storage-diagnostics.log"), safe, {
        mode: 0o600,
      });
    }
    assert.ok(
      Object.values(health).every((status) => status === "healthy"),
      "Disposable services are unhealthy; inspect redacted diagnostics.",
    );
    pass("all disposable services healthy after explicit startup diagnostics");
  }
  database = postgres(dbUrl, { max: 2, prepare: false, onnotice() {} });
  const appPassword = randomUUID(),
    workerPassword = randomUUID(),
    cron = randomUUID() + randomUUID();
  secrets.push(appPassword, workerPassword, cron);
  await database.unsafe(`create role qa_app login password '${appPassword}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_runtime;
    create role qa_worker login password '${workerPassword}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_notification_worker;`);
  const loginUrl = (login, password) => {
    const value = new URL(dbUrl);
    value.username = login;
    value.password = password;
    return value.href;
  };
  const appEnv = {
    ...cleanEnv,
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: base,
    NEXT_PUBLIC_SUPABASE_URL: api,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    DATABASE_URL: loginUrl("qa_app", appPassword),
    NOTIFICATION_DATABASE_URL: loginUrl("qa_worker", workerPassword),
    NOTIFICATION_DELIVERY_ENABLED: groupNotifications ? "true" : "false",
    NOTIFICATION_TRANSPORT: "mailpit",
    NOTIFICATION_MAILPIT_URL: mail,
    CRON_SECRET: cron,
  };
  // Local copies satisfy Turbopack's project-root policy; no package update.
  phase = "production build";
  console.log(
    "Building unchanged production application with isolated public configuration.",
  );
  if (process.platform === "darwin")
    await command("/bin/cp", [
      "-cR",
      path.join(root, "node_modules"),
      path.join(checkout, "node_modules"),
    ]);
  else
    await cp(
      path.join(root, "node_modules"),
      path.join(checkout, "node_modules"),
      {
        recursive: true,
        mode: constants.COPYFILE_FICLONE,
        verbatimSymlinks: true,
      },
    );
  // Source-policy tests must inspect the normal checked-in configuration,
  // while CLI cleanup/build/runtime keep the separately selected QA target.
  const configPath = path.join(checkout, "supabase/config.toml");
  const qaConfig = await readFile(configPath, "utf8");
  await writeFile(
    configPath,
    await readFile(path.join(root, "supabase/config.toml"), "utf8"),
  );
  try {
    for (const [name, args] of [
      ["lint", ["run", "lint"]],
      ["typecheck", ["run", "typecheck"]],
      ["format", ["run", "format:check"]],
      ["tests", ["test"]],
    ]) {
      await writeFile(
        path.join(output, name + ".log"),
        redact(await command("npm", args, cleanEnv)),
      );
      pass("clean current-source " + name);
    }
  } finally {
    await writeFile(configPath, qaConfig);
  }
  const buildEnv = { ...appEnv };
  for (const key of [
    "DATABASE_URL",
    "NOTIFICATION_DATABASE_URL",
    "CRON_SECRET",
  ])
    delete buildEnv[key];
  await writeFile(
    path.join(output, "build.log"),
    redact(
      await command(
        "npm",
        ["run", "build", ...(webpack ? ["--", "--webpack"] : [])],
        buildEnv,
      ),
    ),
  );
  pass(
    `unchanged production build (${webpack ? "webpack" : "default Turbopack"})`,
  );
  phase = "production server";
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3169",
    ],
    { cwd: checkout, env: appEnv, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => {
      serverLog = (serverLog + redact(data.toString())).slice(-100000);
    });
  await waitUntil(async () => {
    if (server.exitCode !== null) throw Error(serverLog);
    try {
      return (await fetch(base + "/sign-in")).ok;
    } catch {
      return false;
    }
  });
  const auth = createClient(api, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  async function person(name) {
    const email = `${name.toLowerCase().replaceAll(" ", "-")}-${tag}@users.movx.test`,
      password = randomUUID();
    secrets.push(password);
    const created = await auth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        movx_test_ticket: groupNotifications ? "MOV-86" : "MOV-77",
        temporary: true,
      },
    });
    assert.ifError(created.error);
    const authId = created.data.user.id;
    const [identity] =
      await database`select * from app.enroll_application_identity(${authId}::uuid,${name}::text)`;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/sign-in?returnTo=%2Faccount");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(base + "/account");
    await expect(
      page.getByRole("button", {
        name: "Notifications, 0 unread",
        exact: true,
      }),
    ).toBeVisible();
    return {
      authId,
      profileId: identity.identity_profile_id,
      runId: identity.identity_run_id,
      name,
      email,
      context,
      page,
    };
  }
  phase = "real browser password sign-in";
  const coach = await person("QA Coach"),
    athlete = await person("QA Athlete"),
    stranger = await person("QA Stranger");
  await database.begin(async (tx) => {
    await tx`select set_config('app.current_auth_user_id',${coach.authId},true),set_config('app.current_profile_id',${coach.profileId},true),set_config('app.current_run_id',${coach.runId},true),set_config('app.current_run_role','member',true)`;
    await tx`select app.submit_owned_coach_application()`;
    await tx`select app.upsert_owned_coach_profile(${coach.name}::text,'An isolated disposable local coach for end-to-end individual group approval testing.'::text,array['Boxing']::text[],'Europe/Berlin'::text,'hidden'::text,'40000000-0000-4000-8000-000000000001'::uuid,null::text,null::numeric,null::numeric,null::text,null::text)`;
  });
  await database`select app.review_coach_application(${coach.profileId}::uuid,'pending','approved','Disposable group approval QA','local-test','movx-identity-application-v1')`;
  await database`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
  pass("three independent real browser password sessions");

  phase = "coach publishes an approval-based group through the real interface";
  const coachPage = coach.page;
  await coachPage.goto(base + "/coach/events/new");
  await coachPage
    .getByLabel("Session title", { exact: true })
    .fill("Approval QA " + tag);
  const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const deadlineDate = new Date(Date.now() + 4 * 86400000)
    .toISOString()
    .slice(0, 10);
  await coachPage
    .getByLabel("Starts at", { exact: true })
    .fill(date + "T18:00");
  await coachPage.getByLabel("Ends at", { exact: true }).fill(date + "T19:00");
  await coachPage
    .getByLabel("Coach decision deadline", { exact: true })
    .fill(deadlineDate + "T18:00");
  await coachPage.getByLabel("Minimum participants", { exact: true }).fill("1");
  await coachPage.getByLabel("Maximum participants", { exact: true }).fill("2");
  await coachPage
    .getByRole("button", { name: "Save draft and review", exact: true })
    .click();
  await expect(coachPage).toHaveURL(/\/coach\/events\/[a-f0-9-]{36}$/);
  const ownerPath = new URL(coachPage.url()).pathname;
  const id = ownerPath.split("/").at(-1);
  const eventPath = "/events/group-" + id.replaceAll("-", "");
  const decide = async (page, label, area = page) => {
    const button = area.getByRole("button", { name: label, exact: true });
    const form = area
      .locator("form")
      .filter({ has: page.getByRole("button", { name: label, exact: true }) });
    await form.getByRole("checkbox").check();
    await button.focus();
    await page.keyboard.press("Enter");
  };
  await decide(coachPage, "Publish session");
  await expect(
    coachPage.getByRole("heading", { name: "Published session", exact: true }),
  ).toBeVisible();
  pass(
    "real coach draft/publication with frozen terms and separate event confirmation",
  );
  phase = "real pending reservations and independent approvals";
  for (const person of [athlete, stranger]) {
    await person.page.goto(base + eventPath);
    await person.page
      .getByRole("button", { name: "Request a seat", exact: true })
      .click();
    await expect(
      person.page.getByText("Pending coach approval · seat reserved", {
        exact: true,
      }),
    ).toBeVisible();
  }
  await coachPage.goto(base + ownerPath);
  await expect(
    coachPage.getByRole("button", { name: "Confirm session", exact: true }),
  ).toHaveCount(0);
  await expect(
    coachPage.getByText("0 individually approved", { exact: true }),
  ).toBeVisible();
  const firstRow = coachPage
    .locator(".coach-event-roster li")
    .filter({ hasText: athlete.name });
  const secondRow = coachPage
    .locator(".coach-event-roster li")
    .filter({ hasText: stranger.name });
  // A well-formed stale/foreign attempt must recover instead of reporting approval.
  await firstRow
    .locator('input[name="registrationId"]')
    .first()
    .evaluate((el) => {
      el.value = "99999999-9999-4999-8999-999999999999";
    });
  await decide(coachPage, "Approve participant", firstRow);
  await expect(coachPage).toHaveURL(/issue=conflict/);
  await expect(
    coachPage.locator(".coach-event-notice[role=alert]"),
  ).toBeVisible();
  await coachPage.goto(base + ownerPath);
  for (const width of [1440, 375, 320]) {
    await coachPage.setViewportSize({ width, height: 1000 });
    assert.equal(
      await coachPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    for (const selector of [
      ".header-messages",
      ".notification-bell",
      ".account-menu-trigger",
    ]) {
      const bounds = await coachPage.locator(selector).boundingBox();
      assert.ok(
        bounds &&
          bounds.width >= 44 &&
          bounds.height >= 44 &&
          bounds.x >= 0 &&
          bounds.x + bounds.width <= width,
      );
    }
    if (width === 320) {
      const account = coachPage.locator(".account-menu-trigger");
      await account.focus();
      await coachPage.keyboard.press("Enter");
      await expect(account).toHaveAttribute("aria-expanded", "true");
      await coachPage.keyboard.press("Escape");
      await expect(account).toHaveAttribute("aria-expanded", "false");
      await expect(account).toBeFocused();
      const bell = coachPage.locator(".notification-bell");
      await bell.focus();
      await coachPage.keyboard.press("Enter");
      await expect(
        coachPage.getByRole("dialog", { name: "Notifications", exact: true }),
      ).toBeVisible();
      await coachPage.keyboard.press("Escape");
      await expect(bell).toBeFocused();
    }
    await coachPage.screenshot({
      path: path.join(output, `pending-roster-${width}.png`),
      fullPage: true,
    });
  }
  await decide(coachPage, "Approve participant", firstRow);
  await expect(
    firstRow.getByText("Participation approved", { exact: false }),
  ).toBeVisible();
  await athlete.page.reload();
  await expect(
    athlete.page.getByText("Participation approved", { exact: true }),
  ).toBeVisible();
  await expect(
    athlete.page.getByText(
      /Your participation is approved. The coach has not yet confirmed/,
    ),
  ).toBeVisible();
  await decide(coachPage, "Confirm session");
  await expect(
    coachPage.getByText("Confirmed by coach", { exact: true }),
  ).toBeVisible();
  await stranger.page.reload();
  await expect(
    stranger.page.getByText("Pending coach approval · seat reserved", {
      exact: true,
    }),
  ).toBeVisible();
  pass(
    "pending full-capacity seats, approved-only minimum, keyboard approval, stale recovery and 1440/375/320 roster layouts",
  );
  phase = "post-confirmation decline and fresh approval after withdrawal";
  await decide(coachPage, "Decline participant", secondRow);
  await expect(
    secondRow.getByText("Participation declined", { exact: false }),
  ).toBeVisible();
  await stranger.page.reload();
  await expect(
    stranger.page.getByText("Participation declined", { exact: true }),
  ).toBeVisible();
  await expect(
    stranger.page.getByRole("button", { name: "Request a seat", exact: true }),
  ).toHaveCount(0);
  await athlete.page.reload();
  await athlete.page
    .getByRole("button", { name: "Withdraw my seat", exact: true })
    .click();
  await expect(
    athlete.page.getByText("You withdrew", { exact: true }),
  ).toBeVisible();
  await athlete.page
    .getByRole("button", { name: "Request a seat", exact: true })
    .click();
  await expect(
    athlete.page.getByText("Pending coach approval · seat reserved", {
      exact: true,
    }),
  ).toBeVisible();
  await coachPage.reload();
  await expect(
    coachPage.getByText("Confirmed by coach", { exact: true }),
  ).toBeVisible();
  const [states] =
    await database`select count(*) filter(where status='pending')::int pending,count(*) filter(where status='active')::int approved,count(*) filter(where status='withdrawn' and decision='approved')::int withdrawn,count(*) filter(where status='declined')::int declined from app.coach_group_registrations where session_id=${id}::uuid`;
  assert.deepEqual(states, {
    pending: 1,
    approved: 0,
    withdrawn: 1,
    declined: 1,
  });
  pass(
    "confirmed event stays confirmed; final decline and withdrawal/rejoin retain decisions without inherited approval",
  );
  phase = "real recipient privacy, cancellation and mobile athlete history";
  const outsider = await person("QA Outsider");
  await outsider.page.goto(base + ownerPath);
  await expect(
    outsider.page.getByRole("heading", {
      name: "This coach event is not available to this account",
      exact: true,
    }),
  ).toBeVisible();
  await athlete.page.goto(base + ownerPath);
  await expect(
    athlete.page.getByRole("heading", {
      name: "This coach event is not available to this account",
      exact: true,
    }),
  ).toBeVisible();
  const publicPage = await outsider.context.request.get(base + eventPath);
  const html = await publicPage.text();
  for (const p of [athlete, stranger]) {
    assert.equal(html.includes(p.email), false);
    assert.equal(html.includes(p.profileId), false);
  }
  await decide(coachPage, "Cancel session");
  await expect(coachPage.getByText("Cancelled", { exact: true })).toBeVisible();
  await athlete.page.goto(base + "/sessions/groups");
  await expect(
    athlete.page.getByText("Session cancelled", { exact: true }),
  ).toBeVisible();
  for (const width of [1440, 375, 320]) {
    await athlete.page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await athlete.page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await athlete.page.screenshot({
      path: path.join(output, `athlete-history-${width}.png`),
      fullPage: true,
    });
  }
  pass(
    "real owner/athlete denial, public aggregate privacy, cancellation history and responsive athlete views",
  );
  phase = "real deadline expiry presentation on a confirmed event";
  const expiringId = randomUUID();
  const attemptId = randomUUID();
  await database`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,published_at,confirmed_at,confirmed_by_profile_id)
    select ${expiringId}::uuid,run_id,coach_profile_id,${"group-" + expiringId.replaceAll("-", "")},'Deadline QA',description,discipline,intended_level,training_location_id,venue_snapshot,starts_at+interval '2 days',ends_at+interval '2 days',clock_timestamp()+interval '3 seconds',1,2,0,'confirmed',clock_timestamp(),clock_timestamp(),coach_profile_id from app.coach_group_sessions where id=${id}::uuid`;
  await database`insert into app.coach_group_registrations(id,run_id,session_id,athlete_profile_id) values(${attemptId}::uuid,${athlete.runId}::uuid,${expiringId}::uuid,${athlete.profileId}::uuid)`;
  await new Promise((resolve) => setTimeout(resolve, 3200));
  await athlete.page.goto(
    base + "/events/group-" + expiringId.replaceAll("-", ""),
  );
  await expect(
    athlete.page.getByText("Approval deadline passed", { exact: true }),
  ).toBeVisible();
  await expect(
    athlete.page.getByText("Confirmed by coach", { exact: true }),
  ).toBeVisible();
  await expect(
    athlete.page.getByRole("button", { name: "Request a seat", exact: true }),
  ).toHaveCount(0);
  await coachPage.goto(base + "/coach/events/" + expiringId);
  await expect(
    coachPage.getByRole("button", { name: "Approve participant", exact: true }),
  ).toHaveCount(0);
  pass(
    "real expired-pending UI preserves confirmed event and disables stale decisions",
  );
  const [queues] =
    await database`select (select count(*)::int from app.notification_emails) messages,(select count(*)::int from app.booking_notification_events) bookings`;
  assert.deepEqual(queues, { messages: 0, bookings: 0 });
  pass(
    "group approvals create no private booking/message notification side effects",
  );
  if (groupNotifications) {
    phase = "real group bell, independent reads and Mailpit delivery";
    await coachPage.goto(base + "/account");
    const bell = coachPage.getByRole("button", { name: /^Notifications,/ });
    await expect(bell).toHaveAccessibleName(
      /^Notifications, [1-9][0-9]* unread$/,
    );
    await bell.click();
    const dialog = coachPage.getByRole("dialog", {
      name: "Notifications",
      exact: true,
    });
    await expect(
      dialog.getByRole("link", { name: /Group approval deadline passed/ }),
    ).toHaveAttribute("href", `/coach/events/${expiringId}`);
    await dialog
      .getByRole("button", { name: "Mark all read", exact: true })
      .click();
    await expect(bell).toHaveAccessibleName("Notifications, 0 unread");
    const [queuedBefore] =
      await database`select count(*)::int n from app.group_notification_receipts where state='queued'`;
    assert.ok(queuedBefore.n >= 19);
    for (let n = 0; n < 30; n++) {
      const r = await fetch(base + "/api/internal/notifications/dispatch", {
        headers: { authorization: "Bearer " + cron },
      });
      assert.equal(r.status, 200);
      const result = await r.json();
      assert.equal(result.status, "ready");
      assert.equal(result.result.failed, 0);
      assert.equal(result.result.unknown, 0);
      if (result.result.claimed === 0) break;
    }
    const receipts =
      await database`select r.id,r.provider_id,r.recipient_profile_id,r.participation_status,e.kind,e.session_id from app.group_notification_receipts r join app.group_notification_events e on e.id=r.event_id where r.state='accepted'`;
    assert.equal(receipts.length, queuedBefore.n);
    const pendingConfirmation = receipts.find(
      (r) =>
        r.kind === "confirmed" && r.recipient_profile_id === stranger.profileId,
    );
    assert.ok(pendingConfirmation);
    assert.equal(pendingConfirmation.participation_status, "pending");
    const mailMessage = await (
      await fetch(mail + "/api/v1/message/" + pendingConfirmation.provider_id)
    ).json();
    assert.match(mailMessage.Text, /still awaiting coach approval/);
    assert.equal(mailMessage.To.length, 1);
    assert.equal(mailMessage.To[0].Address, stranger.email);
    assert.equal(mailMessage.From.Address, "notification@movx.club");
    const [summaries] =
      await database`select count(*)::int n from app.group_notification_receipts r join app.group_notification_events e on e.id=r.event_id where e.session_id=${id}::uuid and e.kind='confirmed' and r.recipient_profile_id=${coach.profileId}::uuid`;
    assert.equal(summaries.n, 1);
    await coachPage.screenshot({
      path: path.join(output, "group-bell.png"),
      fullPage: true,
    });
    await coachPage.keyboard.press("Escape");
    await expect(bell).toBeFocused();
    pass(
      "real group bell/read independence and all canonical individual/summary emails captured once in isolated Mailpit",
    );
  }
  assert.deepEqual(errors, []);
  pass("no browser runtime exceptions");
} catch (error) {
  if (browser) {
    let n = 0;
    for (const context of browser.contexts())
      for (const page of context.pages()) {
        await page
          .screenshot({
            path: path.join(output, `failure-${n++}.png`),
            fullPage: true,
          })
          .catch(() => {});
      }
  }
  console.error(redact(`FAIL ${phase}: ${error.stack ?? error}`));
  await writeFile(
    path.join(output, "failure.txt"),
    redact(`${phase}\n${error.stack ?? error}`),
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) {
    server.kill("SIGTERM");
    if (server.exitCode === null)
      await new Promise((resolve) => server.once("exit", resolve));
  }
  await database?.end({ timeout: 1 });
  await writeFile(path.join(output, "server.log"), redact(serverLog));
  if (started) {
    assert.match(
      project,
      /^mov(?:77-group-approval|86-group-notification)-qa-[a-f0-9]{10}$/,
    );
    try {
      await command(cli, [
        "stop",
        "--workdir",
        checkout,
        "--project-id",
        project,
        "--no-backup",
      ]);
      pass("exact disposable stack and volumes removed");
    } catch (error) {
      console.error(redact(error.message));
      process.exitCode = 1;
    }
  }
  if (retainedBefore !== undefined) {
    try {
      assert.equal(retainedFingerprint(), retainedBefore);
      pass("retained application/Auth-user/Storage row hashes unchanged");
    } catch (error) {
      console.error(redact(error.message));
      process.exitCode = 1;
    }
  }
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      { phase, success: process.exitCode !== 1, results },
      null,
      2,
    ),
  );
  await rm(checkout, { recursive: true, force: true });
  console.log(`Evidence: ${output}`);
}
