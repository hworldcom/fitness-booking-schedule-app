import { expect, test } from "@playwright/test";

test("home presents the focused scheduling loop", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(
    /Discover coaches and request private sessions/,
  );
  await expect(
    page.getByRole("heading", {
      name: "Find your coach. Achieve your goals.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Discover coaches in Berlin",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Three steps from search to a clear answer.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Pick a published hour", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Request confirmation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/request stays pending until the coach accepts it/i),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "How coach confirmation works" }),
  ).toHaveCount(0);
  await expect(page.locator(".marketplace-home-hero .eyebrow")).toHaveCount(0);
  await expect(page.locator(".marketplace-home-confirmation-note")).toHaveCount(
    0,
  );
  const previewGrid = page.locator(".home-coach-grid");
  const previewState = page.locator(".home-coach-discovery-state");
  await expect(previewGrid.or(previewState)).toBeVisible();
  if (await previewGrid.isVisible()) {
    const cards = previewGrid.locator(".compact-coach-card");
    expect(await cards.count()).toBeGreaterThan(0);
    expect(await cards.count()).toBeLessThanOrEqual(15);
    const firstCard = cards.first();
    const profileLink = firstCard.getByRole("link", {
      name: /View profile and schedule/,
    });
    await expect(profileLink).toHaveAttribute(
      "href",
      /^\/coaches\/[a-z0-9-]+$/,
    );
    await expect(
      firstCard.getByText(/Verified coach|Demo coach/, { exact: true }),
    ).toBeVisible();
    if ((await cards.count()) > 1) {
      await expect(cards.nth(1).locator(".avatar img")).toHaveCount(0);
      await expect(cards.nth(1).locator(".avatar")).not.toBeEmpty();
    }
    await profileLink.click();
    await expect(page).toHaveURL(/\/coaches\/[a-z0-9-]+$/);
    await page.goBack();
    await expect(
      page.getByRole("heading", {
        name: "Find your coach. Achieve your goals.",
      }),
    ).toBeVisible();
  } else {
    await expect(
      previewState.getByRole("heading", {
        name: /Coach discovery is temporarily unavailable|No public coaches yet/,
      }),
    ).toBeVisible();
  }
  await expect(
    page
      .locator(".marketplace-home-coach-cta")
      .getByRole("link", { name: "Become a coach" }),
  ).toHaveAttribute(
    "href",
    "/sign-in?intent=coach&returnTo=%2Fprofile%2Fcoach",
  );
  const copy = await page.locator("main").innerText();
  expect(copy).not.toMatch(
    /Solana|wallet|EURC|credits|group funding|pass purchase|24 hours|near you|rating|price/i,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("scheduling-story-home.png"),
    fullPage: true,
  });
});

test("home marketplace remains usable at the adopted review widths", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  for (const [width, height] of [
    [375, 812],
    [393, 852],
    [430, 900],
    [768, 900],
    [1024, 900],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 0));
    const searchBounds = await page.locator(".home-coach-search").boundingBox();
    expect(searchBounds?.height).toBeLessThanOrEqual(66);
    const image = page.locator(".marketplace-home-hero-image");
    await expect(image).toHaveJSProperty("complete", true);
    expect(
      await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    ).toBeGreaterThan(0);
    const imageBounds = await image.boundingBox();
    const headlineBounds = await page
      .getByRole("heading", { name: "Find your coach. Achieve your goals." })
      .boundingBox();
    expect(headlineBounds!.x).toBeGreaterThanOrEqual(imageBounds!.x);
    expect(headlineBounds!.y).toBeGreaterThanOrEqual(imageBounds!.y);
    expect(headlineBounds!.x + headlineBounds!.width).toBeLessThanOrEqual(
      imageBounds!.x + imageBounds!.width + 1,
    );
    expect(headlineBounds!.y + headlineBounds!.height).toBeLessThanOrEqual(
      imageBounds!.y + imageBounds!.height + 1,
    );
    const coachNames = page.locator(
      ".home-coach-grid .compact-coach-identity h3",
    );
    for (
      let index = 0;
      index < Math.min(2, await coachNames.count());
      index++
    ) {
      const name = await coachNames.nth(index).boundingBox();
      expect(name!.y + name!.height).toBeLessThanOrEqual(height);
    }
    await expect(
      page.getByRole("form", { name: "Search coaches" }),
    ).toBeVisible();
    await expect(page.locator('input[name="q"]')).toHaveCount(0);
    const discipline = page.getByRole("combobox", {
      name: "Discipline",
      exact: true,
    });
    const location = page.getByLabel("Where in Berlin?", { exact: true });
    await discipline.focus();
    await expect(discipline).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(location).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Search coaches", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("heading", {
        name: "Discover coaches in Berlin",
      }),
    ).toBeVisible();
    await expect(
      page
        .locator(".marketplace-home-coach-cta")
        .getByRole("link", { name: "Become a coach" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("how it works guides athletes and coaches through real training choices", async ({
  page,
}, testInfo) => {
  await page.goto("/how-it-works");
  await expect(page).toHaveTitle(/How it works/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Good coaching.More personal.",
  );
  const navigation = page.getByRole("navigation", { name: "On this page" });
  await expect(navigation.getByRole("link")).toHaveCount(3);
  await navigation
    .getByRole("link", { name: "For coaches", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#coaches$/);
  await expect(page.locator("#coaches")).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Become a coach", exact: true }),
  ).toHaveAttribute(
    "href",
    "/sign-in?intent=coach&returnTo=%2Fprofile%2Fcoach",
  );
  await navigation.getByRole("link", { name: "Common questions" }).click();
  const confirmation = page
    .locator("summary")
    .filter({ hasText: "When is my session confirmed?" });
  await confirmation.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      /Reaching the minimum does not confirm the class automatically/,
    ),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(confirmation.locator("..")).not.toHaveAttribute("open");
  await expect(
    page.getByRole("link", { name: "Find a coach", exact: true }),
  ).toHaveAttribute("href", "/explore");
  await expect(
    page.getByRole("link", { name: "Explore group classes", exact: true }),
  ).toHaveAttribute("href", "/events");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("athlete-coach-how-it-works.png"),
    fullPage: true,
  });
});

test("public routes use the compact marketplace header", async ({
  page,
}, testInfo) => {
  for (const path of [
    "/",
    "/explore",
    "/coaches/daniel-park",
    "/how-it-works",
    "/sign-in",
  ]) {
    await page.goto(path);
    await expect(page.locator(".public-header")).toBeVisible();
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(page.locator(".mobile-nav")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Public navigation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "How it works", exact: true }).first(),
    ).toBeVisible();
  }

  await page.goto("/");
  await expect(page.locator(".demo-strip")).toHaveCount(0);
  await expect(
    page
      .getByRole("banner")
      .getByRole("link", { name: "Become a coach", exact: true }),
  ).toHaveAttribute(
    "href",
    "/sign-in?returnTo=%2Fprofile%2Fcoach&intent=coach",
  );
  await expect(
    page.getByRole("link", { name: "My sessions", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Coach", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Events", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Following", exact: true }),
  ).toHaveCount(0);

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "MovX Club home" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Explore", exact: true }).first(),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Events", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "How it works", exact: true }).first(),
  ).toBeFocused();

  await page.getByRole("button", { name: "Fictional profiles" }).click();
  await expect(page.getByText(/focused scheduling preview/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/focused scheduling preview/)).toHaveCount(0);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".public-header")).toHaveCSS(
      "position",
      "sticky",
    );
  }
});

test("Profile keeps identity boundaries and independent framing", async ({
  page,
}, testInfo) => {
  const projectViewport = page.viewportSize();
  const widths =
    projectViewport && projectViewport.width <= 760 ? [375, 430] : [1440];
  for (const width of widths) {
    if (projectViewport)
      await page.setViewportSize({ width, height: projectViewport.height });
    await page.goto("/profile");
    const destination = new URL(page.url());
    if (destination.pathname === "/sign-in") {
      expect(destination.searchParams.get("returnTo")).toBe("/profile");
      await expect(page.locator(".public-header")).toBeVisible();
      await expect(page.locator(".authenticated-app-main")).toHaveCount(0);
      continue;
    }
    await expect(page.locator(".profile-shell")).toBeVisible();
    await expect(page.locator(".account-shell-header")).toBeVisible();
    await expect(page.locator(".profile-page-content")).toBeVisible();
    await expect(page.locator(".authenticated-sidebar")).toHaveCount(0);
    await expect(page.locator(".authenticated-mobile-nav")).toHaveCount(0);
    await expect(page.locator(".app-footer")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Skip to profile" }),
    ).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`independent-profile-${width}.png`),
      fullPage: true,
    });
  }
});

test("Home filters stay in one reload-safe grid and Explore retains query search", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("form", { name: "Search coaches" });
  await expect(search.locator('[name="q"]')).toHaveCount(0);
  const navigation = page.getByRole("navigation", {
    name: "Browse coaches by discipline",
  });
  await expect(
    navigation.getByRole("link", { name: "All disciplines", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await search.getByLabel("Discipline", { exact: true }).fill("Muay Thai");
  await search.getByLabel("Where in Berlin?").fill(" Kreuzberg ");
  await search.getByLabel("Where in Berlin?").press("Enter");
  await expect(page).toHaveURL(/\/\?discipline=Muay\+Thai&location=Kreuzberg$/);
  await expect(search.getByLabel("Discipline")).toHaveValue("Muay Thai");
  await expect(search.getByLabel("Where in Berlin?")).toHaveValue("Kreuzberg");
  await expect(
    navigation.getByRole("link", { name: "Muay Thai", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("link", { name: "Boxing", exact: true }).click();
  await expect(page).toHaveURL(/\/\?discipline=Boxing&location=Kreuzberg$/);
  await page.reload();
  await expect(search.getByLabel("Discipline")).toHaveValue("Boxing");
  await page.goBack();
  await expect(search.getByLabel("Discipline")).toHaveValue("Muay Thai");
  await page.goForward();
  await expect(search.getByLabel("Discipline")).toHaveValue("Boxing");
  await page
    .locator(".home-coach-discovery-heading")
    .getByRole("link", { name: "Clear filters" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(search.getByLabel("Discipline")).toHaveValue("");
  await expect(search.getByLabel("Where in Berlin?")).toHaveValue("");
  await search.getByLabel("Discipline").fill("Unsupported discipline");
  await search.getByRole("button", { name: "Search coaches" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(
    await search
      .getByLabel("Discipline")
      .evaluate((input: HTMLInputElement) => input.validity.valid),
  ).toBe(false);
  await navigation
    .getByRole("link", { name: "All disciplines", exact: true })
    .click();
  await expect(search.getByLabel("Discipline")).toHaveValue("");
  await page.goto(
    "/?q=ignored&discipline=Yoga&page=9999999999999999999&view=map",
  );
  await expect(page).toHaveURL(/\/$/);

  await page.goto(
    "/explore?q=patient%20footwork&q=ignored&discipline=Yoga&location=%20Kreuzberg%20&when=tomorrow",
  );
  await expect(page).toHaveURL(
    /\/explore\?q=patient\+footwork&location=Kreuzberg$/,
  );
  await expect(search.getByLabel("Search coach or focus")).toHaveValue(
    "patient footwork",
  );
  await expect(search.getByLabel("Discipline")).toHaveValue("");
  await page
    .getByRole("navigation", { name: "Browse coaches by discipline" })
    .getByRole("link", { name: "Boxing", exact: true })
    .click();
  await expect(page).toHaveURL(
    /q=patient\+footwork&discipline=Boxing&location=Kreuzberg$/,
  );
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(search.getByLabel("Search coach or focus")).toHaveValue("");
});

test("Home typed discipline and Explore query search submit without JavaScript", async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1040 },
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    const search = page.getByRole("form", { name: "Search coaches" });
    await expect(search.locator('[name="q"]')).toHaveCount(0);
    await search.getByLabel("Discipline").fill("boxing");
    await search.getByLabel("Where in Berlin?").fill(" Kreuzberg ");
    await search
      .getByRole("button", { name: "Search coaches" })
      .click({ force: true });
    await expect(page).toHaveURL(/\/\?discipline=Boxing&location=Kreuzberg$/);
    await expect(search.getByLabel("Discipline")).toHaveValue("Boxing");
    await page
      .getByRole("navigation", { name: "Browse coaches by discipline" })
      .getByRole("link", { name: "All disciplines", exact: true })
      .click({ force: true });
    await expect(page).toHaveURL(/\/\?location=Kreuzberg$/);
    await expect(search.getByLabel("Discipline")).toHaveValue("");
    await page.goto("/explore");
    await search.getByLabel("Search coach or focus").fill("boxing basics");
    await search.getByLabel("Discipline").fill("boxing");
    await search.getByLabel("Where in Berlin?").fill(" Kreuzberg ");
    await search
      .getByRole("button", { name: "Search coaches" })
      .click({ force: true });
    await expect(page).toHaveURL(
      /\/explore\?q=boxing\+basics&discipline=Boxing&location=Kreuzberg$/,
    );
    await expect(search.getByLabel("Search coach or focus")).toHaveValue(
      "boxing basics",
    );
  } finally {
    await context.close();
  }
});
