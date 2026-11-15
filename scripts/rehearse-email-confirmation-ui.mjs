// MOV-234: actual confirmation UI with synthetic API/proof fixtures only.
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
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, webkit, devices, expect } from "@playwright/test";

const safari = process.argv.includes("--webkit");
const root = process.cwd(),
  port = safari ? 3211 : 3210,
  base = `http://localhost:${port}`;
const scratch = await mkdtemp(path.join(tmpdir(), "mov234-confirmation-"));
const evidence = path.join(
  root,
  safari
    ? "test-results/email-confirmation-webkit"
    : "test-results/email-confirmation-ui",
);
const checks = [],
  errors = [],
  commands = [],
  proofPostsWithFragment = [];
let server,
  browser,
  activePage,
  log = "";
let proofGate;
let requestResult = { status: "requested", next: "/check-email" };
const contextQuery = "?returnTo=%2Finvitations&intent=coach";
const proof = (type = "signup") =>
  `#flow=${"a".repeat(64)}&token_hash=${"b".repeat(64)}&type=${type}`;
async function wire(context) {
  await context.route("**/api/auth/**", async (route) => {
    const request = route.request(),
      pathname = new URL(request.url()).pathname;
    let body = { status: "signed-out" },
      status = 200;
    if (pathname === "/api/auth/operations") {
      const command = request.postDataJSON();
      commands.push(command);
      if (command.action === "confirm-email")
        proofPostsWithFragment.push(new URL(request.frame().url()).hash !== "");
      if (command.action === "confirm-email" && proofGate) await proofGate;
      body =
        command.action === "confirm-email"
          ? { status: "invalid-proof" }
          : requestResult;
      status =
        body.status === "invalid-proof"
          ? 400
          : body.status === "unavailable"
            ? 503
            : body.status === "rate-limited"
              ? 429
              : 200;
    } else if (pathname === "/api/auth/google") body = { available: false };
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
async function fits(page, width) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.screenshot({
    path: path.join(evidence, `recovery-${width}.png`),
    fullPage: true,
  });
}
async function handoff(requestBrowser, width) {
  const preview = await browser.newContext({
    ...(safari && width < 400 ? devices["iPhone 13"] : {}),
    viewport: { width, height: 900 },
  });
  await wire(preview);
  try {
    const emailPage = await preview.newPage();
    for (const type of ["signup", "recovery"]) {
      const original = base + "/auth/confirm" + contextQuery + proof(type);
      const before = commands.length;
      await emailPage.goto(original, { waitUntil: "commit" });
      await expect(
        emailPage.getByRole("button", { name: "Continue securely" }),
      ).toBeEnabled();
      assert.equal(emailPage.url(), original);
      const receivingPage = await requestBrowser.newPage();
      await receivingPage.goto(emailPage.url(), { waitUntil: "commit" });
      await expect(
        receivingPage.getByRole("button", { name: "Continue securely" }),
      ).toBeEnabled();
      assert.equal(receivingPage.url(), original);
      assert.equal(commands.length, before);
      await receivingPage
        .getByRole("button", { name: "Continue securely" })
        .click();
      await expect(
        receivingPage.getByRole("button", {
          name:
            type === "signup"
              ? "Request confirmation email"
              : "Request password reset email",
        }),
      ).toBeEnabled();
      assert.deepEqual(commands.at(-1), {
        action: "confirm-email",
        flow: "a".repeat(64),
        tokenHash: "b".repeat(64),
        type,
      });
      assert.equal(new URL(receivingPage.url()).hash, "");
      await receivingPage.close();
    }
  } finally {
    await preview.close();
  }
}
try {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "localhost", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
  await mkdir(evidence, { recursive: true });
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
  await rm(path.join(scratch, "src/proxy.ts"));
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
</AuthSessionProvider></body></html>;}`,
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
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-confirmation-fixture",
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
      String(port),
    ],
    { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (chunk) => (log += chunk));
  server.stderr.on("data", (chunk) => (log += chunk));
  for (
    const deadline = Date.now() + 90000;
    !log.includes("Ready") && Date.now() < deadline && server.exitCode === null;
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"));
  // Compile destinations before mounting a browser so dev Fast Refresh cannot
  // replace the page after its private fragment has already been removed.
  for (const route of ["/auth/confirm", "/check-email", "/forgot-password"])
    assert.equal((await fetch(base + route)).status, 200);
  browser = safari
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ channel: "chrome", headless: true });
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const staticPage = await noJs.newPage();
  for (const type of ["signup", "recovery"]) {
    await staticPage.goto(base + "/auth/confirm" + proof(type), {
      waitUntil: "commit",
    });
    await expect(
      staticPage.getByText("Reading your email link…", { exact: true }),
    ).toBeVisible();
    await expect(
      staticPage.getByText("enable JavaScript", { exact: false }),
    ).toBeVisible();
    assert.ok(
      !(await staticPage.locator("body").innerText()).includes("expired"),
    );
  }
  assert.equal(commands.length, 0);
  await noJs.close();
  checks.push(
    "disabled JavaScript: truthful initial state and no automatic send",
  );

  for (const width of [1440, 375, 320]) {
    const context = await browser.newContext({
      ...(safari && width < 400 ? devices["iPhone 13"] : {}),
      viewport: { width, height: 900 },
    });
    context.setDefaultTimeout(20000);
    await wire(context);
    const page = await context.newPage();
    activePage = page;
    page.on("pageerror", (error) => errors.push(error.message));
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const blocker = async (route) => {
      await gate;
      await route.continue();
    };
    await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, blocker);
    const before = commands.length;
    await page.goto(base + "/auth/confirm" + contextQuery + proof(), {
      waitUntil: "commit",
    });
    await expect(
      page.getByText("Reading your email link…", { exact: true }),
    ).toBeVisible();
    assert.ok(!(await page.locator("body").innerText()).includes("expired"));
    assert.equal(commands.length, before);
    release();
    await expect(
      page.getByRole("button", { name: "Continue securely" }),
    ).toBeEnabled();
    await page.unroute(/\/_next\/static\/.*\.js(?:\?|$)/, blocker);
    assert.equal(new URL(page.url()).hash, proof());
    assert.equal(commands.length, before);
    await handoff(context, width);
    await page.getByRole("button", { name: "Continue securely" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Request confirmation email" }),
    ).toBeEnabled();
    await expect(page.locator(".authentication-error")).toBeFocused();
    assert.equal(commands.at(-1).action, "confirm-email");
    const email = page.getByLabel("Email address", { exact: true });
    const request = page.getByRole("button", {
      name: "Request confirmation email",
    });
    const afterProof = commands.length;
    await request.click();
    await expect(page.locator(".authentication-error")).toHaveText(
      "Enter a valid email address.",
    );
    assert.equal(commands.length, afterProof);
    await email.fill("confirmation-fixture@example.test");
    for (const result of [
      { status: "unavailable" },
      { status: "rate-limited", retryAfterSeconds: 60 },
    ]) {
      requestResult = result;
      await request.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".authentication-error")).toContainText(
        result.status === "unavailable" ? "unavailable" : "60 seconds",
      );
      await expect(request).toBeEnabled();
      await expect(email).toHaveValue("confirmation-fixture@example.test");
      await expect(page.locator(".authentication-error")).toBeFocused();
    }
    await fits(page, width);
    requestResult = { status: "requested", next: "/check-email" };
    await request.click();
    await expect(page).toHaveURL(/\/check-email\?/);
    const destination = new URL(page.url());
    assert.equal(destination.searchParams.get("purpose"), "confirmation");
    assert.equal(destination.searchParams.get("returnTo"), "/invitations");
    assert.equal(destination.searchParams.get("intent"), "coach");
    await expect(
      page.getByText("If an email arrives", { exact: false }),
    ).toBeVisible();
    assert.deepEqual(commands.at(-1), {
      action: "resend-confirmation",
      email: "confirmation-fixture@example.test",
      returnTo: "/invitations",
      intent: "coach",
    });
    for (const fragment of ["", "#flow=incomplete&type=signup"]) {
      const count = commands.length;
      await page.goto(base + "/auth/confirm" + contextQuery + fragment, {
        waitUntil: "commit",
      });
      await expect(
        page.getByRole("button", { name: "Request confirmation email" }),
      ).toBeEnabled();
      assert.equal(commands.length, count);
      await expect(
        page.getByRole("link", { name: "Open password reset form" }),
      ).toHaveAttribute("href", "/forgot-password" + contextQuery);
    }
    const beforeRecovery = commands.length;
    await page.goto(base + "/auth/confirm" + contextQuery + proof("recovery"), {
      waitUntil: "commit",
    });
    await expect(
      page.getByRole("button", { name: "Continue securely" }),
    ).toBeEnabled();
    assert.equal(new URL(page.url()).hash, proof("recovery"));
    assert.equal(commands.length, beforeRecovery);
    await page.getByRole("button", { name: "Continue securely" }).click();
    await expect(page.locator(".authentication-error")).toContainText(
      "browser where you requested it",
    );
    await expect(
      page.getByRole("button", { name: "Request password reset email" }),
    ).toBeEnabled();
    await page
      .getByLabel("Email address", { exact: true })
      .fill("confirmation-fixture@example.test");
    await page
      .getByRole("button", { name: "Request password reset email" })
      .click();
    await expect(page).toHaveURL(/purpose=recovery/);
    assert.equal(commands.at(-1).action, "request-recovery");
    await page.goto(base + "/auth/confirm" + contextQuery + proof(), {
      waitUntil: "commit",
    });
    await expect(
      page.getByRole("button", { name: "Continue securely" }),
    ).toBeEnabled();
    const beforeStaleButton = commands.length;
    await page.evaluate((fragment) => {
      const oldButton = [...document.querySelectorAll("button")].find(
        (button) => button.textContent === "Continue securely",
      );
      window.location.hash = fragment;
      oldButton.click();
    }, proof("recovery"));
    await expect.poll(() => new URL(page.url()).hash).toBe(proof("recovery"));
    await expect(
      page.getByRole("button", { name: "Continue securely" }),
    ).toBeEnabled();
    assert.equal(commands.length, beforeStaleButton);
    await page.goto(base + "/auth/confirm" + contextQuery + proof(), {
      waitUntil: "commit",
    });
    await expect(
      page.getByRole("button", { name: "Continue securely" }),
    ).toBeEnabled();
    let releaseProof;
    proofGate = new Promise((resolve) => (releaseProof = resolve));
    const pending = commands.length;
    await page.getByRole("button", { name: "Continue securely" }).click();
    await expect.poll(() => commands.length).toBe(pending + 1);
    await page.evaluate((fragment) => {
      window.location.hash = fragment;
    }, proof("recovery"));
    await expect.poll(() => new URL(page.url()).hash).toBe(proof("recovery"));
    releaseProof();
    proofGate = undefined;
    await expect(
      page.getByRole("button", { name: "Continue securely" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Request confirmation email" }),
    ).toHaveCount(0);
    await expect(page.locator(".authentication-error")).toHaveCount(0);
    assert.equal(commands.length, pending + 1);
    assert.equal(new URL(page.url()).hash, proof("recovery"));
    await page.getByRole("button", { name: "Continue securely" }).click();
    await expect(
      page.getByRole("button", { name: "Request password reset email" }),
    ).toBeEnabled();
    assert.equal(commands.at(-1).type, "recovery");
    assert.equal(new URL(page.url()).hash, "");
    await context.close();
    activePage = undefined;
    checks.push(
      `${width}px: delayed scripts, signup/recovery preview-to-browser handoff, fragment cleanup before explicit POST, confirmation resend, validation, unavailable/rate limits, keyboard, continuation, same-tab recovery and stale-proof fencing`,
    );
  }
  assert.deepEqual(errors, []);
  assert.ok(proofPostsWithFragment.length > 0);
  assert.ok(proofPostsWithFragment.every((present) => !present));
  assert.ok(!log.includes("token_hash="));
  await writeFile(
    path.join(evidence, "results.json"),
    JSON.stringify(
      {
        passed: true,
        engine: safari ? "webkit" : "chromium",
        checks,
        realAuth: false,
        externalEmail: false,
        database: false,
      },
      null,
      2,
    ),
  );
  for (const check of checks) console.log("PASS " + check);
} catch (error) {
  if (activePage) {
    await activePage
      .screenshot({ path: path.join(evidence, "failure.png"), fullPage: true })
      .catch(() => {});
    await writeFile(
      path.join(evidence, "failure.json"),
      JSON.stringify(
        {
          commands,
          error: String(error),
          text: await activePage
            .locator("body")
            .innerText()
            .catch(() => ""),
          errors,
        },
        null,
        2,
      ),
    ).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  if (server) {
    server.kill("SIGTERM");
    if (server.exitCode === null)
      await new Promise((resolve) => server.once("close", resolve));
  }
  await writeFile(path.join(evidence, "server.log"), log).catch(() => {});
  await rm(scratch, { recursive: true, force: true });
}
