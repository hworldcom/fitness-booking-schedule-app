import { expect, test } from "@playwright/test";

const cases = [
  { width: 375, height: 812, pixelRatio: 2 },
  { width: 375, height: 812, pixelRatio: 3 },
  { width: 390, height: 844, pixelRatio: 2 },
  { width: 390, height: 844, pixelRatio: 3 },
  { width: 1440, height: 1040, pixelRatio: 1 },
  { width: 1440, height: 1040, pixelRatio: 2 },
];

for (const { width, height, pixelRatio } of cases) {
  test.describe(`${width}px at ${pixelRatio}x`, () => {
    test.use({
      viewport: { width, height },
      deviceScaleFactor: pixelRatio,
      isMobile: width < 768,
      hasTouch: width < 768,
    });

    test("backgrounds cover their frames without excessive downloads or changed crops", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "This matrix explicitly sets phone/desktop dimensions and pixel ratios once.",
      );
      const measurements = [];
      for (const path of ["/", "/explore", "/events"]) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        const image = page.locator(".marketplace-home-hero-image");
        await expect
          .poll(
            () =>
              image.evaluate(
                (element: HTMLImageElement) =>
                  element.complete && element.naturalWidth > 0,
              ),
            { timeout: 15_000 },
          )
          .toBe(true);
        const metrics = await image.evaluate((element: HTMLImageElement) => {
          const frame = element.getBoundingClientRect();
          const banner = element.closest("section")!.getBoundingClientRect();
          const ratio = element.naturalWidth / element.naturalHeight;
          const renderedWidth = Math.max(frame.width, frame.height * ratio);
          const renderedHeight = renderedWidth / ratio;
          const verticalPosition =
            parseFloat(getComputedStyle(element).objectPosition.split(" ")[1]) /
            100;
          return {
            viewportWidth: window.innerWidth,
            pixelRatio: window.devicePixelRatio,
            selectedWidth: Number(
              new URL(element.currentSrc).searchParams.get("w"),
            ),
            requiredWidth: Math.ceil(renderedWidth * window.devicePixelRatio),
            visibleSourceTop:
              (banner.top -
                frame.top +
                (renderedHeight - frame.height) * verticalPosition) /
              renderedHeight,
            bannerHeight: banner.height,
            hasOverflow:
              document.documentElement.scrollWidth > window.innerWidth,
          };
        });
        expect(metrics.viewportWidth).toBe(width);
        expect(metrics.pixelRatio).toBe(pixelRatio);
        expect(metrics.selectedWidth).toBeGreaterThanOrEqual(
          metrics.requiredWidth - 1,
        );
        expect(metrics.selectedWidth).toBeLessThanOrEqual(
          Math.ceil(metrics.requiredWidth * 1.12),
        );
        expect(metrics.bannerHeight).toBeCloseTo(width < 768 ? 160 : 340, 0);
        expect(metrics.hasOverflow).toBe(false);
        if (path === "/events") {
          // All faces in this retained photo are above its source midpoint.
          expect(metrics.visibleSourceTop).toBeGreaterThanOrEqual(0.499);
        }
        const banner = page.locator(".marketplace-home-hero");
        const heading = banner.getByRole("heading", { level: 1 });
        await expect(heading).toBeVisible();
        const bannerBounds = (await banner.boundingBox())!;
        const headingBounds = (await heading.boundingBox())!;
        expect(headingBounds.y).toBeGreaterThanOrEqual(bannerBounds.y);
        expect(headingBounds.y + headingBounds.height).toBeLessThanOrEqual(
          bannerBounds.y + bannerBounds.height + 1,
        );
        measurements.push({ path, ...metrics });
      }
      await testInfo.attach("background-selections", {
        body: JSON.stringify(measurements, null, 2),
        contentType: "application/json",
      });
    });
  });
}
