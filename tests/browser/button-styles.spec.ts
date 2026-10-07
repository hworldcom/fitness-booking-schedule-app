import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const globalStyles = readFileSync(
  resolve("src/app/globals.css"),
  "utf8",
).replace('@import "tailwindcss";', "");

test("secondary buttons stay readable inside dark surfaces", async ({
  page,
}) => {
  await page.setContent(`
    <main style="min-height: 100vh; background: #193126; color: white; padding: 32px">
      <a class="button secondary" href="#bookings">Manage bookings</a>
    </main>
  `);
  await page.addStyleTag({ content: globalStyles });

  const manageBookings = page.getByRole("link", { name: "Manage bookings" });
  await expect(manageBookings).toBeVisible();
  await expect(manageBookings).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(manageBookings).toHaveCSS("color", "rgb(34, 37, 31)");

  await manageBookings.focus();
  await expect(manageBookings).toBeFocused();
  await expect(manageBookings).toHaveCSS("color", "rgb(34, 37, 31)");

  await manageBookings.hover();
  await expect(manageBookings).toHaveCSS(
    "background-color",
    "rgb(243, 245, 238)",
  );
  await expect(manageBookings).toHaveCSS("color", "rgb(34, 37, 31)");
});
