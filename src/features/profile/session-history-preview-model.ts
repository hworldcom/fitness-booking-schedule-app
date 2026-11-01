import {
  clientBookingTimeline,
  type PrivateBookingProjection,
} from "@/domain/coach-bookings";

export type HistoryPreviewView = "upcoming" | "past" | "requests";

export function historyPreviewView(value: unknown): HistoryPreviewView {
  return value === "upcoming" || value === "requests" ? value : "past";
}

export function historyPreviewHref(view: HistoryPreviewView) {
  return `/sessions/preview?view=${view}`;
}

export function historyPreviewBookings(
  bookings: readonly PrivateBookingProjection[],
  referenceTime: string,
) {
  const timeline = clientBookingTimeline(bookings, referenceTime);
  return { upcoming: timeline.upcoming, past: timeline.history };
}

export function historyPreviewStatus(booking: PrivateBookingProjection) {
  if (booking.status === "completed") return "Completed";
  if (booking.status === "cancelled")
    return booking.cancelledBy
      ? `Cancelled by ${booking.cancelledBy === "client" ? "you" : "coach"}`
      : "Cancelled";
  return "Confirmed";
}
