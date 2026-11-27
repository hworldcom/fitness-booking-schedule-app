/** Model a real tab return in isolated browser rehearsals, including headless Chrome. */
export async function returnToVisiblePage(page) {
  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    try {
      for (const state of ["hidden", "visible"]) {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          value: state,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      }
      window.dispatchEvent(new Event("focus"));
    } finally {
      if (descriptor)
        Object.defineProperty(document, "visibilityState", descriptor);
      else delete document.visibilityState;
    }
  });
}

/** Explicit fresh-page setup between completed fixture phases; accept only its unload prompt. */
export async function reloadFixturePage(page) {
  const discard = (dialog) => dialog.accept();
  page.on("dialog", discard);
  try {
    await page.reload();
  } finally {
    page.off("dialog", discard);
  }
}
