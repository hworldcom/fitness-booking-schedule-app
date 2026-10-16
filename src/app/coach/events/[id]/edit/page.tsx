import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import {
  coachEventHref,
  draftValues,
  ownerEventId,
} from "@/features/coach-events/contract";
import { CoachEventsAccess } from "@/features/coach-events/access";
import { CoachEventDraftForm } from "@/features/coach-events/forms";
import {
  CoachEventsFrame,
  CoachEventsState,
} from "@/features/coach-events/screens";
import { ownedGroupEvent } from "@/server/group-sessions/owner-service";

export const metadata = { title: "Edit group draft" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = ownerEventId((await params).id);
  if (!id)
    return (
      <CoachEventsFrame>
        <CoachEventsState status="invalid" />
      </CoachEventsFrame>
    );
  const permalink = `${coachEventHref(id)}/edit`;
  const state = await ownedGroupEvent(id);
  if (state.status === "signed-out" || state.status === "preview")
    redirect(signInHref(permalink));
  if (state.status !== "ready")
    return (
      <CoachEventsFrame>
        <CoachEventsState status={state.status} href={permalink} />
      </CoachEventsFrame>
    );
  const session = state.value.session;
  if (session.status !== "draft" || !session.canEdit || !state.context.canDraft)
    redirect(coachEventHref(id));
  return (
    <CoachEventsFrame>
      <CoachEventsAccess
        identity={state.context.identity}
        scope={state.context.scope}
      >
        <header className="events-heading">
          <span className="eyebrow">PRIVATE DRAFT</span>
          <h1>Edit group session</h1>
          <p>Save your changes and review them before publication.</p>
        </header>
        <CoachEventDraftForm
          id={id}
          revision={session.revision}
          context={state.context}
          initial={draftValues(session)}
          permalink={permalink}
        />
      </CoachEventsAccess>
    </CoachEventsFrame>
  );
}
