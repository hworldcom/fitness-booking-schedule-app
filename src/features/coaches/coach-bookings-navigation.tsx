import Link from "next/link";
import { CalendarCheck, ClipboardList, UserPlus } from "lucide-react";
import {
  coachBookingsHref,
  type CoachBookingsSection,
} from "@/domain/coach-bookings-navigation";

export function CoachBookingsNavigation({
  active,
  pendingCount,
  newBookingHref = coachBookingsHref("new-booking"),
}: {
  active: CoachBookingsSection;
  pendingCount: number | null;
  newBookingHref?: string;
}) {
  return (
    <nav
      className="workspace-section-navigation"
      aria-label="Bookings sections"
    >
      <Link
        href={coachBookingsHref("sessions")}
        aria-current={active === "sessions" ? "page" : undefined}
      >
        <CalendarCheck size={16} aria-hidden="true" /> Booked sessions
      </Link>
      <Link
        href={coachBookingsHref("requests")}
        aria-current={active === "requests" ? "page" : undefined}
        aria-label={
          pendingCount === null
            ? "Booking requests, pending count unavailable"
            : `Booking requests, ${pendingCount} pending`
        }
      >
        <ClipboardList size={16} aria-hidden="true" /> Booking requests
        <span className="workspace-section-count" aria-hidden="true">
          {pendingCount ?? "—"}
        </span>
      </Link>
      <Link
        href={newBookingHref}
        aria-current={active === "new-booking" ? "page" : undefined}
      >
        <UserPlus size={16} aria-hidden="true" /> Schedule a client
      </Link>
    </nav>
  );
}
