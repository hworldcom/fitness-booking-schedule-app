import { setExploreCategories } from "./explore-controls";
import directoryFixture from "../fixtures/public-browser-directory.json" with { type: "json" };
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#edf2e8" },
          },
        ],
      },
    }),
  );
});

test("desktop discovery starts with real profiles and filters the public directory", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/explore");
  await expect(page).toHaveTitle(/Explore coaches/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Explore", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".marketplace-explore-hero")).toHaveCount(0);
  const profiles = page.locator(".explore-profiles");
  const cards = profiles.locator(".compact-coach-card.result");
  await expect(cards).toHaveCount(directoryFixture.coaches.length);
  await expect(page.locator(".explore-map-layout")).toHaveCount(0);
  for (const name of directoryFixture.coaches) {
    const card = cards.filter({
      has: page.getByRole("heading", { name, exact: true }),
    });
    await expect(
      card.getByText("Primary training location", { exact: true }),
    ).toBeVisible();
    await expect(card.getByText("Demo coach", { exact: true })).toBeVisible();
    await expect(
      card.getByRole("link", { name: "View profile", exact: true }),
    ).toHaveAttribute("href", /^\/coaches\/[a-z0-9-]+$/);
    await expect(card.locator(".explore-coach-distance")).toContainText(
      /Berlin centre/,
    );
    await expect(
      card.getByText("No availability today", { exact: true }),
    ).toHaveCount(0);
  }
  await setExploreCategories(page, ["Boxing"]);
  await expect(cards).toHaveCount(2);
  expect((await cards.locator("h3").allTextContents()).sort()).toEqual([
    "Daniel Park",
    "Sam Lee",
  ]);
  await page.getByRole("link", { name: "Clear search", exact: true }).click();
  await expect(cards).toHaveCount(directoryFixture.coaches.length);
  const search = page.getByRole("form", { name: "Search coaches" });
  await search.locator(".explore-location-filter summary").click();
  await search.getByLabel("Where in Berlin?").fill("Tempelhofer");
  await search.getByRole("button", { name: "Apply location" }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText(["Daniel Park"]);
  await cards.getByRole("link", { name: "View profile", exact: true }).click();
  await expect(page).toHaveURL(/\/coaches\/daniel-park$/);
});

test("desktop Map is a distinct layout with public primary markers and keyboard selection", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/explore?view=list");
  const controls = page.getByRole("navigation", {
    name: "Explore results view",
  });
  await expect(
    page.getByRole("button", { name: "Save Daniel Park", exact: true }).first(),
  ).toBeEnabled();
  await page.waitForLoadState("networkidle");
  await expect(
    controls.getByRole("link", { name: "Profiles", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  let reads = 0;
  page.on("request", (request) => {
    if (request.headers().rsc && new URL(request.url()).pathname === "/explore")
      reads++;
  });
  await controls.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page.locator(".explore-map-layout")).toBeVisible();
  await expect(page.locator(".explore-profiles")).toBeHidden();
  await expect(page.locator("button.location-map-marker")).toHaveCount(
    directoryFixture.coaches.length,
  );
  const daniel = page.getByRole("button", {
    name: /Select Daniel Park at primary training location/,
  });
  await expect(daniel.locator("img")).toHaveAttribute(
    "src",
    "/images/coaches/daniel-park.webp",
  );
  await expect(
    page.getByRole("button", { name: /Select Sam Lee at/ }).locator("img"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Select .* Chimosa/ }),
  ).toHaveCount(0);
  const nora = page.getByRole("button", {
    name: /Select Nora Klein at primary/,
  });
  const idris = page.getByRole("button", {
    name: /Select Idris Malik at primary/,
  });
  await expect(nora).toHaveAttribute("data-coincident-count", "2");
  await expect(idris).toHaveAttribute("data-coincident-count", "2");
  expect(await nora.getAttribute("data-marker-offset")).not.toBe(
    await idris.getAttribute("data-marker-offset"),
  );
  await daniel.focus();
  await page.keyboard.press("Enter");
  const card = page.locator(".explore-map-list article").filter({
    has: page.getByRole("heading", { name: "Daniel Park", exact: true }),
  });
  await expect(card).toHaveAttribute("data-selected", "true");
  await expect(card).toBeFocused();
  await controls.getByRole("link", { name: "Profiles", exact: true }).click();
  await expect(page.locator(".explore-profiles")).toBeVisible();
  expect(reads).toBe(0);
  await page.goBack();
  await expect(page.locator(".explore-map-layout")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("explore-desktop-map.png"),
    fullPage: true,
  });
});

test("map provider failure retains public profiles and offers retry", async ({
  page,
}, testInfo) => {
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/explore?view=map");
  await expect(
    page.getByText(/Map unavailable. The same coach results/),
  ).toBeVisible();
  await expect(page.locator(".explore-profiles")).toBeVisible();
  await expect(page.locator(".compact-coach-card.result")).toHaveCount(
    directoryFixture.coaches.length,
  );
  await expect(
    page.getByRole("button", { name: "Retry map", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No coaches match these filters." }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("explore-provider-failure.png"),
    fullPage: true,
  });
});

test("mobile starts on Map and keeps search, selection and history across the floating view control", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/explore?q=footwork&discipline=Boxing&location=Berlin");
  const map = page.locator(".explore-map-layout"),
    floating = page.locator(".explore-floating-view");
  await expect(map).toBeVisible();
  await expect(floating).toHaveText("Show profiles");
  await floating.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".explore-profiles")).toBeVisible();
  await expect(page).toHaveURL(
    /q=footwork&discipline=Boxing&location=Berlin&view=list$/,
  );
  const card = page.locator(".compact-coach-card.result").filter({
    has: page.getByRole("heading", { name: "Daniel Park", exact: true }),
  });
  await card
    .getByRole("button", { name: "Show Daniel Park on the map" })
    .click();
  const detail = page.getByRole("region", { name: "Daniel Park map details" });
  await expect(detail).toBeVisible();
  await expect(detail).toBeFocused();
  await expect(
    detail.getByRole("link", { name: "View profile", exact: true }),
  ).toHaveAttribute("href", "/coaches/daniel-park");
  await floating.click();
  await expect(page.locator(".explore-profiles")).toBeVisible();
  await page.goBack();
  await expect(map).toBeVisible();
  await expect(detail).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("explore-mobile-map.png"),
    fullPage: true,
  });
});

test("selected coach profile location stays geographically anchored while zooming out", async ({
  page,
}, testInfo) => {
  await page.goto("/coaches/daniel-park");

  const mapPanel = page.getByRole("region", {
    name: "Daniel Park training locations map",
  });
  await expect(
    mapPanel.getByLabel("Daniel Park training locations"),
  ).toBeVisible({ timeout: 30_000 });
  const chimosaMarker = mapPanel.getByRole("button", {
    name: /Select training location 2: Chimosa/,
  });
  const tempelhoferMarker = mapPanel.getByRole("button", {
    name: /Select training location 1: Tempelhofer Feld/,
  });
  await chimosaMarker.click();
  await expect(chimosaMarker).toHaveAttribute("aria-pressed", "true");

  for (let zoomStep = 0; zoomStep < 5; zoomStep += 1) {
    await mapPanel.getByRole("button", { name: "Zoom out" }).click();
    await page.waitForTimeout(400);
  }
  await expect
    .poll(() =>
      chimosaMarker.evaluate((marker) => {
        const style = getComputedStyle(marker);
        return Object.freeze({ position: style.position, scale: style.scale });
      }),
    )
    .toEqual({ position: "absolute", scale: "none" });
  const markerCenters = await Promise.all(
    [chimosaMarker, tempelhoferMarker].map((marker) =>
      marker.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return Object.freeze({
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        });
      }),
    ),
  );
  const mapBounds = await mapPanel
    .locator(".coach-map-canvas")
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return Object.freeze({
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
      });
    });
  for (const center of markerCenters) {
    expect(center.x).toBeGreaterThanOrEqual(mapBounds.left);
    expect(center.x).toBeLessThanOrEqual(mapBounds.right);
    expect(center.y).toBeGreaterThanOrEqual(mapBounds.top);
    expect(center.y).toBeLessThanOrEqual(mapBounds.bottom);
  }
  expect(
    Math.hypot(
      markerCenters[0]!.x - markerCenters[1]!.x,
      markerCenters[0]!.y - markerCenters[1]!.y,
    ),
  ).toBeLessThan(40);
  await page.screenshot({
    path: testInfo.outputPath("chimosa-selected-zoomed-out.png"),
    fullPage: true,
  });
});

test("guest opens a coach profile without fabricated availability", async ({
  page,
}, testInfo) => {
  await page.goto("/coaches/sam-lee");

  await expect(
    page.getByRole("heading", { name: "Sam Lee", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Muay Thai", { exact: true })).toBeVisible();
  await expect(
    page
      .locator(".coach-website-facts")
      .getByRole("link", { name: /Northside Combat/ }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Training locations" })
      .getByText("Northside Combat", { exact: true }),
  ).toBeVisible();
  const profileMap = page.getByRole("region", {
    name: "Sam Lee training locations map",
  });
  const profileMapCanvas = profileMap.getByLabel("Sam Lee training locations");
  const profileMapUnavailable = profileMap.getByText("Map unavailable", {
    exact: true,
  });
  await expect(profileMapCanvas.or(profileMapUnavailable)).toBeVisible({
    timeout: 30_000,
  });
  const locationRow = page
    .locator(".public-coach-locations li")
    .filter({ hasText: "Northside Combat" });
  const locationButton = locationRow.getByRole("button", {
    name: "Show Northside Combat on the map",
  });
  await expect(locationButton).toBeVisible();
  await expect(
    locationRow.locator(".public-coach-location-key svg"),
  ).toBeVisible();
  await expect(locationRow.locator(".public-coach-location-key")).toHaveText(
    "",
  );
  if (await profileMapCanvas.isVisible()) {
    const locationMarker = profileMap.getByRole("button", {
      name: /Select training location: Northside Combat/,
    });
    await expect(locationMarker).toBeVisible();
    await expect(locationMarker).toHaveAttribute("aria-pressed", "true");
    expect(await locationMarker.getAttribute("data-marker-color")).toBe(
      await locationRow.getAttribute("data-location-color"),
    );
    await locationButton.focus();
    await expect(locationButton).toBeFocused();
    await locationButton.press("Enter");
    await expect(locationButton).toHaveAttribute("aria-pressed", "true");
  } else {
    await expect(locationButton).toBeDisabled();
    await expect(
      profileMap.getByText(/remains available in the list below/),
    ).toBeVisible();
  }
  await expect(page.getByText("Primary base", { exact: true })).toBeVisible();
  const schedule = page.getByRole("region", {
    name: "Make time for your next step.",
  });
  await expect(schedule.getByRole("status").locator("strong")).toHaveText("0");
  await expect(schedule.getByRole("status")).toContainText("open slots");
  await expect(schedule.getByRole("status")).toContainText(
    "in the next 7 days",
  );
  await expect(
    schedule.getByRole("link", {
      name: "Sign in to view schedule",
      exact: true,
    }),
  ).toHaveAttribute("href", /\/sign-in\?returnTo=/);
  await expect(
    schedule.getByRole("button", { name: /request|book/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Sign in to view schedule" }),
  ).toHaveAttribute("href", /\/sign-in\?returnTo=/);
  await expect(page.getByText(/not live tracking/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to coaches" }),
  ).toHaveAttribute("href", "/explore");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("coach-profile.png"),
    fullPage: true,
  });
});

test("coach profile keeps its complete location list when the map provider fails", async ({
  page,
}) => {
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort("failed"),
  );
  await page.goto("/coaches/sam-lee");

  const locations = page.getByRole("region", { name: "Training locations" });
  await expect(
    locations.getByText("Northside Combat", { exact: true }),
  ).toBeVisible();
  await expect(
    locations.getByText(/Near Amerika-Gedenkbibliothek/),
  ).toBeVisible();
  await expect(
    locations.getByText("Map unavailable", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    locations.getByRole("button", {
      name: "Show Northside Combat on the map",
    }),
  ).toBeDisabled();
  const summary = page
    .getByRole("region", { name: "Make time for your next step." })
    .getByRole("status");
  await expect(summary.locator("strong")).toHaveText("0");
  await expect(summary).toContainText("open slots");
  await expect(summary).toContainText("in the next 7 days");
});

test("coach workspace stays protected and exposes no placeholder controls", async ({
  page,
}) => {
  await page.goto("/coach");
  const destination = new URL(page.url());
  if (destination.pathname === "/sign-in") {
    const continuation = new URL(
      destination.searchParams.get("returnTo")!,
      destination.origin,
    );
    expect(continuation.pathname).toBe("/coach");
    expect(continuation.searchParams.get("view")).toBe("schedule");
  } else {
    await expect(
      page.getByRole("heading", {
        name: "Sign in to manage coach availability.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse coaches" }),
    ).toHaveAttribute("href", "/explore");
  }
  await expect(page.getByText("Analytics", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("coach profile setup stays behind application identity", async ({
  page,
}) => {
  await page.goto("/profile/coach");
  const destination = new URL(page.url());
  if (destination.pathname === "/sign-in") {
    expect(destination.searchParams.get("returnTo")).toBe("/profile/coach");
  } else {
    await expect(
      page.getByRole("heading", {
        name: "Sign in to create your coach profile.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse coaches" }),
    ).toHaveAttribute("href", "/explore");
  }
});
