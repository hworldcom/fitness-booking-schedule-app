import { expect, test, type Page } from "@playwright/test";

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
    "This browser-local interaction check requires preview mode.",
  );
}

test("retained navigation surfaces render without overflow or removed products", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const configuredGuest =
    (await page.request.get("/api/auth/actor")).status() === 401;
  const nav = page.getByRole("navigation", {
    name:
      testInfo.project.name === "mobile"
        ? "Mobile navigation"
        : "Main navigation",
    exact: true,
  });

  for (const [label, route] of [
    ["Explore", "/explore"],
    ["My Membership", "/my-access"],
    ["Profile", "/profile"],
    ["Home", "/"],
  ]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    const privateGuestRoute =
      configuredGuest && ["My Membership", "Profile"].includes(label);
    await expect(page).toHaveURL((url) =>
      privateGuestRoute
        ? url.pathname === "/sign-in" &&
          url.searchParams.get("returnTo") === route
        : url.pathname === route,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  if (!configuredGuest) {
    await page.goto("/my-access");
    await expect(
      page.getByRole("heading", {
        name: /Your membership draft/,
      }),
    ).toBeVisible();
    await expect(page.locator(".my-access")).not.toContainText(
      /\b(passes|tickets|transferable)\b/i,
    );
  }
  expect(errors).toEqual([]);
});

test("Explore filters gyms and keeps the details dialog keyboard accessible", async ({
  page,
}, testInfo) => {
  await page.goto("/explore?q=Fabrik");
  await expect(page.locator(".studio-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".studio-card")).toHaveCount(7);
  const plans = page.locator(".explore-plans");
  await expect(plans).toContainText("Basic");
  await expect(plans).toContainText("€80");
  await expect(plans).toContainText("10 included check-ins");
  await expect(plans).toContainText("Classic");
  await expect(plans).toContainText("€150");
  await expect(plans).toContainText("Unlimited included check-ins");
  await expect(plans).toContainText("€15");
  await expect(
    plans.getByRole("link", { name: "Preview Basic" }),
  ).toHaveAttribute("href", "/membership/setup?plan=basic");
  await expect(
    plans.getByRole("link", { name: "Preview Classic" }),
  ).toHaveAttribute("href", "/membership/setup?plan=classic");

  const activity = page.getByRole("combobox", {
    name: "Activities",
    exact: true,
  });
  await activity.selectOption("Muay Thai");
  await expect(page.locator(".studio-card")).toHaveCount(1);
  const openGym = page.getByRole("button", {
    name: "View Northside Combat",
    exact: true,
  });
  await openGym.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Northside Combat",
    exact: true,
  });
  await expect(dialog).toContainText("Illustrative gym");
  await expect(dialog).toContainText("does not show live availability");
  await expect(dialog).toContainText("Blücherplatz 1, 10961 Berlin");
  await expect(dialog).toContainText("not the fictional gym's address");
  await expect(
    dialog.getByRole("link", { name: "Open map anchor" }),
  ).toHaveAttribute("href", /google\.com\/maps\/search/);
  await page.keyboard.press("Escape");
  await expect(openGym).toBeFocused();

  await activity.selectOption("Massage");
  await expect(page.locator(".studio-card")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Area", exact: true })
    .selectOption("Kreuzberg");
  await expect(
    page.getByRole("heading", { name: "No gyms match those filters yet." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all gyms" }).click();
  await expect(page.locator(".studio-card")).toHaveCount(7);
  const plan = page.getByRole("combobox", { name: "Plan", exact: true });
  await plan.selectOption("basic");
  await expect(page.locator(".studio-card")).toHaveCount(5);
  await plan.selectOption("all");
  await expect(page.locator(".studio-card")).toHaveCount(7);
  await page.screenshot({
    path: testInfo.outputPath("gym-only-explore.png"),
    fullPage: true,
  });
});

test("old preview state keeps follows and drops retired fields", async ({
  page,
}) => {
  await requirePreviewMode(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "repx-club-preview-v1",
      JSON.stringify({
        version: 2,
        following: ["daniel", "max"],
        eventDrafts: [{ id: "retired" }],
        reactions: { retired: "cheer" },
      }),
    );
  });
  await page.goto("/users/max");
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Following", exact: true }).click();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("repx-club-preview-v1") || "null"),
  );
  expect(state).toEqual({ version: 3, following: ["daniel"] });
});

test("keyboard entry and unavailable browser storage still recover", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const wallet = page.getByRole("button", { name: "Connect Phantom wallet" });
  await wallet.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Your club. Your wallet." }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(wallet).toBeFocused();

  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "Browser storage is unavailable",
  );
  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { name: "Explore participating gyms." }),
  ).toBeVisible();
});
