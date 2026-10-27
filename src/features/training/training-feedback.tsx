"use client";
import type { TrainingWorkspace } from "./use-training-workspace";

export function TrainingFeedback({
  workspace,
  onRetry,
}: {
  workspace: TrainingWorkspace;
  onRetry: () => void;
}) {
  return (
    <>
      {workspace.error && (
        <section role="alert" className="training-error">
          <p>{workspace.error}</p>
          {workspace.pending && (
            <button disabled={workspace.busy} onClick={onRetry}>
              Retry last save
            </button>
          )}
          <button
            disabled={workspace.busy || !!workspace.pending}
            onClick={workspace.refresh}
          >
            Refresh calendar
          </button>
        </section>
      )}
      <p role="status" aria-live="polite">
        {workspace.busy ? "Saving…" : workspace.message}
      </p>
    </>
  );
}
