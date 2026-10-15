import { expect, test } from "@playwright/test";

// A valid local style makes view/navigation checks independent of tile latency.
// The actual MapLibre component, coordinates and public directory still run.
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

test("Explore typed filters, shortcuts and clear preserve the active view through history", async ({
  page,
}) => {
  await page.goto("/explore?q=footwork&location=Berlin&view=map");
  const search = page.getByRole("form", { name: "Search coaches" });
  const discipline = search.getByRole("combobox", {
    name: "Discipline",
    exact: true,
  });
  await discipline.fill("boxing");
  await search.getByLabel("Where in Berlin?").press("Enter");
  await expect(page).toHaveURL(
    /q=footwork&discipline=Boxing&location=Berlin&view=map$/,
  );
  await expect(discipline).toHaveValue("Boxing");
  const shortcuts = page.getByRole("navigation", {
    name: "Browse coaches by discipline",
  });
  await shortcuts.getByRole("link", { name: "Muay Thai", exact: true }).click();
  await expect(page).toHaveURL(
    /q=footwork&discipline=Muay\+Thai&location=Berlin&view=map$/,
  );
  await page.reload();
  await expect(discipline).toHaveValue("Muay Thai");
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/explore\?view=map$/);
  await expect(discipline).toHaveValue("");
  await expect(search.getByLabel("Search coach or focus")).toHaveValue("");
  await page.goBack();
  await expect(discipline).toHaveValue("Muay Thai");
  await expect(search.getByLabel("Search coach or focus")).toHaveValue(
    "footwork",
  );
  await page.goForward();
  await expect(page).toHaveURL(/\/explore\?view=map$/);
  await discipline.fill("Yoga");
  await search.getByRole("button", { name: "Search coaches" }).click();
  await expect(page).toHaveURL(/\/explore\?view=map$/);
  expect(
    await discipline.evaluate(
      (input: HTMLInputElement) => input.validity.valid,
    ),
  ).toBe(false);
  await shortcuts
    .getByRole("link", { name: "All disciplines", exact: true })
    .click();
  await expect(discipline).toHaveValue("");
  await search
    .getByLabel("Search coach or focus")
    .fill("no-such-coach-dev0236");
  await search.getByLabel("Search coach or focus").press("Enter");
  await expect(
    page.getByRole("heading", { name: "No coaches match these filters." }),
  ).toBeVisible();
  await expect(page.locator(".compact-coach-card.result")).toHaveCount(0);
  await expect(page.locator(".coach-map-panel")).toHaveCount(0);
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/explore\?view=map$/);
  await expect(page.locator(".compact-coach-card.result")).toHaveCount(5);
});

test("Explore shares Home's search and cards without introducing a Home query field", async ({
  page,
}, testInfo) => {
  const widths =
    testInfo.project.name === "mobile" ? [375, 430] : [768, 1024, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1040 });
    await page.goto("/explore");
    const search = page.getByRole("form", { name: "Search coaches" });
    const query = search.getByLabel("Search coach or focus");
    await query.focus();
    await page.keyboard.press("Tab");
    await expect(
      search.getByRole("combobox", { name: "Discipline", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(search.getByLabel("Where in Berlin?")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      search.getByRole("button", { name: "Search coaches" }),
    ).toBeFocused();
    const cards = page.locator(".compact-coach-card.result");
    await expect(cards).toHaveCount(5);
    await expect(cards.locator(".compact-coach-bio")).toHaveCount(0);
    await expect(cards.first().locator(".avatar img")).toHaveAttribute(
      "src",
      "/images/coaches/daniel-park.webp",
    );
    await expect(cards.nth(1).locator(".avatar")).toHaveText("ED");
    const containedActions = await cards.evaluateAll((rows) =>
      rows.every((card) => {
        const bounds = card.getBoundingClientRect();
        return [...card.querySelectorAll(".compact-coach-actions > *")].every(
          (action) => {
            const rect = action.getBoundingClientRect();
            return (
              rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
            );
          },
        );
      }),
    );
    expect(containedActions).toBe(true);

    const gridColumns = await page
      .locator(".coach-card-grid")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    expect(gridColumns).toBe(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`explore-${width}.png`),
      fullPage: true,
    });
    await cards.first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`explore-cards-${width}.png`),
    });
    // Stress wrapping using temporary browser-only content, then reload below.
    await cards.first().evaluate((card) => {
      card.querySelector("h3")!.textContent = "Avery".repeat(35);
      card.querySelector(".compact-coach-location strong")!.textContent =
        "LongTrainingPlace".repeat(25);
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto("/");
    await expect(page.locator('input[name="q"]')).toHaveCount(0);
    await expect(page.locator(".coach-map-panel")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Find your coach. Make time to train.",
      }),
    ).toBeVisible();
  }
});

test("Explore typed aliases and explicit view submit without JavaScript", async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1040 },
  });
  const page = await context.newPage();
  try {
    await page.goto("/explore?view=list");
    const search = page.getByRole("form", { name: "Search coaches" });
    await search.getByLabel("Search coach or focus").fill("escapes");
    await search.getByLabel("Discipline").fill("bjj");
    await search.getByLabel("Where in Berlin?").fill(" Berlin ");
    await search
      .getByRole("button", { name: "Search coaches" })
      .click({ force: true });
    await expect(page).toHaveURL(
      /q=escapes&discipline=Brazilian\+Jiu-Jitsu&location=Berlin&view=list$/,
    );
    await expect(search.getByLabel("Discipline")).toHaveValue(
      "Brazilian Jiu-Jitsu",
    );
    await expect(
      page.getByRole("heading", { name: "Idris Malik", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Clear search" })
      .click({ force: true });
    await expect(page).toHaveURL(/\/explore\?view=list$/);
    await expect(page.locator(".compact-coach-card.result")).toHaveCount(5);
  } finally {
    await context.close();
  }
});
