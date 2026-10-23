import type { CoachTrainingLocation } from "@/domain/coaches";
import type { CalendarPage, CalendarQuery } from "@/domain/coach-calendar";

export type CoachCalendarData = Readonly<{
  sessionTypes?: readonly import("@/domain/session-types").SessionType[];
  scope: string;
  actorIdentity: string;
  locations: readonly CoachTrainingLocation[];
  mayEditAvailability: boolean;
  availabilityPausedReason: "profile-hidden" | "coach-suspended" | null;
  page: CalendarPage;
  query: CalendarQuery;
}>;
export type CoachCalendarResult =
  | Readonly<{ status: "ready"; data: CoachCalendarData }>
  | Readonly<{ status: "unavailable" | "denied" | "invalid"; message: string }>;
export type CoachCalendarLoader = (
  query: CalendarQuery,
  scope: string,
) => Promise<CoachCalendarResult>;
