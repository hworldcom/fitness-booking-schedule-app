import type { ReactNode } from "react";
import type { CoachProjection } from "@/domain/coaches";
import { CoachWorkspaceHeader } from "./coach-workspace-header";

export function CoachWorkspaceFrame({
  coach,
  ownerDisplayName,
  children,
}: {
  coach: CoachProjection | null;
  ownerDisplayName: string;
  children: ReactNode;
}) {
  return (
    <div className="coach-workspace">
      <CoachWorkspaceHeader coach={coach} ownerDisplayName={ownerDisplayName} />
      {children}
    </div>
  );
}
