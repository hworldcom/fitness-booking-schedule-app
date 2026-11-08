// MOV-215/MOV-216: real Shell/view preference with owned loopback Auth/API fixtures.
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
import { createServer } from "node:net";
import { chromium, expect as baseExpect } from "@playwright/test";

const publicMobileOnly = process.argv.includes("--public-mobile");
const expect = baseExpect.configure({ timeout: 20000 });
const root = process.cwd(),
  port = 3201,
  base = `http://127.0.0.1:${port}`;
const output = path.join(root, "test-results/workspace-view-switch");
const scratch = await mkdtemp(path.join(tmpdir(), "mov215-view-switch-"));
const checks = [],
  errors = [],
  writes = [];
let server,
  browser,
  log = "",
  success = false;
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
async function put(file, text) {
  const target = path.join(scratch, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
}

async function publicMobileChecks(browser) {
  const context = await browser.newContext();
  await context.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") {
      writes.push(route.request().url());
      return route.abort();
    }
    if (new URL(route.request().url()).pathname.startsWith("/api/auth/"))
      return route.continue();
    return route.fulfill({ status: 503, json: { status: "unavailable" } });
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|server rendered.*match/i.test(message.text())
    )
      errors.push(message.text());
  });
  const cookie = (kind) =>
    context.addCookies([{ name: "mov215-actor", value: kind, url: base }]);
  const open = (href) => page.goto(base + href, { waitUntil: "networkidle" });
  const nav = () =>
    page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  const refresh = () =>
    page
      .getByRole("button", { name: "Refresh fixture account", exact: true })
      .click();
  const allRoutes = [
    "/",
    "/explore",
    "/events",
    "/events/fixture",
    "/coaches/fixture",
    "/@fixture_coach",
    "/how-it-works",
    "/privacy",
  ];
  await cookie("approved");
  for (const width of [1440, 768, 760, 430, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    const routes =
      width === 320
        ? allRoutes
        : width === 375
          ? ["/", "/explore", "/@fixture_coach"]
          : ["/", "/explore"];
    for (const href of routes) {
      await open(href);
      await expect(page.locator(".sidebar")).toHaveCount(0);
      if (width > 760) {
        await expect(nav()).toHaveCount(0);
        await expect(page.locator(".mobile-nav")).toBeHidden();
        continue;
      }
      await expect(nav()).toBeVisible();
      await expect(
        nav().getByRole("link", { name: "My training", exact: true }),
      ).toHaveAttribute("href", "/sessions/calendar");
      await expect(nav().getByRole("link").last()).toHaveText(
        "Switch to coach view",
      );
      await expect(nav().locator('[aria-current="page"]')).toHaveCount(
        href === "/" ? 1 : 0,
      );
      if (href === "/")
        await expect(nav().locator('[aria-current="page"]')).toHaveText("Home");
      assert.equal(
        await nav().evaluate((el) => getComputedStyle(el).position),
        "fixed",
      );
      for (const link of await nav().getByRole("link").all())
        assert.ok((await link.boundingBox()).height >= 44);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${href} overflow`,
      );
      await page.evaluate(() =>
        scrollTo(0, document.documentElement.scrollHeight),
      );
      const bar = await nav().boundingBox(),
        footer = await page.locator(".footer-demo-info").boundingBox(),
        action = await page
          .getByRole("button", { name: "End of content action", exact: true })
          .boundingBox();
      assert.ok(
        footer && footer.y + footer.height < bar.y,
        `${width} ${href} footer clearance`,
      );
      assert.ok(
        action && action.y + action.height < bar.y,
        `${width} ${href} action clearance`,
      );
      await expect(nav()).toBeVisible();
      if (href === "/")
        await page.screenshot({
          path: path.join(output, `${width}-public-bottom-athlete.png`),
        });
    }
    record(
      `${width}px public browsing header/no sidebar, signed-in bottom bar policy, Home/current,44px/no overflow/footer clearance`,
    );
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await open("/sessions/calendar");
  await nav().getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(base + "/");
  await nav().getByRole("link", { name: "Bookings", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(base + "/sessions");
  await open("/coach");
  await nav().getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(base + "/");
  await expect(
    nav().getByRole("link", { name: "Calendar", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    nav().getByRole("link", { name: "Calendar", exact: true }),
  ).toBeVisible();
  await open("/explore");
  await expect(
    nav().getByRole("link", { name: "Calendar", exact: true }),
  ).toHaveAttribute("href", "/coach");
  await expect(nav().getByRole("link").last()).toHaveText(
    "Switch to athlete view",
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: path.join(output, "375-public-bottom-coach.png"),
  });
  await page.setViewportSize({ width: 320, height: 812 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "320px public coach-mode header and bottom navigation fit",
  );
  await page.screenshot({
    path: path.join(output, "320-public-bottom-coach.png"),
  });
  await nav().getByRole("link").last().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(base + "/sessions/calendar");
  record(
    "public mobile workspace handoff, keyboard links,375/320px coach preference/reload and separated view switch",
  );
  for (const status of [
    "not-applied",
    "pending",
    "rejected",
    "demo",
    "suspended",
  ]) {
    await cookie(status);
    await open("/");
    await expect(nav()).toBeVisible();
    await expect(
      nav().getByRole("link", { name: "My training", exact: true }),
    ).toBeVisible();
    await expect(nav().getByRole("link", { name: /^Switch to/ })).toHaveCount(
      ["demo", "suspended"].includes(status) ? 1 : 0,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  for (const status of ["preview", "signed-out", "unavailable", "forbidden"]) {
    await cookie(status);
    await open("/");
    await expect(page.locator(".mobile-nav")).toHaveCount(0);
  }
  record(
    "mobile website eligibility retains athlete capability and hides the bar for guests/unavailable actors",
  );
  await cookie("approved");
  for (const route of [
    "/sign-in",
    "/register",
    "/check-email",
    "/forgot-password",
    "/reset-password",
    "/complete-profile",
    "/profile",
    "/profile/coach",
    "/account",
    "/messages",
  ]) {
    await open(route);
    await expect(page.locator(".mobile-nav")).toHaveCount(0);
  }
  record(
    "mobile Auth/enrollment/recovery and independent Profile/Account/Messages keep their existing framing",
  );
  for (const kind of ["other", "dataset"]) {
    await cookie("approved");
    await open("/coach");
    await open("/");
    await expect(
      nav().getByRole("link", { name: "Calendar", exact: true }),
    ).toBeVisible();
    await cookie(kind);
    await refresh();
    await expect(page.locator("[data-fixture-state]")).toHaveAttribute(
      "data-fixture-state",
      new RegExp(
        kind === "other"
          ? '"slug":"switch-other"'
          : '"slug":"switch-other-run"',
      ),
    );
    await expect(
      nav().getByRole("link", { name: "My training", exact: true }),
    ).toBeVisible();
    await expect(
      nav().getByRole("link", { name: "Calendar", exact: true }),
    ).toHaveCount(0);
  }
  await cookie("unavailable");
  await refresh();
  await expect(page.locator(".mobile-nav")).toHaveCount(0);
  await cookie("approved");
  await refresh();
  await expect(nav()).toBeVisible();
  await cookie("signed-out");
  await refresh();
  await expect(page.locator(".mobile-nav")).toHaveCount(0);
  record(
    "public mobile account/dataset preference isolation, verification and sign-out clear former navigation",
  );
  await context.close();
}
try {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, "recovery.json"),
    JSON.stringify({ scratch, port, owned: true }),
  );
  for (const item of [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
    "next.config.ts",
  ])
    await cp(path.join(root, item), path.join(scratch, item), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  await put(
    "src/tests-fixtures/workspace-switch-auth.ts",
    `
    import{cookies}from"next/headers";
    export async function initialAuthorizationState(){const jar=await cookies(),kind=jar.get("mov215-actor")?.value??"approved";
      const subject=kind==="other"?"22222222-2222-4222-8222-222222222222":"11111111-1111-4111-8111-111111111111";
      const session=kind==="signed-out"?{status:"signed-out" as const}:kind==="preview"?{status:"disabled" as const}:{status:"signed-in" as const,subject,email:"fixture@example.invalid",expiresAt:null};
      if(["signed-out","preview","unavailable","forbidden"].includes(kind))return{session,actor:{status:kind}};
      return{session,actor:{status:"authorized" as const,profile:{slug:kind==="other"?"switch-other":"switch-coach",displayName:"Switch Fixture",avatarUrl:null,coachPortraitUrl:null},demoRun:{slug:kind==="dataset"?"switch-other-run":"switch-run",name:"Owned switch fixture"},role:"member" as const,coachAccessStatus:["demo","suspended","not-applied","pending","rejected"].includes(kind)?kind:"approved"}};
    }
    export async function currentActorSnapshot(){return(await initialAuthorizationState()).actor;}
  `,
  );
  const layout = await readFile(path.join(root, "src/app/layout.tsx"), "utf8");
  await put(
    "src/app/layout.tsx",
    layout.replace(
      'from "@/server/authorization/service"',
      'from "@/tests-fixtures/workspace-switch-auth"',
    ),
  );
  await put(
    "src/app/api/auth/actor/route.ts",
    `import{currentActorSnapshot}from"@/tests-fixtures/workspace-switch-auth";export async function GET(){return Response.json(await currentActorSnapshot(),{headers:{"Cache-Control":"private, no-store"}})}`,
  );
  await put(
    "src/app/api/auth/session/route.ts",
    `import{initialAuthorizationState}from"@/tests-fixtures/workspace-switch-auth";export async function GET(){return Response.json((await initialAuthorizationState()).session,{headers:{"Cache-Control":"private, no-store"}})}`,
  );
  await cp(
    path.join(root, "tests/fixtures/workspace-view-switch-ui.tsx"),
    path.join(scratch, "src/tests-fixtures/workspace-switch-page.tsx"),
  );
  for (const route of [
    "coach",
    "coach/athletes",
    "sessions",
    "sessions/calendar",
    "my-coaches",
    "explore",
    "profile",
    "profile/coach",
    "account",
    "messages",
    "",
    "events",
    "events/fixture",
    "coaches/fixture",
    "[handle]",
    "how-it-works",
    "privacy",
    "sign-in",
    "register",
    "check-email",
    "forgot-password",
    "reset-password",
    "complete-profile",
  ])
    await put(
      `src/app/${route}/page.tsx`,
      'export {default} from "@/tests-fixtures/workspace-switch-page";',
    );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|MUX|RESEND|SMTP|CRON_SECRET|NOTIFICATION/.test(
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
      String(port),
    ],
    {
      cwd: scratch,
      env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => {
      log += chunk;
    });
  const deadline = Date.now() + 60000;
  while (
    !log.includes("Ready") &&
    Date.now() < deadline &&
    server.exitCode === null
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"), "Owned server did not start");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  await context.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() !== "GET") {
      writes.push(url.pathname);
      return route.abort();
    }
    if (url.pathname.startsWith("/api/auth/")) return route.continue();
    return route.fulfill({ status: 503, json: { status: "unavailable" } });
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|server rendered.*match/i.test(message.text())
    )
      errors.push(message.text());
  });
  const cookie = (kind) =>
    context.addCookies([{ name: "mov215-actor", value: kind, url: base }]);
  const open = (href) => page.goto(base + href, { waitUntil: "networkidle" });
  const refresh = () =>
    page
      .getByRole("button", { name: "Refresh fixture account", exact: true })
      .click();
  if (!publicMobileOnly) {
    for (const width of [1440, 768, 760, 430, 375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await cookie("approved");
      await open("/my-coaches");
      const nav = page.getByRole("navigation", {
        name: width > 760 ? "Main navigation" : "Mobile navigation",
        exact: true,
      });
      for (const [label, href] of [
        ["coach", "/coach"],
        ["athlete", "/sessions/calendar"],
      ]) {
        const link = nav.getByRole("link", {
          name: `Switch to ${label} view`,
          exact: true,
        });
        await expect(link).toBeVisible();
        await expect(nav.getByRole("link").last()).toHaveText(
          `Switch to ${label} view`,
        );
        assert.equal(await link.getAttribute("aria-current"), null);
        await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
        const line = await nav.getByRole("separator").boundingBox(),
          box = await link.boundingBox();
        assert.ok(
          line && box && line.width > 100 && line.height <= 2 && line.y < box.y,
        );
        assert.ok(box.height >= 44);
        await link.focus();
        assert.ok(
          await link.evaluate(
            (el) =>
              el.matches(":focus-visible") &&
              getComputedStyle(el).outlineStyle !== "none",
          ),
        );
        await page.screenshot({
          path: path.join(output, `${width}-switch-${label}.png`),
        });
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(base + href);
      }
      await page.reload();
      await expect(nav.getByRole("link").last()).toHaveText(
        "Switch to coach view",
      );
      await page.goBack();
      await expect(nav.getByRole("link").last()).toHaveText(
        "Switch to athlete view",
      );
      await page.goForward();
      await expect(nav.getByRole("link").last()).toHaveText(
        "Switch to coach view",
      );
      await page
        .getByRole("button", { name: "Show content failure", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "We couldn’t verify access right now.",
          exact: true,
        }),
      ).toBeVisible();
      await expect(nav.getByRole("link").last()).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (width <= 760) {
        assert.equal(
          await nav.evaluate((el) => getComputedStyle(el).position),
          "fixed",
        );
        const navBox = await nav.boundingBox();
        assert.ok(
          await page
            .locator(".availability-savebar")
            .evaluate(
              (el, height) =>
                parseFloat(getComputedStyle(el).bottom) >= height + 8,
              navBox.height,
            ),
        );
        await page.evaluate(() =>
          scrollTo(0, document.documentElement.scrollHeight),
        );
        const footer = await page
          .locator("footer .footer-contact")
          .first()
          .boundingBox();
        assert.ok(
          footer && footer.y + footer.height < navBox.y,
          "Footer remains above mobile nav",
        );
        await expect(nav.getByRole("link").last()).toBeVisible();
      }
      record(
        `${width}px last switch/separator,44px/focus/keyboard round trip,history/reload,content failure,overflow and mobile clearance`,
      );
    }
    await page.setViewportSize({ width: 1440, height: 400 });
    await open("/coach");
    const desktop = page.getByRole("navigation", {
      name: "Main navigation",
      exact: true,
    });
    await desktop.getByRole("link").last().focus();
    const shortBox = await desktop.getByRole("link").last().boundingBox();
    assert.ok(shortBox.y >= 0 && shortBox.y + shortBox.height <= 400);
    record(
      "short desktop sidebar scrolls the final keyboard control into view",
    );
    for (const status of [
      "not-applied",
      "pending",
      "rejected",
      "preview",
      "signed-out",
      "unavailable",
      "forbidden",
      "demo",
      "suspended",
    ]) {
      await cookie(status);
      await open("/my-coaches");
      const nav = page.getByRole("navigation", {
        name: "Main navigation",
        exact: true,
      });
      await expect(nav.getByRole("link", { name: /^Switch to/ })).toHaveCount(
        ["demo", "suspended"].includes(status) ? 1 : 0,
      );
      if (["demo", "suspended"].includes(status)) {
        await nav
          .getByRole("link", { name: "Switch to coach view", exact: true })
          .click();
        await expect(page).toHaveURL(base + "/coach");
      }
    }
    record(
      "ordinary/applicant/unauthorized/unavailable states omit the switch; demo/suspended retain existing destinations",
    );
    await cookie("approved");
    await open("/coach");
    await page.goto(base + "/explore");
    await expect(
      page.getByRole("navigation", { name: "Main navigation", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation", exact: true }),
    ).toHaveCount(0);
    for (const kind of ["other", "dataset"]) {
      await cookie("approved");
      await open("/coach");
      await open("/explore");
      await cookie(kind);
      await refresh();
      await expect(page.locator("[data-fixture-state]")).toHaveAttribute(
        "data-fixture-state",
        new RegExp(
          kind === "other"
            ? '"slug":"switch-other"'
            : '"slug":"switch-other-run"',
        ),
      );
      await page
        .getByRole("button", {
          name: "Account menu for Switch Fixture",
          exact: true,
        })
        .click();
      await expect(
        page
          .locator(".account-menu-panel")
          .getByRole("link", { name: "Switch to coach view", exact: true }),
      ).toBeVisible();
    }
    await cookie("approved");
    await open("/my-coaches");
    await cookie("unavailable");
    await refresh();
    await expect(desktop.getByRole("link", { name: /^Switch to/ })).toHaveCount(
      0,
    );
    await cookie("approved");
    await refresh();
    await expect(
      desktop.getByRole("link", { name: "Switch to coach view", exact: true }),
    ).toBeVisible();
    await cookie("signed-out");
    await refresh();
    await expect(desktop.getByRole("link", { name: /^Switch to/ })).toHaveCount(
      0,
    );
    record(
      "account/dataset preference isolation and live verification/sign-out remove stale switching controls",
    );
    await cookie("approved");
    for (const route of ["/profile", "/account", "/messages"]) {
      await open(route);
      await expect(page.locator(".workspace-view-switch")).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: "Account menu for Switch Fixture",
          exact: true,
        }),
      ).toBeVisible();
    }
    await open("/profile");
    await page
      .getByRole("button", {
        name: "Account menu for Switch Fixture",
        exact: true,
      })
      .click();
    await page
      .locator(".account-menu-panel")
      .getByRole("link", { name: "Switch to coach view", exact: true })
      .click();
    await expect(page).toHaveURL(base + "/profile/coach");
    record(
      "public desktop and standalone framings stay independent; the existing dropdown retains Profile switching",
    );
    await context.addInitScript(() =>
      Object.defineProperty(window, "sessionStorage", {
        get() {
          throw new Error("Fixture storage unavailable");
        },
      }),
    );
    await open("/my-coaches");
    await desktop
      .getByRole("link", { name: "Switch to coach view", exact: true })
      .click();
    await expect(page).toHaveURL(base + "/coach");
    await desktop
      .getByRole("link", { name: "Switch to athlete view", exact: true })
      .click();
    await expect(page).toHaveURL(base + "/sessions/calendar");
    record("explicit switching works when session storage is unavailable");
  }
  await context.close();
  await publicMobileChecks(browser);
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  success = true;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    const closed = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await closed;
  }
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "server.log"), log);
  await rm(scratch, { recursive: true, force: true });
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        success,
        checks,
        errors,
        writes,
        ownedCheckoutRemoved: true,
        noRealAuthSqlOrEmail: true,
      },
      null,
      2,
    ),
  );
}
