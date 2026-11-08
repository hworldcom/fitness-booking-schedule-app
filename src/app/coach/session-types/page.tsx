import { SessionTypeManager } from "@/features/session-types/manager";
import { CoachSchedulePage } from "@/app/coach/schedule-page";
export const metadata = { title: "Session types" };
export default function Page() {
  return (
    <CoachSchedulePage active="session-types" returnHref="/coach/session-types">
      <SessionTypeManager embedded />
    </CoachSchedulePage>
  );
}
