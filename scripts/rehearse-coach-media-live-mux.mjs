// MOV-19: explicit opt-in live Mux rehearsal; real provider assets are created and cleaned by exact IDs.
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import {
  randomUUID,
  randomBytes,
  createHmac,
  createPrivateKey,
  sign,
} from "node:crypto";
import { parseEnv } from "node:util";
import { createServer } from "node:http";
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
      ["--live", "--webpack", "--diagnose-storage"].includes(arg),
    ),
);
assert.ok(
  process.argv.includes("--live"),
  "Live provider calls require the explicit --live flag.",
);
const muxSettings = parseEnv(
  await readFile(path.join(root, ".env.local"), "utf8"),
);
const muxKeys = [
  "MUX_TOKEN_ID",
  "MUX_TOKEN_SECRET",
  "MUX_SIGNING_KEY_ID",
  "MUX_SIGNING_PRIVATE_KEY",
];
const muxEnv = Object.fromEntries(
  muxKeys.map((key) => {
    assert.ok(
      muxSettings[key] && !/[<>]/.test(muxSettings[key]),
      `Missing ${key}`,
    );
    return [key, muxSettings[key]];
  }),
);
const diagnoseStorage = process.argv.includes("--diagnose-storage");
const webpack = process.argv.includes("--webpack");
const tag = randomUUID().replaceAll("-", "").slice(0, 10);
const project = `mov19-live-mux-${tag}`;
const checkout = await mkdtemp(path.join(tmpdir(), `${project}-`));
const output = path.join(root, "test-results/coach-media-live-mux", tag);
const base = "http://localhost:3179";
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
const secrets = Object.values(muxEnv);
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
  muxListener,
  webhookProxy,
  muxLog = "",
  keepRecovery = false,
  browser,
  database,
  started = false,
  serverLog = "",
  phase = "setup";
let retainedBefore;
const webhookDeliveries = [];
const providerFailures = [];
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
async function muxApi(resource, init = {}) {
  assert.ok(
    /^(assets|uploads)(?:\/[a-zA-Z0-9]+)?(?:\/cancel)?$/.test(resource),
  );
  const response = await fetch("https://api.mux.com/video/v1/" + resource, {
    ...init,
    headers: {
      authorization:
        "Basic " +
        Buffer.from(
          muxEnv.MUX_TOKEN_ID + ":" + muxEnv.MUX_TOKEN_SECRET,
        ).toString("base64"),
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    providerFailures.push({
      resource,
      method: init.method ?? "GET",
      status: response.status,
      type: body?.error?.type,
      messages: Array.isArray(body?.error?.messages)
        ? body.error.messages
            .filter((m) => typeof m === "string")
            .map((m) => redact(m).replace(/https?:\/\/[^\s"'<>]+/g, "[URL]"))
        : [],
    });
    throw Error(`Mux ${init.method ?? "GET"} returned ${response.status}`);
  }
  if (
    response.status === 204 ||
    init.method === "DELETE" ||
    resource.endsWith("/cancel")
  )
    return null;
  return (await response.json()).data;
}
async function waitUntil(check, timeout = 30000) {
  const end = Date.now() + timeout;
  do {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 1100));
  } while (Date.now() < end);
  throw Error(`Timed out in ${phase}`);
}
try {
  await mkdir(output, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(output, "recovery.json"),
    JSON.stringify(
      { project, checkout, ports: [55521, 55522, 55524, 3179] },
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
    .replaceAll("5532", "5552")
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
  assert.equal(new URL(api).port, "55521");
  assert.equal(new URL(dbUrl).port, "55522");
  assert.equal(new URL(mail).port, "55524");
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
  // Source-policy checks inspect checked-in configuration, while CLI/build
  // and runtime continue to use only the separate disposable target.
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
  phase = "private CLI webhook forwarding";
  const muxSecret = randomBytes(32).toString("hex");
  secrets.push(muxSecret);
  const muxRoot = path.join(checkout, "private-mux-cli");
  const muxCliEnv = {
    ...cleanEnv,
    XDG_CONFIG_HOME: path.join(muxRoot, "config"),
    XDG_DATA_HOME: path.join(muxRoot, "data"),
    XDG_CACHE_HOME: path.join(muxRoot, "cache"),
  };
  await mkdir(path.join(muxCliEnv.XDG_CONFIG_HOME, "mux"), {
    recursive: true,
    mode: 0o700,
  });
  await mkdir(path.join(muxCliEnv.XDG_DATA_HOME, "mux"), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(
    path.join(muxCliEnv.XDG_CONFIG_HOME, "mux/config.json"),
    JSON.stringify({
      environments: {
        [project]: {
          token: {
            tokenId: muxEnv.MUX_TOKEN_ID,
            tokenSecret: muxEnv.MUX_TOKEN_SECRET,
          },
        },
      },
      defaultEnvironment: project,
    }),
    { mode: 0o600 },
  );
  await writeFile(
    path.join(muxCliEnv.XDG_DATA_HOME, `mux/webhook-signing-secret-${project}`),
    muxSecret,
    { mode: 0o600 },
  );
  appEnv.MUX_WEBHOOK_SECRET = muxSecret;
  Object.assign(appEnv, muxEnv);
  // The CLI's JSON output omits forwarding HTTP statuses and does not retry
  // failed forwards. Observe exact signed forwarding without logging bodies.
  webhookProxy = createServer(async (request, response) => {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 256 * 1024) {
          response.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const event = JSON.parse(body.toString());
      const forwarded = await fetch(base + "/api/webhooks/mux", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "mux-signature": String(request.headers["mux-signature"] ?? ""),
        },
        body,
        signal: AbortSignal.timeout(30000),
      });
      webhookDeliveries.push({
        type: event.type,
        asset: event.data?.id,
        passthrough: event.data?.passthrough,
        status: forwarded.status,
      });
      response.writeHead(forwarded.status).end();
    } catch {
      webhookDeliveries.push({ status: "forward-error" });
      response.writeHead(503).end();
    }
  });
  await new Promise((resolve) => webhookProxy.listen(0, "127.0.0.1", resolve));
  const forwardingOrigin = `http://127.0.0.1:${webhookProxy.address().port}`;
  muxListener = spawn(
    "mux",
    ["webhooks", "listen", "--forward-to", forwardingOrigin, "--json"],
    { cwd: checkout, env: muxCliEnv, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [muxListener.stdout, muxListener.stderr])
    stream.on("data", (data) => {
      muxLog = (muxLog + redact(data.toString())).slice(-100000);
    });
  phase = "production server";
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3179",
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
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
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
        movx_test_ticket: "MOV-19",
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

  phase = "generate temporary video with synthetic speech";
  await command("say", [
    "-o",
    path.join(checkout, "speech.aiff"),
    "This is a temporary MovX coach video. We are testing secure video uploads, captions, and playback. This clip contains no personal information.",
  ]);
  await command("afconvert", [
    "-f",
    "WAVE",
    "-d",
    "LEI16",
    path.join(checkout, "speech.aiff"),
    path.join(checkout, "speech.wav"),
  ]);
  const wave = (await readFile(path.join(checkout, "speech.wav"))).toString(
    "base64",
  );
  const generator = await browser.newPage();
  await generator.setContent("<button>Generate temporary test video</button>");
  await generator.getByRole("button").click();
  async function clips(durations) {
    const encoded = await generator.evaluate(
      async ({ durations, wave, tag }) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d"),
          noise = document.createElement("canvas");
        noise.width = 320;
        noise.height = 180;
        const noiseContext = noise.getContext("2d");
        let tick = 0;
        function paint() {
          const pixels = noiseContext.createImageData(320, 180);
          for (let i = 0; i < pixels.data.length; i += 4) {
            const n = (Math.random() * 255) | 0;
            pixels.data[i] = n;
            pixels.data[i + 1] = (n + tick * 13) % 255;
            pixels.data[i + 2] = 255 - n;
            pixels.data[i + 3] = 255;
          }
          noiseContext.putImageData(pixels, 0, 0);
          ctx.drawImage(noise, 0, 0, 1280, 720);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(60, 250, 1160, 200);
          ctx.fillStyle = "#293f32";
          ctx.font = "40px sans-serif";
          ctx.fillText("MovX temporary video test", 100, 325);
          ctx.font = "25px sans-serif";
          ctx.fillText(tag + " · frame " + tick++, 100, 385);
        }
        paint();
        const timer = setInterval(paint, 1000 / 15);
        const audio = new AudioContext();
        await audio.resume();
        const destination = audio.createMediaStreamDestination();
        const source = audio.createBufferSource();
        source.buffer = await audio.decodeAudioData(
          Uint8Array.from(atob(wave), (c) => c.charCodeAt(0)).buffer,
        );
        source.loop = true;
        source.connect(destination);
        source.start();
        const stream = new MediaStream([
          ...canvas.captureStream(15).getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ]);
        try {
          return await Promise.all(
            durations.map(
              (seconds) =>
                new Promise((resolve) => {
                  const chunks = [];
                  const recorder = new MediaRecorder(stream, {
                    mimeType: "video/webm;codecs=vp8,opus",
                    videoBitsPerSecond: 3000000,
                  });
                  recorder.ondataavailable = (event) => {
                    if (event.data.size) chunks.push(event.data);
                  };
                  recorder.onstop = async () => {
                    const bytes = new Uint8Array(
                      await new Blob(chunks, {
                        type: "video/webm",
                      }).arrayBuffer(),
                    );
                    let text = "";
                    for (let i = 0; i < bytes.length; i += 32768)
                      text += String.fromCharCode(
                        ...bytes.subarray(i, i + 32768),
                      );
                    resolve({ seconds, base64: btoa(text) });
                  };
                  recorder.start(250);
                  setTimeout(() => recorder.stop(), seconds * 1000);
                }),
            ),
          );
        } finally {
          clearInterval(timer);
          stream.getTracks().forEach((track) => track.stop());
          source.stop();
          await audio.close();
        }
      },
      { durations, wave, tag },
    );
    const files = [];
    for (const clip of encoded) {
      const file = path.join(checkout, `fixture-${clip.seconds}.webm`);
      await writeFile(file, Buffer.from(clip.base64, "base64"));
      files.push(file);
    }
    return files;
  }
  const [shortClip] = await clips([8]);
  pass(
    "generated temporary 720p video and synthetic speech without retained user media",
  );
  const coachPage = coach.page;
  await coachPage.goto(base + "/profile/coach");
  const editor = coachPage.locator(".coach-media-editor");
  await expect(
    editor.getByLabel("Training video file", { exact: true }),
  ).toBeEnabled();
  const ownState = async () =>
    (await (await coachPage.request.get(base + "/api/coach/media")).json())
      .media;
  const apiCommand = async (action, extra = {}) => {
    const m = await ownState();
    const response = await coachPage.request.post(base + "/api/coach/media", {
      headers: { origin: base },
      data: { action, revision: m.revision, ...extra },
    });
    assert.equal(response.status(), 200);
    return (await response.json()).media;
  };
  const videoRows = async () =>
    database`select id,status,mux_upload_id,mux_asset_id,mux_playback_id,duration,external_claimed from app.coach_media_assets where kind='video' order by created_at`;
  const choose = async (file, description) => {
    await editor
      .getByLabel("Training video file", { exact: true })
      .setInputFiles(file);
    await editor
      .getByLabel("Video description", { exact: true })
      .fill(description);
    await editor
      .getByRole("button", { name: "Upload to draft", exact: true })
      .click();
  };
  // The UI's immediate refresh response is deliberately lost. Only a real
  // callback can mark this upload ready; no fixture asserts provider state.
  await coachPage.route("**/api/coach/media", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      request.headers()["content-type"] === "application/json" &&
      request.postDataJSON().action === "refresh-video"
    )
      await route.fulfill({ status: 503, json: { status: "unavailable" } });
    else await route.continue();
  });
  phase = "real direct upload and verified Mux callbacks";
  await choose(shortClip, "Temporary coach introduction");
  await waitUntil(async () => {
    if (muxListener.exitCode !== null) throw Error(redact(muxLog));
    return (await videoRows()).some((row) => row.status === "ready");
  }, 180000);
  await coachPage.unroute("**/api/coach/media");
  await editor
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  await expect(
    editor.getByRole("button", {
      name: "Watch video: Temporary coach introduction",
      exact: true,
    }),
  ).toBeVisible();
  const first = (await ownState()).video;
  const firstRow = (await videoRows()).find((row) => row.id === first.id);
  assert.ok(Number(firstRow.duration) > 0 && Number(firstRow.duration) <= 60);
  await waitUntil(
    async () =>
      webhookDeliveries.some(
        (event) =>
          event.passthrough === first.id &&
          event.type === "video.asset.ready" &&
          event.status === 204,
      ),
    30000,
  );
  pass(
    "actual direct upload and real CLI-forwarded verified callback readiness after a lost refresh response",
    { asset: firstRow.mux_asset_id, seconds: Number(firstRow.duration) },
  );

  phase = "real signed public poster/playback and captions";
  const [profile] =
    await database`select public_slug from app.coach_profiles where profile_id=${coach.profileId}::uuid`;
  const slug = profile.public_slug;
  const guest = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const guestPage = await guest.newPage();
  guestPage.on("pageerror", (e) => errors.push(e.message));
  assert.equal(
    (
      await (
        await guest.request.get(base + `/api/coaches/${slug}/media`)
      ).json()
    ).media.video,
    null,
  );
  assert.equal(
    (
      await stranger.page.request.get(
        base + `/api/coach/media/videos/${first.id}/playback`,
      )
    ).status(),
    403,
  );
  await editor
    .getByRole("button", { name: "Publish media", exact: true })
    .click();
  await expect(
    editor.getByText("Training media published.", { exact: true }),
  ).toBeVisible();
  const accessPath = `/api/coaches/${slug}/media/videos/${first.id}/playback`;
  const accessResponse = await guest.request.get(base + accessPath);
  assert.equal(accessResponse.status(), 200);
  const access = await accessResponse.json();
  const manifest = `https://stream.mux.com/${access.playbackId}.m3u8?token=`;
  const fresh = await fetch(manifest + access.token);
  assert.equal(fresh.status, 200);
  assert.match(await fresh.text(), /#EXTM3U/);
  const [header, payload] = access.token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.equal(claims.max_resolution, "720p");
  assert.ok(claims.exp - Date.now() / 1000 <= 300);
  const expiredPayload = Buffer.from(
    JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }),
  ).toString("base64url");
  const pem = muxEnv.MUX_SIGNING_PRIVATE_KEY;
  const privateKey = createPrivateKey(
    pem.includes("BEGIN")
      ? pem.replaceAll("\\n", "\n")
      : Buffer.from(pem, "base64"),
  );
  const expired = `${header}.${expiredPayload}.${sign("RSA-SHA256", Buffer.from(`${header}.${expiredPayload}`), privateKey).toString("base64url")}`;
  assert.equal((await fetch(manifest + expired)).status, 403);
  const poster = await guest.request.get(
    base + `/api/coaches/${slug}/media/videos/${first.id}/poster`,
  );
  assert.equal(poster.status(), 200);
  assert.match(poster.headers()["content-type"], /^image\//);
  await guestPage.goto(base + `/coaches/${slug}`);
  assert.ok(
    (await guestPage.locator(".coach-media-video-cover").boundingBox())
      ?.height >= 250,
    "desktop video cover must retain its readable height",
  );
  await guestPage
    .getByRole("button", {
      name: "Watch video: Temporary coach introduction",
      exact: true,
    })
    .click();
  const playerDialog = guestPage.getByRole("dialog", {
    name: "Meet your coach",
    exact: true,
  });
  assert.equal(await playerDialog.locator("mux-player").count(), 0);
  await playerDialog
    .getByRole("button", { name: "Load video", exact: true })
    .click();
  const player = playerDialog.locator("mux-player");
  await player.waitFor();
  await player.evaluate(async (element) => {
    await element.play();
  });
  await expect
    .poll(() => player.evaluate((element) => element.currentTime), {
      timeout: 30000,
    })
    .toBeGreaterThan(0.2);
  await guestPage.keyboard.press("Escape");
  await expect(
    guestPage.getByRole("button", {
      name: "Watch video: Temporary coach introduction",
      exact: true,
    }),
  ).toBeFocused();
  let track;
  await waitUntil(async () => {
    const asset = await muxApi("assets/" + firstRow.mux_asset_id);
    track = asset.tracks?.find(
      (t) =>
        t.type === "text" &&
        t.text_source === "generated_vod" &&
        t.status === "ready",
    );
    return !!track;
  }, 180000);
  const captions = await fetch(
    `https://stream.mux.com/${access.playbackId}/text/${track.id}.vtt?token=${access.token}`,
  );
  assert.equal(captions.status, 200);
  assert.match(await captions.text(), /WEBVTT/);
  // Signed duplicate and older event types fetch current provider truth.
  const before = (await ownState()).revision;
  for (const type of ["video.asset.ready", "video.asset.created"]) {
    const body = JSON.stringify({
        type,
        data: { id: firstRow.mux_asset_id, passthrough: first.id },
      }),
      t = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", appEnv.MUX_WEBHOOK_SECRET)
      .update(t + "." + body)
      .digest("hex");
    assert.equal(
      (
        await fetch(base + "/api/webhooks/mux", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "mux-signature": `t=${t},v1=${signature}`,
          },
          body,
        })
      ).status,
      204,
    );
  }
  assert.equal((await ownState()).revision, before);
  await guestPage.setViewportSize({ width: 375, height: 850 });
  assert.ok(
    (await guestPage.locator(".coach-media-video-cover").boundingBox())
      ?.height >= 260,
    "mobile video cover must retain its readable height",
  );
  await guestPage.screenshot({
    path: path.join(output, "public-video-mobile.png"),
    fullPage: true,
  });
  pass(
    "actual signed 720p HLS/poster and browser playback, generated captions, expired-token rejection, duplicate/out-of-order callback idempotence and mobile keyboard close",
  );

  phase = "real pending upload cancellation";
  const pendingId = randomUUID();
  await apiCommand("video", {
    id: pendingId,
    description: "Cancelled temporary upload",
  });
  const pending = (await videoRows()).find((row) => row.id === pendingId);
  assert.ok(pending.mux_upload_id);
  await apiCommand("cancel", { id: pendingId });
  assert.equal(
    (await muxApi("uploads/" + pending.mux_upload_id)).status,
    "cancelled",
  );
  assert.equal(
    (
      await (
        await guest.request.get(base + `/api/coaches/${slug}/media`)
      ).json()
    ).media.video.id,
    first.id,
  );
  pass("real pending Mux upload cancellation preserves published video");

  phase = "generate near-limit and over-limit temporary fixtures";
  const [nearClip, longClip] = await clips([59.5, 61]);
  pass("generated near-60-second and over-limit fixtures");
  phase = "real over-limit rejection preserves publication";
  await editor
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  await choose(longClip, "Over-limit temporary video");
  let longRow;
  await waitUntil(async () => {
    longRow = (await videoRows()).find(
      (row) => row.id !== first.id && row.id !== pendingId,
    );
    return longRow?.status === "failed";
  }, 180000);
  assert.equal(
    (
      await (
        await guest.request.get(base + `/api/coaches/${slug}/media`)
      ).json()
    ).media.video.id,
    first.id,
  );
  await waitUntil(
    () =>
      webhookDeliveries.some(
        (event) =>
          event.passthrough === longRow.id &&
          event.type === "video.asset.ready",
      ),
    30000,
  );
  const longDelivery = webhookDeliveries.findLast(
    (event) =>
      event.passthrough === longRow.id && event.type === "video.asset.ready",
  );
  assert.ok([204, 503].includes(longDelivery.status));
  const cleanupStates = [];
  await waitUntil(async () => {
    const current = await apiCommand("cancel", { id: longRow.id });
    const exists = !!(await muxApi("assets/" + longRow.mux_asset_id));
    cleanupStates.push({ pending: current.cleanupPending, exists });
    assert.equal(current.published.video.id, first.id);
    if (exists) {
      assert.equal(
        current.cleanupPending,
        true,
        "failed deletion must retain an honest cleanup queue",
      );
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
    return !exists;
  }, 90000);
  pass(
    "actual provider duration over 60 seconds rejected and exact failed asset deleted; old publication preserved",
    { callbackStatus: longDelivery.status, cleanupStates },
  );

  phase = "real near-limit replacement and exact old-asset cleanup";
  await editor
    .getByRole("button", { name: "Reload media", exact: true })
    .click();
  await choose(nearClip, "Near-limit temporary replacement");
  let replacementRow;
  await waitUntil(async () => {
    replacementRow = (await videoRows()).find(
      (row) => ![first.id, pendingId, longRow.id].includes(row.id),
    );
    return replacementRow?.status === "ready";
  }, 180000);
  assert.ok(
    Number(replacementRow.duration) > 58 &&
      Number(replacementRow.duration) <= 60,
  );
  assert.equal(
    (
      await (
        await guest.request.get(base + `/api/coaches/${slug}/media`)
      ).json()
    ).media.video.id,
    first.id,
  );
  assert.ok(await muxApi("assets/" + firstRow.mux_asset_id));
  await apiCommand("publish");
  await waitUntil(
    async () => !(await muxApi("assets/" + firstRow.mux_asset_id)),
    30000,
  );
  assert.equal(
    (
      await (
        await guest.request.get(base + `/api/coaches/${slug}/media`)
      ).json()
    ).media.video.id,
    replacementRow.id,
  );
  await database`update app.coach_profiles set visibility='hidden' where profile_id=${coach.profileId}::uuid`;
  assert.equal(
    (
      await guest.request.get(
        base +
          `/api/coaches/${slug}/media/videos/${replacementRow.id}/playback`,
      )
    ).status(),
    404,
  );
  assert.deepEqual(errors, []);
  pass(
    "actual near-60-second replacement preserves prior asset until publication, deletes only the old asset, and hiding denies new tokens",
    { seconds: Number(replacementRow.duration) },
  );
} catch (error) {
  console.error(redact(`FAIL ${phase}: ${error.stack ?? error}`));
  process.exitCode = 1;
  await writeFile(
    path.join(output, "failure.txt"),
    redact(`${phase}\n${error.stack ?? error}`),
  );
  if (browser) {
    let n = 0;
    for (const context of browser.contexts())
      for (const page of context.pages())
        await page
          .screenshot({
            path: path.join(output, `failure-${n++}.png`),
            fullPage: true,
          })
          .catch(() => {});
  }
} finally {
  await browser?.close();
  if (database) {
    try {
      const assets =
        await database`select id,status,mux_upload_id,mux_asset_id,external_claimed from app.coach_media_assets where kind='video'`;
      await writeFile(
        path.join(output, "provider-references.json"),
        JSON.stringify(assets, null, 2),
        { mode: 0o600 },
      );
      for (const asset of assets) {
        let providerId = asset.mux_asset_id;
        if (!providerId && asset.mux_upload_id) {
          const upload = await muxApi("uploads/" + asset.mux_upload_id);
          if (upload?.asset_id) providerId = upload.asset_id;
          else if (upload?.status === "waiting")
            await muxApi("uploads/" + asset.mux_upload_id + "/cancel", {
              method: "PUT",
            });
        }
        if (providerId) {
          const actual = await muxApi("assets/" + providerId);
          if (actual) {
            assert.equal(actual.passthrough, asset.id);
            assert.equal(actual.upload_id, asset.mux_upload_id);
            await waitUntil(async () => {
              try {
                await muxApi("assets/" + providerId, { method: "DELETE" });
              } catch {
                await new Promise((resolve) => setTimeout(resolve, 4000));
                return false;
              }
              return !(await muxApi("assets/" + providerId));
            }, 90000);
          }
          assert.equal(await muxApi("assets/" + providerId), null);
        } else if (!asset.mux_upload_id && asset.external_claimed)
          throw Error(
            "An external creation outcome is unknown; retain exact recovery records.",
          );
      }
      pass(
        "all exact test Mux assets removed or already absent; incomplete waiting uploads cancelled",
      );
    } catch (error) {
      keepRecovery = true;
      process.exitCode = 1;
      console.error(redact("Provider cleanup incomplete: " + error.message));
    }
  }
  for (const child of [muxListener, server])
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  await database?.end({ timeout: 1 });
  if (webhookProxy) await new Promise((resolve) => webhookProxy.close(resolve));
  await writeFile(
    path.join(output, "webhook-deliveries.json"),
    JSON.stringify(webhookDeliveries, null, 2),
  );
  await writeFile(
    path.join(output, "provider-failures.json"),
    JSON.stringify(providerFailures, null, 2),
    { mode: 0o600 },
  );
  await writeFile(path.join(output, "server.log"), redact(serverLog));
  await rm(path.join(checkout, "private-mux-cli"), {
    recursive: true,
    force: true,
  });
  if (started && !keepRecovery) {
    assert.match(project, /^mov19-live-mux-[a-f0-9]{10}$/);
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
      keepRecovery = true;
      process.exitCode = 1;
      console.error(redact(error.message));
    }
  }
  if (retainedBefore !== undefined) {
    try {
      assert.equal(retainedFingerprint(), retainedBefore);
      pass("retained application/Auth-user/Storage row hashes unchanged");
    } catch (error) {
      process.exitCode = 1;
      console.error(redact(error.message));
    }
  }
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      { phase, success: process.exitCode !== 1, keepRecovery, results },
      null,
      2,
    ),
  );
  if (!keepRecovery) await rm(checkout, { recursive: true, force: true });
  console.log(`Evidence: ${output}`);
  if (keepRecovery)
    console.log(
      "The exact isolated stack is retained for recovery; consult recovery.json. Real Mux credentials were removed from the temporary CLI config.",
    );
}
