import { expect, test } from "@playwright/test";

test("guests and preview visitors are never assigned a personal identity", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page.locator("body")).not.toContainText("Anna Klein");
  await expect(page.locator(".sidebar-profile")).toHaveCount(0);
  await expect(page.locator(".header-avatar")).toHaveCount(0);

  await page.goto("/profile");
  const destination = new URL(page.url());
  if (destination.pathname === "/sign-in") {
    expect(destination.searchParams.get("returnTo")).toBe("/profile");
  } else {
    await expect(
      page.getByRole("heading", {
        name: "Create an account to make this space yours.",
      }),
    ).toBeVisible();
  }

  await expect(page.locator("body")).not.toContainText("Anna Klein");
  await expect(page.getByText("Available test EURC")).toHaveCount(0);
  await expect(page.getByText("Confirmed visits")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("account-profile-boundary.png"),
    fullPage: true,
  });
});
