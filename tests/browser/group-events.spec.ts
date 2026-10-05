import { expect, test } from "@playwright/test";

test("guest group-event catalogue is public, honest and keyboard reachable", async ({
  page,
}, testInfo) => {
  const response = await page.goto("/events");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/Group events/);
  await expect(
    page.getByRole("heading", { name: "Fund the class together." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No published group events yet." }),
  ).toBeVisible();
  await expect(page.getByText(/full refund/)).toBeVisible();
  await expect(page.getByText(/finalized and verified/)).toBeVisible();
  await expect(
    page.locator("main .group-event-operation-actions button"),
  ).toHaveCount(0);

  const eventsLink = page
    .getByRole("link", { name: "Events", exact: true })
    .first();
  await expect(eventsLink).toHaveAttribute("aria-current", "page");
  await eventsLink.focus();
  await expect(eventsLink).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("group-event-catalogue.png"),
    fullPage: true,
  });
});

test("coach event management stays behind application identity", async ({
  page,
}) => {
  await page.goto("/coach/events");
  const destination = new URL(page.url());
  if (destination.pathname === "/sign-in") {
    expect(destination.searchParams.get("returnTo")).toBe("/coach/events");
  } else {
    await expect(
      page.getByRole("heading", { name: "Sign in to manage group events." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse group events" }),
    ).toHaveAttribute("href", "/events");
  }
  await expect(page.getByText("Set the immutable funding terms")).toHaveCount(
    0,
  );
});

test("unknown or unpublished event slugs expose no funding controls", async ({
  page,
}) => {
  const response = await page.goto("/events/not-a-published-event");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "A little off the beaten track." }),
  ).toBeVisible();
  await expect(
    page.locator("main .group-event-operation-actions button"),
  ).toHaveCount(0);
});
