import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMembershipDraftAction,
  EMPTY_MEMBERSHIP_DRAFT,
  isMembershipDraftReviewable,
  MEMBERSHIP_DRAFT_VERSION,
  parseMembershipDraft,
  type MembershipDraft,
} from "../src/domain/membership-draft";
import { plans, studios } from "../src/features/preview/catalogue";

const catalogue = { plans, gyms: studios };

function choose(draft: MembershipDraft, gymId: string): MembershipDraft {
  return applyMembershipDraftAction(
    draft,
    { type: "toggle-gym", gymId },
    catalogue,
  ).draft;
}

test("a valid draft requires one plan and exactly four distinct eligible gyms", () => {
  let draft = applyMembershipDraftAction(
    EMPTY_MEMBERSHIP_DRAFT,
    { type: "select-plan", planId: "basic" },
    catalogue,
  ).draft;

  for (const gymId of [
    "northside-combat",
    "fabrik",
    "vela",
    "groundline-mma",
  ]) {
    draft = choose(draft, gymId);
  }

  assert.equal(isMembershipDraftReviewable(draft, catalogue), true);
  assert.deepEqual(draft.gymIds, [
    "northside-combat",
    "fabrik",
    "vela",
    "groundline-mma",
  ]);

  const fifth = applyMembershipDraftAction(
    draft,
    { type: "toggle-gym", gymId: "kiezstrike" },
    catalogue,
  );
  assert.equal(fifth.issue, "maximum-gyms");
  assert.equal(fifth.draft, draft);

  const removed = applyMembershipDraftAction(
    draft,
    { type: "toggle-gym", gymId: "fabrik" },
    catalogue,
  );
  assert.equal(removed.issue, null);
  assert.equal(removed.draft.gymIds.includes("fabrik"), false);
  assert.equal(isMembershipDraftReviewable(removed.draft, catalogue), false);
});

test("selection blocks missing-plan, unknown and plan-ineligible gyms", () => {
  assert.equal(
    applyMembershipDraftAction(
      EMPTY_MEMBERSHIP_DRAFT,
      { type: "toggle-gym", gymId: "northside-combat" },
      catalogue,
    ).issue,
    "choose-plan-first",
  );

  const basic = applyMembershipDraftAction(
    EMPTY_MEMBERSHIP_DRAFT,
    { type: "select-plan", planId: "basic" },
    catalogue,
  ).draft;
  assert.equal(
    applyMembershipDraftAction(
      basic,
      { type: "toggle-gym", gymId: "quiet-current" },
      catalogue,
    ).issue,
    "gym-ineligible",
  );
  assert.equal(
    applyMembershipDraftAction(
      basic,
      { type: "toggle-gym", gymId: "retired-gym" },
      catalogue,
    ).issue,
    "unknown-gym",
  );
});

test("switching plans removes choices that are no longer eligible", () => {
  let classic = applyMembershipDraftAction(
    EMPTY_MEMBERSHIP_DRAFT,
    { type: "select-plan", planId: "classic" },
    catalogue,
  ).draft;
  classic = choose(classic, "quiet-current");
  classic = choose(classic, "northside-combat");

  const switched = applyMembershipDraftAction(
    classic,
    { type: "select-plan", planId: "basic" },
    catalogue,
  );
  assert.deepEqual(switched.removedGymIds, ["quiet-current"]);
  assert.deepEqual(switched.draft.gymIds, ["northside-combat"]);
  assert.equal(switched.draft.planId, "basic");
});

test("saved drafts recover safely from corruption and stale versions", () => {
  for (const raw of [
    "{broken",
    "null",
    JSON.stringify({
      version: MEMBERSHIP_DRAFT_VERSION,
      planId: "basic",
      gymIds: ["fabrik", "fabrik"],
    }),
    JSON.stringify({
      version: MEMBERSHIP_DRAFT_VERSION,
      planId: "basic",
      gymIds: ["fabrik", "vela", "groundline-mma", "kiezstrike", "extra"],
    }),
  ]) {
    const parsed = parseMembershipDraft(raw, catalogue);
    assert.equal(parsed.recovery, "corrupt");
    assert.equal(parsed.draft, EMPTY_MEMBERSHIP_DRAFT);
  }

  const stale = parseMembershipDraft(
    JSON.stringify({ version: 99, planId: "classic", gymIds: [] }),
    catalogue,
  );
  assert.equal(stale.recovery, "stale-version");
  assert.equal(stale.draft, EMPTY_MEMBERSHIP_DRAFT);
});

test("catalogue changes retain only still-eligible choices", () => {
  const parsed = parseMembershipDraft(
    JSON.stringify({
      version: MEMBERSHIP_DRAFT_VERSION,
      planId: "basic",
      gymIds: ["northside-combat", "quiet-current", "retired-gym"],
    }),
    catalogue,
  );

  assert.equal(parsed.recovery, "catalogue-changed");
  assert.deepEqual(parsed.draft.gymIds, ["northside-combat"]);
  assert.equal(isMembershipDraftReviewable(parsed.draft, catalogue), false);
});

test("reset clears draft selections without leaving an active state", () => {
  const draft: MembershipDraft = {
    version: MEMBERSHIP_DRAFT_VERSION,
    planId: "classic",
    gymIds: ["quiet-current"],
  };
  const outcome = applyMembershipDraftAction(
    draft,
    { type: "reset" },
    catalogue,
  );
  assert.equal(outcome.draft, EMPTY_MEMBERSHIP_DRAFT);
  assert.deepEqual(outcome.removedGymIds, ["quiet-current"]);
});
