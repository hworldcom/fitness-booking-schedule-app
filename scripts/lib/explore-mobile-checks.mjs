import assert from "node:assert/strict";
import path from "node:path";
import { expect } from "@playwright/test";

// Called only by the owned Explore rehearsal, with fictional public/identity
// adapters and intercepted providers. Native WebKit touch drives the controls.
export async function checkExploreMobile({
  page,
  browser,
  base,
  evidence,
  report,
  setViewer,
}) {
  const categories = page.locator(".explore-category-filter");
  const floating = page.locator(".explore-floating-view");
  const location = page
    .getByRole("button", { name: "Use current location", exact: true })
    .filter({ visible: true });
  const marker = page.locator(".location-device-dot");
  const ready = async () => {
    await page.locator(".explore-enhanced").waitFor();
    await page
      .locator(".location-map-marker")
      .first()
      .waitFor({ state: "attached" });
  };
  const openCategories = async () => {
    await categories.locator("summary").tap();
    await expect(categories).toHaveAttribute("open", "");
  };
  const centred = async () => {
    await expect(marker).toBeVisible();
    await expect
      .poll(async () => {
        const dot = await marker.boundingBox(),
          canvas = await page.locator(".coach-map-canvas").boundingBox();
        return dot && canvas
          ? Math.abs(dot.x + dot.width / 2 - canvas.x - canvas.width / 2) +
              Math.abs(dot.y + dot.height / 2 - canvas.y - canvas.height / 2)
          : 1000;
      })
      .toBeLessThan(5);
  };
  for (const [width, height] of [
    [390, 844],
    [375, 667],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(base + "/explore?view=map");
    await ready();
    assert.equal(
      await page.evaluate(() => window.exploreLocationRequests.length),
      0,
      "No automatic location request",
    );
    await expect
      .poll(async () => {
        const canvas = await page.locator(".coach-map-canvas").boundingBox();
        const header = await page.locator(".public-header").boundingBox();
        return canvas.height / (height - header.height);
      })
      .toBeGreaterThan(0.65);
    const surface = await page.locator(".explore-map-surface").boundingBox(),
      canvas = await page.locator(".coach-map-canvas").boundingBox(),
      header = await page.locator(".public-header").boundingBox(),
      sheet = await page.locator(".explore-map-sheet").boundingBox();
    assert(surface && canvas && header && sheet);
    assert(
      canvas.height / (height - header.height) > 0.65,
      "Collapsed map must occupy most of the available screen",
    );
    assert(sheet.height <= 60, "Initial result sheet is a compact handle");
    assert(surface.x <= 1 && surface.width >= width - 1, "Map is edge to edge");
    assert(
      surface.y + surface.height <= height + 1,
      "Map fits the visible screen",
    );
    await openCategories();
    // Model Safari moving focus to the page before its native label activation.
    // Focus and pointer cancellation alone must never remove the tap target.
    await page.locator("main").evaluate((main) => {
      main.tabIndex = -1;
      main.focus();
    });
    await expect(categories).toHaveAttribute("open", "");
    const boxing = categories.getByRole("checkbox", {
      name: "Boxing",
      exact: true,
    });
    await boxing.tap();
    await expect(boxing).toBeChecked();
    await boxing.tap();
    await expect(boxing).not.toBeChecked();
    await categories.locator("summary").focus();
    await categories
      .locator("label")
      .filter({ hasText: /^Boxing$/ })
      .evaluate((label) => {
        label.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            pointerType: "touch",
          }),
        );
        label.addEventListener(
          "pointerdown",
          () => {
            const main = document.querySelector("main");
            main?.focus();
          },
          { once: true, capture: true },
        );
      });
    await expect(categories).toHaveAttribute("open", "");
    await categories
      .locator("label")
      .filter({ hasText: /^Boxing$/ })
      .tap();
    await expect(
      categories.getByRole("checkbox", { name: "Boxing", exact: true }),
    ).toBeChecked();
    await expect(categories).toHaveAttribute("open", "");
    await categories
      .locator("label")
      .filter({ hasText: /^Fitness$/ })
      .tap();
    await expect(
      categories.getByRole("checkbox", { name: "Fitness", exact: true }),
    ).toBeChecked();
    await categories
      .getByRole("button", { name: "Clear selection", exact: true })
      .tap();
    await expect(categories.locator("input:checked")).toHaveCount(0);
    await categories
      .locator("label")
      .filter({ hasText: /^Boxing$/ })
      .tap();
    await categories
      .locator("label")
      .filter({ hasText: /^Fitness$/ })
      .tap();
    await categories
      .getByRole("button", { name: "Apply categories", exact: true })
      .tap();
    await expect
      .poll(() => new URL(page.url()).searchParams.getAll("discipline"))
      .toEqual(["Boxing", "Fitness"]);
    await ready();
    await location.tap();
    await centred();
    await expect(page.locator(".explore-map-origin")).toContainText(
      "Current location",
    );
    await expect(page.locator(".explore-map-origin")).toContainText(
      "Accuracy about 120 m",
    );
    await floating.tap();
    await expect(page.locator(".coach-results-summary")).toContainText(
      "Current location",
    );
    await expect(
      page.locator(".explore-profiles .compact-coach-card.result"),
    ).toHaveCount(3);
    await floating.tap();
    await centred();
    await page.goBack();
    await expect(floating).toHaveText("Show map");
    await page.goForward();
    await expect(floating).toHaveText("Show profiles");
    await centred();
    assert(!/[?&](?:latitude|longitude|lat|lng)=/.test(page.url()));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(evidence, `mobile-map-${width}.png`),
    });
    report(
      `touch labels/Clear/Apply, shared location and centred pin, history, compact edge-to-edge map at ${width}x${height}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/explore?view=map");
  await ready();
  await page.evaluate(() => (window.exploreLocationMode = "delayed"));
  await location.tap();
  await expect(
    page.getByText("Finding your location…", { exact: true }),
  ).toBeVisible();
  await expect(location).toBeDisabled();
  await page.evaluate(() => window.exploreLocationFailure({ code: 1 }));
  const alert = page.locator(".explore-map-feedback").getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("browser settings");
  await expect(location).toBeEnabled();
  await alert.getByText("Allow location on iPhone", { exact: true }).tap();
  await expect(alert).toContainText("Website Settings");
  await page.evaluate(() => (window.exploreLocationMode = "timeout"));
  await location.tap();
  await expect(alert).toContainText("timed out");
  await page.evaluate(() => (window.exploreLocationMode = "silent"));
  await location.tap();
  await expect(location).toBeDisabled();
  await expect(alert).toContainText("taking too long", { timeout: 18000 });
  await expect(location).toBeEnabled();
  await page.evaluate(() => (window.exploreLocationMode = null));
  await location.tap();
  await centred();
  await expect(alert).toHaveCount(0);
  report(
    "immediate waiting feedback, denial/settings help, native timeout, bounded silent request and successful retry",
  );
  await openCategories();
  await categories
    .getByRole("checkbox", { name: "Boxing", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await expect(categories).not.toHaveAttribute("open", "");
  await expect(categories.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(categories).toHaveAttribute("open", "");
  await categories
    .getByRole("button", { name: "Apply categories", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  await expect(categories).not.toHaveAttribute("open", "");
  await categories.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(categories).toHaveAttribute("open", "");
  await page.keyboard.press("Shift+Tab");
  await expect(categories).not.toHaveAttribute("open", "");
  await openCategories();
  await page.touchscreen.tap(3, 3);
  await expect(categories).not.toHaveAttribute("open", "");
  // Opening a marker preview is explicit; the default sheet never consumes the map.
  await page.goto(base + "/explore?view=map");
  await ready();
  await page
    .locator(".location-map-marker")
    .filter({ visible: true })
    .first()
    .tap();
  await expect(page.locator(".explore-map-sheet > section")).toBeVisible();
  await page.locator(".explore-sheet-handle").tap();
  await expect(page.locator(".explore-sheet-handle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.locator(".explore-sheet-handle").tap();
  await location.tap();
  await centred();
  await expect(page.locator(".explore-map-sheet > section")).toBeHidden();
  for (const height of [667, 520, 844]) {
    await page.setViewportSize({ width: 390, height });
    await expect
      .poll(async () => {
        const r = await page.locator(".explore-map-surface").boundingBox();
        return r.y + r.height <= height + 1;
      })
      .toBe(true);
  }
  report(
    "keyboard/outside closure, explicit marker preview, expandable results and viewport resize recovery",
  );
  setViewer("a");
  await page.getByRole("button", { name: "Fixture a", exact: true }).click();
  await page.goto(base + "/explore?view=map");
  await ready();
  // The fixture switches local identity explicitly; do not navigate away afterward.
  await page.getByRole("button", { name: "Fixture a", exact: true }).click();
  await page.locator(".mobile-nav").waitFor();
  await location.tap();
  await centred();
  await expect
    .poll(async () => {
      const nav = await page.locator(".mobile-nav").boundingBox(),
        map = await page.locator(".explore-map-surface").boundingBox();
      return map.y + map.height <= nav.y + 1;
    })
    .toBe(true);
  await page.screenshot({ path: path.join(evidence, "member-map.png") });
  report(
    "signed-in bottom navigation stays clear of the map, result sheet and touch controls",
  );
  const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const p = await nojs.newPage();
    await p.goto(base + "/explore?view=map");
    await p.locator(".explore-category-filter summary").tap();
    await p.getByRole("checkbox", { name: "Boxing", exact: true }).tap();
    await p.getByRole("checkbox", { name: "Fitness", exact: true }).tap();
    await p
      .getByRole("button", { name: "Apply categories", exact: true })
      .tap();
    await expect
      .poll(() => new URL(p.url()).searchParams.getAll("discipline"))
      .toEqual(["Boxing", "Fitness"]);
    await expect(
      p.locator(".explore-profiles .compact-coach-card.result"),
    ).toHaveCount(3);
  } finally {
    await nojs.close();
  }
  report(
    "native no-JavaScript touch GET preserves multiple categories and usable profile results",
  );
}
