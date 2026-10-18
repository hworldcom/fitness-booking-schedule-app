import { CalendarClock, CalendarDays, UsersRound } from "lucide-react";

export const COACH_WORKSPACE_DESTINATIONS = Object.freeze([
  { id: "schedule", label: "Schedule", href: "/coach", Icon: CalendarClock },
  {
    id: "bookings",
    label: "Bookings",
    href: "/coach?view=bookings",
    Icon: CalendarDays,
  },
  { id: "events", label: "Events", href: "/coach/events", Icon: UsersRound },
] as const);
