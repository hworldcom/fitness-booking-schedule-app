import { expect, test, type Page } from "@playwright/test";

const storageKey = "movx-club:membership-draft:v1";

async function requirePreviewMode(page: Page) {
  const response = await page.request.get("/api/auth/actor");
  const actor: unknown = await response.json();
  test.skip(
    !(
      response.status() === 200 &&
      typeof actor === "object" &&
      actor !== null &&
      "status" in actor &&
      actor.status === "preview"
    ),
    "The My Membership browser-local state check requires preview mode.",
  );
}

test("builds and reviews an exactly-four-gym membership draft", async ({
  page,
}, testInfo) => {
  await page.goto("/membership/setup");
  await expect(
    page.getByRole("heading", { name: "Build your membership draft." }),
  ).toBeVisible();
  await expect(page.getByText("0/4", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review draft" }),
  ).toBeDisabled();

  const basic = page.getByRole("radio", { name: /Basic/ });
  await basic.focus();
  await page.keyboard.press("Space");
  await expect(basic).toBeChecked();

  const selectedGyms = [
    "Northside Combat",
    "Fabrik Training",
    "Studio Vela",
    "Groundline MMA",
  ];
  for (const name of selectedGyms) {
    const checkbox = page.getByRole("checkbox", { name: new RegExp(name) });
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
  }

  await expect(page.getByText("4/4", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Kiezstrike Club/ }),
  ).toBeDisabled();

  const review = page.getByRole("button", { name: "Review draft" });
  await review.focus();
  await page.keyboard.press("Enter");
  const summary = page.locator(".membership-review");
  await expect(
    page.getByRole("heading", { name: "Review your membership." }),
  ).toBeVisible();
  await expect(summary).toContainText("Basic");
  await expect(summary).toContainText("€80");
  await expect(summary).toContainText("10 included check-ins");
  await expect(summary).toContainText(
    "one included check-in per venue-local day",
    {
      ignoreCase: true,
    },
  );
  await expect(summary).toContainText("€15");
  for (const name of selectedGyms) await expect(summary).toContainText(name);
  await expect(summary).toContainText("Devnet demo payment only");
  await expect(
    page.getByRole("link", { name: "Sign in to activate" }),
  ).toHaveAttribute("href", "/sign-in?returnTo=%2Fmembership%2Fsetup");

  await page.reload();
  await expect(basic).toBeChecked();
  await expect(page.getByText("4/4", { exact: true })).toBeVisible();
  for (const name of selectedGyms) {
    await expect(
      page.getByRole("checkbox", { name: new RegExp(name) }),
    ).toBeChecked();
  }

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("membership-setup.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Review draft" }).click();
  await page.getByRole("link", { name: "Sign in to activate" }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fmembership%2Fsetup$/);
  await expect(
    page.getByRole("heading", { name: "Sign in with your email." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("plan switching removes gyms that are not eligible", async ({ page }) => {
  await page.goto("/membership/setup");
  await page.getByRole("radio", { name: /Classic/ }).check();
  await page.getByRole("checkbox", { name: /Quiet Current Recovery/ }).check();
  await page.getByRole("checkbox", { name: /Northside Combat/ }).check();
  await expect(page.getByText("2/4", { exact: true })).toBeVisible();

  await page.getByRole("radio", { name: /Basic/ }).check();
  await expect(
    page.getByRole("checkbox", { name: /Quiet Current Recovery/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Quiet Current Recovery/ }),
  ).toBeDisabled();
  await expect(page.getByText("1/4", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Quiet Current Recovery was removed",
  );
});

test("corrupt browser storage resets safely with visible feedback", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "{broken");
  }, storageKey);
  await page.goto("/membership/setup");

  await expect(page.getByRole("status")).toContainText(
    "saved draft, so the preview was reset",
  );
  await expect(page.getByText("0/4", { exact: true })).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(null);
});

test("unavailable browser storage leaves the draft preview usable", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.goto("/membership/setup");

  await expect(
    page.locator(".membership-setup").getByRole("status"),
  ).toContainText("This draft will last only until the page closes");
  await page.getByRole("radio", { name: /Basic/ }).check();
  await expect(page.getByRole("radio", { name: /Basic/ })).toBeChecked();
});

test("My Membership shows saved choices as a draft, never active access", async ({
  page,
}) => {
  await requirePreviewMode(page);
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        planId: "classic",
        gymIds: [
          "northside-combat",
          "fabrik",
          "quiet-current",
          "nightshift-athletic",
        ],
      }),
    );
  }, storageKey);
  await page.goto("/my-access");

  await expect(
    page.getByRole("heading", { name: "Your membership draft." }),
  ).toBeVisible();
  const card = page.locator(".membership-draft-card");
  await expect(card).toContainText("DRAFT SELECTION");
  await expect(card).toContainText("Not active");
  await expect(card).toContainText("Classic");
  await expect(card).toContainText("€150 / month");
  await expect(card).toContainText("4/4 gyms");
  await expect(card).toContainText("One included check-in per venue-local day");
  await expect(card).toContainText("€15");
  await expect(card).toContainText("No payment or access exists");
  await expect(card).not.toContainText(/active membership|payment confirmed/i);

  await page.getByRole("button", { name: "Reset draft" }).click();
  await expect(
    page.getByRole("heading", { name: "No membership draft yet." }),
  ).toBeVisible();
});
