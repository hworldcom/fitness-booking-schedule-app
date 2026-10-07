import { test, expect } from "@playwright/test";

test("sign-in explains the email/account boundary without blocking public browsing", async ({
  page,
}, testInfo) => {
  let identityRequests = 0;
  await page.route("**/api/auth/identity", async (route) => {
    identityRequests += 1;
    await route.fulfill({ status: 500, body: "unexpected identity request" });
  });
  await page.goto("/sign-in");

  await expect(
    page.getByRole("heading", {
      name: "Sign in with your email.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Email code · No password")).toBeVisible();
  await expect(page.getByText("Three small steps")).toBeVisible();
  await expect(
    page.getByText(/Email is the scheduling authority/),
  ).toBeVisible();
  const emailInput = page.getByLabel("Email address");
  if ((await emailInput.count()) === 0) {
    await expect(
      page.getByText("Local authentication is not configured."),
    ).toBeVisible();
  } else {
    await expect(emailInput).toBeVisible();
  }

  await page.screenshot({
    path: testInfo.outputPath("email-sign-in.png"),
    fullPage: true,
  });

  await page
    .getByRole("link", { name: "Continue browsing without signing in" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: "Find the right coach. Book one clear hour.",
    }),
  ).toBeVisible();
  expect(identityRequests).toBe(0);
});

test("the global sign-in control is keyboard reachable", async ({ page }) => {
  await page.goto("/");
  const signIn = page.getByRole("link", { name: "Sign in", exact: true });
  await expect(signIn).toBeVisible();
  await signIn.focus();
  await expect(signIn).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sign-in$/);
});
