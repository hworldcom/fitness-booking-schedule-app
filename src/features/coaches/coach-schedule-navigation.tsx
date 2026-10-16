import Link from "next/link";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { calendarHref } from "@/domain/coach-calendar";
import "./coach-calendar.css";
export function CoachScheduleNavigation({
  active,
  date,
}: {
  active: "calendar" | "availability";
  date: string;
}) {
  return (
    <nav className="coach-schedule-navigation" aria-label="Schedule sections">
      <Link
        aria-current={active === "calendar" ? "page" : undefined}
        href={calendarHref({
          date,
          view: "week",
          type: "all",
          venueId: null,
          history: false,
        })}
      >
        <CalendarDays size={16} /> Calendar
      </Link>
      <Link
        aria-current={active === "availability" ? "page" : undefined}
        href="/coach?view=schedule&section=availability"
      >
        <SlidersHorizontal size={16} /> Availability
      </Link>
    </nav>
  );
}
