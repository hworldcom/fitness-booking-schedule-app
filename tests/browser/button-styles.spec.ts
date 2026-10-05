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
      <a class="button secondary" href="#posts">Manage posts</a>
    </main>
  `);
  await page.addStyleTag({ content: globalStyles });

  const managePosts = page.getByRole("link", { name: "Manage posts" });
  await expect(managePosts).toBeVisible();
  await expect(managePosts).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(managePosts).toHaveCSS("color", "rgb(34, 37, 31)");

  await managePosts.focus();
  await expect(managePosts).toBeFocused();
  await expect(managePosts).toHaveCSS("color", "rgb(34, 37, 31)");

  await managePosts.hover();
  await expect(managePosts).toHaveCSS("background-color", "rgb(243, 245, 238)");
  await expect(managePosts).toHaveCSS("color", "rgb(34, 37, 31)");
});
