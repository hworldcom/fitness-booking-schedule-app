import { CalendarClock, Clock3 } from "lucide-react";
import type {
  CoachDirectoryEntry,
  PublicCoachAvailabilitySlot,
} from "@/domain/coaches";

function slotTime(slot: PublicCoachAvailabilitySlot, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(slot.startsAt))}–${formatter.format(new Date(slot.endsAt))}`;
}

export function CoachTodayAvailability({
  entry,
  limit,
}: {
  entry: CoachDirectoryEntry;
  limit: number;
}) {
  const visibleSlots = entry.todaySlots.slice(0, limit);
  const remaining = entry.todaySlots.length - visibleSlots.length;

  return (
    <section
      className="coach-today-availability"
      aria-label={`Today's availability for ${entry.coach.displayName}`}
    >
      <header>
        <CalendarClock size={15} aria-hidden="true" />
        <span>Today</span>
        <strong>
          {entry.todaySlots.length === 0
            ? "No availability today"
            : `${entry.todaySlots.length} open ${entry.todaySlots.length === 1 ? "time" : "times"}`}
        </strong>
      </header>
      {visibleSlots.length > 0 && (
        <ul>
          {visibleSlots.map((slot) => (
            <li key={slot.id}>
              <Clock3 size={13} aria-hidden="true" />
              <time dateTime={slot.startsAt}>
                {slotTime(slot, entry.coach.timezone)}
              </time>
              <span>
                <strong>{slot.location.name}</strong>
                <small>{slot.location.label}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {remaining > 0 && (
        <p className="coach-today-more">
          +{remaining} more open {remaining === 1 ? "time" : "times"} today
        </p>
      )}
    </section>
  );
}
