"use server";

import { revalidatePath } from "next/cache";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  bookDirectPrivateSession,
  cancelDirectPrivateBooking,
  completeDirectPrivateBooking,
} from "@/server/coaches/booking-service";

export type CoachMarketplaceActionResult = Readonly<{
  status:
    | "saved"
    | "invalid"
    | "conflict"
    | "signed-out"
    | "forbidden"
    | "unavailable";
  message: string;
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

function refreshScheduling() {
  revalidatePath("/profile");
  revalidatePath("/coach");
  revalidatePath("/explore");
  revalidatePath("/coaches/[slug]", "page");
}

export async function bookPrivateSessionAction(
  slotId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(slotId)) return invalid("That time is invalid.");
  const result = await bookDirectPrivateSession(slotId);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict") {
    return Object.freeze({
      status: "conflict",
      message:
        "That hour is no longer available. Refresh to see the latest schedule.",
    });
  }
  refreshScheduling();
  return Object.freeze({
    status: "saved",
    message: "Session booked. It now appears in your schedule.",
    bookingId: result.value,
  });
}

export async function cancelPrivateBookingAction(
  bookingId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(bookingId)) return invalid("That booking is invalid.");
  const result = await cancelDirectPrivateBooking(bookingId);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict") {
    return Object.freeze({
      status: "conflict",
      message: "That booking can no longer be cancelled.",
    });
  }
  refreshScheduling();
  return Object.freeze({
    status: "saved",
    message: "Booking cancelled. The future time is open again.",
    bookingId: result.value,
  });
}

export async function completePrivateBookingAction(
  bookingId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(bookingId)) return invalid("That booking is invalid.");
  const result = await completeDirectPrivateBooking(bookingId);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict") {
    return Object.freeze({
      status: "conflict",
      message: "That session cannot be completed from its current state.",
    });
  }
  refreshScheduling();
  return Object.freeze({
    status: "saved",
    message: "Session marked completed.",
    bookingId: result.value,
  });
}
