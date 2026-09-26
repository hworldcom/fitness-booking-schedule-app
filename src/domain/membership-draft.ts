import type {
  GymSummary,
  MembershipPlanId,
  PublicCatalogue,
} from "./catalogue";

export const MEMBERSHIP_DRAFT_VERSION = 1 as const;
export const REQUIRED_CORE_GYMS = 4 as const;

export type MembershipDraft = {
  version: typeof MEMBERSHIP_DRAFT_VERSION;
  planId: MembershipPlanId | null;
  gymIds: string[];
};

export type MembershipDraftRecovery =
  "none" | "corrupt" | "stale-version" | "catalogue-changed";

export type ParsedMembershipDraft = {
  draft: MembershipDraft;
  recovery: MembershipDraftRecovery;
};

export type MembershipDraftAction =
  | { type: "select-plan"; planId: MembershipPlanId }
  | { type: "toggle-gym"; gymId: string }
  | { type: "reset" };

export type MembershipDraftIssue =
  | "choose-plan-first"
  | "gym-ineligible"
  | "maximum-gyms"
  | "unknown-gym"
  | "unknown-plan";

export type MembershipDraftOutcome = {
  draft: MembershipDraft;
  issue: MembershipDraftIssue | null;
  removedGymIds: string[];
};

export const EMPTY_MEMBERSHIP_DRAFT: MembershipDraft = Object.freeze({
  version: MEMBERSHIP_DRAFT_VERSION,
  planId: null,
  gymIds: [],
});

type DraftCatalogue = Pick<PublicCatalogue, "plans" | "gyms">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasPlan(catalogue: DraftCatalogue, planId: string) {
  return catalogue.plans.some((plan) => plan.id === planId);
}

function gymForId(catalogue: DraftCatalogue, gymId: string) {
  return catalogue.gyms.find((gym) => gym.id === gymId);
}

function isGymEligible(gym: GymSummary, planId: MembershipPlanId) {
  return gym.eligiblePlans.includes(planId);
}

export function parseMembershipDraft(
  raw: string | null,
  catalogue: DraftCatalogue,
): ParsedMembershipDraft {
  if (!raw) return { draft: EMPTY_MEMBERSHIP_DRAFT, recovery: "none" };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { draft: EMPTY_MEMBERSHIP_DRAFT, recovery: "corrupt" };
  }

  if (!isRecord(value)) {
    return { draft: EMPTY_MEMBERSHIP_DRAFT, recovery: "corrupt" };
  }
  if (value.version !== MEMBERSHIP_DRAFT_VERSION) {
    return { draft: EMPTY_MEMBERSHIP_DRAFT, recovery: "stale-version" };
  }
  if (
    !(value.planId === null || typeof value.planId === "string") ||
    !Array.isArray(value.gymIds) ||
    !value.gymIds.every((gymId): gymId is string => typeof gymId === "string")
  ) {
    return { draft: EMPTY_MEMBERSHIP_DRAFT, recovery: "corrupt" };
  }

  const gymIds = value.gymIds;
  if (
    new Set(gymIds).size !== gymIds.length ||
    gymIds.length > REQUIRED_CORE_GYMS ||
    (value.planId === null && gymIds.length > 0)
  ) {
    return { draft: EMPTY_MEMBERSHIP_DRAFT, recovery: "corrupt" };
  }
  if (value.planId === null) {
    return { draft: EMPTY_MEMBERSHIP_DRAFT, recovery: "none" };
  }
  if (!hasPlan(catalogue, value.planId)) {
    return { draft: EMPTY_MEMBERSHIP_DRAFT, recovery: "catalogue-changed" };
  }

  const planId = value.planId as MembershipPlanId;
  const eligibleGymIds = gymIds.filter((gymId) => {
    const gym = gymForId(catalogue, gymId);
    return gym ? isGymEligible(gym, planId) : false;
  });
  return {
    draft: {
      version: MEMBERSHIP_DRAFT_VERSION,
      planId,
      gymIds: eligibleGymIds,
    },
    recovery:
      eligibleGymIds.length === gymIds.length ? "none" : "catalogue-changed",
  };
}

export function applyMembershipDraftAction(
  draft: MembershipDraft,
  action: MembershipDraftAction,
  catalogue: DraftCatalogue,
): MembershipDraftOutcome {
  if (action.type === "reset") {
    return {
      draft: EMPTY_MEMBERSHIP_DRAFT,
      issue: null,
      removedGymIds: [...draft.gymIds],
    };
  }

  if (action.type === "select-plan") {
    if (!hasPlan(catalogue, action.planId)) {
      return { draft, issue: "unknown-plan", removedGymIds: [] };
    }
    const retainedGymIds = draft.gymIds.filter((gymId) => {
      const gym = gymForId(catalogue, gymId);
      return gym ? isGymEligible(gym, action.planId) : false;
    });
    return {
      draft: {
        version: MEMBERSHIP_DRAFT_VERSION,
        planId: action.planId,
        gymIds: retainedGymIds,
      },
      issue: null,
      removedGymIds: draft.gymIds.filter(
        (gymId) => !retainedGymIds.includes(gymId),
      ),
    };
  }

  if (!draft.planId) {
    return { draft, issue: "choose-plan-first", removedGymIds: [] };
  }
  const gym = gymForId(catalogue, action.gymId);
  if (!gym) return { draft, issue: "unknown-gym", removedGymIds: [] };
  if (!isGymEligible(gym, draft.planId)) {
    return { draft, issue: "gym-ineligible", removedGymIds: [] };
  }
  if (draft.gymIds.includes(gym.id)) {
    return {
      draft: {
        ...draft,
        gymIds: draft.gymIds.filter((gymId) => gymId !== gym.id),
      },
      issue: null,
      removedGymIds: [gym.id],
    };
  }
  if (draft.gymIds.length >= REQUIRED_CORE_GYMS) {
    return { draft, issue: "maximum-gyms", removedGymIds: [] };
  }
  return {
    draft: { ...draft, gymIds: [...draft.gymIds, gym.id] },
    issue: null,
    removedGymIds: [],
  };
}

export function membershipDraftPlan(
  draft: MembershipDraft,
  catalogue: DraftCatalogue,
) {
  return draft.planId
    ? (catalogue.plans.find((plan) => plan.id === draft.planId) ?? null)
    : null;
}

export function membershipDraftGyms(
  draft: MembershipDraft,
  catalogue: DraftCatalogue,
) {
  return draft.gymIds
    .map((gymId) => gymForId(catalogue, gymId))
    .filter((gym): gym is GymSummary => Boolean(gym));
}

export function isMembershipDraftReviewable(
  draft: MembershipDraft,
  catalogue: DraftCatalogue,
) {
  if (!draft.planId || draft.gymIds.length !== REQUIRED_CORE_GYMS) return false;
  if (!hasPlan(catalogue, draft.planId)) return false;
  return draft.gymIds.every((gymId) => {
    const gym = gymForId(catalogue, gymId);
    return gym ? isGymEligible(gym, draft.planId!) : false;
  });
}
