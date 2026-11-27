// MOV-281/MOV-285/MOV-286: real Explore/Shell/MapLibre with fictional public and identity adapters.
// Owned source only, no environment files, Auth accounts, databases or retained writes.
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
import { chromium, webkit, expect } from "@playwright/test";
expect.configure({ timeout: 15_000 });
const touch =
  process.argv.includes("--mobile-touch") ||
  process.argv.includes("--webkit-touch");
const safari = process.argv.includes("--webkit-touch");
const root = process.cwd(),
  scratch = await mkdtemp(path.join(tmpdir(), "mov281-explore-"));
const evidence = path.join(
    root,
    `test-results/explore-discovery-ui${safari ? "-webkit-touch" : touch ? "-chrome-touch" : ""}`,
  ),
  base = "http://127.0.0.1:3212";
const checks = [],
  errors = [];
let server,
  browser,
  page,
  log = "",
  passed = false;
const report = (text) => {
  checks.push(text);
  console.log(`PASS ${text}`);
};
const style = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#f3eef9" },
    },
  ],
};
const actor = (value) => ({
  status: "authorized",
  profile: {
    slug: `fixture-${value}`,
    displayName: `Fixture ${value}`,
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "explore-fixture", name: "Explore fixture" },
  role: "member",
  coachAccessStatus: "not-applied",
});
try {
  await mkdir(evidence, { recursive: true });
  for (const name of [
    "src",
    "tests/fixtures",
    "public",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, name), path.join(scratch, name), {
      recursive: true,
    });
  const imports = (
    await readFile(path.join(root, "src/app/layout.tsx"), "utf8")
  )
    .split("\n")
    .filter((line) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(line));
  const css = new Map();
  for (const name of [
    "globals.css",
    "club-theme.css",
    "authenticated-workspace.css",
    "client-sessions-workspace.css",
    "workspace-section-navigation.css",
    "my-sessions-navigation.css",
    "coming-soon.css",
    "coach-story.css",
    "coach-discovery.css",
    "coach-workspace.css",
    "account-menu.css",
    "notifications.css",
    "account-settings.css",
    "authentication.css",
    "public-marketplace-accessibility.css",
    "coach-directory-cards.css",
    "public-page-theme.css",
    "explore-discovery.css",
  ])
    css.set(name, await readFile(path.join(scratch, "src/app", name)));
  await rm(path.join(scratch, "src/app"), { recursive: true });
  await mkdir(path.join(scratch, "src/app/explore"), { recursive: true });
  for (const [name, content] of css)
    await writeFile(path.join(scratch, "src/app", name), content);
  await writeFile(
    path.join(scratch, "src/app/layout.tsx"),
    `${imports.join("\n")}\nexport default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}`,
  );
  await writeFile(
    path.join(scratch, "src/app/explore/page.tsx"),
    `import {ExploreDiscoveryFixture} from '../../../tests/fixtures/explore-discovery-ui';import {normalizeCoachExploreFilters,canonicalCoachExploreView,coachDirectoryHref,isCanonicalCoachDirectorySearch} from '@/features/coaches/marketplace-search-contract';import {redirect} from 'next/navigation';export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const raw=await searchParams,filters=normalizeCoachExploreFilters(raw),view=canonicalCoachExploreView(raw);if(!isCanonicalCoachDirectorySearch(raw,filters,view))redirect(coachDirectoryHref(filters,{},view));return <ExploreDiscoveryFixture filters={filters} view={view}/>;}`,
  );
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
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|MUX|RESEND|SMTP|CRON|OPENAI_API_KEY/.test(
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
      "3212",
    ],
    {
      cwd: scratch,
      env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (value) => {
    log += value;
  });
  server.stderr.on("data", (value) => {
    log += value;
  });
  const deadline = Date.now() + 90_000;
  while (
    !log.includes("Ready") &&
    Date.now() < deadline &&
    server.exitCode === null
  )
    await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(log.includes("Ready"), "Isolated Explore app did not start");
  browser = await (safari
    ? webkit.launch({ headless: true })
    : chromium.launch({ channel: "chrome", headless: true }));
  let viewer = "a",
    failMap = false,
    failAddress = false;
  let addressReads = 0;
  const context = await browser.newContext({
    viewport: { width: touch ? 390 : 1440, height: touch ? 844 : 1000 },
    ...(touch ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}),
    geolocation: { latitude: 52.51, longitude: 13.45, accuracy: 120 },
    permissions: ["geolocation"],
  });
  await context.addInitScript(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(
      navigator.geolocation,
    );
    window.exploreLocationRequests = [];
    navigator.geolocation.getCurrentPosition = (success, failure, options) => {
      window.exploreLocationRequests.push(options);
      if (window.exploreLocationMode === "delayed") {
        window.exploreLocationFailure = failure;
        window.exploreLocationSuccess = success;
        return;
      }
      if (window.exploreLocationMode === "silent") return;
      if (window.exploreLocationMode === "denied") {
        failure({ code: 1 });
        return;
      }
      if (window.exploreLocationMode === "timeout") {
        failure({ code: 3 });
        return;
      }
      return original(success, failure, options);
    };
  });
  await context.route("https://tiles.openfreemap.org/**", (route) =>
    failMap ? route.abort() : route.fulfill({ json: style }),
  );
  await context.route("https://api.geoapify.com/**", async (route) => {
    addressReads++;
    if (failAddress)
      return route.fulfill({ status: 503, json: { error: "Fixture offline" } });
    await route.fulfill({
      json: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [13.42, 52.53] },
            properties: {
              formatted: "Fixture Work, Berlin, Germany",
              country_code: "de",
              city: "Berlin",
              place_id: "fixture-work",
            },
          },
        ],
      },
    });
  });
  await context.route("**/api/auth/actor", (route) =>
    route.fulfill({ json: actor(viewer) }),
  );
  await context.route("**/api/**", (route) =>
    new URL(route.request().url()).pathname === "/api/auth/actor"
      ? route.fallback()
      : route.fulfill({ status: 503, json: { status: "unavailable" } }),
  );
  page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/explore", {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  if (touch) {
    const { checkExploreMobile } =
      await import("./lib/explore-mobile-checks.mjs");
    await checkExploreMobile({
      page,
      browser,
      base,
      evidence,
      report,
      setViewer: (value) => {
        viewer = value;
      },
    });
  } else {
    const profiles = page.locator(".explore-profiles"),
      map = page.locator(".explore-map-layout"),
      controls = page.getByRole("navigation", { name: "Explore results view" });
    const categories = page.locator(".explore-category-filter");
    const setCategories = async (selected) => {
      if ((await categories.getAttribute("open")) === null)
        await categories.locator("summary").click();
      await categories
        .getByRole("button", { name: "Clear selection", exact: true })
        .click();
      for (const category of selected)
        await categories
          .getByRole("checkbox", { name: category, exact: true })
          .check();
      await categories
        .getByRole("button", { name: "Apply categories", exact: true })
        .click();
      await expect
        .poll(() =>
          new URL(page.url()).searchParams.getAll("discipline").sort(),
        )
        .toEqual([...selected].sort());
      await page.waitForLoadState("networkidle");
    };
    await profiles.waitFor();
    await page
      .getByRole("button", { name: "Save Near Coach", exact: true })
      .first()
      .waitFor();
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(3);
    assert.equal(await page.locator(".marketplace-explore-hero").count(), 0);
    let routeReads = 0;
    page.on("request", (request) => {
      if (
        request.headers().rsc &&
        new URL(request.url()).pathname === "/explore"
      )
        routeReads++;
    });
    assert.equal(
      await page.evaluate(() => window.exploreLocationRequests.length),
      0,
      "Profiles must not request permission on load",
    );
    await expect(
      page.getByText(/Nearest to Berlin centre/).filter({ visible: true }),
    ).toBeVisible();
    await expect(profiles.locator("h3").first()).toHaveText("Near Coach");
    await page
      .getByRole("button", { name: "Use current location", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(/Nearest to Current location/).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Accuracy about 120 m", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(profiles.locator("h3").first()).toHaveText("Group Coach");
    const options = await page.evaluate(() => window.exploreLocationRequests);
    assert.equal(options.length, 1);
    assert.equal(options[0].enableHighAccuracy, true);
    assert.equal(options[0].maximumAge, 0);
    assert.doesNotMatch(page.url(), /52\.51|13\.45/);
    assert.equal(
      await page.evaluate(() =>
        Object.values(localStorage).some((value) =>
          /52\.51|13\.45|accuracyMeters/.test(value),
        ),
      ),
      false,
    );
    report(
      "Profiles-first explicit fresh high-accuracy location changes nearest order without a Map detour or stored coordinates",
    );
    await controls.getByRole("link", { name: "Map", exact: true }).click();
    await map.waitFor();
    await page.locator(".location-map-marker").first().waitFor();
    const device = page.locator(".location-device-dot");
    await expect(device).toHaveCount(1);
    await expect(device).toBeVisible();
    await expect(device).toHaveAttribute("aria-label", /Accuracy about 120 m/);
    await expect(page.locator(".location-map-marker")).toHaveCount(3);
    const assertDeviceCentred = async () => {
      await expect
        .poll(async () => {
          const pin = await device.boundingBox(),
            viewport = await page.locator(".coach-map-canvas").boundingBox();
          return Boolean(
            pin &&
            viewport &&
            Math.abs(pin.x + pin.width / 2 - viewport.x - viewport.width / 2) <
              3 &&
            Math.abs(
              pin.y + pin.height / 2 - viewport.y - viewport.height / 2,
            ) < 3,
          );
        })
        .toBe(true);
    };
    await assertDeviceCentred();
    await page.screenshot({
      path: path.join(evidence, "device-desktop.png"),
      fullPage: true,
    });
    await controls.getByRole("link", { name: "Profiles", exact: true }).click();
    await profiles.waitFor();
    assert.equal(
      routeReads,
      0,
      "View switching must not fetch the directory again",
    );
    await page.goBack();
    await map.waitFor();
    await page.goForward();
    await profiles.waitFor();
    report(
      "desktop result-heading control, distinct views, native history and zero directory reloads",
    );
    assert.equal(
      await page.evaluate(() => window.exploreLocationRequests.length),
      1,
      "View/history changes must reuse the chosen location",
    );
    await context.setGeolocation({
      latitude: 52.56,
      longitude: 13.52,
      accuracy: 8000,
    });
    await page
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await expect(profiles.locator("h3").first()).toHaveText("Far Coach");
    await expect(
      page.getByText("Accuracy about 8.0 km", { exact: true }),
    ).toBeVisible();
    await controls.getByRole("link", { name: "Map", exact: true }).click();
    await expect(device).toHaveCount(1);
    await assertDeviceCentred();
    const ring = await page.locator(".location-device-accuracy").boundingBox(),
      viewport = await page.locator(".coach-map-canvas").boundingBox();
    assert.ok(
      ring &&
        viewport &&
        ring.width > 18 &&
        ring.height <= viewport.height &&
        ring.width <= viewport.width,
      "Camera must show the reported uncertainty, not imply street-level precision",
    );
    const panCanvas = await page
      .locator(".coach-map-canvas canvas")
      .boundingBox();
    assert.ok(panCanvas);
    await page.mouse.move(
      panCanvas.x + panCanvas.width / 3,
      panCanvas.y + panCanvas.height / 3,
    );
    await page.mouse.down();
    await page.mouse.move(
      panCanvas.x + panCanvas.width / 3 + 110,
      panCanvas.y + panCanvas.height / 3 + 50,
      { steps: 8 },
    );
    await page.mouse.up();
    await page.setViewportSize({ width: 1360, height: 1000 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const panned = await device.boundingBox(),
      resized = await page.locator(".coach-map-canvas").boundingBox();
    assert.ok(
      panned &&
        resized &&
        Math.abs(panned.x + panned.width / 2 - resized.x - resized.width / 2) >
          30,
      "Resizing must not reapply an already completed location camera request",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await controls.getByRole("link", { name: "Profiles", exact: true }).click();
    await context.setGeolocation({
      latitude: 52.51,
      longitude: 13.45,
      accuracy: 120,
    });
    report(
      "one device marker remains geographically centred across repeated requests, hidden-map fitting and mode/history changes",
    );
    await profiles
      .getByRole("button", { name: "Save Near Coach", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Show saved coaches", exact: true })
      .click();
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(1);
    await page.reload();
    await page.locator(".explore-enhanced").waitFor();
    await profiles.waitFor();
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Show saved coaches", exact: true })
      .click();
    report(
      "saved hearts, saved-only URL/filter, reload and visible profile population",
    );
    await page
      .getByLabel("Session type", { exact: true })
      .selectOption("group");
    await page.waitForURL(/session=group/);
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(1);
    assert.match(await profiles.textContent(), /Group Coach/);
    await expect(
      profiles.locator(".coach-card-rate, .coach-today-availability"),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Clear search", exact: true }).click();
    await page.waitForURL(/view=list/);
    await expect(page.getByLabel("Session type", { exact: true })).toHaveValue(
      "",
    );
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(3);
    await setCategories(["Boxing"]);
    await page.waitForURL(/discipline=Boxing/);
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(2);
    await page.getByRole("link", { name: "Clear search", exact: true }).click();
    await expect(
      categories.locator('input[name="discipline"]:checked'),
    ).toHaveCount(0);
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(3);
    report(
      "real native category/session GET controls and filter-clearing navigation",
    );
    await page
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await expect(
      page.getByText(/Nearest to Current location/).filter({ visible: true }),
    ).toBeVisible();
    await setCategories(["Boxing"]);
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(2);
    await categories.locator("summary").click();
    await categories
      .getByRole("checkbox", { name: "Fitness", exact: true })
      .check();
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(2);
    assert.deepEqual(new URL(page.url()).searchParams.getAll("discipline"), [
      "Boxing",
    ]);
    await categories
      .getByRole("button", { name: "Apply categories", exact: true })
      .click();
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(3);
    await expect(categories.locator("summary")).toHaveAttribute(
      "aria-label",
      "Categories, 2 selected",
    );
    await expect(
      page.getByText(/Nearest to Current location/).filter({ visible: true }),
    ).toBeVisible();
    const beforeViews = routeReads;
    await controls.getByRole("link", { name: "Map", exact: true }).click();
    await expect(map).toBeVisible();
    await expect(page.locator(".location-map-marker")).toHaveCount(3);
    await controls.getByRole("link", { name: "Profiles", exact: true }).click();
    await expect(profiles).toBeVisible();
    assert.equal(routeReads, beforeViews);
    await page.reload();
    await page.locator(".explore-enhanced").waitFor();
    await expect(
      categories.locator('input[name="discipline"]:checked'),
    ).toHaveCount(2);
    await page.goBack();
    await expect(map).toBeVisible();
    await page.goForward();
    await expect(profiles).toBeVisible();
    assert.deepEqual(new URL(page.url()).searchParams.getAll("discipline"), [
      "Boxing",
      "Fitness",
    ]);
    await setCategories([]);
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(3);
    report(
      "multiple category drafts apply as a union, preserve location/view/history and reload, and clear independently",
    );
    const search = page.getByRole("form", { name: "Search coaches" });
    await search.getByLabel("Search coach or focus").fill("No such coach");
    await search.getByRole("button", { name: "Search coaches" }).click();
    await page
      .getByRole("heading", {
        name: "No coaches match these filters.",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("link", { name: "Clear filters", exact: true })
      .click();
    report("empty results remain distinct from unavailable data");
    await page.setViewportSize({ width: 375, height: 852 });
    await page.goto(base + "/explore?view=map");
    await map.waitFor();
    const floating = page.locator(".explore-floating-view");
    await floating.waitFor();
    await page
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await page
      .getByText(/Nearest to Current location/)
      .filter({ visible: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Search near home", exact: true })
      .click();
    let dialog = page.getByRole("dialog", { name: "Saved places" });
    await dialog.waitFor();
    await dialog
      .getByLabel("Address or area", { exact: true })
      .fill("Fixture Home A");
    await dialog.getByText("Enter coordinates", { exact: true }).click();
    await dialog.getByLabel("Saved place latitude").fill("52.51");
    await dialog.getByLabel("Saved place longitude").fill("13.45");
    await dialog
      .getByRole("button", { name: "Save Home", exact: true })
      .click();
    await dialog
      .getByRole("region", { name: "Home shortcut" })
      .getByRole("button", { name: "Use", exact: true })
      .click();
    await page
      .getByText(/Nearest to Home/)
      .filter({ visible: true })
      .waitFor();
    assert.doesNotMatch(page.url(), /Fixture|52\.51|13\.45/);
    await expect(page.locator(".location-device-dot")).toHaveCount(0);
    await page.reload();
    await page.locator(".explore-enhanced").waitFor();
    await page
      .getByRole("button", { name: "Search near home", exact: true })
      .click();
    await page
      .getByText(/Nearest to Home/)
      .filter({ visible: true })
      .waitFor();
    report(
      "explicit geolocation and Home coordinates, persistence and private-coordinate URL exclusion",
    );
    await page.evaluate(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(success) {
            window.explorePendingPosition = success;
          },
        },
      });
    });
    await page
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Search near home", exact: true })
      .click();
    await page.evaluate(() =>
      window.explorePendingPosition({
        coords: { latitude: 52.6, longitude: 13.6 },
      }),
    );
    await expect(
      page.getByText(/Nearest to Home/).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Nearest to Current location/).filter({ visible: true }),
    ).toHaveCount(0);
    report(
      "a late device-location response cannot replace a newer Home selection",
    );
    await expect(page.locator(".location-device-dot")).toHaveCount(0);
    assert.equal(addressReads, 0, "No address search without explicit action");
    await page
      .getByRole("button", { name: "Manage Home and Work locations" })
      .click();
    dialog = page.getByRole("dialog", { name: "Saved places" });
    await dialog
      .getByRole("region", { name: "Work shortcut" })
      .getByRole("button", { name: "Set location", exact: true })
      .click();
    await dialog
      .getByLabel("Address or area", { exact: true })
      .fill("Fixture work");
    failAddress = true;
    await dialog
      .getByRole("button", { name: "Search address", exact: true })
      .click();
    await dialog.getByText(/Address search is unavailable/).waitFor();
    assert.equal(
      await dialog
        .getByRole("button", { name: "Save Work", exact: true })
        .isDisabled(),
      true,
    );
    failAddress = false;
    await dialog
      .getByRole("button", { name: "Search address", exact: true })
      .click();
    await dialog
      .getByRole("button", {
        name: "Fixture Work, Berlin, Germany",
        exact: true,
      })
      .click();
    await dialog
      .getByRole("button", { name: "Save Work", exact: true })
      .click();
    let work = dialog.getByRole("region", { name: "Work shortcut" });
    await expect(work).toContainText("Fixture Work, Berlin, Germany");
    await work.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog
      .getByLabel("Address or area", { exact: true })
      .fill("Changed address");
    assert.equal(
      await dialog
        .getByRole("button", { name: "Save Work", exact: true })
        .isDisabled(),
      true,
      "Editing an address invalidates old coordinates",
    );
    await dialog
      .getByRole("button", { name: "Use map centre", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Save Work", exact: true })
      .click();
    await expect(work).toContainText("Changed address");
    await work
      .getByRole("button", { name: "Remove work location", exact: true })
      .click();
    await expect(work).toContainText("Not set");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    report(
      "explicit address lookup, provider failure/retry, Work edit invalidation/removal and dialog keyboard recovery",
    );
    for (const width of [1440, 1024, 768, 375, 320]) {
      await page.setViewportSize({ width, height: width < 760 ? 852 : 1040 });
      for (const view of ["list", "map"]) {
        await page.goto(base + "/explore?view=" + view);
        await page.locator(".explore-enhanced").waitFor();
        if (view === "map")
          await page.locator(".location-map-marker").first().waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `overflow at ${width}/${view}`,
        );
        if (view === "list") {
          await categories.locator("summary").click();
          await categories
            .getByRole("checkbox", { name: "Boxing", exact: true })
            .focus();
          await page.keyboard.press("Space");
          await expect(
            categories.getByRole("checkbox", { name: "Boxing", exact: true }),
          ).toBeChecked();
          const panel = await categories
            .locator(".explore-category-panel")
            .boundingBox();
          assert.ok(
            panel && panel.x >= 0 && panel.x + panel.width <= width,
            "Category popup must fit the viewport",
          );
          await page.screenshot({
            path: path.join(evidence, `categories-${width}.png`),
            fullPage: true,
          });
          await page.keyboard.press("Escape");
          await expect(categories).not.toHaveAttribute("open", "");
          await expect(categories.locator("summary")).toBeFocused();
          await categories.locator("summary").click();
          await page
            .getByRole("heading", { name: "Explore", exact: true, level: 1 })
            .click();
          await expect(categories).not.toHaveAttribute("open", "");
        }
        await page.screenshot({
          path: path.join(evidence, `${width}-${view}.png`),
          fullPage: true,
        });
        if (width < 760) {
          const button = await floating.boundingBox();
          assert.ok(
            button &&
              button.x >= 0 &&
              button.x + button.width <= width &&
              button.y + button.height <= 852,
          );
          await floating.focus();
          await page.keyboard.press("Enter");
          await page.waitForURL(view === "map" ? /view=list/ : /view=map/);
        }
      }
    }
    report(
      "desktop/tablet/375/320 bounds, keyboard and floating control placement",
    );
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 852 });
      await page.goto(base + "/explore?view=list");
      await page
        .getByRole("button", { name: "Use current location", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await expect(
        page
          .getByText("Accuracy about 120 m", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await floating.click();
      await expect(device).toBeVisible();
      await assertDeviceCentred();
      const dot = await device.boundingBox(),
        sheet = await page.locator(".explore-map-sheet").boundingBox();
      assert.ok(
        dot && sheet && dot.y + dot.height <= sheet.y,
        "The device pin must be above the sheet",
      );
      await page.screenshot({
        path: path.join(evidence, `device-${width}.png`),
        fullPage: true,
      });
      await page.goto(base + "/explore?view=map");
      await page
        .getByRole("button", { name: "Use current location", exact: true })
        .click();
      await expect(
        page
          .getByText("Accuracy about 120 m", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await assertDeviceCentred();
      await page
        .locator(".location-map-marker")
        .filter({ visible: true })
        .first()
        .click();
      await expect
        .poll(async () => {
          const action = await page
              .locator(".explore-map-sheet")
              .getByRole("link", { name: "View profile", exact: true })
              .boundingBox(),
            toggle = await floating.boundingBox();
          return Boolean(
            action &&
            toggle &&
            (action.y + action.height <= toggle.y ||
              toggle.y + toggle.height <= action.y ||
              action.x + action.width <= toggle.x ||
              toggle.x + toggle.width <= action.x),
          );
        })
        .toBe(true);
      await page.locator(".explore-sheet-handle").click();
      await expect(page.locator(".explore-sheet-handle")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await floating.click();
      await page
        .getByRole("button", { name: "Use current location", exact: true })
        .click();
      await expect(
        page
          .getByText("Accuracy about 120 m", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await floating.click();
      await expect(page.locator(".explore-sheet-handle")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await assertDeviceCentred();
    }
    report(
      "Profiles-first keyboard location and visible centred mobile device markers at375/320",
    );

    await page.setViewportSize({ width: 1440, height: 1040 });
    await page.goto(base + "/explore?view=map");
    await map.waitFor();
    const canvas = page.locator(".coach-map-canvas canvas");
    const rect = await canvas.boundingBox();
    assert.ok(rect);
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 3);
    await page.mouse.down();
    await page.mouse.move(
      rect.x + rect.width / 2 + 90,
      rect.y + rect.height / 3 + 40,
      { steps: 8 },
    );
    await page.mouse.up();
    await page
      .getByRole("button", { name: "Search this area", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Search this area", exact: true })
      .click();
    await page.getByText(/Nearest to Map centre/).waitFor();
    report("map panning and explicit area search preserve map interaction");
    await page.goto(base + "/explore?view=list");
    failMap = true;
    await controls.getByRole("link", { name: "Map", exact: true }).click();
    await page.getByText(/Map unavailable\. The same coach results/).waitFor();
    await profiles.waitFor();
    await expect(profiles.locator(".compact-coach-card.result")).toHaveCount(3);
    await page
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await expect(
      page.getByText(/Nearest to Current location/).filter({ visible: true }),
    ).toBeVisible();
    await expect(device).toHaveCount(0);
    failMap = false;
    await page.getByRole("button", { name: "Retry map", exact: true }).click();
    await page.locator(".location-map-marker").first().waitFor();
    report(
      "map-provider failure keeps profiles and explicit retry restores the map",
    );
    await page.goto(base + "/explore?view=list");
    viewer = "a";
    await page.getByRole("button", { name: "Fixture a", exact: true }).click();
    await page
      .getByRole("button", { name: "Save Near Coach", exact: true })
      .first()
      .waitFor();
    await profiles
      .getByRole("button", { name: "Save Near Coach", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await controls.getByRole("link", { name: "Map", exact: true }).click();
    await expect(device).toBeVisible();
    await controls.getByRole("link", { name: "Profiles", exact: true }).click();
    viewer = "b";
    await page.getByRole("button", { name: "Fixture b", exact: true }).click();
    await expect(device).toHaveCount(0);
    await profiles
      .getByRole("button", { name: "Save Near Coach", exact: true })
      .waitFor();
    assert.equal(
      await profiles
        .getByRole("button", { name: "Unsave Near Coach", exact: true })
        .count(),
      0,
    );
    viewer = "a";
    await page.getByRole("button", { name: "Fixture a", exact: true }).click();
    await profiles
      .getByRole("button", { name: "Unsave Near Coach", exact: true })
      .waitFor();
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 852 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const navigation = page.locator(".mobile-nav");
      await navigation.waitFor();
      await expect
        .poll(async () => {
          const nav = await navigation.boundingBox(),
            control = await floating.boundingBox();
          return Boolean(
            nav && control && control.y + control.height <= nav.y - 8,
          );
        })
        .toBe(true);
      await page.screenshot({
        path: path.join(evidence, `member-${width}-profiles.png`),
        fullPage: true,
      });
    }
    report(
      "the signed-in mobile view control stays above the actual bottom navigation at 375/320px",
    );
    await page.setViewportSize({ width: 1440, height: 1040 });
    await page
      .getByRole("button", { name: "Fixture unknown", exact: true })
      .click();
    await page
      .getByText(/Saved discovery settings are unavailable while your account/)
      .waitFor();
    assert.equal(
      await profiles.getByRole("button", { name: /Unsave/ }).count(),
      0,
    );
    report(
      "real provider contexts keep browser favorites separate across account changes and unknown identity",
    );
    const denied = await browser.newContext({
      viewport: { width: 375, height: 852 },
    });
    await denied.route("https://tiles.openfreemap.org/**", (route) =>
      route.fulfill({ json: style }),
    );
    const deniedPage = await denied.newPage();
    await deniedPage.goto(base + "/explore?view=list");
    await deniedPage
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await deniedPage.getByText(/Location permission was denied/).waitFor();
    await expect(deniedPage.locator(".explore-profiles")).toBeVisible();
    await expect(deniedPage.locator(".location-device-dot")).toHaveCount(0);
    await denied.close();
    report("denied location permission retains normal profile discovery");
    const invalid = await browser.newContext();
    await invalid.route("https://tiles.openfreemap.org/**", (route) =>
      route.fulfill({ json: style }),
    );
    await invalid.addInitScript(() => {
      window.exploreCoordinates = {
        latitude: NaN,
        longitude: 13.45,
        accuracy: 120,
      };
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition(success) {
            success({ coords: window.exploreCoordinates });
          },
        },
      });
    });
    const invalidPage = await invalid.newPage();
    await invalidPage.goto(base + "/explore?view=list");
    await invalidPage
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await expect(
      invalidPage.getByText(/Your device returned an invalid location/),
    ).toBeVisible();
    await expect(
      invalidPage
        .getByText(/Nearest to Berlin centre/)
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(invalidPage.locator(".location-device-dot")).toHaveCount(0);
    await invalidPage.evaluate(() => {
      window.exploreCoordinates = {
        latitude: 52.52,
        longitude: 13.405,
        accuracy: NaN,
      };
    });
    await invalidPage
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await expect(
      invalidPage.getByText("Accuracy unavailable", { exact: true }),
    ).toBeVisible();
    await invalidPage
      .getByRole("navigation", { name: "Explore results view" })
      .getByRole("link", { name: "Map", exact: true })
      .click();
    await expect(invalidPage.locator(".location-device-dot")).toBeVisible();
    await expect(invalidPage.locator(".location-device-accuracy")).toBeHidden();
    await invalid.close();
    report(
      "invalid coordinates never invent a point, and missing accuracy never invents an uncertainty area",
    );
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw Error("blocked");
      };
      Storage.prototype.setItem = () => {
        throw Error("blocked");
      };
    });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(base + "/explore?view=list");
    await blockedPage
      .getByText(/Saved discovery settings could not be loaded/)
      .waitFor();
    assert.equal(
      await blockedPage
        .locator(".explore-profiles .compact-coach-card.result")
        .count(),
      3,
    );
    await blocked.close();
    report(
      "blocked browser storage is visible and never hides public profiles",
    );
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const nojsPage = await nojs.newPage();
    await nojsPage.goto(base + "/explore?view=map");
    assert.equal(
      await nojsPage
        .locator(".explore-profiles .compact-coach-card.result")
        .count(),
      3,
    );
    await nojsPage.getByLabel("Search coach or focus").fill("Near");
    await nojsPage.getByRole("button", { name: "Search coaches" }).click();
    assert.equal(
      await nojsPage.locator(".compact-coach-card.result").count(),
      1,
    );
    await nojsPage
      .getByRole("link", { name: "Clear search", exact: true })
      .click();
    const nojsCategories = nojsPage.locator(".explore-category-filter");
    await nojsCategories.locator("summary").click();
    await nojsCategories
      .getByRole("checkbox", { name: "Boxing", exact: true })
      .check();
    await nojsCategories
      .getByRole("checkbox", { name: "Fitness", exact: true })
      .check();
    await nojsCategories
      .getByRole("button", { name: "Apply categories", exact: true })
      .click();
    assert.deepEqual(
      new URL(nojsPage.url()).searchParams.getAll("discipline"),
      ["Boxing", "Fitness"],
    );
    assert.equal(
      await nojsPage.locator(".compact-coach-card.result").count(),
      3,
    );
    await nojs.close();
    report(
      "no-JavaScript map URLs retain profiles and native GET search with multiple categories",
    );
  }
  assert.deepEqual(errors, []);
  passed = true;
} catch (error) {
  if (page)
    await page
      .screenshot({ path: path.join(evidence, "failure.png"), fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  await writeFile(path.join(evidence, "server.log"), log);
  await writeFile(
    path.join(evidence, "results.json"),
    JSON.stringify({ passed, checks, errors }, null, 2),
  );
  await browser?.close();
  if (server?.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("close", resolve);
      setTimeout(resolve, 5000);
    });
  }
  await rm(scratch, { recursive: true, force: true });
  console.log("Evidence: " + evidence);
}
