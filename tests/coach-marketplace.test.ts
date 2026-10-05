import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCancellationWindow,
  formatEurcBaseUnits,
  shortenChainReference,
} from "../src/domain/coach-marketplace";

test("EURC formatting keeps exact six-decimal base-unit value without float rounding", () => {
  assert.equal(formatEurcBaseUnits("0"), "0");
  assert.equal(formatEurcBaseUnits("1"), "0.000001");
  assert.equal(formatEurcBaseUnits("10000000"), "10");
  assert.equal(formatEurcBaseUnits("10000001"), "10.000001");
  assert.equal(
    formatEurcBaseUnits("12345678901234567890"),
    "12345678901234.56789",
  );
  assert.throws(() => formatEurcBaseUnits("10.1"), /non-negative integer/u);
  assert.throws(() => formatEurcBaseUnits("-1"), /non-negative integer/u);
});

test("cancellation cutoff copy names exact minute, hour, and day boundaries", () => {
  assert.equal(formatCancellationWindow(0), "until the session starts");
  assert.equal(formatCancellationWindow(45), "45 minutes before the session");
  assert.equal(formatCancellationWindow(60), "1 hour before the session");
  assert.equal(formatCancellationWindow(120), "2 hours before the session");
  assert.equal(formatCancellationWindow(1440), "1 day before the session");
  assert.equal(formatCancellationWindow(2880), "2 days before the session");
  assert.throws(() => formatCancellationWindow(-1), /non-negative integer/u);
  assert.throws(() => formatCancellationWindow(1.5), /non-negative integer/u);
});

test("chain references remain verifiable without replacing the human label", () => {
  assert.equal(shortenChainReference("short-address"), "short-address");
  assert.equal(
    shortenChainReference("GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU"),
    "GvZdpX…i4v1MU",
  );
});
