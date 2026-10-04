import { expect, test } from "@playwright/test";

test("home explains pass booking first and group funding second", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Private coaching and group-funded training/);
  await expect(
    page.getByRole("heading", {
      name: "Book a private session. Or help a group event happen.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Buy coach credits, then book the right hour.",
    }),
  ).toBeVisible();
  await expect(page.getByText("One credit", { exact: true })).toBeVisible();
  await expect(page.getByText("Ten credits", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Fund one seat. Let the published threshold decide.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Minimum reached", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Minimum missed", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Devnet test EURC · no real funds/),
  ).toBeVisible();
  await expect(
    page.getByText(/remain clearly labelled preview flows/),
  ).toBeVisible();

  const howLink = page
    .getByRole("link", { name: "See both features", exact: true })
    .first();
  await expect(howLink).toHaveAttribute("href", "/how-it-works");
  await howLink.focus();
  await expect(howLink).toBeFocused();
  await expect(
    page.getByRole("link", { name: /Join early access/ }).first(),
  ).toHaveAttribute("href", "/coming-soon");
  await expect(
    page.getByRole("link", { name: "Group funding is coming soon" }),
  ).toHaveAttribute("href", "/coming-soon");

  const copy = await page.locator("main").innerText();
  expect(copy).not.toMatch(
    /four gyms|Basic membership|Classic membership|training request|coach proposal/i,
  );
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

test("how it works distinguishes both loops and their preview boundaries", async ({
  page,
}, testInfo) => {
  await page.goto("/how-it-works");

  await expect(page).toHaveTitle(/How it works/);
  await expect(
    page.getByRole("heading", {
      name: "Two clear paths to train with a coach.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Public preview, not live transactions"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "A public training location, not live tracking.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/fictional gym is a place label only/),
  ).toBeVisible();
  await expect(
    page.getByText(/automatic return or a later coach/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "One funded seat, with a deterministic outcome.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/deadline itself sends no transaction/),
  ).toBeVisible();
  await expect(page.getByText(/no real funds/)).toBeVisible();
  await expect(page.getByText(/does not execute automatically/)).toBeVisible();
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

test("public navigation keeps unfinished marketplace actions honest", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page.locator(".demo-strip")).toContainText(
    "Coach discovery live · pass booking and group funding still in progress.",
  );
  await expect(
    page.getByRole("link", { name: "Explore", exact: true }).first(),
  ).toHaveAttribute("href", "/explore");
  await expect(
    page.getByRole("link", { name: "How it works", exact: true }).first(),
  ).toHaveAttribute("href", "/how-it-works");

  if (testInfo.project.name === "desktop") {
    await page.getByRole("button", { name: "About this preview" }).click();
    await expect(page.getByText(/two-feature coach marketplace/)).toBeVisible();
    await expect(
      page.getByText(
        /Pass purchase, private booking and group funding are not live yet/,
      ),
    ).toBeVisible();
  }
});
