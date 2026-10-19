"use client";
import { EventError } from "@/features/events/event-error";
import { MySessionsNavigation } from "@/features/profile/my-sessions-navigation";

export default function GroupHistoryError({ retry }: { retry: () => void }) {
  return (
    <div className="my-session-recovery">
      <MySessionsNavigation active="group" />
      <EventError retry={retry} />
    </div>
  );
}
