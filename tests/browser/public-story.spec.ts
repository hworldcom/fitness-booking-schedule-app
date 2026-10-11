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
      name: "Find the right coach. Request one clear hour.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Discovery and scheduling in four steps.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("See real open hours", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Request coach confirmation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Sign in by email and request any published hour before training starts.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See how scheduling works" }),
  ).toHaveAttribute("href", "/how-it-works");
  const copy = await page.locator("main").innerText();
  expect(copy).not.toMatch(
    /Solana|wallet|EURC|credits|group funding|pass purchase|24 hours/i,
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

test("private routes retain the workspace chrome", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.locator(".public-header")).toHaveCount(0);

  if ((await page.viewportSize())!.width <= 760) {
    await expect(page.locator(".sidebar")).toBeHidden();
    await expect(page.locator(".mobile-nav")).toBeVisible();
  } else {
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator(".mobile-nav")).toBeHidden();
  }
});
