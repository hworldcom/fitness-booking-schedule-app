import assert from "node:assert/strict";
import path from "node:path";
import { expect } from "@playwright/test";

// Actual mounted controls and Account authority; only API responses are fixtures.
export async function rehearseCalendarExport({
  page,
  base,
  evidence,
  generation,
  pass,
  setState,
}) {
  let enabled = false,
    available = true,
    backfillPending = false,
    failed = 0,
    missing = 0,
    issues = [],
    fault = false,
    conflict = false,
    hold = false,
    holding = 0,
    completed = 0,
    release;
  const posts = [];
  const result = () => ({
    status: "ready",
    available,
    generation,
    connectionState: "connected",
    export: {
      enabled,
      version: generation,
      backfillPending,
      pending: backfillPending ? 2 : 0,
      failed,
      missing,
      issues,
      lastSyncedAt: null,
    },
  });
  await page.unroute("**/api/account/google-calendar/export");
  await page.route("**/api/account/google-calendar/export", async (route) => {
    const snapshot = result(),
      held = hold;
    if (held) {
      holding++;
      await new Promise((r) => {
        release = r;
      });
    }
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      posts.push(input);
      assert.equal(input.version, generation);
      assert.equal(input.generation, generation);
      assert.match(input.commandId, /^[a-f0-9-]{36}$/);
      assert.deepEqual(
        Object.keys(input).sort(),
        (input.action === "repair"
          ? ["acknowledged", "action", "commandId", "generation", "version"]
          : ["action", "commandId", "generation", "version"]
        ).sort(),
      );
      if (fault)
        return route.fulfill({ status: 503, json: { status: "unavailable" } });
      if (conflict)
        return route.fulfill({ status: 409, json: { status: "conflict" } });
      if (input.action === "enable") {
        enabled = true;
        backfillPending = true;
      }
      if (input.action === "disable") {
        enabled = false;
        backfillPending = false;
      }
      if (input.action === "repair") {
        assert.equal(input.acknowledged, true);
        failed = 0;
        missing = 0;
        issues = [];
      }
    }
    await route
      .fulfill({
        json: route.request().method() === "GET" ? snapshot : result(),
      })
      .catch(() => {});
    if (held) completed++;
  });
  const open = () => page.goto(`${base}/calendar-fixture`);
  const region = page.getByRole("region", { name: "Google booking sync" });
  const toggle = region.getByRole("checkbox", {
    name: "Sync confirmed bookings",
    exact: true,
  });
  for (const width of [1440, 375, 320]) {
    setState("connected");
    enabled = false;
    available = true;
    backfillPending = false;
    failed = 0;
    missing = 0;
    issues = [];
    await page.setViewportSize({ width, height: 900 });
    const before = posts.length;
    await open();
    await expect(toggle).not.toBeChecked();
    await expect(toggle).toBeEnabled();
    assert.equal(
      posts.length,
      before,
      "loading a connection never opts into export",
    );
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    await expect(
      region.getByText("Preparing upcoming confirmed bookings…", {
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(posts.length, before + 1);
    assert.equal(posts.at(-1).action, "enable");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await region.screenshot({
      path: path.join(evidence, `booking-sync-${width}.png`),
    });
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).not.toBeChecked();
    await expect(
      region.getByText("Booking sync is off. Existing Google copies remain.", {
        exact: true,
      }),
    ).toBeVisible();
    pass(
      `${width}px: saved-off default, one keyboard opt-in/backfill, disable and no horizontal overflow`,
    );
  }
  enabled = true;
  available = false;
  await open();
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeDisabled();
  pass("Delivery unavailable still permits turning an existing preference off");
  available = true;
  enabled = false;
  fault = true;
  await open();
  await toggle.click();
  await expect(
    region.getByText("The previous request could not be verified.", {
      exact: false,
    }),
  ).toBeVisible();
  const attempted = posts.at(-1),
    count = posts.length;
  await page.waitForTimeout(300);
  assert.equal(
    posts.length,
    count,
    "uncertainty never triggers an automatic mutation retry",
  );
  fault = false;
  await region
    .getByRole("button", { name: "Retry previous sync request", exact: true })
    .click();
  await expect(toggle).toBeChecked();
  assert.deepEqual(posts.at(-1), attempted);
  pass("Unknown mutation outcome retains the exact command for explicit retry");
  conflict = true;
  await toggle.click();
  await expect(
    region.getByText(
      "Booking sync changed. Reload its status before trying again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(toggle).toHaveCount(0);
  conflict = false;
  await region
    .getByRole("button", { name: "Reload booking sync", exact: true })
    .click();
  await expect(toggle).toBeChecked();
  pass("Conflicting preference requires a fresh read before another command");
  failed = 1;
  missing = 1;
  issues = ["event-missing"];
  backfillPending = false;
  await open();
  await region
    .getByText("Repair missing booking copies", { exact: true })
    .click();
  const repair = region.getByRole("button", {
    name: "Recreate missing booking copies",
    exact: true,
  });
  await expect(repair).toBeDisabled();
  const before = posts.length;
  await region
    .getByRole("checkbox", {
      name: "I checked Google Calendar and want to recreate missing booking copies.",
      exact: true,
    })
    .check();
  assert.equal(posts.length, before);
  await repair.click();
  await expect(repair).toHaveCount(0);
  assert.equal(posts.at(-1).action, "repair");
  pass(
    "Missing copies require explicit acknowledgement before a target-free repair command",
  );
  backfillPending = true;
  await open();
  await expect(toggle).toBeChecked();
  const started = holding,
    finished = completed;
  hold = true;
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect.poll(() => holding).toBe(started + 1);
  hold = false;
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  release?.();
  await expect.poll(() => completed).toBe(finished + 1);
  await expect(toggle).not.toBeChecked();
  pass("A delayed polling read cannot overwrite a newer saved opt-out");
  hold = true;
  const loaded = page.waitForRequest("**/api/account/google-calendar/export");
  await open();
  await loaded;
  await page.getByRole("button", { name: "Sign out fixture" }).click();
  await expect(region).toHaveCount(0);
  hold = false;
  release?.();
  await expect(region).toHaveCount(0);
  pass("Owner loss removes booking controls and ignores a late protected read");
  enabled = false;
  backfillPending = false;
  await open();
  await expect(toggle).not.toBeChecked();
  hold = true;
  const beforeMutation = holding,
    beforeCompletion = completed;
  await toggle.click();
  await expect.poll(() => holding).toBe(beforeMutation + 1);
  await page.getByRole("button", { name: "Sign out fixture" }).click();
  await expect(region).toHaveCount(0);
  hold = false;
  release?.();
  await expect.poll(() => completed).toBe(beforeCompletion + 1);
  await expect(region).toHaveCount(0);
  pass("A late saved mutation cannot restore controls after owner loss");
}
