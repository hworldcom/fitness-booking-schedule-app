import { expect, test } from "@playwright/test";

test("desktop guest browses and filters the persistent coach directory", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/explore");

  await expect(page).toHaveTitle(/Explore martial-arts coaches/);
  await expect(
    page.getByRole("heading", {
      name: "Find your discipline. Meet your coach.",
    }),
  ).toBeVisible();
  await expect(page.getByText("5 coaches", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sam Lee", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Daniel Park" }),
  ).toBeVisible();
  const danielCard = page.locator(".compact-coach-card.result").filter({
    has: page.getByRole("heading", { name: "Daniel Park" }),
  });
  const elifCard = page.locator(".compact-coach-card.result").filter({
    has: page.getByRole("heading", { name: "Elif Demir" }),
  });
  await expect(
    danielCard.getByText("Primary training location", { exact: true }),
  ).toBeVisible();
  const danielTodaySummary = danielCard.getByText(
    /^(?:\d+ open times?|No availability today)$/,
  );
  await expect(danielTodaySummary).toBeVisible();
  const danielTodayLabel = await danielTodaySummary.innerText();
  await expect(
    elifCard.getByText("No availability today", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".demo-strip")).toBeVisible();
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

    const danielMapButton = danielCard.getByRole("button", {
      name: "Show Daniel Park on the map",
    });
    await danielMapButton.focus();
    await expect(danielMapButton).toBeFocused();
    await danielMapButton.press("Enter");
    await expect(danielMapButton).toHaveAttribute("aria-pressed", "true");
    await expect(danielMarker).toHaveAttribute("aria-pressed", "true");

    await danielMarker.click();
    await expect(danielMarker).toHaveAttribute("aria-pressed", "true");
    await expect(danielCard).toHaveAttribute("data-selected", "true");
    await expect
      .poll(() =>
        danielCard.evaluate((card) => document.activeElement === card),
      )
      .toBe(true);
    const danielMapDetail = page.getByRole("region", {
      name: "Daniel Park map details",
    });
    await expect(danielMapDetail).toBeVisible();
    await expect(
      danielMapDetail.getByText("Primary training location", { exact: true }),
    ).toBeVisible();
    await expect(
      danielMapDetail.getByText(danielTodayLabel, { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("coach-map-selected.png"),
      fullPage: true,
    });
    await page.screenshot({
      path: testInfo.outputPath("coach-map-selected-viewport.png"),
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

  const discipline = page
    .getByRole("navigation", { name: "Browse coaches by discipline" })
    .getByRole("link", { name: "Muay Thai", exact: true });
  await discipline.focus();
  await expect(discipline).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/discipline=Muay(\+|%20)Thai/);
  const filteredCards = page.locator(".compact-coach-card.result");
  await expect(filteredCards.first()).toBeVisible();
  const filteredCount = await filteredCards.count();
  await expect(
    page.getByText(`${filteredCount} coach${filteredCount === 1 ? "" : "es"}`, {
      exact: true,
    }),
  ).toBeVisible();
  for (const card of await filteredCards.all()) {
    await expect(
      card
        .locator(".compact-coach-disciplines span")
        .filter({ hasText: /^Muay Thai(?:\s*·)?$/ }),
    ).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Sam Lee" })).toBeVisible();
  const filteredMap = page.getByLabel("Matching coach locations");
  const filteredMapUnavailable = page.getByText("Map unavailable", {
    exact: true,
  });
  await expect(filteredMap.or(filteredMapUnavailable)).toBeVisible({
    timeout: 30_000,
  });
  if (await filteredMap.isVisible()) {
    await expect(
      page.getByRole("button", { name: /Select Sam Lee at/ }),
    ).toBeVisible();
    await expect(page.locator("button.location-map-marker")).toHaveCount(
      filteredCount,
    );
  }
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

test("desktop Explore keeps a bounded 60/40 comparison layout across breakpoints", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(page.getByText("5 coaches", { exact: true })).toBeVisible();

  for (const viewport of [
    { width: 1440, height: 1040, columns: true },
    { width: 1024, height: 900, columns: true },
    { width: 768, height: 900, columns: false },
  ]) {
    await page.setViewportSize(viewport);
    const measurements = await page
      .locator(".coach-explore-layout")
      .evaluate((layout) => {
        const list = layout.querySelector(".coach-card-grid");
        const map = layout.querySelector(".coach-map-panel");
        if (!(list instanceof HTMLElement) || !(map instanceof HTMLElement)) {
          throw new Error("Explore layout regions are missing");
        }
        const layoutBounds = layout.getBoundingClientRect();
        const listBounds = list.getBoundingClientRect();
        const mapBounds = map.getBoundingClientRect();
        return {
          listRatio: listBounds.width / layoutBounds.width,
          sideBySide: Math.abs(listBounds.top - mapBounds.top) < 2,
          mapPosition: getComputedStyle(map).position,
          mapTop: Number.parseFloat(getComputedStyle(map).top),
          mapMaxHeight: getComputedStyle(map).maxHeight,
          noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
        };
      });

    expect(measurements.noOverflow).toBe(true);
    expect(measurements.sideBySide).toBe(viewport.columns);
    if (viewport.columns) {
      expect(measurements.listRatio).toBeGreaterThan(0.5);
      expect(measurements.listRatio).toBeLessThan(0.7);
      expect(measurements.mapPosition).toBe("sticky");
      expect(measurements.mapTop).toBeGreaterThanOrEqual(76);
      expect(measurements.mapMaxHeight).not.toBe("none");
    } else {
      expect(measurements.mapPosition).toBe("static");
      expect(measurements.mapMaxHeight).toBe("none");
    }
  }
});

test("desktop Explore keeps every coach and profile link when the map provider fails", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort("failed"),
  );
  await page.goto("/explore");

  await expect(
    page
      .getByLabel("Coach location map")
      .getByText("Map unavailable", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  const cards = page.locator(".compact-coach-card.result");
  await expect(cards).toHaveCount(5);
  await expect(
    page.getByRole("link", { name: /View Daniel Park's coach profile/ }),
  ).toHaveAttribute("href", "/coaches/daniel-park");
  await expect(
    page.getByRole("button", { name: /Show .* on the map/ }),
  ).toHaveCount(0);
  await expect(page.locator(".coach-explore-layout")).toHaveClass(
    /map-unavailable/,
  );
  const listRatio = await page
    .locator(".coach-explore-layout")
    .evaluate(
      (layout) =>
        (layout.querySelector(".coach-card-grid")?.getBoundingClientRect()
          .width ?? 0) / layout.getBoundingClientRect().width,
    );
  expect(listRatio).toBeGreaterThan(0.68);
  await expect(
    page.getByText(/same coach results remain available in the list/i),
  ).toBeVisible();
});

test("desktop Explore keeps both result surfaces for a mobile view URL", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop non-regression only");
  await page.goto("/explore?view=map");

  await expect(page.locator(".compact-coach-card.result")).toHaveCount(5);
  await expect(page.getByLabel("Coach location map")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Explore results view" }),
  ).toBeHidden();
});

test("mobile Explore preserves filters and browser history while switching views", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile view-state only");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/explore?discipline=Boxing");

  const viewSwitch = page.getByRole("navigation", {
    name: "Explore results view",
  });
  const listView = viewSwitch.getByRole("link", { name: /List/ });
  const mapView = viewSwitch.getByRole("link", { name: "Map", exact: true });
  await expect(listView).toHaveAttribute("aria-current", "page");
  await expect(
    page.locator(".compact-coach-card.result").first(),
  ).toBeVisible();
  await expect(page.getByLabel("Coach location map")).toBeHidden();

  await mapView.click();
  await expect(page).toHaveURL(/discipline=Boxing.*view=map/);
  await expect(mapView).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Coach location map")).toBeVisible();
  await expect(page.locator(".compact-coach-card.result").first()).toBeHidden();
  const mapViewport = await page
    .locator(".coach-map-canvas")
    .evaluate((map) => {
      const bounds = map.getBoundingClientRect();
      return { height: bounds.height, viewportHeight: window.innerHeight };
    });
  expect(mapViewport.height / mapViewport.viewportHeight).toBeGreaterThan(0.5);
  await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("mobile-map-view.png"),
  });

  await page.reload();
  await expect(page).toHaveURL(/discipline=Boxing.*view=map/);
  await expect(page.getByLabel("Coach location map")).toBeVisible();
  await page.getByRole("link", { name: "Back to list" }).click();
  await expect(page).toHaveURL(/discipline=Boxing.*view=list/);
  await expect(
    page.locator(".compact-coach-card.result").first(),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/discipline=Boxing.*view=map/);
  await expect(page.getByLabel("Coach location map")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/explore\?discipline=Boxing$/);
  await expect(
    page.locator(".compact-coach-card.result").first(),
  ).toBeVisible();

  await page.goto("/explore?discipline=Boxing&view=grid");
  await expect(page).toHaveURL(/\/explore\?discipline=Boxing$/);
  await expect(listView).toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 430, height: 932 });
  const controlSizes = await viewSwitch.locator("a").evaluateAll((controls) =>
    controls.map((control) => {
      const bounds = control.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    }),
  );
  for (const size of controlSizes) {
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.setViewportSize({ width: 667, height: 375 });
  await viewSwitch.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page.getByRole("link", { name: "Back to list" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("mobile card selection opens a focused truthful map preview", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile map preview only");
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/explore?discipline=Boxing");

  const danielCard = page.locator(".compact-coach-card.result").filter({
    has: page.getByRole("heading", { name: "Daniel Park" }),
  });
  await danielCard
    .getByRole("button", { name: "Show Daniel Park on the map" })
    .click();
  await expect(page).toHaveURL(/discipline=Boxing.*view=map/);

  const danielPreview = page.getByRole("region", {
    name: "Daniel Park map details",
  });
  await expect(danielPreview).toBeVisible();
  await expect(danielPreview).toBeFocused();
  await expect(
    danielPreview.getByText("Primary training location", { exact: true }),
  ).toBeVisible();
  await expect(
    danielPreview.getByRole("link", {
      name: "View full profile and schedule",
    }),
  ).toHaveAttribute("href", "/coaches/daniel-park");
  await expect(
    danielPreview.getByRole("button", { name: /request|book/i }),
  ).toHaveCount(0);
  const selectedLayout = await page.evaluate(() => {
    const preview = document.querySelector(".coach-map-detail");
    const map = document.querySelector(".coach-map-canvas");
    if (!preview || !map) return null;
    const previewBounds = preview.getBoundingClientRect();
    const mapBounds = map.getBoundingClientRect();
    return {
      mapHeight: mapBounds.height,
      viewportHeight: window.innerHeight,
      previewBottom: previewBounds.bottom,
      mapTop: mapBounds.top,
    };
  });
  expect(selectedLayout).not.toBeNull();
  expect(
    selectedLayout!.mapHeight / selectedLayout!.viewportHeight,
  ).toBeGreaterThan(0.45);
  expect(selectedLayout!.previewBottom).toBeLessThanOrEqual(
    selectedLayout!.mapTop + 1,
  );
  await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("mobile-selected-coach-map.png"),
  });

  const mapPanel = page.getByLabel("Coach location map");
  for (let zoomStep = 0; zoomStep < 3; zoomStep += 1) {
    await mapPanel.getByRole("button", { name: "Zoom out" }).click();
    await page.waitForTimeout(250);
  }
  const samMarker = page.getByRole("button", { name: /Select Sam Lee at/ });
  await expect(samMarker).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => {
      const marker = await samMarker.boundingBox();
      const canvas = await page
        .getByLabel("Matching coach locations")
        .boundingBox();
      return Boolean(
        marker &&
        canvas &&
        marker.x >= canvas.x &&
        marker.y >= canvas.y &&
        marker.x + marker.width <= canvas.x + canvas.width &&
        marker.y + marker.height <= canvas.y + canvas.height,
      );
    })
    .toBe(true);
  await samMarker.click();
  const samPreview = page.getByRole("region", { name: "Sam Lee map details" });
  await expect(samPreview).toBeVisible();
  await expect(samPreview).toBeFocused();
  await expect(
    samPreview.getByText("No availability today", { exact: true }),
  ).toBeVisible();
});

test("mobile map failure replaces the failed view with the complete list", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile recovery only");
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort("failed"),
  );
  await page.goto("/explore?discipline=Boxing&view=map");

  await expect(page).toHaveURL(/discipline=Boxing.*view=list/, {
    timeout: 30_000,
  });
  await expect(
    page.locator(".compact-coach-card.result").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Map unavailable. Showing the complete coach list."),
  ).toBeVisible();
  const viewSwitch = page.getByRole("navigation", {
    name: "Explore results view",
  });
  await expect(
    viewSwitch.getByRole("link", { name: "Map", exact: true }),
  ).toHaveCount(0);
  await expect(viewSwitch.getByText("Map unavailable")).toBeVisible();
  await expect(page.getByLabel("Coach location map")).toBeHidden();
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
