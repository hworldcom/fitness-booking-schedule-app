import assert from "node:assert/strict";
import test from "node:test";
import {
  isApplicationIdentitySnapshot,
  normalizeDisplayName,
} from "@/auth/identity-contracts";
import { isCoachApplicationSubmissionSnapshot } from "@/auth/coach-application-contracts";

test("display names are normalized and bounded without assuming ASCII names", () => {
  assert.equal(normalizeDisplayName("  Anna   Klein "), "Anna Klein");
  assert.equal(normalizeDisplayName("李 雷"), "李 雷");
  assert.equal(normalizeDisplayName("A"), null);
  assert.equal(normalizeDisplayName("<>"), null);
  assert.equal(normalizeDisplayName(`Anna\u0000Klein`), null);
  assert.equal(normalizeDisplayName("A".repeat(81)), null);
});

test("the browser identity contract exposes no wallet or authority metadata", () => {
  const enrolled = {
    status: "enrolled",
    profile: {
      id: "10000000-0000-4000-8000-000000000001",
      slug: "anna-klein-930000000000",
      displayName: "Anna Klein",
    },
    demoRun: {
      id: "20000000-0000-4000-8000-000000000001",
      slug: "local-foundation-2030",
      name: "Local foundation run",
    },
    role: "member",
  };

  assert.equal(isApplicationIdentitySnapshot(enrolled), true);
  assert.equal(
    isApplicationIdentitySnapshot({ status: "profile-required" }),
    true,
  );
  assert.equal(
    isApplicationIdentitySnapshot({
      ...enrolled,
      wallet: { address: "browser-supplied" },
    }),
    false,
  );
  assert.equal(
    isApplicationIdentitySnapshot({
      ...enrolled,
      profile: { ...enrolled.profile, privileged: true },
    }),
    false,
  );
});

test("the coach application response exposes only its bounded status", () => {
  assert.equal(
    isCoachApplicationSubmissionSnapshot({ status: "pending" }),
    true,
  );
  assert.equal(
    isCoachApplicationSubmissionSnapshot({ status: "rejected" }),
    true,
  );
  assert.equal(
    isCoachApplicationSubmissionSnapshot({ status: "suspended" }),
    true,
  );
  assert.equal(
    isCoachApplicationSubmissionSnapshot({ status: "signed-out" }),
    true,
  );
  assert.equal(
    isCoachApplicationSubmissionSnapshot({
      status: "approved",
      profileId: "browser-supplied",
    }),
    false,
  );
  assert.equal(
    isCoachApplicationSubmissionSnapshot({ status: "activated" }),
    false,
  );
});
