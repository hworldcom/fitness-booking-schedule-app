// MOV-16: mounted UI and installed-SDK PKCE protocol proof. No real users or database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const root = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), "mov16-google-"));
const evidence = path.join(root, "test-results/google-authentication");
const base = "http://localhost:3196";
const authOrigin = "http://127.0.0.1:3197";
let available = true;
let authorization;
let exchange;
let server;
let browser;
let log = "";
const errors = [];
const checks = [];
const transport = createServer(async (request, response) => {
  const url = new URL(request.url, authOrigin);
  response.setHeader("content-type", "application/json");
  if (url.pathname === "/auth/v1/settings") {
    response.end(JSON.stringify({ external: { google: available } }));
  } else if (url.pathname === "/auth/v1/authorize") {
    authorization = url;
    const callback = new URL(url.searchParams.get("redirect_to"));
    assert.equal(callback.origin, base);
    callback.searchParams.set("error", "access_denied");
    callback.searchParams.set(
      "error_description",
      "private-fixture-description",
    );
    response.writeHead(302, { location: callback.toString() });
    response.end();
  } else if (url.pathname === "/auth/v1/token") {
    let body = "";
    for await (const chunk of request) body += chunk;
    exchange = JSON.parse(body);
    response.writeHead(400);
    response.end(
      JSON.stringify({ code: "bad_code", message: "Fixture rejection" }),
    );
  } else {
    response.writeHead(404);
    response.end("{}");
  }
});

try {
  await mkdir(evidence, { recursive: true });
  await new Promise((resolve, reject) => {
    transport.once("error", reject);
    transport.listen(3197, "127.0.0.1", resolve);
  });
  for (const file of [
    "src",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
    "next.config.ts",
  ])
    await cp(path.join(root, file), path.join(scratch, file), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  const styles = (await readFile("src/app/layout.tsx", "utf8"))
    .split("\n")
    .filter((line) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(line));
  await writeFile(
    path.join(scratch, "src/app/layout.tsx"),
    `${styles.join("\n")}
import {AuthSessionProvider} from "@/auth/client/session-provider";
import {ActorProvider} from "@/auth/client/actor-provider";
export default function Layout({children}:{children:React.ReactNode}) {
return <html lang="en"><body><AuthSessionProvider initialSession={{status:"signed-out"}}>
<ActorProvider initialActor={{status:"signed-out"}}>{children}</ActorProvider>
</AuthSessionProvider></body></html>;
}`,
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/DATABASE|SUPABASE|MOVX|AUTH|NEXT_PUBLIC|VERCEL|MUX|RESEND|SMTP|NOTIFICATION|CRON_SECRET|GEOAPIFY/.test(
          key,
        ),
    ),
  );
  Object.assign(env, {
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SITE_URL: base,
    NEXT_PUBLIC_SUPABASE_URL: authOrigin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-google-protocol-fixture",
    MOVX_GOOGLE_AUTH_ENABLED: "true",
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
      "3196",
    ],
    {
      cwd: scratch,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (data) => (log += data));
  server.stderr.on("data", (data) => (log += data));
  for (
    const deadline = Date.now() + 90000;
    !log.includes("Ready") && Date.now() < deadline && server.exitCode === null;
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"), "isolated Next app started");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1440, 375, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const url = `${base}/sign-in?returnTo=%2Finvitations&intent=coach`;
    available = false;
    await page.goto(url);
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeDisabled();
    await expect(page.locator('input[name="email"]')).toBeEnabled();
    await expect(
      page.getByText("Google sign-in is currently unavailable.", {
        exact: true,
      }),
    ).toBeVisible();
    available = true;
    await page.reload();
    const google = page.getByRole("button", { name: "Continue with Google" });
    await expect(google).toBeEnabled();
    await google.focus();
    await expect(google).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Google sign-in was cancelled. Try again or use email.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(google).toBeEnabled();
    const destination = new URL(page.url());
    assert.equal(destination.pathname, "/sign-in");
    assert.equal(destination.searchParams.get("returnTo"), "/invitations");
    assert.equal(destination.searchParams.get("intent"), "coach");
    assert.ok(!destination.searchParams.has("error_description"));
    assert.equal(
      authorization.searchParams.get("scopes"),
      "openid email profile",
    );
    assert.equal(authorization.searchParams.get("provider"), "google");
    await expect(
      page.getByRole("link", { name: "Forgot password?" }),
    ).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(evidence, `cancelled-${width}.png`),
      fullPage: true,
    });
    await page.goto(`${base}/register?returnTo=%2Finvitations&intent=coach`);
    await expect(google).toBeEnabled();
    await context.close();
    checks.push(
      `desktop/mobile ${width}: unavailable, enabled, keyboard cancellation, continuation, password recovery, registration and overflow`,
    );
  }

  const context = await browser.newContext();
  const emailName = "sb-127-auth-token-code-verifier";
  await context.addCookies([
    { name: emailName, value: "ordinary-email-verifier", url: base },
  ]);
  const started = await context.request.post(`${base}/auth/google/start`, {
    headers: { origin: base },
    form: { returnTo: "/messages" },
    maxRedirects: 0,
  });
  assert.equal(started.status(), 303);
  const authorize = new URL(started.headers().location);
  const callback = new URL(authorize.searchParams.get("redirect_to"));
  const jar = await context.cookies();
  const verifier = jar.find((cookie) =>
    cookie.name.endsWith("-google-code-verifier"),
  );
  assert.ok(verifier?.httpOnly);
  assert.equal(verifier.sameSite, "Lax");
  assert.ok(verifier.expires * 1000 <= Date.now() + 600_000);
  const stored = verifier.value.startsWith("base64-")
    ? Buffer.from(verifier.value.slice(7), "base64url").toString()
    : verifier.value;
  const rawVerifier = JSON.parse(stored).split("/")[0];
  assert.equal(
    createHash("sha256").update(rawVerifier).digest("base64url"),
    authorize.searchParams.get("code_challenge"),
  );
  callback.searchParams.set("code", "rejected-fixture-code-1234567890");
  const rejected = await context.request.get(callback.toString(), {
    maxRedirects: 0,
  });
  assert.equal(rejected.status(), 303);
  assert.equal(rejected.headers()["cache-control"], "private, no-store");
  assert.equal(rejected.headers()["referrer-policy"], "no-referrer");
  assert.ok(rejected.headers().location.endsWith("&notice=google-failed#"));
  assert.equal(exchange.code_verifier, rawVerifier);
  const after = await context.cookies();
  assert.ok(
    !after.some(
      (cookie) =>
        cookie.name.includes("google-code-verifier") ||
        cookie.name === "movx-google-flow",
    ),
  );
  assert.equal(
    after.find((cookie) => cookie.name === emailName)?.value,
    "ordinary-email-verifier",
  );
  assert.ok(!log.includes("rejected-fixture-code-1234567890"));
  assert.ok(!log.includes("private-fixture-description"));
  await context.close();
  checks.push(
    "installed SDK: distinct HttpOnly PKCE cookie, actual challenge/exchange, failed-proof cleanup, email-verifier preservation, clean redirect and callback log redaction",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, "results.json"),
    JSON.stringify(
      { passed: true, checks, realGoogle: false, database: false },
      null,
      2,
    ),
  );
  for (const check of checks) console.log("PASS " + check);
} finally {
  await browser?.close();
  if (server) {
    server.kill("SIGTERM");
    if (server.exitCode === null)
      await new Promise((resolve) => server.once("close", resolve));
  }
  if (transport.listening)
    await new Promise((resolve) => transport.close(resolve));
  await writeFile(path.join(evidence, "server.log"), log).catch(() => {});
  await rm(scratch, { recursive: true, force: true });
}
