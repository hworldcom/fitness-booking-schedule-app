import { SessionTypeManager } from "@/features/session-types/manager";
import { CoachWorkspacePage } from "@/app/coach/workspace-page";
export const metadata = { title: "Session types" };
export default function Page() {
  return (
    <CoachWorkspacePage
      area="calendar"
      active="session-types"
      returnHref="/coach/session-types"
    >
      <SessionTypeManager embedded />
    </CoachWorkspacePage>
  );
}
