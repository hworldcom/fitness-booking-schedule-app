import { expect, test } from "@playwright/test";

test("unavailable Explore retains compact search, view and retry without substitute inventory", async ({
  page,
}, testInfo) => {
  await page.goto("/explore?discipline=Boxing&view=map");
  const unavailable = page.getByRole("heading", {
    name: "Coach discovery is temporarily unavailable.",
  });
  test.skip(
    !(await unavailable.isVisible()),
    "Requires the configuration-free production preview; actual directory behavior is checked separately.",
  );
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 375 : 1440,
    height: 1040,
  });
  await expect(
    page.getByRole("heading", {
      name: "Find your discipline. Meet your coach.",
    }),
  ).toBeVisible();
  const search = page.getByRole("form", { name: "Search coaches" });
  await expect(search).toBeVisible();
  await search.getByLabel("Search coach or focus").fill("patient footwork");
  await search.getByLabel("Where in Berlin?").press("Enter");
  await expect(page).toHaveURL(
    /q=patient\+footwork&discipline=Boxing&view=map$/,
  );
  await expect(unavailable).toBeVisible();
  await expect(page.locator(".compact-coach-card")).toHaveCount(0);
  await expect(page.locator(".coach-map-panel")).toHaveCount(0);
  const retry = page.getByRole("link", { name: "Try again", exact: true });
  await expect(retry).toHaveAttribute(
    "href",
    "/explore?q=patient+footwork&discipline=Boxing&view=map",
  );
  await retry.click();
  await expect(unavailable).toBeVisible();
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/explore\?view=map$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("explore-unavailable.png"),
    fullPage: true,
  });
});
