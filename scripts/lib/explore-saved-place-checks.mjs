import assert from "node:assert/strict";
import path from "node:path";
import { expect } from "@playwright/test";

export async function checkExploreSavedPlaces({
  page,
  base,
  evidence,
  report,
  touch,
  setViewer,
}) {
  const act = (locator) => (touch ? locator.tap() : locator.click());
  const pin = page.locator(".location-saved-place-marker");
  const dialog = page.getByRole("dialog", { name: "Saved places" });
  const scope = (kind) =>
    dialog.locator(`section[aria-label="${kind} shortcut"]`);
  const open = async () => {
    const mapMenu = page.getByRole("button", {
      name: "Manage Home and Work locations",
      exact: true,
    });
    await act(
      (await mapMenu.isVisible())
        ? mapMenu
        : page.getByRole("button", { name: "Saved places", exact: true }),
    );
    await expect(dialog).toBeVisible();
  };
  const save = async (kind, latitude, longitude) => {
    await act(
      scope(kind).getByRole("button", { name: /^(Edit|Set location)$/ }),
    );
    await dialog
      .getByLabel("Address or area", { exact: true })
      .fill(`Private ${kind} fixture`);
    await act(dialog.getByText("Enter coordinates", { exact: true }));
    await dialog
      .getByLabel("Saved place latitude", { exact: true })
      .fill(String(latitude));
    await dialog
      .getByLabel("Saved place longitude", { exact: true })
      .fill(String(longitude));
    await act(
      dialog.getByRole("button", { name: `Save ${kind}`, exact: true }),
    );
  };
  const selectPlace = async (kind) => {
    await act(scope(kind).getByRole("button", { name: "Use", exact: true }));
    await expect(dialog).toHaveCount(0);
  };
  const centred = async (kind) => {
    await expect(pin).toHaveCount(1);
    await expect(pin).toBeVisible();
    await expect(pin).toHaveAttribute(
      "aria-label",
      `${kind} saved place. Your search origin.`,
    );
    await expect(pin.locator("span")).toHaveText(kind);
    await expect
      .poll(async () => {
        const p = await pin.boundingBox(),
          c = await page.locator(".coach-map-canvas").boundingBox();
        return p && c
          ? Math.abs(p.x + p.width / 2 - c.x - c.width / 2) +
              Math.abs(p.y + p.height - c.y - c.height / 2)
          : 1000;
      })
      .toBeLessThan(4);
    await expect(page.locator(".location-device-dot")).toHaveCount(0);
    await expect(page.locator(".location-device-accuracy")).toHaveCount(0);
  };
  const changeView = async (name) => {
    await act(
      page.getByRole("link", {
        name: new RegExp(`^(${name}|Show ${name.toLowerCase()})$`),
      }),
    );
  };
  await page.setViewportSize({
    width: touch ? 390 : 1440,
    height: touch ? 844 : 1000,
  });
  await page.evaluate(() => localStorage.clear());
  setViewer("a");
  await page.goto(base + "/explore?view=list");
  await act(page.getByRole("button", { name: "Fixture a", exact: true }));
  await expect(page.locator(".explore-enhanced")).toBeVisible();
  await expect(pin).toHaveCount(0);
  await open();
  await save("Home", 52.525, 13.415);
  await save("Work", 52.54, 13.47);
  await selectPlace("Home");
  await expect(page.locator(".coach-results-summary")).toContainText(
    "Nearest to Home",
  );
  await changeView("Map");
  await centred("Home");
  assert.equal(
    await page.evaluate(() => window.exploreLocationRequests.length),
    0,
  );
  const categories = page.locator(".explore-category-filter");
  await act(categories.locator("summary"));
  await act(
    categories.getByRole("button", { name: "Clear selection", exact: true }),
  );
  for (const name of ["Boxing", "Fitness"])
    await act(
      categories.locator("label").filter({ hasText: new RegExp(`^${name}$`) }),
    );
  await act(
    categories.getByRole("button", { name: "Apply categories", exact: true }),
  );
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll("discipline"))
    .toEqual(["Boxing", "Fitness"]);
  await centred("Home");
  await changeView("Profiles");
  await changeView("Map");
  await centred("Home");
  await page.goBack();
  await expect(page.locator(".explore-profiles")).toBeVisible();
  await page.goForward();
  await centred("Home");
  await page.screenshot({ path: path.join(evidence, "saved-home.png") });
  await open();
  await selectPlace("Work");
  await centred("Work");
  await expect(pin).toHaveAttribute("data-kind", "work");
  await page.screenshot({ path: path.join(evidence, "saved-work.png") });
  await changeView("Profiles");
  await open();
  await selectPlace("Home");
  await changeView("Map");
  await centred("Home");
  await open();
  await save("Home", 52.535, 13.435);
  await expect(dialog).toHaveCount(0);
  await centred("Home");
  await open();
  await act(scope("Home").getByRole("button", { name: "Edit", exact: true }));
  await dialog
    .getByLabel("Address or area", { exact: true })
    .fill("Read the actual map centre");
  await act(
    dialog.getByRole("button", { name: "Use map centre", exact: true }),
  );
  await expect
    .poll(async () =>
      Math.abs(
        Number(
          await dialog
            .getByLabel("Saved place latitude", { exact: true })
            .inputValue(),
        ) - 52.535,
      ),
    )
    .toBeLessThan(0.00001);
  await expect
    .poll(async () =>
      Math.abs(
        Number(
          await dialog
            .getByLabel("Saved place longitude", { exact: true })
            .inputValue(),
        ) - 13.435,
      ),
    )
    .toBeLessThan(0.00001);
  await act(
    scope("Home").getByRole("button", {
      name: "Remove home location",
      exact: true,
    }),
  );
  await expect(pin).toHaveCount(0);
  await expect(
    page.locator(touch ? ".explore-map-origin" : ".coach-results-summary"),
  ).toContainText("Berlin centre");
  await selectPlace("Work");
  await centred("Work");
  await act(
    page
      .getByRole("button", { name: "Use current location", exact: true })
      .filter({ visible: true }),
  );
  await expect(page.locator(".location-device-dot")).toBeVisible();
  await expect(pin).toHaveCount(0);
  await open();
  await selectPlace("Work");
  await centred("Work");
  // A map drag changes only the camera until the explicit area search is chosen.
  const canvas = page.locator(".coach-map-canvas canvas"),
    box = await canvas.boundingBox();
  assert(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 70,
    box.y + box.height / 2 + 30,
    { steps: 8 },
  );
  await page.mouse.up();
  await act(
    page.getByRole("button", { name: "Search this area", exact: true }),
  );
  await expect(pin).toHaveCount(0);
  await open();
  await selectPlace("Work");
  await centred("Work");
  setViewer("b");
  await page.getByRole("button", { name: "Fixture b", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(pin).toHaveCount(0);
  setViewer("a");
  await page.getByRole("button", { name: "Fixture a", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(pin).toHaveCount(0);
  await expect(
    page.locator(touch ? ".explore-map-origin" : ".coach-results-summary"),
  ).toContainText("Berlin centre");
  await act(
    page.getByRole("button", { name: "Search near home", exact: true }),
  );
  await expect(dialog).toBeVisible();
  await act(
    scope("Home").getByRole("button", { name: "Set location", exact: true }),
  );
  await expect(page.locator(".location-saved-place-marker")).toHaveCount(0);
  await page.keyboard.press("Escape");
  assert(!/[?&](?:latitude|longitude|lat|lng)=/.test(page.url()));
  report(
    `${touch ? "touch" : "desktop"} Home/Work pins, hidden-map/category/history retention, active edit/removal, GPS/area replacement and account privacy`,
  );
}
