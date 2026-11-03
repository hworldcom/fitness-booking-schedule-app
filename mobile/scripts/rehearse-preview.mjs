import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const evidence = path.join(root, "test-results/preview");
mkdirSync(evidence, { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-preview.mjs"], {
  cwd: root,
  env: { ...process.env, MOBILE_PREVIEW_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Preview server did not start")),
      10000,
    );
    server.stdout.on("data", (data) => {
      const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Preview server exited " + code));
    });
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 912 } });
  const failures = [];
  const externalRequests = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(url) && !request.url().startsWith("data:"))
      externalRequests.push(request.url());
  });
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: /Find your.*next move/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample preview · no live account or bookings"),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(evidence, "explore.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Boxing", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Meet Nia Winter" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Meet Leo Anders" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Meet Nia Winter" }).click();
  await page.getByRole("button", { name: "Preview booking flow" }).click();
  await expect(page.getByText("Booking is not connected yet.")).toBeVisible();
  await page.getByRole("button", { name: "Open sample session" }).click();
  await expect(page.getByText("COACH’S SHARED PLAN")).toBeVisible();
  await page.getByRole("button", { name: "Open shared session note" }).click();
  await expect(page.getByText("Visible to you and Nia")).toBeVisible();
  await page.getByRole("textbox", { name: "Shared session note" }).fill("");
  await page.getByRole("button", { name: "Update preview note" }).click();
  await expect(page.getByRole("alert")).toContainText("needs some text");
  await page
    .getByRole("textbox", { name: "Shared session note" })
    .fill("Sample shared feedback.");
  await page.getByRole("button", { name: "Update preview note" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Nothing was saved to a real account",
  );
  await page.screenshot({
    path: path.join(evidence, "shared-note.png"),
    fullPage: true,
  });
  // A full reload intentionally resets memory-only sample edits.
  await page.goto(url + "/sessions");
  await page
    .getByRole("button", { name: "Open notes for My strength session" })
    .click();
  await expect(page.getByText("Private · only you")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Personal workout note" })
    .fill("Only in my private preview note.");
  await page.getByRole("button", { name: "Update preview note" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Nothing was saved to a real account",
  );
  // Exercise the native stack's control. Browser Back can reload the web-only
  // renderer, which deliberately resets this preview's in-memory state.
  await page.getByRole("link", { name: "Go back" }).click();
  await page
    .getByRole("button", { name: "Open notes for My strength session" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Personal workout note" }),
  ).toHaveValue("Only in my private preview note.");
  await page.screenshot({
    path: path.join(evidence, "personal-note.png"),
    fullPage: true,
  });
  await page.goto(url + "/messages");
  await page.getByRole("button", { name: "Open conversation" }).click();
  const composer = page.getByRole("textbox", { name: "Sample message" });
  await composer.fill("Keep this draft while I look at the session.");
  await page.getByRole("button", { name: "View shared session" }).click();
  await page.getByRole("link", { name: "Go back" }).click();
  await expect(composer).toHaveValue(
    "Keep this draft while I look at the session.",
  );
  await page.getByRole("button", { name: "Send sample message" }).click();
  await expect(
    page
      .getByText("Keep this draft while I look at the session.", {
        exact: true,
      })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(composer).toHaveValue("");
  await page.getByRole("button", { name: "Send sample message" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Write a sample message first",
  );
  await composer.fill("A second sample.");
  await page.screenshot({
    path: path.join(evidence, "conversation.png"),
    fullPage: true,
  });
  await page.goto(url + "/notes/not-a-real-note");
  await expect(
    page.getByRole("heading", { name: "Sample note not found" }),
  ).toBeVisible();
  for (const width of [320, 375, 420, 430, 1440]) {
    await page.setViewportSize({ width, height: 912 });
    for (const route of [
      "/",
      "/sessions",
      "/messages",
      "/account",
      "/notes/personal-strength",
      "/conversation/nia",
    ]) {
      await page.goto(url + route);
      await expect(
        page.getByText("Sample preview · no live account or bookings"),
      ).toBeVisible();
      const bounds = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.viewport);
    }
    await page.screenshot({
      path: path.join(evidence, "conversation-" + width + ".png"),
      fullPage: true,
    });
  }
  await page.goto(url + "/");
  const boxing = page.getByRole("button", { name: "Boxing", exact: true });
  await expect(boxing).toBeVisible();
  for (let step = 0; step < 16; step += 1) {
    await page.keyboard.press("Tab");
    if (await boxing.evaluate((element) => element === document.activeElement))
      break;
  }
  await expect(boxing).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Meet Leo Anders" }),
  ).toHaveCount(0);
  expect(failures).toEqual([]);
  expect(externalRequests).toEqual([]);
  console.log(
    "Preview UI passed: navigation/filter, booking-unavailable, shared/private notes, validation, memory-only saves, draft/back/send, missing data, five widths, keyboard and zero external requests.",
  );
  console.log("Screenshots: " + evidence);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
