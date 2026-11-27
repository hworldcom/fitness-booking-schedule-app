import { expect, type Page } from "@playwright/test";

export async function setExploreCategories(
  page: Page,
  selected: readonly string[],
) {
  const filter = page.locator(".explore-category-filter");
  if ((await filter.getAttribute("open")) === null)
    await filter.locator("summary").click();
  await filter
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  for (const category of selected)
    await filter.getByRole("checkbox", { name: category, exact: true }).check();
  await filter
    .getByRole("button", { name: "Apply categories", exact: true })
    .click();
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll("discipline").sort())
    .toEqual([...selected].sort());
  await page.waitForLoadState("networkidle");
}
