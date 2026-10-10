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
  await expect(page.getByText("Primary base", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "No open times right now.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in to book" }),
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
