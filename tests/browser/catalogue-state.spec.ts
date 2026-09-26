import { expect, test } from "@playwright/test";
import postgres from "postgres";

const storageKey = "movx-club:membership-draft:v1";
const databaseUrl =
  process.env.DATABASE_TEST_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const database = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: false,
});

test.afterAll(async () => {
  await database.end();
});

test("empty persistent catalogue has a bounded public state", async ({
  page,
}) => {
  await database`
    update app.demo_runs
    set catalogue_visibility = 'private'
    where slug = 'local-foundation-2030'
  `;

  try {
    await page.goto("/explore");
    await expect(
      page.getByRole("heading", {
        name: "No participating gyms are available yet.",
      }),
    ).toBeVisible();
    await expect(page.locator(".studio-card")).toHaveCount(0);

    await page.goto("/membership/setup");
    await expect(
      page.getByRole("heading", {
        name: "No membership plans are available yet.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
  } finally {
    await database`
      update app.demo_runs
      set catalogue_visibility = 'public'
      where slug = 'local-foundation-2030'
    `;
  }
});

test("an inconsistent persistent catalogue never falls back to fixtures", async ({
  page,
}) => {
  await database`
    update app.membership_products
    set status = 'retired'
    where slug = 'classic'
  `;

  try {
    await page.goto("/explore");
    await expect(
      page.getByRole("heading", { name: "The gym catalogue is unavailable." }),
    ).toBeVisible();
    await expect(page.locator(".studio-card")).toHaveCount(0);

    await page.goto("/search?q=Fabrik");
    await expect(
      page.getByRole("heading", { name: "The gym catalogue is unavailable." }),
    ).toBeVisible();
    await expect(page.locator(".discovery-result")).toHaveCount(0);
  } finally {
    await database`
      update app.membership_products
      set status = 'active'
      where slug = 'classic'
    `;
  }
});

test("a saved draft visibly reconciles changed persistent eligibility", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        planId: "basic",
        gymIds: ["northside-combat", "fabrik", "vela", "groundline-mma"],
      }),
    );
  }, storageKey);
  await database`
    update app.membership_product_gym_eligibility eligibility
    set status = 'inactive'
    from app.membership_products product, app.venues venue
    where eligibility.run_id = product.run_id
      and eligibility.product_id = product.id
      and eligibility.run_id = venue.run_id
      and eligibility.venue_id = venue.id
      and product.slug = 'basic'
      and venue.slug = 'northside-combat'
  `;

  try {
    await page.goto("/membership/setup");
    await expect(page.getByText("3/4", { exact: true })).toBeVisible();
    await expect(
      page.locator(".membership-setup").getByRole("status"),
    ).toContainText("eligibility changed");
    await expect(
      page.getByRole("checkbox", { name: /Northside Combat/ }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /Northside Combat/ }),
    ).toBeDisabled();
  } finally {
    await database`
      update app.membership_product_gym_eligibility eligibility
      set status = 'active'
      from app.membership_products product, app.venues venue
      where eligibility.run_id = product.run_id
        and eligibility.product_id = product.id
        and eligibility.run_id = venue.run_id
        and eligibility.venue_id = venue.id
        and product.slug = 'basic'
        and venue.slug = 'northside-combat'
    `;
  }
});
