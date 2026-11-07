// MOV-201: actual components in an owned app; no live Auth or database writes.
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
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const root = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), "mov201-profile-links-"));
const evidence = path.join(root, "test-results/connection-profile-links");
const base = "http://127.0.0.1:3199";
const errors = [],
  checks = [];
let server,
  browser,
  log = "";
try {
  await mkdir(evidence, { recursive: true });
  for (const name of [
    "src",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, name), path.join(scratch, name), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  const styles = (await readFile(path.join(root, "src/app/layout.tsx"), "utf8"))
    .split("\n")
    .filter((line) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(line));
  await writeFile(
    path.join(scratch, "src/app/layout.tsx"),
    `${styles.join("\n")}\nimport "@/features/connections/connections.css";\nexport default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body><main style={{padding:24,maxWidth:1200,margin:'auto'}}>{children}</main></body></html>}`,
  );
  await cp(
    path.join(root, "tests/fixtures/connection-profile-links-ui.tsx"),
    path.join(scratch, "src/app/page.tsx"),
  );
  await mkdir(path.join(scratch, "src/app/coaches/test-coach"), {
    recursive: true,
  });
  await writeFile(
    path.join(scratch, "src/app/coaches/test-coach/page.tsx"),
    "export default function Page(){return <h1>Public coach profile fixture</h1>;}",
  );
  await mkdir(path.join(scratch, "public"));
  await writeFile(
    path.join(scratch, "public/fixture-coach.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#604078"/><text x="40" y="48" text-anchor="middle" font-size="24" fill="white">FC</text></svg>',
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|MUX|RESEND|SMTP|CRON_SECRET/.test(
          key,
        ),
    ),
  );
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3199",
    ],
    {
      cwd: scratch,
      env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => {
    log += chunk;
  });
  server.stderr.on("data", (chunk) => {
    log += chunk;
  });
  const deadline = Date.now() + 60_000;
  while (
    !log.includes("Ready") &&
    Date.now() < deadline &&
    server.exitCode === null
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"), "Owned fixture server did not start");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const identity = () =>
    page.getByRole("link", {
      name: "View Fixture Coach’s coach profile",
      exact: true,
    });
  const profile = () =>
    page.getByRole("link", { name: "View coach profile", exact: true });
  async function disconnect() {
    const button = page.getByRole("button", {
      name: "Disconnect",
      exact: true,
    });
    if (await button.count()) {
      await button.click();
      await expect(
        page.getByRole("button", { name: "Stay connected" }),
      ).toBeFocused();
      await page.getByRole("button", { name: "Confirm disconnect" }).click();
    }
    await expect(
      page.getByRole("article", { name: "Fixture Coach · Disconnected" }),
    ).toBeVisible();
    await expect(profile()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Message coach", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "View shared history", exact: true }),
    ).toHaveCount(0);
  }
  for (const width of [1440, 393, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base, { waitUntil: "networkidle", timeout: 90_000 });
    await disconnect();
    await expect(identity()).toHaveAttribute("href", "/coaches/test-coach");
    await identity().focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(identity()).toBeFocused();
    await expect(identity()).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(base + "/coaches/test-coach");
    await expect(
      page.getByRole("heading", { name: "Public coach profile fixture" }),
    ).toBeVisible();
    await page.goto(base);
    await disconnect();
    await identity().locator(".avatar").click();
    await expect(page).toHaveURL(base + "/coaches/test-coach");
    await page.goto(base);
    await disconnect();
    await profile().click();
    await expect(page).toHaveURL(base + "/coaches/test-coach");
    await page.goto(base);
    await disconnect();
    await page
      .getByRole("button", { name: "Toggle public profile fixture" })
      .click();
    await expect(identity()).toHaveCount(0);
    await expect(profile()).toHaveCount(0);
    await expect(page.locator(".coach-connection-card img")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Toggle public profile fixture" })
      .click();
    await expect(identity()).toBeVisible();
    await page
      .getByRole("button", { name: "Simulate unavailable read" })
      .click();
    await expect(identity()).toHaveCount(0);
    await expect(
      page.locator(".coach-connections").getByRole("alert"),
    ).toHaveCount(4);
    await page
      .getByRole("button", {
        name: "Retry previous connection requests",
        exact: true,
      })
      .click();
    await expect(identity()).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(evidence, `disconnected-${width}.png`),
      fullPage: true,
    });
    checks.push(
      `${width}px: disconnect keeps public identity/action navigation, keyboard/avatar clicks, publication and unavailable-read gates, no overflow`,
    );
    console.log("PASS " + checks.at(-1));
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, "validation.json"),
    JSON.stringify(
      {
        checks,
        errors,
        proof:
          "Mounted production components with fictional UI state and a stub profile destination; no live Auth/SQL/UAT proof.",
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 5000);
    });
  }
  await writeFile(path.join(evidence, "next.log"), log).catch(() => {});
  await rm(scratch, { recursive: true, force: true });
}
