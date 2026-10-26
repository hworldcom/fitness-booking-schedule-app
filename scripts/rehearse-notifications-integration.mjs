import { verifiedDatabaseFingerprints } from "./lib/database-fingerprints.mjs";
import { rehearseCoachApplicationEmail } from "./lib/coach-application-email-integration.mjs";
// MOV-68: real Auth/API/SQL/browser/worker QA in a wholly disposable stack.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
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
assert.ok(process.argv.slice(2).every((arg) => arg === "--webpack"));
const webpack = process.argv.includes("--webpack");
const tag = randomUUID().replaceAll("-", "").slice(0, 10);
const project = `mov68-notification-qa-${tag}`;
const checkout = await mkdtemp(path.join(tmpdir(), `${project}-`));
const output = path.join(root, "test-results/notifications-integration", tag);
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
 schemaname,tablename),false,false,'')))[1]::text hash from pg_tables
 where schemaname='app' or (schemaname='auth' and tablename='users')
 or (schemaname='storage' and tablename in ('buckets','objects'))) hashes;`;
function retainedFingerprint() {
  return verifiedDatabaseFingerprints(
    execFileSync(
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
    ),
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
    NOTIFICATION_DELIVERY_ENABLED: "true",
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
  // Inspect only current source, excluding retained ignored work/evidence copies.
  // Policy tests need the normal checked-in config; startup/runtime keep QA ports.
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
      app_metadata: { movx_test_ticket: "MOV-68", temporary: true },
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
  const call = async (person, route, body, headers = {}) => {
    const response = await person.context.request.fetch(base + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin: base,
        ...(route.startsWith("/api/notifications")
          ? { "x-movx-notification-version": "2" }
          : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { data: body }),
    });
    return {
      status: response.status(),
      data: await response.json(),
      headers: response.headers(),
    };
  };
  const ready = async (person, route, body) => {
    const result = await call(person, route, body);
    assert.equal(
      result.status,
      200,
      `${route}: ${JSON.stringify(result.data)}`,
    );
    assert.equal(result.data.status, "ready");
    return result.data.value;
  };
  const list = (p, suffix = "") => ready(p, "/api/notifications" + suffix);
  const message = (p, action, args) =>
    ready(p, "/api/messages", { action, args });
  const dispatch = async () => {
    const r = await fetch(base + "/api/internal/notifications/dispatch", {
      headers: { authorization: `Bearer ${cron}` },
    });
    assert.equal(r.status, 200);
    return (await r.json()).result;
  };
  const refresh = async (p) => {
    await p.page.bringToFront();
    await p.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  };
  phase = "real browser password sign-in";
  const coach = await person("QA Coach"),
    athlete = await person("QA Athlete"),
    stranger = await person("QA Stranger");
  await rehearseCoachApplicationEmail({
    base,
    coach,
    database,
    mail,
    cron,
    pass,
    output,
  });
  await database`select app.review_coach_application(${coach.profileId}::uuid,'pending','approved','Disposable message notification QA','local-test','movx-identity-application-v1')`;
  await database`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
  const [profile] =
    await database`select slug from app.profiles where id=${coach.profileId}::uuid`;
  const publicProfile = await (
    await fetch(base + `/coaches/${profile.slug}`)
  ).text();
  for (const secret of [
    "+4915123456789",
    "+4915198765432",
    "https://www.instagram.com/movx_test",
    "https://www.facebook.com/movx_test",
    "https://www.linkedin.com/in/movx-test",
  ])
    assert.equal(publicProfile.includes(secret), false);
  pass(
    "approved public coach page and metadata exclude all private application contacts",
  );
  pass("three independent real browser password sessions");

  phase = "real inquiry capture and recipient authorization";
  const firstBody = `Private QA message ${tag} <script>literal</script>`;
  await athlete.page.goto(base + `/coaches/${profile.slug}`);
  await athlete.page
    .getByRole("link", { name: "Message coach", exact: true })
    .click();
  await athlete.page.getByLabel("Your message").fill(firstBody);
  await athlete.page
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(
    athlete.page.getByText(firstBody, { exact: true }),
  ).toBeVisible();
  await expect(athlete.page).toHaveURL(/conversation=/);
  const conversationId = new URL(athlete.page.url()).searchParams.get(
    "conversation",
  );
  assert.ok(conversationId);
  const [firstJob] =
    await database`select j.id,j.due_at,j.first_entry_id,extract(epoch from j.due_at-e.created_at) delay_seconds from app.notification_emails j join app.message_entries e on e.id=j.first_entry_id where j.conversation_id=${conversationId}::uuid and j.recipient_profile_id=${coach.profileId}::uuid`;
  assert.ok(firstJob);
  assert.equal(Number(firstJob.delay_seconds), 300);
  const firstDeadline = new Date(firstJob.due_at).getTime();
  const thread = await ready(
    athlete,
    `/api/messages?conversationId=${conversationId}`,
  );
  const contextId = thread.contexts.find((c) => c.kind === "inquiry").id;
  const send = (body, submissionId = randomUUID()) =>
    message(athlete, "send", { conversationId, contextId, body, submissionId });
  assert.equal((await list(coach)).unreadCount, 1);
  assert.equal((await list(athlete)).unreadCount, 0);
  assert.equal((await list(stranger)).unreadCount, 0);
  const initial = await list(coach);
  assert.ok(!JSON.stringify(initial).includes(firstBody));
  assert.ok(!JSON.stringify(initial).includes(athlete.email));
  assert.equal(
    (
      await call(stranger, "/api/notifications", {
        action: "read",
        args: { id: initial.items[0].id },
      })
    ).status,
    503,
  );
  assert.equal(
    (await call(stranger, `/api/messages?conversationId=${conversationId}`))
      .status,
    409,
  );
  assert.equal(
    (
      await call(
        coach,
        "/api/notifications",
        { action: "read", args: { id: initial.items[0].id } },
        { origin: "https://other.example" },
      )
    ).status,
    403,
  );
  const guest = await browser.newContext();
  assert.equal(
    (await guest.request.get(base + "/api/notifications")).status(),
    401,
  );
  assert.equal(
    (await fetch(base + "/api/internal/notifications/dispatch")).status,
    401,
  );
  assert.equal((await dispatch()).claimed, 0);
  pass(
    "browser inquiry atomically captures recipient-only notification; guest, stranger, origin and cron guards",
  );

  phase = "bell versus conversation read state";
  await refresh(coach);
  const bell = coach.page.getByRole("button", { name: /^Notifications,/ });
  await expect(bell).toHaveAccessibleName("Notifications, 1 unread");
  await bell.click();
  const dialog = coach.page.getByRole("dialog");
  await expect(
    dialog.getByRole("link", { name: /New message from QA/ }),
  ).toBeVisible();
  assert.equal((await ready(coach, "/api/messages")).unreadCount, 1);
  await dialog
    .getByRole("button", { name: /Mark message notification/ })
    .click();
  await expect(bell).toHaveAccessibleName("Notifications, 0 unread");
  assert.equal((await ready(coach, "/api/messages")).unreadCount, 1);
  assert.equal(
    (
      await database`select state from app.notification_emails where id=${firstJob.id}::uuid`
    )[0].state,
    "queued",
  );
  await coach.page.keyboard.press("Escape");
  await expect(bell).toBeFocused();
  const retryId = randomUUID();
  await send("Exact retry QA", retryId);
  await send("Exact retry QA", retryId);
  assert.equal((await list(coach)).unreadCount, 1);
  assert.equal(
    Number(
      (
        await database`select count(*) n from app.message_entries where submission_id=${retryId}::uuid`
      )[0].n,
    ),
    1,
  );
  pass(
    "bell opening/mark-read independent of chat; exact message retry produces one alert",
  );

  phase = "real history paging and snapshot cutoff";
  for (let i = 0; i < 21; i++) await send(`Paging QA ${i}`);
  assert.equal((await list(coach)).unreadCount, 22);
  await refresh(coach);
  await bell.click();
  await expect(dialog.locator(".notification-items > li")).toHaveCount(20);
  await dialog.getByRole("button", { name: "Older", exact: true }).click();
  await expect(dialog.locator(".notification-items > li")).toHaveCount(3);
  await dialog.getByRole("button", { name: "Newer", exact: true }).click();
  await expect(dialog.locator(".notification-items > li")).toHaveCount(20);
  const snapshot = await list(coach);
  await send("Arrived after list snapshot");
  await ready(coach, "/api/notifications", {
    action: "read-all",
    args: { throughAt: snapshot.snapshotAt },
  });
  assert.equal((await list(coach, "?filter=unread")).unreadCount, 1);
  await refresh(coach);
  await dialog.getByRole("button", { name: "Unread", exact: true }).click();
  await expect(dialog.locator(".notification-items > li")).toHaveCount(1);
  pass(
    "real twenty-item paging and snapshot-bounded mark-all preserve later arrivals",
  );

  phase = "read/write transport failure recovery";
  await coach.page.route("**/api/notifications", async (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await dialog
    .getByRole("button", { name: /Mark message notification/ })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  assert.equal((await list(coach)).unreadCount, 1);
  await coach.page.unroute("**/api/notifications");
  await dialog.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: /Mark message notification/ }),
  ).toBeVisible();
  await coach.page.route("**/api/notifications?*", (route) =>
    route.abort("failed"),
  );
  // Opening explicitly forces a fresh read; a focus event may correctly
  // coalesce with the successful retry still in flight above.
  await coach.page.keyboard.press("Escape");
  await bell.click();
  await expect(bell).toHaveAccessibleName("Notifications, count unavailable");
  await expect(dialog.locator(".notification-items > li")).toHaveCount(1);
  await coach.page.unroute("**/api/notifications?*");
  await dialog.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(bell).toHaveAccessibleName("Notifications, 1 unread");
  await dialog
    .getByRole("button", { name: "Mark all read", exact: true })
    .click();
  await expect(
    dialog.getByText("You’re all caught up", { exact: true }),
  ).toBeVisible();
  assert.equal((await ready(coach, "/api/messages")).unreadCount, 1);
  pass(
    "real API failure injection retains stale rows/count uncertainty; writes retry without false success",
  );

  phase = "desktop/mobile and real signed-in header coverage";
  await dialog.getByRole("button", { name: "All", exact: true }).click();
  await expect(dialog.locator(".notification-items > li")).toHaveCount(20);
  for (const width of [1440, 375, 320]) {
    await coach.page.setViewportSize({ width, height: 950 });
    const bounds = await dialog.boundingBox();
    assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1);
    await coach.page.screenshot({
      path: path.join(output, `bell-${width}.png`),
    });
  }
  await coach.page.keyboard.press("Escape");
  for (const route of [
    "/explore",
    "/coach",
    "/messages",
    "/account",
    "/profile",
  ]) {
    await coach.page.goto(base + route);
    await expect(bell).toHaveAccessibleName("Notifications, 0 unread");
  }
  // Leave Messages without opening the conversation, so it stays unread.
  await coach.page.goto(base + "/account");
  await coach.page.setViewportSize({ width: 1440, height: 1000 });
  pass(
    "actual authorized headers at five routes; desktop and 375/320px panel bounds and Escape focus",
  );

  phase = "real five-minute eligibility";
  const [unchanged] =
    await database`select due_at from app.notification_emails where id=${firstJob.id}::uuid`;
  assert.equal(new Date(unchanged.due_at).getTime(), firstDeadline);
  let checks = 0;
  while (Date.now() < firstDeadline - 1000) {
    assert.equal((await dispatch()).claimed, 0);
    checks++;
    const remaining = firstDeadline - Date.now();
    console.log(
      `Five-minute wall-clock check: not eligible; ${Math.ceil(remaining / 1000)} seconds remain.`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(30000, Math.max(100, remaining - 1000))),
    );
  }
  await waitUntil(async () => Date.now() >= firstDeadline + 500, 5000);
  const delivered = await dispatch();
  assert.equal(delivered.accepted, 1);
  const [accepted] =
    await database`select state,provider_id from app.notification_emails where id=${firstJob.id}::uuid`;
  assert.equal(accepted.state, "accepted");
  const captured = await (
    await fetch(`${mail}/api/v1/message/${accepted.provider_id}`)
  ).json();
  assert.equal(captured.From.Address, "notification@movx.club");
  assert.equal(captured.To[0].Address, coach.email);
  const raw = await (
    await fetch(`${mail}/api/v1/message/${accepted.provider_id}/raw`)
  ).text();
  assert.match(raw, /Reply-To:.*hello@movx\.club/i);
  assert.ok(
    captured.Text.includes(`${base}/messages?conversation=${conversationId}`),
  );
  assert.ok(!JSON.stringify(captured).includes(firstBody));
  assert.equal((await dispatch()).claimed, 0);
  await send("Still unread after first delivery");
  assert.equal(
    Number(
      (
        await database`select count(*) n from app.notification_emails where conversation_id=${conversationId}::uuid and recipient_profile_id=${coach.profileId}::uuid`
      )[0].n,
    ),
    1,
  );
  assert.equal((await dispatch()).claimed, 0);
  pass(
    "actual five-minute wall-clock delay, fixed deadline, correct captured headers/link/privacy and one email until read",
    { earlyDispatchChecks: checks },
  );

  phase = "real conversation read and next unread period suppression";
  await coach.page.bringToFront();
  await coach.page.goto(`${base}/messages?conversation=${conversationId}`);
  const lastMessage = coach.page.getByText(
    "Still unread after first delivery",
    { exact: true },
  );
  await lastMessage.scrollIntoViewIfNeeded();
  await lastMessage.click();
  await expect(lastMessage).toBeInViewport({ ratio: 0.5 });
  await expect
    .poll(() =>
      coach.page.evaluate(
        () => document.hasFocus() && document.visibilityState === "visible",
      ),
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        (
          await database`select closed_at from app.notification_emails where id=${firstJob.id}::uuid`
        )[0].closed_at,
    )
    .not.toBeNull();
  assert.ok(
    (await list(coach)).unreadCount > 0,
    "Reading chat must not silently mark bell history read",
  );
  await coach.page.goto(base + "/account");
  await send("Fresh unread period after reading");
  const jobs =
    await database`select id,state,closed_at from app.notification_emails where conversation_id=${conversationId}::uuid and recipient_profile_id=${coach.profileId}::uuid order by due_at`;
  assert.equal(jobs.length, 2);
  assert.equal(jobs[1].state, "queued");
  await coach.page.goto(`${base}/messages?conversation=${conversationId}`);
  const freshMessage = coach.page.getByText(
    "Fresh unread period after reading",
    { exact: true },
  );
  await freshMessage.scrollIntoViewIfNeeded();
  await freshMessage.click();
  await expect(freshMessage).toBeInViewport({ ratio: 0.5 });
  await expect
    .poll(
      async () =>
        (
          await database`select state from app.notification_emails where id=${jobs[1].id}::uuid`
        )[0].state,
    )
    .toBe("suppressed");
  assert.equal((await dispatch()).claimed, 0);
  pass(
    "real Messages full read closes period, next text re-arms, read-before-due suppresses second email",
  );
  phase = "real booking HTTP/Auth/SQL/bell/two-party immediate email";
  await coach.page.goto(base + "/account");
  const [venue] =
    await database`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
  const [offer] =
    await database`select id,revision from app.coach_session_types where coach_profile_id=${coach.profileId}::uuid and format='private' limit 1`;
  const [future] =
    await database`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text target`;
  await database.begin(async (tx) => {
    await tx`select set_config('app.current_auth_user_id',${coach.authId},true),set_config('app.current_profile_id',${coach.profileId},true),set_config('app.current_run_id',${coach.runId},true),set_config('app.current_run_role','member',true)`;
    await tx`select app.save_owned_effective_coach_availability(${tx.json({ kind: "dates", operationId: randomUUID(), expectedRevision: 0, dates: [{ date: future.target, mode: "custom", hours: [{ localStartTime: "09:00", locationId: venue.id, locationUpdatedAt: venue.stamp }] }] })})`;
    await tx`select app.mutate_owned_coach_session_type(${randomUUID()}::uuid,${tx.json({ action: "save", id: offer.id, expectedRevision: offer.revision, format: "private", name: "Booking QA session", description: "Disposable browser booking notification validation.", color: "#123456", durationMinutes: 60, defaultLocationId: venue.id, bookable: true })})`;
  });
  const [start] =
    await database`select ((${future.target}::date+time '09:00') at time zone 'Europe/Berlin') starts_at`;
  const requestBody = {
    commandId: randomUUID(),
    typeId: offer.id,
    typeRevision: offer.revision + 1,
    locationId: venue.id,
    startsAt: new Date(start.starts_at).toISOString(),
  };
  const booked = await call(athlete, "/api/session-bookings", requestBody);
  assert.equal(booked.status, 200, JSON.stringify(booked.data));
  assert.equal(booked.data.status, "saved");
  assert.equal(booked.data.requestStatus, "pending");
  const replay = await call(athlete, "/api/session-bookings", requestBody);
  assert.equal(replay.data.requestId, booked.data.requestId);
  const receiptRows =
    await database`select r.id,r.recipient_profile_id,r.state,r.notify_in_app from app.booking_notification_receipts r join app.booking_notification_events e on e.id=r.event_id where e.source_id=${booked.data.requestId}::uuid`;
  assert.equal(receiptRows.length, 2);
  assert.ok(receiptRows.every((r) => r.state === "queued"));
  assert.equal(receiptRows.filter((r) => r.notify_in_app).length, 1);
  assert.equal(
    (await list(athlete)).items.filter((x) => x.kind === "booking").length,
    0,
  );
  await refresh(coach);
  await bell.click();
  await expect(
    dialog.getByRole("link", { name: /Booking request submitted/ }),
  ).toBeVisible();
  const legacy = await coach.context.request.get(base + "/api/notifications");
  const legacyPage = (await legacy.json()).value;
  assert.equal(legacyPage.items.filter((x) => x.kind === "booking").length, 0);
  const legacyRead = await coach.context.request.post(
    base + "/api/notifications",
    {
      headers: { origin: base },
      data: { action: "read-all", args: { throughAt: legacyPage.snapshotAt } },
    },
  );
  assert.equal(legacyRead.status(), 200);
  assert.equal(
    (await list(coach, "?filter=unread")).items.filter(
      (x) => x.kind === "booking",
    ).length,
    1,
  );
  await dialog
    .getByRole("button", {
      name: "Mark booking request submitted notification as read",
      exact: true,
    })
    .click();
  assert.ok(
    (
      await database`select state from app.booking_notification_receipts where id in(${receiptRows[0].id}::uuid,${receiptRows[1].id}::uuid)`
    ).every((r) => r.state === "queued"),
  );
  assert.equal((await dispatch()).accepted, 2);
  const receipts =
    await database`select provider_id,recipient_profile_id from app.booking_notification_receipts where id in(${receiptRows[0].id}::uuid,${receiptRows[1].id}::uuid)`;
  const received = new Set();
  for (const receipt of receipts) {
    const captured = await (
      await fetch(`${mail}/api/v1/message/${receipt.provider_id}`)
    ).json();
    assert.equal(captured.From.Address, "notification@movx.club");
    assert.equal(captured.To.length, 1);
    received.add(captured.To[0].Address);
    assert.match(captured.Text, /Booking request submitted/);
    assert.match(captured.Text, /not a confirmed booking/);
    assert.ok(!captured.Text.includes(firstBody));
  }
  assert.deepEqual(received, new Set([coach.email, athlete.email]));
  assert.equal((await dispatch()).claimed, 0);
  pass(
    "real browser-cookie booking POST/retry, canonical SQL capture, coach-only bell, legacy v1/v2 isolation, independent read and two immediate Mailpit receipts",
  );
  await guest.close();
  assert.deepEqual(errors, []);
  pass("no browser runtime exceptions");
} catch (error) {
  let captureIndex = 0;
  for (const context of browser?.contexts() ?? [])
    for (const page of context.pages())
      await page
        .screenshot({
          path: path.join(output, `failure-${captureIndex++}.png`),
          fullPage: true,
        })
        .catch(() => {});
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
    assert.match(project, /^mov68-notification-qa-[a-f0-9]{10}$/);
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
