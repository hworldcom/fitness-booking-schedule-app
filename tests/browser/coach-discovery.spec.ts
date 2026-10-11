import { expect, test } from "@playwright/test";

test("guest browses and filters the persistent coach directory", async ({
  page,
}, testInfo) => {
  await page.goto("/explore");

  await expect(page).toHaveTitle(/Explore martial-arts coaches/);
  await expect(
    page.getByRole("heading", {
      name: "Find a coach and a time that fits.",
    }),
  ).toBeVisible();
  await expect(page.getByText("5 coaches", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sam Lee", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Daniel Park" }),
  ).toBeVisible();
  const danielCard = page.locator(".coach-card").filter({
    has: page.getByRole("heading", { name: "Daniel Park" }),
  });
  await expect(
    danielCard.getByText("Primary training location", { exact: true }),
  ).toBeVisible();
  await expect(
    danielCard.getByText("No availability today", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Fictional coaches and places/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Map of matching coaches" }),
  ).toBeVisible();
  const mapCanvas = page.getByLabel("Matching coach locations");
  const unavailableState = page.getByText("Map unavailable", { exact: true });
  await expect(mapCanvas.or(unavailableState)).toBeVisible({ timeout: 30_000 });
  if (await mapCanvas.isVisible()) {
    const markers = page.locator("button.location-map-marker");
    await expect(markers).toHaveCount(5);
    const danielMarker = page.getByRole("button", {
      name: /Select Daniel Park at primary training location/,
    });
    await expect(danielMarker.locator("img")).toHaveAttribute(
      "src",
      "/images/coaches/daniel-park.webp",
    );
    await expect(
      page.getByRole("button", { name: /Select Sam Lee at/ }).locator("img"),
    ).toHaveCount(0);
    const noraMarker = page.getByRole("button", {
      name: /Select Nora Klein at primary training location/,
    });
    const idrisMarker = page.getByRole("button", {
      name: /Select Idris Malik at primary training location/,
    });
    await expect(noraMarker).toHaveAttribute("data-coincident-count", "2");
    await expect(idrisMarker).toHaveAttribute("data-coincident-count", "2");
    expect(await noraMarker.getAttribute("data-marker-offset")).not.toBe(
      await idrisMarker.getAttribute("data-marker-offset"),
    );
    await danielMarker.click();
    await expect(danielMarker).toHaveAttribute("aria-pressed", "true");
    const danielMapDetail = page.getByRole("region", {
      name: "Daniel Park map details",
    });
    await expect(danielMapDetail).toBeVisible();
    await expect(
      danielMapDetail.getByText("Primary training location", { exact: true }),
    ).toBeVisible();
    await expect(
      danielMapDetail.getByText("No availability today", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("coach-map-selected.png"),
      fullPage: true,
    });
    await danielMarker.locator("img").evaluate((image) => {
      image.dispatchEvent(new Event("error"));
    });
    await expect(danielMarker.locator("img")).toHaveCount(0);
    await expect(
      danielMarker.locator(".location-map-marker-initials"),
    ).toHaveText("DP");
    await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible();
  } else {
    await expect(page.getByText(/public map could not load/)).toBeVisible();
  }

  const discipline = page.getByLabel("Discipline");
  await discipline.focus();
  await expect(discipline).toBeFocused();
  await discipline.selectOption("Muay Thai");
  await page.getByRole("button", { name: "Apply filters" }).click();

  await expect(page).toHaveURL(/discipline=Muay(\+|%20)Thai/);
  await expect(page.getByText("1 coach", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sam Lee" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daniel Park" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("coach-directory-filtered.png"),
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
      .locator(".public-coach-place")
      .getByText("Northside Combat", { exact: true }),
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
  await expect(locationRow.locator(".public-coach-location-key")).toHaveText(
    "1",
  );
  if (await profileMapCanvas.isVisible()) {
    const locationMarker = profileMap.getByRole("button", {
      name: /Select training location 1: Northside Combat/,
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
  await expect(
    page.getByRole("heading", {
      name: "No scheduled times right now.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in for session requests" }),
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
  await expect(
    page.getByRole("heading", { name: "No scheduled times right now." }),
  ).toBeVisible();
});

test("coach workspace stays protected and exposes no placeholder controls", async ({
  page,
}) => {
  await page.goto("/coach");
  const destination = new URL(page.url());
  if (destination.pathname === "/sign-in") {
    expect(destination.searchParams.get("returnTo")).toBe("/coach");
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
