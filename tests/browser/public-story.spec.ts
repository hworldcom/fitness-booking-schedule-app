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
      name: "Find your coach. Request a time that works.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "A first look at the directory.",
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
  ).toHaveAttribute("href", "/how-it-works");
  const previewGrid = page.locator(".home-coach-preview-grid");
  const previewState = page.locator(".home-coach-discovery-state");
  await expect(previewGrid.or(previewState)).toBeVisible();
  if (await previewGrid.isVisible()) {
    const cards = previewGrid.locator(".compact-coach-card");
    expect(await cards.count()).toBeGreaterThan(0);
    expect(await cards.count()).toBeLessThanOrEqual(3);
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
        name: "Find your coach. Request a time that works.",
      }),
    ).toBeVisible();
  } else {
    await expect(
      previewState.getByRole("heading", {
        name: /Coach previews are temporarily unavailable|No public coaches yet/,
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
  for (const width of [375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("form", { name: "Search coaches" }),
    ).toBeVisible();
    await expect(page.locator('input[name="q"]')).toHaveCount(0);
    const discipline = page.getByRole("combobox", {
      name: "Discipline",
      exact: true,
    });
    const location = page.getByLabel("Location", { exact: true });
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
        name: "A first look at the directory.",
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

test("how it works explains authoritative scheduling transitions", async ({
  page,
}, testInfo) => {
  await page.goto("/how-it-works");
  await expect(page).toHaveTitle(/How it works/);
  await expect(
    page.getByRole("heading", {
      name: "Published time in. Coach-confirmed session out.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "One occurrence has one active booking.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Cancellation reopens a future occurrence/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("scheduling-how-it-works.png"),
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
  await expect(page.locator(".demo-strip")).toContainText(
    "Coach discovery and coach-confirmed scheduling preview.",
  );
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
  ).toHaveCount(0);
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

test("private routes enforce identity before showing workspace chrome", async ({
  page,
}, testInfo) => {
  const projectViewport = page.viewportSize();
  const widths =
    projectViewport && projectViewport.width <= 760 ? [375, 430] : [1440];

  for (const width of widths) {
    if (projectViewport) {
      await page.setViewportSize({ width, height: projectViewport.height });
    }
    await page.goto("/profile");
    const destination = new URL(page.url());
    if (destination.pathname === "/sign-in") {
      expect(destination.searchParams.get("returnTo")).toBe("/profile");
      await expect(page.locator(".public-header")).toBeVisible();
      await expect(page.locator(".authenticated-app-main")).toHaveCount(0);
      continue;
    }
    await expect(page.locator(".public-header")).toHaveCount(0);
    await expect(page.locator(".authenticated-app-main")).toBeVisible();
    await expect(page.locator(".authenticated-topbar")).toBeVisible();

    if (width <= 760) {
      await expect(page.locator(".sidebar")).toBeHidden();
      const mobileNavigation = page.getByRole("navigation", {
        name: "Mobile navigation",
      });
      await expect(mobileNavigation).toBeVisible();
      const exploreLink = mobileNavigation.getByRole("link", {
        name: "Explore",
      });
      await expect(exploreLink).toBeVisible();
      await expect(
        mobileNavigation.getByRole("link", { name: "Profile" }),
      ).toBeVisible();
      await expect(
        mobileNavigation.getByRole("link", { name: "Home" }),
      ).toHaveCount(0);
      await expect(
        mobileNavigation.getByRole("link", { name: "How it works" }),
      ).toHaveCount(0);
      const controlSizes = await mobileNavigation
        .locator("a")
        .evaluateAll((controls) =>
          controls.map((control) => {
            const bounds = control.getBoundingClientRect();
            return { width: bounds.width, height: bounds.height };
          }),
        );
      for (const size of controlSizes) {
        expect(size.width).toBeGreaterThanOrEqual(44);
        expect(size.height).toBeGreaterThanOrEqual(44);
      }
      await exploreLink.focus();
      await expect(exploreLink).toBeFocused();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const footerContentBottom = await page
        .locator(".authenticated-app-footer .footer-contact-line")
        .evaluate((element) => element.getBoundingClientRect().bottom);
      const navigationTop = await mobileNavigation.evaluate(
        (element) => element.getBoundingClientRect().top,
      );
      expect(footerContentBottom).toBeLessThanOrEqual(navigationTop);
    } else {
      await expect(page.locator(".authenticated-sidebar")).toBeVisible();
      await expect(
        page.getByText("PRIVATE WORKSPACE", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Scheduling preview/ }),
      ).toBeVisible();
      await expect(page.locator(".mobile-nav")).toBeHidden();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`authenticated-workspace-${width}.png`),
      fullPage: true,
    });
  }
});

test("home search and discipline links share the canonical Explore contract", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("form", { name: "Search coaches" });
  await expect(search).toBeVisible();
  await expect(search.getByLabel("Search coach or focus")).toHaveCount(0);
  await expect(search.locator('[name="q"]')).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Browse coaches by discipline" })
    .getByRole("link", { name: "Boxing", exact: true })
    .click();
  await expect(page).toHaveURL(/\/explore\?discipline=Boxing$/);
  await page.goBack();
  await expect(search.locator('[name="q"]')).toHaveCount(0);
  await search.getByLabel("Discipline").selectOption("Muay Thai");
  await search.getByLabel("Location").fill(" Kreuzberg ");
  await search.getByLabel("Location").press("Enter");

  await expect(page).toHaveURL(
    /\/explore\?discipline=Muay\+Thai&location=Kreuzberg$/,
  );
  await expect(search.getByLabel("Search coach or focus")).toHaveValue("");
  await expect(search.getByLabel("Discipline")).toHaveValue("Muay Thai");
  await expect(search.getByLabel("Location")).toHaveValue("Kreuzberg");
  await search.getByLabel("Search coach or focus").fill(" patient  footwork ");
  await search.getByLabel("Search coach or focus").press("Enter");
  await expect(page).toHaveURL(
    /\/explore\?q=patient\+footwork&discipline=Muay\+Thai&location=Kreuzberg$/,
  );
  await expect(search.getByLabel("Search coach or focus")).toHaveValue(
    "patient footwork",
  );
  await expect(
    page
      .getByRole("navigation", { name: "Browse coaches by discipline" })
      .getByRole("link", { name: "Muay Thai", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page
    .getByRole("navigation", { name: "Browse coaches by discipline" })
    .getByRole("link", { name: "Boxing", exact: true })
    .click();
  await expect(page).toHaveURL(
    /q=patient\+footwork&discipline=Boxing&location=Kreuzberg$/,
  );
  await page.reload();
  await expect(search.getByLabel("Discipline")).toHaveValue("Boxing");
  await page.goBack();
  await expect(search.getByLabel("Discipline")).toHaveValue("Muay Thai");
  await page.goForward();
  await expect(search.getByLabel("Discipline")).toHaveValue("Boxing");

  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(search.getByLabel("Search coach or focus")).toHaveValue("");
  await expect(search.getByLabel("Discipline")).toHaveValue("");
  await expect(search.getByLabel("Location")).toHaveValue("");
  await expect(page.getByLabel("When", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Price", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Rating", { exact: true })).toHaveCount(0);

  await page.goto(
    "/explore?q=patient%20footwork&q=ignored&discipline=Yoga&location=%20Kreuzberg%20&when=tomorrow",
  );
  await expect(page).toHaveURL(
    /\/explore\?q=patient\+footwork&location=Kreuzberg$/,
  );
  await expect(search.getByLabel("Discipline")).toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("marketplace search submits without JavaScript", async ({
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
    await search.getByLabel("Discipline").selectOption("Boxing");
    await search.getByLabel("Location").fill(" Kreuzberg ");
    await search
      .getByRole("button", { name: "Search coaches" })
      .click({ force: true });
    await expect(page).toHaveURL(
      /\/explore\?discipline=Boxing&location=Kreuzberg$/,
    );
    await expect(search.getByLabel("Search coach or focus")).toHaveValue("");
    await expect(search.getByLabel("Discipline")).toHaveValue("Boxing");
    await expect(search.getByLabel("Location")).toHaveValue("Kreuzberg");
    await search.getByLabel("Search coach or focus").fill("boxing basics");
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
