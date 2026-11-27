import { expect, test } from "@playwright/test";
import { setExploreCategories } from "./explore-controls";

test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      json: { version: 8, sources: {}, layers: [] },
    }),
  );
});

test("Explore category alternatives use the real public directory once per coach and preserve other filters", async ({
  page,
}) => {
  await page.goto("/explore?location=Berlin&session=private&view=list");
  const cards = page.locator(".explore-profiles .compact-coach-card.result");
  const names = () => cards.locator("h3").allTextContents();
  const categories = page.locator(".explore-category-filter");
  await setExploreCategories(page, ["Boxing", "Fitness"]);
  await expect(cards).toHaveCount(3);
  expect((await names()).sort()).toEqual([
    "Daniel Park",
    "Jake Miller",
    "Sam Lee",
  ]);
  await expect(categories.locator("summary")).toHaveAttribute(
    "aria-label",
    "Categories, 2 selected",
  );
  expect(new URL(page.url()).searchParams.get("location")).toBe("Berlin");
  expect(new URL(page.url()).searchParams.get("session")).toBe("private");

  await page
    .getByRole("button", { name: "Save Jake Miller", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show saved coaches", exact: true })
    .click();
  await expect(cards).toHaveCount(1);
  expect(await names()).toEqual(["Jake Miller"]);
  expect(new URL(page.url()).searchParams.getAll("discipline")).toEqual([
    "Boxing",
    "Fitness",
  ]);
  await page
    .getByRole("button", { name: "Show saved coaches", exact: true })
    .click();
  await expect(cards).toHaveCount(3);

  // Both layouts expose the same native history contract through their links.
  await page.getByRole("link", { name: /^(Map|Show map)$/ }).click();
  await expect(page.locator(".location-map-marker")).toHaveCount(3);
  await page.reload();
  await expect(
    categories.locator('input[name="discipline"]:checked'),
  ).toHaveCount(2);
  await page.goBack();
  await expect(cards).toHaveCount(3);
  await page.goForward();
  await expect(page.locator(".explore-map-layout")).toBeVisible();
  await page.getByRole("link", { name: /^(Profiles|Show profiles)$/ }).click();

  await setExploreCategories(page, ["Boxing", "Muay Thai"]);
  await expect(cards).toHaveCount(2);
  expect((await names()).sort()).toEqual(["Daniel Park", "Sam Lee"]);
  await setExploreCategories(page, []);
  await expect(cards).toHaveCount(6);
  expect(new URL(page.url()).searchParams.getAll("discipline")).toEqual([]);
  expect(new URL(page.url()).searchParams.get("location")).toBe("Berlin");
  expect(new URL(page.url()).searchParams.get("session")).toBe("private");
});

test("native GET applies and clears multiple categories without JavaScript while preserving the search", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(
      "http://127.0.0.1:3101/explore?discipline=fitness&discipline=boxing&discipline=BOXING&location=Berlin&view=list",
    );
    expect(new URL(page.url()).searchParams.getAll("discipline")).toEqual([
      "Boxing",
      "Fitness",
    ]);
    const categories = page.locator(".explore-category-filter");
    const cards = page.locator(".compact-coach-card.result");
    await expect(cards).toHaveCount(3);
    await categories.locator("summary").click();
    await expect(
      categories.getByRole("button", { name: "Clear selection", exact: true }),
    ).toBeDisabled();
    await categories
      .getByRole("checkbox", { name: "Fitness", exact: true })
      .uncheck();
    await categories
      .getByRole("checkbox", { name: "Muay Thai", exact: true })
      .check();
    await categories
      .getByRole("button", { name: "Apply categories", exact: true })
      .click();
    expect(new URL(page.url()).searchParams.getAll("discipline")).toEqual([
      "Boxing",
      "Muay Thai",
    ]);
    await expect(cards).toHaveCount(2);
    expect((await cards.locator("h3").allTextContents()).sort()).toEqual([
      "Daniel Park",
      "Sam Lee",
    ]);
    await categories.locator("summary").click();
    await categories
      .getByRole("checkbox", { name: "Boxing", exact: true })
      .uncheck();
    await categories
      .getByRole("checkbox", { name: "Muay Thai", exact: true })
      .uncheck();
    await categories
      .getByRole("button", { name: "Apply categories", exact: true })
      .click();
    await expect(cards).toHaveCount(6);
    expect(new URL(page.url()).searchParams.get("location")).toBe("Berlin");
    expect(new URL(page.url()).searchParams.get("view")).toBe("list");
  } finally {
    await context.close();
  }
});
