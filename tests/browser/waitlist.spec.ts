import { expect, test } from "@playwright/test";

test("coming soon page prepares a truthful waitlist email request", async ({
  page,
}, testInfo) => {
  await page.goto("/coming-soon");

  await expect(
    page.getByRole("heading", {
      name: "Find the right martial arts coach for you.",
    }),
  ).toBeVisible();
  await expect(
    page.locator(".coming-soon-copy").getByRole("paragraph"),
  ).toHaveText(
    "Discover independent or fictional-gym-associated coaches, explore their disciplines and availability, and book private training that fits your goals and schedule. Cancel before it starts and your unused credit remains.",
  );
  await expect(page.locator(".coming-soon-status")).toContainText(
    "Solana Devnet · Test EURC · No real funds",
  );

  const email = page.getByLabel("Email address", { exact: true });
  const continueButton = page.getByRole("button", {
    name: "Continue",
    exact: true,
  });
  await email.fill("not-an-email");
  await continueButton.click();
  await expect(page.getByText("One last step", { exact: true })).toHaveCount(0);
  expect(
    await email.evaluate((input: HTMLInputElement) => input.validity.valid),
  ).toBe(false);

  await email.fill("early.member@example.com");
  await continueButton.focus();
  await expect(continueButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("One last step", { exact: true })).toBeVisible();
  await expect(page.getByText(/early.member@example.com/)).toBeVisible();

  const preparedEmail = page.getByRole("link", {
    name: "Open waitlist email",
    exact: true,
  });
  await expect(preparedEmail).toHaveAttribute(
    "href",
    /mailto:hello@movx\.club\?subject=Join%20the%20MovX%20Club%20waitlist/,
  );
  await expect(preparedEmail).toHaveAttribute(
    "href",
    /early.member%40example.com/,
  );
  await expect(page.locator(".waitlist-privacy")).toContainText(
    "does not store your address",
  );
  await expect(page.locator(".waitlist-privacy")).toContainText(
    "only after you send the prepared email",
  );

  await page.getByRole("button", { name: "Use another email" }).click();
  await expect(email).toHaveValue("early.member@example.com");
  await expect(
    page
      .locator(".coming-soon-waitlist-copy")
      .getByRole("link", { name: "MovX Club home" }),
  ).toHaveAttribute("href", "/");
  await expect(
    page
      .locator(".coming-soon-return")
      .getByRole("link", { name: "Join the waitlist", exact: true }),
  ).toHaveAttribute("href", "#waitlist-email");
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
