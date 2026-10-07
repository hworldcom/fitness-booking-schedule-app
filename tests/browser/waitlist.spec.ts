import { expect, test } from "@playwright/test";

test("coming soon page prepares a truthful scheduling waitlist request", async ({
  page,
}, testInfo) => {
  await page.goto("/coming-soon");
  await expect(
    page.getByRole("heading", {
      name: "Find a coach and reserve your next hour.",
    }),
  ).toBeVisible();
  await expect(page.locator(".coming-soon-status")).toContainText(
    "Fictional profiles · No payments",
  );
  await expect(page.getByText("DISCOVER · SCHEDULE · TRAIN")).toBeVisible();
  const email = page.getByLabel("Email address", { exact: true });
  await email.fill("early.member@example.com");
  const continueButton = page.getByRole("button", {
    name: "Continue",
    exact: true,
  });
  await continueButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("One last step", { exact: true })).toBeVisible();
  const preparedEmail = page.getByRole("link", {
    name: "Open waitlist email",
    exact: true,
  });
  await expect(preparedEmail).toHaveAttribute(
    "href",
    /early.member%40example.com/,
  );
  await expect(preparedEmail).toHaveAttribute(
    "href",
    /fictional%20coach%20profiles/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("coming-soon.png"),
    fullPage: true,
  });
});
