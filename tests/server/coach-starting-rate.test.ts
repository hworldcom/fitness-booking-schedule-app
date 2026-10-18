import assert from "node:assert/strict";
import test from "node:test";
import { PUT } from "@/app/api/coach/starting-rate/route";
import { publicStartingRateFromRow } from "@/server/db/coaches/starting-rate-repository";
import {
  parseCoachWebsiteContent,
  projectCoachWebsite,
} from "@/domain/coach-website";
import { publicCoachStartingRate } from "@/domain/coach-starting-rate";

test("hidden/absent SQL projections omit the rate entirely; malformed projections do not masquerade as empty", () => {
  assert.equal(publicStartingRateFromRow(null), undefined);
  assert.equal(publicStartingRateFromRow(undefined), undefined);
  for (const value of [
    { amountCents: 6000 },
    {
      schemaVersion: 1,
      amountCents: 6000,
      currency: "USD",
      context: "private-session",
    },
    {
      schemaVersion: 1,
      amountCents: 6000,
      currency: "EUR",
      context: "private-session",
      showPublicly: false,
    },
  ])
    assert.throws(
      () => publicStartingRateFromRow(value),
      /Invalid public starting rate/,
    );
  const content = parseCoachWebsiteContent({})!;
  const hidden = projectCoachWebsite(
    content,
    12,
    false,
    "coach",
    publicStartingRateFromRow(null),
  );
  assert.equal("startingRate" in hidden, false);
  assert.doesNotMatch(
    JSON.stringify(hidden),
    /amountCents|currency|showPublicly/,
  );
  const visible = projectCoachWebsite(
    content,
    12,
    false,
    "coach",
    publicCoachStartingRate(0),
  );
  assert.equal(visible.startingRate?.amountCents, 0);
});
test("price routes reject malformed/forged/oversized/fractional/cross-currency requests before authority or database access", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-public-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  const valid = {
    schemaVersion: 1,
    expectedRevision: 0,
    amountCents: 6000,
    currency: "EUR",
    showPublicly: false,
  };
  for (const body of [
    "{broken",
    "x".repeat(2049),
    JSON.stringify({ ...valid, amountCents: 60.5 }),
    JSON.stringify({ ...valid, currency: "USD" }),
    JSON.stringify({ ...valid, profileId: "forged" }),
    '{"schemaVersion":1,"amountCents":NaN}',
    JSON.stringify({ ...valid, expectedRevision: "0" }),
  ]) {
    const response = await PUT(
      new Request("http://localhost:3100/api/coach/starting-rate", {
        method: "PUT",
        headers: {
          origin: "http://localhost:3100",
          "content-type": "application/json",
        },
        body,
      }),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: "invalid" });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  const response = await PUT(
    new Request("http://localhost:3100/api/coach/starting-rate", {
      method: "PUT",
      headers: {
        origin: "https://forged.example",
        "content-type": "application/json",
      },
      body: JSON.stringify(valid),
    }),
  );
  assert.equal(response.status, 400);
});
