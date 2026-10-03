import { expect, test } from "@playwright/test";

test("home explains the coach-first private-training loop", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Find your martial-arts coach/);
  await expect(
    page.getByRole("heading", {
      name: "Private training built around the way you want to move.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "From the right coach to a completed class.",
    }),
  ).toBeVisible();
  await expect(page.getByText("One session", { exact: true })).toBeVisible();
  await expect(page.getByText("Ten sessions", { exact: true })).toBeVisible();
  await expect(page.getByText(/Devnet test USDC only/)).toBeVisible();
  await expect(page.getByText(/not live tracking/)).toBeVisible();

  const howLink = page
    .getByRole("link", { name: "See how it works", exact: true })
    .first();
  await expect(howLink).toHaveAttribute("href", "/how-it-works");
  await howLink.focus();
  await expect(howLink).toBeFocused();
  await expect(
    page.getByRole("link", { name: /Join early access/ }).first(),
  ).toHaveAttribute("href", "/coming-soon");

  const copy = await page.locator("main").innerText();
  expect(copy).not.toMatch(/four gyms|Basic membership|Classic membership/i);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("coach-story-home.png"),
    fullPage: true,
  });
});

test("how it works distinguishes the pass, place and preview", async ({
  page,
}, testInfo) => {
  await page.goto("/how-it-works");

  await expect(page).toHaveTitle(/How it works/);
  await expect(
    page.getByRole("heading", {
      name: "One clear path to private training.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Preview, not a live marketplace")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "A public training location, not live tracking.",
    }),
  ).toBeVisible();
  await expect(page.getByText(/gym is only a location label/)).toBeVisible();
  await expect(
    page.getByText(/Only a coach-confirmed completed class/),
  ).toBeVisible();
  await expect(page.getByText(/does not use real money/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Join early access/ }).first(),
  ).toHaveAttribute("href", "/coming-soon");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("coach-story-how-it-works.png"),
    fullPage: true,
  });
});
