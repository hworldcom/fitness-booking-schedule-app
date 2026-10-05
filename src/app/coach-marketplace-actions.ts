"use server";

import { revalidatePath } from "next/cache";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  decideOwnedLateBookingCancellation,
  prepareCreditBackedPrivateBooking,
  prepareOwnedPrivateBookingConsumption,
  requestOwnedPrivateBookingCancellation,
} from "@/server/coaches/booking-service";

export type CoachMarketplaceActionResult = Readonly<{
  status:
    | "operation-required"
    | "saved"
    | "invalid"
    | "conflict"
    | "signed-out"
    | "forbidden"
    | "unavailable";
  message: string;
  operationId?: string;
  bookingId?: string;
}>;

function invalid(message: string): CoachMarketplaceActionResult {
  return Object.freeze({ status: "invalid", message });
}

function resultFailure(
  status: "preview" | "signed-out" | "forbidden" | "unavailable",
): CoachMarketplaceActionResult {
  if (status === "preview" || status === "signed-out") {
    return Object.freeze({
      status: "signed-out",
      message: "Sign in before changing a private booking.",
    });
  }
  if (status === "forbidden") {
    return Object.freeze({
      status: "forbidden",
      message: "This account is not authorized for that booking action.",
    });
  }
  return Object.freeze({
    status: "unavailable",
    message: "MovX could not verify the booking state. Nothing was changed.",
  });
}

function conflict(message: string): CoachMarketplaceActionResult {
  return Object.freeze({ status: "conflict", message });
}

function refreshMarketplace() {
  revalidatePath("/profile");
  revalidatePath("/coach");
  revalidatePath("/coaches/[slug]", "page");
}

export async function preparePrivateBookingAction(
  slotId: string,
  creditProjectionId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(slotId) || !isCanonicalUuid(creditProjectionId)) {
    return invalid("The selected class or pass balance is invalid.");
  }
  const result = await prepareCreditBackedPrivateBooking({
    slotId,
    creditProjectionId,
  });
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict") {
    return conflict(
      "That hour is no longer open or the pass balance changed. Refresh before trying again.",
    );
  }
  refreshMarketplace();
  return Object.freeze({
    status: "operation-required",
    message: "Review the one-credit reservation before opening Phantom.",
    operationId: result.value.operationId,
    bookingId: result.value.bookingId,
  });
}

export async function requestPrivateBookingCancellationAction(
  bookingId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(bookingId)) return invalid("That booking is invalid.");
  const result = await requestOwnedPrivateBookingCancellation(bookingId);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict") {
    return conflict("That booking can no longer be cancelled from this state.");
  }
  refreshMarketplace();
  if (result.value.outcome === "return-prepared" && result.value.operationId) {
    return Object.freeze({
      status: "operation-required",
      message: "Review the credit return before opening Phantom.",
      operationId: result.value.operationId,
      bookingId,
    });
  }
  return Object.freeze({
    status: "saved",
    message:
      result.value.outcome === "coach-decision-required"
        ? "Late cancellation requested. The credit remains reserved until the coach decides."
        : "The unconfirmed booking hold was cancelled without a chain transaction.",
    bookingId,
  });
}

export async function decideLateBookingCancellationAction(
  bookingId: string,
  decision: "approved" | "denied",
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(bookingId)) return invalid("That booking is invalid.");
  const result = await decideOwnedLateBookingCancellation(bookingId, decision);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict") {
    return conflict("That cancellation request has already changed.");
  }
  refreshMarketplace();
  if (result.value.outcome === "return-prepared" && result.value.operationId) {
    return Object.freeze({
      status: "operation-required",
      message: "Review the approved credit return before opening Phantom.",
      operationId: result.value.operationId,
      bookingId,
    });
  }
  return Object.freeze({
    status: "saved",
    message:
      "Late cancellation denied. The credit remains reserved for the class.",
    bookingId,
  });
}

export async function preparePrivateBookingConsumptionAction(
  bookingId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(bookingId)) return invalid("That booking is invalid.");
  const result = await prepareOwnedPrivateBookingConsumption(bookingId);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict") {
    return conflict("That class cannot be completed from its current state.");
  }
  refreshMarketplace();
  return Object.freeze({
    status: "operation-required",
    message: "Review the one-credit completion before opening Phantom.",
    operationId: result.value,
    bookingId,
  });
}
