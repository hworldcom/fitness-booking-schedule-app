"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  applyMembershipDraftAction,
  EMPTY_MEMBERSHIP_DRAFT,
  parseMembershipDraft,
  type MembershipDraftAction,
  type MembershipDraftOutcome,
  type MembershipDraftRecovery,
} from "@/domain/membership-draft";
import type { PublicCatalogue } from "@/domain/catalogue";

export const MEMBERSHIP_DRAFT_STORAGE_KEY = "movx-club:membership-draft:v1";

type MembershipDraftSnapshot = {
  draft: typeof EMPTY_MEMBERSHIP_DRAFT;
  recovery: MembershipDraftRecovery;
  storageUnavailable: boolean;
};

const SERVER_SNAPSHOT: MembershipDraftSnapshot = {
  draft: EMPTY_MEMBERSHIP_DRAFT,
  recovery: "none",
  storageUnavailable: false,
};

let snapshot: MembershipDraftSnapshot | undefined;
let snapshotCatalogueVersion: string | undefined;
const listeners = new Set<() => void>();

function persistDraft(draft: typeof EMPTY_MEMBERSHIP_DRAFT) {
  if (!draft.planId && draft.gymIds.length === 0) {
    window.localStorage.removeItem(MEMBERSHIP_DRAFT_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(
    MEMBERSHIP_DRAFT_STORAGE_KEY,
    JSON.stringify(draft),
  );
}

function readSnapshot(catalogue: PublicCatalogue): MembershipDraftSnapshot {
  try {
    const parsed = parseMembershipDraft(
      window.localStorage.getItem(MEMBERSHIP_DRAFT_STORAGE_KEY),
      catalogue,
    );
    if (parsed.recovery !== "none") persistDraft(parsed.draft);
    return {
      draft: parsed.draft,
      recovery: parsed.recovery,
      storageUnavailable: false,
    };
  } catch {
    return {
      draft: EMPTY_MEMBERSHIP_DRAFT,
      recovery: "none",
      storageUnavailable: true,
    };
  }
}

function getSnapshot(catalogue: PublicCatalogue) {
  if (!snapshot || snapshotCatalogueVersion !== catalogue.version) {
    snapshot = readSnapshot(catalogue);
    snapshotCatalogueVersion = catalogue.version;
  }
  return snapshot;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === MEMBERSHIP_DRAFT_STORAGE_KEY || event.key === null) {
      snapshot = undefined;
      snapshotCatalogueVersion = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function dispatchMembershipDraft(
  action: MembershipDraftAction,
  catalogue: PublicCatalogue,
): MembershipDraftOutcome {
  const outcome = applyMembershipDraftAction(
    getSnapshot(catalogue).draft,
    action,
    catalogue,
  );
  let storageUnavailable = false;
  try {
    persistDraft(outcome.draft);
  } catch {
    storageUnavailable = true;
  }
  snapshot = {
    draft: outcome.draft,
    recovery: "none",
    storageUnavailable,
  };
  snapshotCatalogueVersion = catalogue.version;
  listeners.forEach((listener) => listener());
  return outcome;
}

export function useMembershipDraft(catalogue: PublicCatalogue) {
  const currentSnapshot = useCallback(
    () => getSnapshot(catalogue),
    [catalogue],
  );
  const current = useSyncExternalStore(
    subscribe,
    currentSnapshot,
    getServerSnapshot,
  );
  const dispatch = useCallback(
    (action: MembershipDraftAction) =>
      dispatchMembershipDraft(action, catalogue),
    [catalogue],
  );
  return { ...current, dispatch };
}
