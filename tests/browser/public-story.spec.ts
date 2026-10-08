import { expect, test } from "@playwright/test";

test("home presents the focused scheduling loop", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Discover coaches and book private sessions/);
  await expect(
    page.getByRole("heading", {
      name: "Find the right coach. Book one clear hour.",
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
  await expect(page.getByText("Book directly", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See how scheduling works" }),
  ).toHaveAttribute("href", "/how-it-works");
  const copy = await page.locator("main").innerText();
  expect(copy).not.toMatch(
    /Solana|wallet|EURC|credits|group funding|pass purchase/i,
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
      name: "Published time in. Confirmed booking out.",
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

test("public navigation exposes scheduling routes only", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".demo-strip")).toContainText(
    "Coach discovery and direct scheduling preview.",
  );
  for (const name of ["Explore", "How it works", "Profile"]) {
    await expect(
      page.getByRole("link", { name, exact: true }).first(),
    ).toBeVisible();
  }
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
  if (testInfo.project.name === "desktop") {
    await page.getByRole("button", { name: "About this preview" }).click();
    await expect(page.getByText(/focused scheduling preview/)).toBeVisible();
  }
});
