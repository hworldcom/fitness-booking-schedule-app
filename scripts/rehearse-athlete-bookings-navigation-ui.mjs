// MOV-202: mounted production Shell/links with fictional Auth/API responses.
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
import { chromium, expect as baseExpect } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 30000 });
const root = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), "mov202-navigation-"));
const evidence = path.join(root, "test-results/athlete-bookings-navigation");
const base = "http://127.0.0.1:3201";
const actor = {
  status: "authorized",
  profile: {
    slug: "fixture",
    displayName: "Fixture Athlete",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "mov202", name: "Isolated navigation fixture" },
  role: "member",
  coachAccessStatus: "not-applied",
};
const checks = [],
  errors = [];
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
    `${styles.join("\n")}\nimport "@/features/training/training.css";\nexport default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}`,
  );
  await cp(
    path.join(root, "tests/fixtures/athlete-bookings-navigation-ui.tsx"),
    path.join(scratch, "src/navigation-fixture.tsx"),
  );
  for (const route of [
    "my-coaches",
    "sessions",
    "sessions/calendar",
    "sessions/routine",
    "sessions/groups",
    "sessions/preview",
    "sessions/20200000-0000-4000-8000-000000000001",
  ]) {
    const dir = path.join(scratch, "src/app", route);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "page.tsx"),
      'export { default } from "@/navigation-fixture";',
    );
  }
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
      "3201",
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
  const deadline = Date.now() + 60000;
  while (
    !log.includes("Ready") &&
    Date.now() < deadline &&
    server.exitCode === null
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"), "Owned fixture server did not start");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1440, 375, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 812 },
    });
    await context.route("**/api/**", (route) => {
      assert.equal(
        route.request().method(),
        "GET",
        "Navigation must not mutate data",
      );
      if (new URL(route.request().url()).pathname === "/api/auth/actor")
        return route.fulfill({ json: actor });
      return route.fulfill({ status: 503, json: { status: "unavailable" } });
    });
    const page = await context.newPage();
    // First-time compilation of the real booking editor can exceed 30 seconds.
    page.setDefaultNavigationTimeout(60000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|server rendered.*match/i.test(message.text())
      )
        errors.push(message.text());
    });
    const mainNav = page.getByRole("navigation", {
      name: width === 1440 ? "Main navigation" : "Mobile navigation",
      exact: true,
    });
    const sectionNav = page.getByRole("navigation", {
      name: "Session type",
      exact: true,
    });
    await page.goto(base + "/my-coaches");
    const bookings = mainNav.getByRole("link", {
      name: "Bookings",
      exact: true,
    });
    await expect(bookings).toBeVisible();
    await bookings.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(bookings).toBeFocused();
    assert.equal(
      await bookings.evaluate(
        (el) =>
          el.matches(":focus-visible") &&
          getComputedStyle(el).outlineStyle !== "none",
      ),
      true,
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(base + "/sessions");
    await expect(
      page.getByRole("heading", { name: "Bookings", exact: true }),
    ).toBeVisible();
    await expect(sectionNav.getByRole("link")).toHaveCount(2);
    await sectionNav
      .getByRole("link", { name: "Group sessions", exact: true })
      .click();
    await expect(page).toHaveURL(base + "/sessions/groups");
    await expect(mainNav.locator('[aria-current="page"]')).toHaveText(
      "Bookings",
    );
    await page.goBack();
    await expect(sectionNav.locator('[aria-current="page"]')).toHaveText(
      "Private sessions",
    );
    await mainNav
      .getByRole("link", { name: "My training", exact: true })
      .click();
    await expect(page).toHaveURL(base + "/sessions/calendar");
    await expect(sectionNav.getByRole("link")).toHaveCount(2);
    await expect(
      sectionNav.getByRole("link", { name: "Private sessions", exact: true }),
    ).toHaveCount(0);
    await sectionNav
      .getByRole("link", { name: "Plan routine", exact: true })
      .click();
    await expect(mainNav.locator('[aria-current="page"]')).toHaveText(
      "My training",
    );
    for (const [route, current] of [
      ["/sessions", "Bookings"],
      ["/sessions/groups", "Bookings"],
      ["/sessions/calendar", "My training"],
      ["/sessions/routine", "My training"],
      ["/sessions/preview", "Bookings"],
    ]) {
      await page.goto(base + route);
      await expect(mainNav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(mainNav.locator('[aria-current="page"]')).toHaveText(
        current,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${route} overflow at ${width}`,
      );
    }
    await page.goto(base + "/sessions");
    await page.getByRole("button", { name: "Show access failure" }).click();
    await expect(
      page.getByRole("heading", {
        name: "We couldn’t verify access right now.",
      }),
    ).toBeVisible();
    await expect(mainNav.locator('[aria-current="page"]')).toHaveText(
      "Bookings",
    );
    await sectionNav
      .getByRole("link", { name: "Group sessions", exact: true })
      .click();
    await expect(page).toHaveURL(base + "/sessions/groups");
    await expect(sectionNav.locator('[aria-current="page"]')).toHaveText(
      "Group sessions",
    );
    await page.screenshot({
      path: path.join(evidence, `bookings-${width}.png`),
      fullPage: true,
    });
    await page.goto(base + "/sessions/20200000-0000-4000-8000-000000000001");
    await expect(mainNav.locator('[aria-current="page"]')).toHaveText(
      "Bookings",
    );
    const back = page.getByRole("link", { name: "← Bookings", exact: true });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(base + "/sessions");
    checks.push(
      `${width}px: direct Bookings, private/group and planning split, one selected destination, keyboard focus/Enter, browser Back, access failure/detail return and no overflow`,
    );
    console.log("PASS " + checks.at(-1));
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, "validation.json"),
    JSON.stringify(
      {
        checks,
        errors,
        proof:
          "Real Shell, navigation and booking editor with fictional Auth/API fixtures. No live Auth/SQL or retained account writes.",
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
