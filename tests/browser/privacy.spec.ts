import { expect, test } from "@playwright/test";

test("privacy notice is readable without JavaScript or an account", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const response = await page.goto(`${baseURL}/privacy`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Privacy notice" }),
    ).toBeVisible();
    await expect(page.locator(".privacy-date")).toContainText(
      "8 November 2026",
    );
    await expect(
      page.getByText("DRAFT FOR REVIEW", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index, follow",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://movx.club/privacy",
    );
    await expect(page.locator("#privacy-google")).toContainText(
      "does not request access to Google Calendar",
    );
    await expect(page.locator("#privacy-retention")).toContainText(
      "no self-service account-deletion flow",
    );
    await expect(page.locator("#privacy-contact")).toContainText("Hoang Luong");
    await expect(page.locator("#privacy-young-people")).toContainText(
      "MovX is intended for people aged 16 and older",
    );
    await expect(page.locator("#privacy-purposes")).toContainText(
      "Do not enter diagnoses",
    );
  } finally {
    await context.close();
  }
});

test("homepage footer, keyboard sections and responsive recovery remain public", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ status: 503, json: { status: "unavailable" } }),
  );
  await page.route("**/api/auth/actor", (route) =>
    route.fulfill({ status: 503, json: { status: "unavailable" } }),
  );
  await page.goto("/");
  const footer = page.locator("footer");
  const privacy = footer.getByRole("link", { name: "Privacy", exact: true });
  await expect(privacy).toHaveAttribute("href", "/privacy");
  await privacy.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.locator(".public-app-main")).toBeVisible();

  const onThisPage = page.getByRole("navigation", { name: "On this page" });
  const googleSection = onThisPage.getByRole("link", {
    name: "When you choose Google sign-in",
  });
  await googleSection.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#privacy-google$/);
  await expect(page.locator("#privacy-google")).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const target = document.querySelector("#privacy-google");
        const header = document.querySelector(".public-header");
        const top = target!.getBoundingClientRect().top;
        return (
          top >= header!.getBoundingClientRect().bottom && top < innerHeight
        );
      }),
    )
    .toBe(true);
  const request = page
    .locator("#privacy-choices")
    .getByRole("link", { name: "hello@movx.club" });
  await expect(request).toHaveAttribute(
    "href",
    "mailto:hello@movx.club?subject=Privacy%20request",
  );

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: "Privacy notice", exact: true }),
  ).toBeVisible();
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const entry = page
      .locator("footer")
      .getByRole("link", { name: "Privacy", exact: true });
    await entry.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.locator("#privacy-title")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const title = document.querySelector("#privacy-title");
          const header = document.querySelector(".public-header");
          return (
            title!.getBoundingClientRect().top >=
            header!.getBoundingClientRect().bottom
          );
        }),
      )
      .toBe(true);
    await expect(page.locator(".privacy-date")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`privacy-${width}.png`),
    });
    await page.locator("#privacy-contact").screenshot({
      path: testInfo.outputPath(`privacy-contact-${width}.png`),
    });
  }
  await page.getByRole("link", { name: "Back to top", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#privacy-title")).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const title = document.querySelector("#privacy-title");
        const header = document.querySelector(".public-header");
        const top = title!.getBoundingClientRect().top;
        return (
          top >= header!.getBoundingClientRect().bottom && top < innerHeight
        );
      }),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
