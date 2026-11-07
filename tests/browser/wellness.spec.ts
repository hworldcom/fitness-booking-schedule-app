import { expect, test } from "@playwright/test";

test("Wellness stays visible and selected through keyboard discovery and reload", async ({
  page,
}, testInfo) => {
  await page.goto("/?discipline=Wellness");
  await expect(page.locator(".home-training-intro")).toContainText(
    "Discover coaches and group sessions, plan your weekly workouts and recovery,",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /plan your weekly workouts and recovery/,
  );
  const navigation = page.getByRole("navigation", {
    name: "Browse coaches by discipline",
  });
  const wellness = navigation.getByRole("link", {
    name: "Wellness",
    exact: true,
  });
  await expect(wellness).toHaveAttribute("aria-current", "page");
  await expect
    .poll(() =>
      wellness.evaluate((element) => {
        const item = element.getBoundingClientRect();
        const track = element.parentElement!.getBoundingClientRect();
        return item.left >= track.left && item.right <= track.right;
      }),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("wellness-home.png"),
    fullPage: true,
  });
  const explore = page.getByRole("link", { name: "Explore more", exact: true });
  await expect(explore).toHaveAttribute("href", "/explore?discipline=Wellness");
  await explore.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/explore\?discipline=Wellness$/);
  await expect(wellness).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(wellness).toHaveAttribute("aria-current", "page");
  await wellness.focus();
  await expect(wellness).toBeFocused();
  await expect(wellness).toHaveCSS("outline-style", "solid");
  await expect(
    page.locator(".coach-results, .coach-directory-state"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("wellness-explore.png"),
    fullPage: true,
  });
});
