import { test, expect } from "@playwright/test";

test("wallet-free visitors get safe Phantom guidance without losing public access", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  const walletButton = page.getByRole("button", {
    name: "Connect Phantom wallet",
  });
  await expect(walletButton).toBeEnabled();
  await walletButton.click();

  const dialog = page.getByRole("dialog", {
    name: "Your club. Your wallet.",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Phantom was not detected");
  await expect(dialog).toContainText(
    "Connecting does not sign you in or request a message or transaction signature.",
  );
  await expect(dialog).toContainText(
    "Never enter a recovery phrase or private key on this website.",
  );

  const install = dialog.getByRole("link", {
    name: "Get Phantom from the official site",
  });
  await expect(install).toHaveAttribute("href", "https://phantom.com/download");
  await expect(install).toHaveAttribute("target", "_blank");
  await page.screenshot({
    path: testInfo.outputPath("phantom-wallet-guidance.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Private training built around the way you want to move.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).last().click();
  await expect(page).toHaveURL(/\/$/);
});
