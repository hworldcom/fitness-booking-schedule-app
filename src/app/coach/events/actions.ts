"use server";

import { revalidatePath } from "next/cache";
import {
  isGroupEventUuid,
  parseGroupEventDraftInput,
} from "@/domain/group-events";
import {
  createOwnedGroupEventDraft,
  publishOwnedGroupEvent,
  updateOwnedGroupEventDraft,
  withdrawOwnedGroupEventDraft,
} from "@/server/group-events/service";

export type GroupEventDraftActionResult = Readonly<{
  status:
    | "saved"
    | "invalid"
    | "conflict"
    | "signed-out"
    | "forbidden"
    | "unavailable";
  message: string;
  errors: readonly string[];
  eventId?: string;
}>;

type GroupEventDraftActionRequest = Readonly<{
  intent: "create" | "update";
  eventId?: string;
  title: unknown;
  discipline: unknown;
  description: unknown;
  startsAt: unknown;
  endsAt: unknown;
  mediaUrl?: unknown;
}>;

function revalidateGroupEvents() {
  revalidatePath("/coach/events");
  revalidatePath("/events");
  revalidatePath("/events/[slug]", "page");
}

function authorizationFailure(status: string): GroupEventDraftActionResult {
  return Object.freeze({
    status:
      status === "signed-out"
        ? "signed-out"
        : status === "forbidden"
          ? "forbidden"
          : "unavailable",
    message:
      status === "signed-out"
        ? "Your sign-in expired. Sign in again before changing this event."
        : status === "forbidden"
          ? "This account is not authorized to change this event."
          : "MovX could not verify and save this event right now.",
    errors: Object.freeze([]),
  });
}

export async function saveGroupEventDraftAction(
  request: GroupEventDraftActionRequest,
): Promise<GroupEventDraftActionResult> {
  if (
    typeof request !== "object" ||
    request === null ||
    (request.intent !== "create" && request.intent !== "update") ||
    (request.intent === "update" &&
      (!request.eventId || !isGroupEventUuid(request.eventId)))
  ) {
    return Object.freeze({
      status: "invalid",
      message: "Choose a valid group-event draft action.",
      errors: Object.freeze([]),
    });
  }
  const parsed = parseGroupEventDraftInput({
    title: request.title,
    discipline: request.discipline,
    description: request.description,
    startsAt: request.startsAt,
    endsAt: request.endsAt,
    mediaUrl: request.mediaUrl,
    sourceProposalId: null,
  });
  if (!parsed.valid) {
    return Object.freeze({
      status: "invalid",
      message: "Review the event details and local schedule.",
      errors: parsed.errors,
    });
  }

  const result =
    request.intent === "create"
      ? await createOwnedGroupEventDraft(parsed.value)
      : await updateOwnedGroupEventDraft(request.eventId!, parsed.value);
  if (result.status !== "authorized")
    return authorizationFailure(result.status);
  if (result.outcome === "conflict") {
    return Object.freeze({
      status: "conflict",
      message:
        "This draft changed, is already bound to a pool, or no longer belongs to this coach.",
      errors: Object.freeze([]),
    });
  }

  revalidateGroupEvents();
  return Object.freeze({
    status: "saved",
    message:
      request.intent === "create"
        ? "Event draft created."
        : "Event draft updated.",
    errors: Object.freeze([]),
    eventId: result.value,
  });
}

export async function transitionGroupEventDraftAction(
  request: unknown,
): Promise<GroupEventDraftActionResult> {
  if (typeof request !== "object" || request === null) {
    return Object.freeze({
      status: "invalid",
      message: "Choose a valid event transition.",
      errors: Object.freeze([]),
    });
  }
  const candidate = request as Record<string, unknown>;
  if (
    !isGroupEventUuid(String(candidate.eventId)) ||
    (candidate.intent !== "publish" && candidate.intent !== "withdraw")
  ) {
    return Object.freeze({
      status: "invalid",
      message: "Choose a valid event transition.",
      errors: Object.freeze([]),
    });
  }
  const eventId = String(candidate.eventId);
  const result =
    candidate.intent === "publish"
      ? await publishOwnedGroupEvent(eventId)
      : await withdrawOwnedGroupEventDraft(eventId);
  if (result.status !== "authorized")
    return authorizationFailure(result.status);
  if (result.outcome === "conflict") {
    return Object.freeze({
      status: "conflict",
      message:
        candidate.intent === "publish"
          ? "The pool must be finalized, current and scheduled in the future before publishing."
          : "Only an unbound draft can be withdrawn.",
      errors: Object.freeze([]),
    });
  }
  revalidateGroupEvents();
  return Object.freeze({
    status: "saved",
    message:
      candidate.intent === "publish" ? "Event published." : "Draft withdrawn.",
    errors: Object.freeze([]),
    eventId,
  });
}
