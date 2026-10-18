"use server";

import { revalidatePath } from "next/cache";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  isCoachBookingRequestPageCursor,
  type ClientCoachBookingRequestProjection,
  type CoachBookingRequestPage,
  type CoachBookingRequestPageCursor,
  type CoachBookingRequestStatus,
  type OwnedCoachBookingRequestProjection,
} from "@/domain/coach-booking-requests";
import {
  acceptCoachBookingRequest,
  closeCoachBookingRequestOccurrence,
  createCoachBookingRequest,
  currentClientCoachBookingRequestPage,
  declineCoachBookingRequest,
  currentOwnedCoachBookingRequestPage,
  withdrawCoachBookingRequest,
} from "@/server/coaches/booking-request-service";
import {
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
  requestId?: string;
  requestStatus?: CoachBookingRequestStatus;
  request?: ClientCoachBookingRequestProjection;
}>;

export type CoachBookingRequestPageActionResult =
  | Readonly<{
      status: "loaded";
      page: CoachBookingRequestPage<OwnedCoachBookingRequestProjection>;
    }>
  | Readonly<{
      status: "invalid" | "signed-out" | "forbidden" | "unavailable";
      message: string;
    }>;

export type ClientBookingRequestPageActionResult =
  | Readonly<{
      status: "loaded";
      page: CoachBookingRequestPage<ClientCoachBookingRequestProjection>;
    }>
  | Readonly<{
      status: "invalid" | "signed-out" | "forbidden" | "unavailable";
      message: string;
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
    message:
      "MovX could not verify the result. Refresh to check your requests and bookings before trying again.",
  });
}

function refreshScheduling() {
  revalidatePath("/sessions");
  revalidatePath("/coach");
  revalidatePath("/explore");
  revalidatePath("/coaches/[slug]", "page");
  revalidatePath("/[handle]", "page");
}

export async function loadOwnedCoachBookingRequestPageAction(
  cursor: CoachBookingRequestPageCursor | null,
): Promise<CoachBookingRequestPageActionResult> {
  if (cursor !== null && !isCoachBookingRequestPageCursor(cursor)) {
    return Object.freeze({
      status: "invalid",
      message: "That request page is invalid. Refresh to start again.",
    });
  }
  const result = await currentOwnedCoachBookingRequestPage({
    pageSize: 20,
    cursor,
  });
  if (result.status === "authorized") {
    return Object.freeze({ status: "loaded", page: result.page });
  }
  if (result.status === "preview" || result.status === "signed-out") {
    return Object.freeze({
      status: "signed-out",
      message: "Sign in before loading private booking requests.",
    });
  }
  if (result.status === "forbidden") {
    return Object.freeze({
      status: "forbidden",
      message: "This account is not authorized to view those requests.",
    });
  }
  return Object.freeze({
    status: "unavailable",
    message: "The next request page could not be verified. Refresh to retry.",
  });
}

export async function loadClientCoachBookingRequestPageAction(
  cursor: CoachBookingRequestPageCursor | null,
): Promise<ClientBookingRequestPageActionResult> {
  if (cursor !== null && !isCoachBookingRequestPageCursor(cursor)) {
    return Object.freeze({
      status: "invalid",
      message: "That request page is invalid. Refresh to start again.",
    });
  }
  const result = await currentClientCoachBookingRequestPage({
    pageSize: 20,
    cursor,
  });
  if (result.status === "authorized") {
    return Object.freeze({ status: "loaded", page: result.page });
  }
  if (result.status === "preview" || result.status === "signed-out") {
    return Object.freeze({
      status: "signed-out",
      message: "Sign in before loading your booking requests.",
    });
  }
  if (result.status === "forbidden") {
    return Object.freeze({
      status: "forbidden",
      message: "This account is not authorized to view those requests.",
    });
  }
  return Object.freeze({
    status: "unavailable",
    message: "The next request page could not be verified. Refresh to retry.",
  });
}

export async function requestPrivateSessionAction(
  slotId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(slotId)) return invalid("That time is invalid.");
  const result = await createCoachBookingRequest(slotId);
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
    message: "Request saved.",
    requestId: result.value.requestId,
    requestStatus: result.value.status,
    request: result.value.request,
  });
}

export async function withdrawPrivateSessionRequestAction(
  requestId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(requestId)) return invalid("That request is invalid.");
  const result = await withdrawCoachBookingRequest(requestId);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict" || result.value.status !== "withdrawn") {
    return Object.freeze({
      status: "conflict",
      message: "That request can no longer be withdrawn.",
      ...(result.outcome === "saved"
        ? {
            requestId: result.value.requestId,
            requestStatus: result.value.status,
          }
        : {}),
    });
  }
  refreshScheduling();
  return Object.freeze({
    status: "saved",
    message: "Request withdrawn.",
    requestId: result.value.requestId,
    requestStatus: result.value.status,
  });
}

export async function declinePrivateSessionRequestAction(
  requestId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(requestId)) return invalid("That request is invalid.");
  const result = await declineCoachBookingRequest(requestId);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict" || result.value.status !== "declined") {
    return Object.freeze({
      status: "conflict",
      message: "That request can no longer be declined.",
      ...(result.outcome === "saved"
        ? {
            requestId: result.value.requestId,
            requestStatus: result.value.status,
          }
        : {}),
    });
  }
  refreshScheduling();
  return Object.freeze({
    status: "saved",
    message: "Request declined. The occurrence remains open.",
    requestId: result.value.requestId,
    requestStatus: result.value.status,
  });
}

export async function acceptPrivateSessionRequestAction(
  requestId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(requestId)) return invalid("That request is invalid.");
  const result = await acceptCoachBookingRequest(requestId);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (
    result.outcome === "conflict" ||
    result.value.status !== "accepted" ||
    result.value.bookingId === null
  ) {
    return Object.freeze({
      status: "conflict",
      message: "That request can no longer be accepted.",
      ...(result.outcome === "saved"
        ? {
            requestId: result.value.requestId,
            requestStatus: result.value.status,
          }
        : {}),
    });
  }
  refreshScheduling();
  return Object.freeze({
    status: "saved",
    message: "Request accepted. The private session is confirmed.",
    requestId: result.value.requestId,
    requestStatus: result.value.status,
    bookingId: result.value.bookingId,
  });
}

export async function closePrivateSessionOccurrenceAction(
  slotId: string,
): Promise<CoachMarketplaceActionResult> {
  if (!isCanonicalUuid(slotId)) return invalid("That time is invalid.");
  const result = await closeCoachBookingRequestOccurrence(slotId);
  if (result.status !== "authorized") return resultFailure(result.status);
  if (result.outcome === "conflict" || result.value !== "withdrawn") {
    return Object.freeze({
      status: "conflict",
      message: "That occurrence can no longer be closed.",
    });
  }
  refreshScheduling();
  return Object.freeze({
    status: "saved",
    message: "Occurrence closed. Its pending requests are no longer active.",
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
    message: "Booking cancelled.",
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
