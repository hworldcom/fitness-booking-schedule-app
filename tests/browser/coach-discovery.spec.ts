import { expect, test } from "@playwright/test";

test("guest browses and filters the persistent coach directory", async ({
  page,
}, testInfo) => {
  await page.goto("/explore");

  await expect(page).toHaveTitle(/Explore martial-arts coaches/);
  await expect(
    page.getByRole("heading", {
      name: "Find a coach who fits your training.",
    }),
  ).toBeVisible();
  await expect(page.getByText("5 coaches", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sam Lee", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Daniel Park" }),
  ).toBeVisible();
  await expect(
    page.getByText(/No real coaches, gyms, schedules/),
  ).toBeVisible();

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

test("guest opens a coach profile without fabricated offers or availability", async ({
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
      name: "Weekly times are not published yet.",
    }),
  ).toBeVisible();
  await expect(page.getByText("No active indexed offer yet")).toBeVisible();
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
