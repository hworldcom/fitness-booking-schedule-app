import { expect, test } from "@playwright/test";

test("home keeps discovery and the calendar together with a concise coach invitation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Find training\. Build your routine\./);
  await expect(
    page.getByRole("heading", {
      name: "Find your training. Build your routine.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Discover coaches in Berlin",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "All your training. One calendar.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "How MovX works", exact: true }),
  ).toHaveAttribute("href", "/how-it-works");
  await expect(page.locator(".coach-step-grid")).toHaveCount(0);
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
    expect(await cards.count()).toBeLessThanOrEqual(4);
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
        name: "Find your training. Build your routine.",
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
      .locator(".home-coach-invitation")
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
    const searchBounds = await page
      .getByRole("navigation", { name: "Browse coaches by discipline" })
      .boundingBox();
    expect(searchBounds?.height).toBeLessThanOrEqual(66);
    const image = page.locator(".marketplace-home-hero-image");
    await expect(image).toHaveJSProperty("complete", true);
    expect(
      await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    ).toBeGreaterThan(0);
    const imageBounds = await image.boundingBox();
    const headlineBounds = await page
      .getByRole("heading", { name: "Find your training. Build your routine." })
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
    ).toHaveCount(0);
    await expect(page.locator("input")).toHaveCount(0);
    const boxing = page
      .getByRole("navigation", { name: "Browse coaches by discipline" })
      .getByRole("link", { name: "Boxing", exact: true });
    await boxing.focus();
    await expect(boxing).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\?discipline=Boxing$/);
    await expect(boxing).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", {
        name: "Discover coaches in Berlin",
      }),
    ).toBeVisible();
    await expect(
      page
        .locator(".home-coach-invitation")
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
    "Your training.Your rhythm.",
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
    page
      .locator("#coaches")
      .getByRole("link", { name: "Become a coach", exact: true }),
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
