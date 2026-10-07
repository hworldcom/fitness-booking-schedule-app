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
  await expect(page.getByText(/Fictional coaches and places/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Map of matching coaches" }),
  ).toBeVisible();
  const mapCanvas = page.getByLabel("Matching coach locations");
  const unavailableState = page.getByText("Map unavailable", { exact: true });
  await expect(mapCanvas.or(unavailableState)).toBeVisible({ timeout: 30_000 });
  if (await mapCanvas.isVisible()) {
    await expect(page.locator("button.coach-map-marker")).toHaveCount(5);
    await expect(page.locator(".mapboxgl-ctrl-attrib")).toBeVisible();
  } else {
    await expect(page.getByText(/Mapbox is not configured yet/)).toBeVisible();
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
    page.getByText("Northside Combat", { exact: true }),
  ).toBeVisible();
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
