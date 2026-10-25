// MOV-19: real photo UI/Auth/SQL/Storage in a wholly disposable stack. Mux needs separate live credentials.
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { chromium, expect as baseExpect } from "@playwright/test";
import { rehearseProfileEditing } from "./lib/profile-edit-integration.mjs";

const expect = baseExpect.configure({ timeout: 20000 });
const root = process.cwd();
assert.ok(
  process.argv
    .slice(2)
    .every((arg) =>
      ["--webpack", "--diagnose-storage", "--profile-editor"].includes(arg),
    ),
);
const profileEditor = process.argv.includes("--profile-editor");
const diagnoseStorage = process.argv.includes("--diagnose-storage");
const webpack = process.argv.includes("--webpack");
const tag = randomUUID().replaceAll("-", "").slice(0, 10);
const project = `mov19-media-qa-${tag}`;
const checkout = await mkdtemp(path.join(tmpdir(), `${project}-`));
const output = path.join(
  root,
  profileEditor
    ? "test-results/profile-edit-integration"
    : "test-results/coach-media-integration",
  tag,
);
const base = "http://localhost:3169";
const cli = path.join(root, "node_modules/.bin/supabase");
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !/MUX|SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|RESEND|NOTIFICATION|CRON_SECRET|SMTP|OPENAI_API_KEY/.test(
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
    create role qa_worker login password '${workerPassword}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_media_worker;`);
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
    COACH_MEDIA_DATABASE_URL: loginUrl("qa_worker", workerPassword),
    NOTIFICATION_DELIVERY_ENABLED: "false",
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
  for (const key of ["DATABASE_URL", "COACH_MEDIA_DATABASE_URL", "CRON_SECRET"])
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
        movx_test_ticket: profileEditor ? "MOV-101" : "MOV-19",
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
    stranger = await person("QA Stranger");
  await database.begin(async (tx) => {
    await tx`select set_config('app.current_auth_user_id',${coach.authId},true),set_config('app.current_profile_id',${coach.profileId},true),set_config('app.current_run_id',${coach.runId},true),set_config('app.current_run_role','member',true)`;
    await tx`select app.submit_owned_coach_application()`;
    await tx`select app.upsert_owned_coach_profile(${coach.name}::text,'An isolated disposable local coach for training-media testing.'::text,array['Boxing']::text[],'Europe/Berlin'::text,'hidden'::text,'40000000-0000-4000-8000-000000000001'::uuid,null::text,null::numeric,null::numeric,null::text,null::text)`;
  });
  await database`select app.review_coach_application(${coach.profileId}::uuid,'pending','approved','Disposable media QA','local-test','movx-identity-application-v1')`;
  await database`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
  pass("two independent real browser password sessions");
  if (profileEditor) {
    phase = "production profile editor journeys";
    await rehearseProfileEditing({
      base,
      browser,
      database,
      coach,
      stranger,
      person,
      output,
      pass,
      errors,
      tag,
    });
  }

  phase = "real owner photo upload and private drafts";
  const coachPage = coach.page;
  await coachPage.goto(base + "/profile/coach");
  await coachPage
    .getByRole("button", {
      name: "Edit training photos and video",
      exact: true,
    })
    .click();
  const editor = coachPage.locator(".coach-media-editor");
  await expect(editor.getByText("0 / 6 photos", { exact: true })).toBeVisible();
  await expect(
    editor.getByLabel("Training video file", { exact: true }),
  ).toBeDisabled();
  await expect(
    editor.getByText("Video uploads are temporarily unavailable."),
  ).toBeVisible();
  const source = await sharp({
    create: { width: 1800, height: 1000, channels: 3, background: "#55776d" },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: "Private source metadata" } } })
    .toBuffer();
  const choosePhoto = async (description) => {
    await editor
      .getByLabel("Training photo file", { exact: true })
      .setInputFiles({
        name: "training.jpg",
        mimeType: "image/jpeg",
        buffer: source,
      });
    await editor
      .getByLabel("Describe this photo", { exact: true })
      .fill(description);
  };
  // Lose the HTTP result after a real successful upload, then retry the exact
  // browser submission ID. This exercises recovery rather than a mocked save.
  let lost = false;
  await coachPage.route("**/api/coach/media", async (route) => {
    if (
      !lost &&
      route.request().method() === "POST" &&
      route.request().headers()["content-type"] === "image/jpeg"
    ) {
      lost = true;
      const result = await route.fetch();
      assert.equal(result.status(), 200);
      await route.fulfill({ status: 503, json: { status: "unavailable" } });
    } else await route.continue();
  });
  await choosePhoto("Partner pad work");
  await editor
    .getByRole("button", { name: "Upload to draft", exact: true })
    .click();
  await expect(
    editor.getByRole("status").filter({ hasText: "couldn’t confirm" }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Upload to draft", exact: true })
    .click();
  await expect(editor.getByText("1 / 6 photos", { exact: true })).toBeVisible();
  await coachPage.unroute("**/api/coach/media");
  const [profile] =
    await database`select public_slug from app.coach_profiles where profile_id=${coach.profileId}::uuid`;
  const slug = profile.public_slug;
  const state = async () =>
    (await (await coachPage.request.get(base + "/api/coach/media")).json())
      .media;
  const initial = await state();
  const first = initial.photos[0];
  assert.equal(initial.photos.length, 1);
  const guest = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const guestPage = await guest.newPage();
  guestPage.on("pageerror", (e) => errors.push(e.message));
  assert.deepEqual(
    (
      await (
        await guest.request.get(base + `/api/coaches/${slug}/media`)
      ).json()
    ).media.photos,
    [],
  );
  assert.equal((await guest.request.get(base + first.fullUrl)).status(), 401);
  assert.equal(
    (await stranger.page.request.get(base + first.fullUrl)).status(),
    403,
  );
  const ownImage = await coachPage.request.get(base + first.fullUrl);
  assert.equal(ownImage.status(), 200);
  const metadata = await sharp(await ownImage.body()).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.width, 1600);
  pass(
    "real normalized private Storage photo and exact retry after lost successful response; unrelated owner/guest denied",
  );

  phase = "publish, replace, reorder and removal isolation";
  await editor
    .getByRole("button", { name: "Publish media", exact: true })
    .click();
  await expect(
    editor.getByText("Training media published.", { exact: true }),
  ).toBeVisible();
  const publicPath = `/api/coaches/${slug}/media/photos/${first.id}/full`;
  const publishedImage = await guest.request.get(base + publicPath);
  assert.equal(publishedImage.status(), 200);
  assert.equal(publishedImage.headers()["cache-control"], "private, no-store");
  for (let n = 2; n <= 6; n++) {
    await choosePhoto(`Training photo ${n}`);
    await editor
      .getByRole("button", { name: "Upload to draft", exact: true })
      .click();
    await expect(
      editor.getByText(`${n} / 6 photos`, { exact: true }),
    ).toBeVisible();
  }
  await expect(
    editor.getByLabel("Training photo file", { exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole("button", { name: "Replace", exact: true })
    .first()
    .click();
  await choosePhoto("Footwork replacement");
  await editor
    .getByRole("button", { name: "Upload to draft", exact: true })
    .click();
  await expect(
    editor.getByRole("button", {
      name: "View photo: Footwork replacement",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal((await guest.request.get(base + publicPath)).status(), 200);
  await editor
    .getByRole("button", {
      name: "Move Footwork replacement later",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await state()).photos[1].alt)
    .toBe("Footwork replacement");
  const stale = await state();
  await editor
    .getByRole("button", { name: "Remove Footwork replacement", exact: true })
    .click();
  await expect(editor.getByText("5 / 6 photos", { exact: true })).toBeVisible();
  assert.equal((await guest.request.get(base + publicPath)).status(), 200);
  const conflict = await coachPage.request.post(base + "/api/coach/media", {
    headers: { origin: base },
    data: { action: "publish", revision: stale.revision },
  });
  assert.equal(conflict.status(), 409);
  await editor
    .getByRole("button", { name: "Discard media changes", exact: true })
    .click();
  await expect(editor.getByText("1 / 6 photos", { exact: true })).toBeVisible();
  await choosePhoto("Training photo 2");
  await editor
    .getByRole("button", { name: "Upload to draft", exact: true })
    .click();
  await expect(editor.getByText("2 / 6 photos", { exact: true })).toBeVisible();
  await editor
    .getByRole("button", { name: "Publish media", exact: true })
    .click();
  await expect(
    editor.getByText("Training media published.", { exact: true }),
  ).toBeVisible();
  pass(
    "six-photo quota, replacement at capacity, reorder, stale conflict, draft-only removal, discard and explicit publication",
  );

  phase = "public desktop/mobile and keyboard lightbox";
  await guestPage.goto(base + `/coaches/${slug}`);
  await expect(
    guestPage.getByRole("link", { name: "About me", exact: true }),
  ).toBeVisible();
  const photoButton = guestPage.getByRole("button", {
    name: "View photo: Partner pad work",
    exact: true,
  });
  await photoButton.focus();
  await guestPage.keyboard.press("Enter");
  const dialog = guestPage.getByRole("dialog", {
    name: "Partner pad work",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(
    guestPage.getByRole("dialog", { name: "Training photo 2", exact: true }),
  ).toBeVisible();
  await guestPage.keyboard.press("Tab");
  assert.equal(
    await guestPage.evaluate(
      () => !!document.activeElement?.closest('dialog,[role="dialog"]'),
    ),
    true,
  );
  await guestPage.keyboard.press("Escape");
  await expect(photoButton).toBeFocused();
  for (const width of [375, 430, 768, 1024, 1440]) {
    await guestPage.setViewportSize({ width, height: 1000 });
    await photoButton.scrollIntoViewIfNeeded();
    assert.equal(
      await guestPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow at ${width}`,
    );
    await guestPage.screenshot({
      path: path.join(output, `public-${width}.png`),
      fullPage: true,
    });
  }
  await coachPage.setViewportSize({ width: 375, height: 900 });
  await editor.scrollIntoViewIfNeeded();
  assert.equal(
    await coachPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await coachPage.screenshot({
    path: path.join(output, "owner-mobile.png"),
    fullPage: true,
  });
  pass(
    "public gallery at 375/430/768/1024/1440 px, owner mobile, keyboard open/focus containment/next/Escape restoration",
  );

  phase = "explicit video UI fixtures (not live Mux proof)";
  const fixture = structuredClone(await state());
  fixture.videoAvailable = true;
  const endpoint = "https://storage.googleapis.com/mov19-browser-fixture";
  let releaseTransfer;
  const transferGate = new Promise((resolve) => {
    releaseTransfer = resolve;
  });
  await coachPage.route("**/api/coach/media", async (route) => {
    if (route.request().method() === "POST") {
      const command = route.request().postDataJSON();
      fixture.uploads =
        command.action === "video"
          ? [
              {
                id: command.id,
                kind: "video",
                status: "uploading",
                description: command.description,
                error: null,
                uploadUrl: endpoint,
              },
            ]
          : [];
    }
    await route.fulfill({
      status: 200,
      json: { status: "ready", media: fixture },
    });
  });
  await coachPage.route(endpoint, async (route) => {
    await transferGate;
    await route
      .fulfill({
        status: 200,
        headers: { "access-control-allow-origin": base },
      })
      .catch(() => {});
  });
  await editor
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  await expect(
    editor.getByLabel("Training video file", { exact: true }),
  ).toBeEnabled();
  await editor
    .getByLabel("Training video file", { exact: true })
    .setInputFiles({
      name: "explicit-ui-fixture.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(2 * 1024 * 1024),
    });
  await editor
    .getByLabel("Video description", { exact: true })
    .fill("Introduction fixture");
  await editor
    .getByRole("button", { name: "Upload to draft", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Pause upload", exact: true })
    .click();
  await expect(
    editor.getByRole("button", { name: "Resume upload", exact: true }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Resume upload", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Cancel upload", exact: true })
    .click();
  releaseTransfer();
  await expect(
    editor.getByRole("button", { name: "Reload media", exact: true }),
  ).toBeEnabled();
  await expect(
    editor.getByRole("button", { name: "Cancel upload", exact: true }),
  ).toHaveCount(0);
  await editor
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  const videoId = "93290000-0000-4000-8000-000000000099";
  fixture.video = {
    id: videoId,
    description: "Introduction fixture",
    duration: 60,
    posterUrl: `/api/coach/media/videos/${videoId}/poster`,
  };
  await coachPage.route(
    `**/api/coach/media/videos/${videoId}/poster`,
    (route) =>
      route.fulfill({ status: 200, contentType: "image/jpeg", body: source }),
  );
  let playbackReads = 0;
  let releasePlayback;
  const delayedPlayback = new Promise((resolve) => {
    releasePlayback = resolve;
  });
  await coachPage.route(
    `**/api/coach/media/videos/${videoId}/playback`,
    async (route) => {
      playbackReads++;
      if (playbackReads === 1) await delayedPlayback;
      await route
        .fulfill({ status: 503, json: { status: "unavailable" } })
        .catch(() => {}); // The first request is deliberately aborted on close.
    },
  );
  await editor
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  const videoButton = editor.getByRole("button", {
    name: "Watch video: Introduction fixture",
    exact: true,
  });
  assert.equal(
    playbackReads,
    0,
    "A profile view must not request playback access",
  );
  assert.equal(await coachPage.locator("mux-player").count(), 0);
  await videoButton.click();
  const videoDialog = coachPage.getByRole("dialog", {
    name: "Meet your coach",
    exact: true,
  });
  await expect(videoDialog.getByRole("status")).toHaveText("Checking video…");
  await expect.poll(() => playbackReads).toBe(1);
  await expect(
    videoDialog.getByRole("button", { name: "Retry video", exact: true }),
  ).toHaveCount(0);
  assert.equal(await videoDialog.locator("mux-player").count(), 0);
  await coachPage.keyboard.press("Escape");
  await expect(videoButton).toBeFocused();
  await videoButton.click();
  await expect(videoDialog.getByRole("alert")).toHaveText(
    "This video is unavailable. Try again to check access.",
  );
  assert.equal(playbackReads, 2);
  releasePlayback();
  await videoDialog
    .getByRole("button", { name: "Retry video", exact: true })
    .click();
  await expect.poll(() => playbackReads).toBe(3);
  await expect(videoDialog.getByRole("alert")).toHaveText(
    "This video is unavailable. Try again to check access.",
  );
  await expect(
    videoDialog.getByRole("button", { name: "Retry video", exact: true }),
  ).toBeVisible();
  await coachPage.keyboard.press("Escape");
  await expect(videoButton).toBeFocused();
  // This isolated SQL/HTTP fixture exercises the real public composition and
  // CSS cascade, without creating or claiming a real provider asset.
  await database.begin(async (tx) => {
    await tx`insert into app.coach_media_assets(id,run_id,profile_id,kind,status,fingerprint,description,mux_upload_id,mux_asset_id,mux_playback_id,duration)
      select ${videoId}::uuid,run_id,profile_id,'video','ready',repeat('f',64),'Introduction fixture','fixtureupload000001','fixtureasset000001','fixtureplayback000001',60
      from app.coach_media_sets where profile_id=${coach.profileId}::uuid`;
    await tx`update app.coach_media_sets set published_video=${videoId}::uuid where profile_id=${coach.profileId}::uuid`;
  });
  const publicPoster = `**/api/coaches/${slug}/media/videos/${videoId}/poster`;
  await guestPage.route(publicPoster, (route) =>
    route.fulfill({ status: 200, contentType: "image/jpeg", body: source }),
  );
  try {
    await guestPage.goto(base + `/coaches/${slug}`);
    for (const width of [375, 430, 768, 1024, 1440]) {
      await guestPage.setViewportSize({ width, height: 1000 });
      const cover = guestPage.getByRole("button", {
        name: "Watch video: Introduction fixture",
        exact: true,
      });
      await cover.scrollIntoViewIfNeeded();
      const box = await cover.boundingBox();
      assert.ok(
        box && box.height >= (width <= 760 ? 260 : 250),
        `collapsed video cover at ${width}`,
      );
      const style = await cover.evaluate((element) => ({
        color: getComputedStyle(element).color,
        background: getComputedStyle(element).backgroundColor,
      }));
      assert.equal(style.color, "rgb(255, 255, 255)");
      assert.equal(style.background, "rgb(38, 60, 49)");
      assert.equal(
        await photoButton.evaluate(
          (element) => getComputedStyle(element).padding,
        ),
        "0px",
      );
      assert.equal(
        await guestPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `video overflow at ${width}`,
      );
      if ([375, 1440].includes(width))
        await guestPage.screenshot({
          path: path.join(output, `public-video-${width}.png`),
          fullPage: true,
        });
    }
    pass(
      "public video cover retains readable size/color and photos retain edge-to-edge previews at 375/430/768/1024/1440 px (explicit provider fixture)",
    );
  } finally {
    await database.begin(async (tx) => {
      await tx`update app.coach_media_sets set published_video=null where profile_id=${coach.profileId}::uuid and published_video=${videoId}::uuid`;
      await tx`delete from app.coach_media_assets where id=${videoId}::uuid and mux_asset_id='fixtureasset000001'`;
    });
    await guestPage.unroute(publicPoster);
  }
  await coachPage.unroute("**/api/coach/media");
  await coachPage.unroute(endpoint);
  await editor
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  await expect(videoButton).toHaveCount(0);
  pass(
    "HTTP video fixtures: real UpChunk pause/resume/cancel, cover-triggered access without preload, close/reopen and explicit error retry, Escape focus (not live Mux)",
  );

  phase = "truthful failed loads and revocation";
  await coachPage.route("**/api/coach/media", (route) =>
    route.fulfill({ status: 503, json: { status: "unavailable" } }),
  );
  await editor
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  await expect(
    editor.getByRole("status").filter({ hasText: "couldn’t confirm" }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", {
      name: "View photo: Partner pad work",
      exact: true,
    }),
  ).toBeVisible();
  await coachPage.unroute("**/api/coach/media");
  await editor
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  await expect(editor.getByText("2 / 6 photos", { exact: true })).toBeVisible();
  await database`update app.coach_applications set status='suspended' where profile_id=${coach.profileId}::uuid`;
  assert.equal((await guest.request.get(base + publicPath)).status(), 404);
  await editor
    .getByRole("button", { name: "Reload media", exact: true })
    .click({ timeout: 3000 })
    .catch(async () => {
      await expect(coachPage.locator(".coach-profile-canvas")).toHaveCount(0);
    });
  await expect(
    coachPage.getByRole("heading", {
      name: /^(Profile editing access changed|Reload your coach profile)$/,
    }),
  ).toBeVisible();
  assert.equal(await coachPage.locator(".coach-profile-canvas").count(), 0);
  pass(
    "failed reload retains last verified gallery; suspension revokes public media bytes and conceals the entire owner canvas",
  );
  assert.deepEqual(errors, []);
  pass(
    "no browser runtime exceptions; live Mux upload/playback intentionally not claimed without configured credentials",
  );
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
    assert.match(project, /^mov19-media-qa-[a-f0-9]{10}$/);
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
