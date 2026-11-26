import type { GroupSession } from "@/domain/group-sessions";
import type { OwnerMutation } from "@/events/contracts";
type Draft = Extract<OwnerMutation, { action: "save-draft" }>;
type Reply = {
  status: string;
  context?: { scope: string };
  value?: { outcome?: string; reason?: string | null; session?: GroupSession };
};
type Port = {
  change: (command: OwnerMutation, scope: string) => Promise<Reply>;
  read: (id: string) => Promise<Reply>;
};
export function sameGroupDraft(session: GroupSession, draft: Draft) {
  const a = draft.args;
  return (
    session.id === a.id &&
    session.title === a.title.trim() &&
    session.description === a.description.trim() &&
    session.discipline === a.discipline &&
    session.intendedLevel === a.intendedLevel.trim() &&
    session.venue.id === a.locationId &&
    Date.parse(session.startsAt) === Date.parse(a.startsAt) &&
    Date.parse(session.endsAt) === Date.parse(a.endsAt) &&
    Date.parse(session.decisionDeadlineAt) ===
      Date.parse(a.decisionDeadlineAt) &&
    session.minimumParticipants === a.minimumParticipants &&
    session.maximumParticipants === a.maximumParticipants &&
    session.priceCents === a.priceCents &&
    (session.sessionType?.id ?? null) === (a.sessionTypeId ?? null)
  );
}
export async function submitGroupDraft(
  draft: Draft,
  scope: string,
  mode: "draft" | "submit",
  resume: boolean,
  port: Port,
) {
  let session: GroupSession | undefined;
  try {
    if (resume) {
      const current = await port.read(draft.args.id);
      if (current.status === "ready") {
        if (current.context?.scope !== scope)
          return { issue: "actor-changed", pending: false };
        session = current.value?.session;
        if (!session || !sameGroupDraft(session, draft))
          return { issue: "conflict", pending: false };
        if (mode === "draft" || session.publishedAt)
          return { issue: null, pending: false };
        const expectedSavedRevision = (draft.args.expectedRevision ?? 0) + 1;
        if (session.revision !== expectedSavedRevision)
          return { issue: "conflict", pending: false };
      } else if (current.status !== "conflict")
        return {
          issue: current.status,
          pending: current.status === "unavailable",
        };
    }
    if (!session) {
      const saved = await port.change(draft, scope);
      if (saved.status !== "ready")
        return { issue: saved.status, pending: saved.status === "unavailable" };
      session = saved.value?.session;
      if (saved.value?.outcome !== "saved" || !session)
        return {
          issue: saved.value?.reason ?? saved.value?.outcome ?? "unavailable",
          pending:
            !saved.value?.outcome || saved.value.outcome === "unavailable",
        };
    }
    if (mode === "draft") return { issue: null, pending: false };
    const result = await port.change(
      {
        action: "publish",
        args: { id: session.id, expectedRevision: session.revision },
      },
      scope,
    );
    if (result.status === "ready" && result.value?.outcome === "published")
      return { issue: null, pending: false };
    return {
      issue:
        result.status === "ready"
          ? (result.value?.reason ?? result.value?.outcome ?? "conflict")
          : result.status,
      pending:
        result.status === "unavailable" ||
        result.value?.outcome === "unavailable",
      revision: session.revision,
    };
  } catch {
    return { issue: "unavailable", pending: true };
  }
}
