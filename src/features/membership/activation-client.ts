"use client";

import type {
  MemberMembershipState,
  MembershipActivationSnapshot,
} from "@/domain/membership-activation";

export type MembershipClientStateResult =
  | Readonly<{ status: "ready"; membership: MemberMembershipState }>
  | Readonly<{
      status: "signed-out" | "forbidden" | "unavailable";
    }>;

export type MembershipClientMutationResult = Readonly<{
  status: string;
  membershipPeriodId?: string;
  reason?: string;
}>;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function activation(value: unknown): value is MembershipActivationSnapshot {
  const record = object(value);
  return (
    !!record &&
    typeof record.id === "string" &&
    ["pending", "submitted", "confirmed", "failed"].includes(
      String(record.status),
    ) &&
    !!object(record.plan) &&
    Array.isArray(record.gyms)
  );
}

function stateResult(value: unknown): MembershipClientStateResult {
  const result = object(value);
  if (
    result?.status === "ready" &&
    object(result.membership) &&
    Array.isArray(object(result.membership)?.history)
  ) {
    const membership = result.membership as unknown as MemberMembershipState;
    if (
      membership.history.every(activation) &&
      (membership.pending === null || activation(membership.pending))
    ) {
      return { status: "ready", membership };
    }
  }
  if (result?.status === "signed-out" || result?.status === "forbidden") {
    return { status: result.status };
  }
  return { status: "unavailable" };
}

async function jsonRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    ...init,
  });
  return response.json();
}

export async function fetchMembershipState(): Promise<MembershipClientStateResult> {
  try {
    return stateResult(await jsonRequest("/api/membership"));
  } catch {
    return { status: "unavailable" };
  }
}

async function mutation(
  path: string,
  body: Record<string, unknown>,
): Promise<MembershipClientMutationResult> {
  try {
    const value = object(
      await jsonRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    if (!value || typeof value.status !== "string") {
      return { status: "unavailable" };
    }
    return {
      status: value.status,
      ...(typeof value.membershipPeriodId === "string"
        ? { membershipPeriodId: value.membershipPeriodId }
        : {}),
      ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    };
  } catch {
    return { status: "unavailable" };
  }
}

export function prepareMembershipActivationRequest(input: {
  operationId: string;
  planId: string;
  gymIds: readonly string[];
}) {
  return mutation("/api/membership/activation/prepare", input);
}

export function submitMembershipActivationRequest(input: {
  operationId: string;
  transactionSignature: string;
}) {
  return mutation("/api/membership/activation/submission", input);
}

export function reconcileMembershipActivationRequest(operationId: string) {
  return mutation("/api/membership/activation/reconcile", { operationId });
}

export function cancelMembershipActivationRequest(operationId: string) {
  return mutation("/api/membership/activation/failure", {
    operationId,
    reason: "wallet-cancelled",
  });
}
