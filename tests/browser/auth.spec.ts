import { test, expect } from "@playwright/test";

test("password-first entry offers registration and recovery while public browsing stays available", async ({
  page,
}, testInfo) => {
  let identityRequests = 0;
  await page.route("**/api/auth/identity", async (route) => {
    identityRequests++;
    await route.fulfill({ status: 500, body: "unexpected identity request" });
  });
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Forgot password?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Google sign-in is currently unavailable."),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your account", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("New password", { exact: true }),
  ).toHaveAttribute("autocomplete", "new-password");
  await expect(
    page.getByText("At least 8 characters. No special character mix required."),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("registration.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Browse coaches without signing in" })
    .click();
  await expect(page).toHaveURL(/\/explore$/);
  expect(identityRequests).toBe(0);
});

test("global sign-in and reset recovery are keyboard reachable", async ({
  page,
}) => {
  await page.goto("/");
  const signIn = page.getByRole("link", { name: "Sign in", exact: true });
  await signIn.focus();
  await expect(signIn).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sign-in$/);
  const forgot = page.getByRole("link", { name: "Forgot password?" });
  await forgot.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Reset your password", exact: true }),
  ).toBeVisible();
  await page.goto("/reset-password");
  await expect(
    page.getByText("Open a fresh reset link to choose a new password."),
  ).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await page.goto("/auth/confirm");
  await expect(
    page.getByText(
      "This link is missing, expired or already used. Request a fresh email in this browser.",
    ),
  ).toBeVisible();
});
