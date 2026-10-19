import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectTouchTargets(controls: Locator) {
  const sizes = await controls.evaluateAll((elements) =>
    elements
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const { width, height } = element.getBoundingClientRect();
        return { name: element.textContent?.trim(), width, height };
      }),
  );
  for (const size of sizes) {
    expect(size.width, size.name).toBeGreaterThanOrEqual(44);
    expect(size.height, size.name).toBeGreaterThanOrEqual(44);
  }
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("public landmarks, headings, skip focus and touch controls fit every breakpoint", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const widths =
    testInfo.project.name === "mobile" ? [375, 430] : [768, 1024, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 });
    for (const route of ["/", "/explore", "/how-it-works", "/sign-in"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(
        page.getByRole("region", { name: "Demonstration data" }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Public navigation" }),
      ).toHaveCount(1);
      await expect(page.locator(".authenticated-mobile-nav")).toHaveCount(0);
      const levels = await page
        .locator("main :is(h1,h2,h3,h4,h5,h6)")
        .evaluateAll((headings) =>
          headings.map((heading) => Number(heading.tagName.slice(1))),
        );
      for (let index = 1; index < levels.length; index++) {
        expect(levels[index]).toBeLessThanOrEqual(levels[index - 1] + 1);
      }
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Skip to content" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      const focusPosition = await page.evaluate(() => ({
        mainTop: document.querySelector("main")!.getBoundingClientRect().top,
        headerBottom: document
          .querySelector(".public-header")!
          .getBoundingClientRect().bottom,
      }));
      expect(focusPosition.mainTop).toBeGreaterThanOrEqual(
        focusPosition.headerBottom,
      );
      await expectTouchTargets(
        page.locator(
          ".public-header a, .demo-strip button, .footer-contact, main input, main select, main button, main .button, .marketplace-discipline-chip, .compact-coach-link, main .text-link",
        ),
      );
      await expectNoOverflow(page);
    }
  }
});

test("Home reveals a selected discipline and retains keyboard focus during filtering", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 950 });
  await page.goto("/?discipline=Wrestling");
  const navigation = page.getByRole("navigation", {
    name: "Browse coaches by discipline",
  });
  const selected = navigation.getByRole("link", {
    name: "Wrestling",
    exact: true,
  });
  await expect(selected).toHaveAttribute("aria-current", "page");
  await expect
    .poll(() =>
      selected.evaluate((element) => {
        const item = element.getBoundingClientRect();
        const track = element.parentElement!.getBoundingClientRect();
        return item.left >= track.left && item.right <= track.right;
      }),
    )
    .toBe(true);
  const boxing = navigation.getByRole("link", { name: "Boxing", exact: true });
  await boxing.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/\?discipline=Boxing$/);
  await expect(boxing).toHaveAttribute("aria-current", "page");
  await expect(boxing).toBeFocused();
  await expect(page.getByRole("form", { name: "Search coaches" })).toHaveCount(
    0,
  );
  await expect(boxing).toHaveCSS("outline-style", "solid");
  await page.reload();
  await expect(boxing).toHaveAttribute("aria-current", "page");
  await expectNoOverflow(page);
});

test("the public preview dialog traps focus and restores its trigger", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Fictional profiles" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "A first look at MovX Club.",
  });
  const close = dialog.getByRole("button", { name: "Close dialog" });
  const explore = dialog.getByRole("button", { name: "Let’s explore" });
  await expect(close).toBeFocused();
  await expectTouchTargets(dialog.getByRole("button"));
  await page.keyboard.press("Shift+Tab");
  await expect(explore).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("reduced motion uses instant map-selection scrolling and keeps profile access", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const original = Element.prototype.scrollIntoView;
    const behaviors: (ScrollBehavior | undefined)[] = [];
    Object.assign(window, { selectionScrollBehaviors: behaviors });
    Element.prototype.scrollIntoView = function (options) {
      if (typeof options === "object") behaviors.push(options.behavior);
      return original.call(this, options);
    };
  });
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#edf2e8" },
          },
        ],
      },
    }),
  );
  await page.goto("/explore");
  const cards = page.locator(".compact-coach-card.result");
  test.skip(
    (await cards.count()) === 0,
    "Map selection requires a configured directory; covered by the isolated public fixtures.",
  );
  const card = cards.first();
  const name = await card.locator("h3").innerText();
  await card.getByRole("button", { name: `Show ${name} on the map` }).click();
  if (testInfo.project.name === "mobile") {
    await expect(page).toHaveURL(/view=map/);
    await expect(page.locator(".coach-map-detail")).toBeFocused();
  }
  const marker = page.locator(".location-map-marker").first();
  await expect(marker).toBeVisible();
  await marker.focus();
  await page.keyboard.press("Enter");
  if (testInfo.project.name === "desktop") await expect(card).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { selectionScrollBehaviors: string[] })
            .selectionScrollBehaviors.length,
      ),
    )
    .toBeGreaterThan(0);
  const behaviors = await page.evaluate(
    () =>
      (window as unknown as { selectionScrollBehaviors: string[] })
        .selectionScrollBehaviors,
  );
  expect(behaviors).not.toContain("smooth");
  expect(behaviors).toContain("instant");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.activeElement!.getBoundingClientRect().top >=
          document.querySelector(".public-header")!.getBoundingClientRect()
            .bottom,
      ),
    )
    .toBe(true);
  const profileLink =
    testInfo.project.name === "mobile"
      ? page.locator(".coach-map-detail > a")
      : card.locator(".compact-coach-link");
  await expect(profileLink).toBeVisible();
  await expect(profileLink).toHaveAttribute("href", /^\/coaches\/[a-z0-9-]+$/);
  await expectNoOverflow(page);
});

test("portraits failing before hydration retain initials and profile navigation", async ({
  page,
}) => {
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "image") return route.abort();
    if (route.request().url().includes("/_next/static/chunks/")) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const cards = page.locator(".home-coach-grid article");
  test.skip(
    (await cards.count()) === 0,
    "Portrait failure requires a configured directory; covered by the isolated public fixtures.",
  );
  const avatar = cards.first().locator(".avatar");
  await expect(avatar.locator("img")).toHaveCount(0);
  await expect(avatar).not.toBeEmpty();
  const profile = cards.first().locator(".compact-coach-identity");
  const destination = await profile.getAttribute("href");
  await profile.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
