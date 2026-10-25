// Real React/MapLibre components in an isolated Next app. No Auth, DB or saved data.
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
import { chromium } from "@playwright/test";

const root = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), "movx-mov99-map-"));
const evidence = path.join(root, "test-results/coach-profile-locations");
const base = "http://127.0.0.1:3188";
let server,
  browser,
  log = "";
const checks = [],
  errors = [],
  measurements = [];
const report = (message) => {
  checks.push(message);
  console.log(`PASS ${message}`);
};
const style = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#f1ebf7" },
    },
  ],
};
try {
  await mkdir(evidence, { recursive: true });
  for (const name of [
    "src",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
  ]) {
    await cp(path.join(root, name), path.join(scratch, name), {
      recursive: true,
    });
  }
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  await mkdir(path.join(scratch, "public/vendor"), { recursive: true });
  await cp(
    path.join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"),
    path.join(scratch, "public/vendor/maplibre-gl-worker.mjs"),
  );
  const imports = (
    await readFile(path.join(root, "src/app/layout.tsx"), "utf8")
  )
    .split("\n")
    .filter((line) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(line));
  await writeFile(
    path.join(scratch, "src/app/layout.tsx"),
    `${imports.join("\n")}\nexport default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }\n`,
  );
  await cp(
    path.join(root, "tests/fixtures/coach-profile-locations-ui.tsx"),
    path.join(scratch, "src/app/page.tsx"),
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|MUX/.test(key),
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
      "3188",
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
  const deadline = Date.now() + 90_000;
  while (
    !log.includes("Ready") &&
    Date.now() < deadline &&
    server.exitCode === null
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"), "Isolated Next fixture failed to start");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("https://tiles.openfreemap.org/styles/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(style),
    }),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(20_000);
  await page.goto(base, { waitUntil: "networkidle", timeout: 90_000 });
  const markers = page.locator("button.location-map-marker");
  await markers.first().waitFor();
  const region = page.locator(".public-coach-locations");
  assert.equal(await region.locator(".coach-section-heading > svg").count(), 0);
  assert.equal(await markers.count(), 1);
  assert.equal(await markers.first().textContent(), "");
  assert.equal(await markers.first().getAttribute("aria-pressed"), "true");
  assert.equal(
    await markers.first().getAttribute("data-marker-color"),
    "#61417b",
  );
  assert.equal(
    await region.locator(".public-coach-location-key svg").count(),
    1,
  );
  assert.equal(
    await region.locator(".public-coach-location-key").textContent(),
    "",
  );
  const single = await markers.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      width: s.width,
      height: s.height,
      padding: s.padding,
      background: s.backgroundColor,
      radius: s.borderRadius,
      shape: getComputedStyle(el, "::before").backgroundColor,
    };
  });
  assert.deepEqual(single, {
    width: "44px",
    height: "44px",
    padding: "0px",
    background: "rgba(0, 0, 0, 0)",
    radius: "0px",
    shape: "rgb(97, 65, 123)",
  });
  await region.screenshot({ path: path.join(evidence, "single-desktop.png") });
  report(
    "Real MapLibre DOM has one compact purple pin, matching list glyph, primary selection and no outside heading icon",
  );

  await page
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("multiple");
  await page.waitForFunction(
    () => document.querySelectorAll("button.location-map-marker").length === 3,
  );
  assert.deepEqual(await markers.allTextContents(), ["1", "2", "3"]);
  const rows = region.locator("li");
  const colors = await markers.evaluateAll((items) =>
    items.map((el) => el.getAttribute("data-marker-color")),
  );
  assert.equal(new Set(colors).size, 3);
  assert.deepEqual(
    colors,
    await rows.evaluateAll((items) =>
      items.map((el) => el.getAttribute("data-location-color")),
    ),
  );
  for (const [index, marker] of (await markers.all()).entries()) {
    const geometry = await marker.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        width: s.width,
        height: s.height,
        padding: s.padding,
        radius: s.borderRadius,
        color: s.color,
      };
    });
    assert.deepEqual(geometry, {
      width: "44px",
      height: "44px",
      padding: "0px",
      radius: "50%",
      color: "rgb(255, 255, 255)",
    });
    const background = await marker.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const keyBackground = await rows
      .nth(index)
      .locator(".public-coach-location-key")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.equal(background, keyBackground);
    assert.notEqual(background, "rgb(255, 255, 255)");
  }
  await markers.nth(1).click();
  assert.equal(await rows.nth(1).getAttribute("data-selected"), "true");
  await rows.nth(2).getByRole("button").focus();
  await page.keyboard.press("Enter");
  assert.equal(await markers.nth(2).getAttribute("aria-pressed"), "true");
  await markers.first().focus();
  await page.keyboard.press("Enter");
  assert.equal(await rows.first().getAttribute("data-selected"), "true");
  const focus = await markers.first().evaluate((el) => ({
    width: getComputedStyle(el).outlineWidth,
    style: getComputedStyle(el).outlineStyle,
  }));
  assert.equal(focus.style, "solid");
  assert.equal(focus.width, "3px");
  await region.screenshot({
    path: path.join(evidence, "multiple-desktop.png"),
  });
  report(
    "Multiple locations keep distinct matching numbered markers and rows; CSS geometry/white contrast, pointer and bidirectional keyboard selection pass",
  );

  await page
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("coincident");
  await page.waitForFunction(() =>
    document.querySelector("[data-coincident-count='2']"),
  );
  const coincident = markers.filter({
    has: page.locator(".location-map-marker-initials"),
  });
  assert.equal(await coincident.count(), 3);
  const offsets = await markers.evaluateAll((items) =>
    items.map((el) => el.getAttribute("data-marker-offset")),
  );
  assert.notEqual(offsets[0], offsets[1]);
  await markers.nth(1).focus();
  await page.keyboard.press("Enter");
  assert.equal(await rows.nth(1).getAttribute("data-selected"), "true");
  report("Coincident locations retain distinct offsets and keyboard selection");

  await page
    .getByRole("checkbox", { name: "Long names and addresses", exact: true })
    .check();
  for (const width of [1440, 1024, 768, 430, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const measurement = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      rows: document.querySelectorAll(".public-coach-locations li").length,
    }));
    assert.ok(measurement.scrollWidth <= width, JSON.stringify(measurement));
    assert.equal(measurement.rows, 3);
    measurements.push(measurement);
    if ([1440, 375, 320].includes(width))
      await region.screenshot({
        path: path.join(evidence, `long-multiple-${width}.png`),
      });
  }
  await page
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("single");
  await markers.first().waitFor();
  await region.screenshot({ path: path.join(evidence, "single-mobile.png") });
  report(
    "Long names/addresses and single/multiple maps remain readable without horizontal overflow at six desktop/tablet/phone widths",
  );

  await page
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("directory");
  await markers.first().waitFor();
  assert.equal(await markers.first().textContent(), "DC");
  await page
    .getByRole("combobox", { name: "Marker presentation", exact: true })
    .selectOption("pin");
  await page.waitForFunction(() =>
    document.querySelector(".location-map-marker-pin[aria-pressed='true']"),
  );
  assert.equal(await markers.first().textContent(), "");
  await page
    .getByRole("combobox", { name: "Marker presentation", exact: true })
    .selectOption("badge");
  await page.waitForFunction(
    () =>
      document.querySelector(".location-map-marker[aria-pressed='true']")
        ?.textContent === "DC",
  );
  report(
    "Default directory initials remain unchanged and presentation-only marker recreation preserves selection",
  );

  const failureContext = await browser.newContext({
    viewport: { width: 375, height: 950 },
  });
  await failureContext.route(
    "https://tiles.openfreemap.org/styles/**",
    (route) => route.abort(),
  );
  const failure = await failureContext.newPage();
  await failure.goto(base, { waitUntil: "networkidle", timeout: 60_000 });
  await failure
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("multiple");
  await failure.getByText("Map unavailable", { exact: true }).waitFor();
  assert.equal(await failure.locator(".public-coach-locations li").count(), 3);
  assert.equal(
    await failure.getByText("Primary base", { exact: true }).isVisible(),
    true,
  );
  assert.equal(
    await failure
      .locator(".public-coach-location-map .lucide-map-pin-off")
      .count(),
    1,
  );
  await failure
    .locator(".public-coach-locations")
    .screenshot({ path: path.join(evidence, "provider-unavailable.png") });
  report(
    "Provider failure keeps all names/addresses and the primary label; failure icon stays inside the map state",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(evidence, "validation.json"),
    JSON.stringify(
      {
        checks,
        measurements,
        errors,
        map: "Actual MapLibre/WebGL with an intercepted deterministic background style; not live tile proof",
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
