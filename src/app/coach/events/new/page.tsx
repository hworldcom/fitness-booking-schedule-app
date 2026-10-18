import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import type { EventSearch } from "@/features/events/event-contract";
import { draftValues, ownerEventId } from "@/features/coach-events/contract";
import { CoachEventsAccess } from "@/features/coach-events/access";
import { CoachEventDraftForm } from "@/features/coach-events/forms";
import {
  CoachEventsFrame,
  CoachEventsState,
} from "@/features/coach-events/screens";
import { ownerEventContext } from "@/server/group-sessions/owner-service";

export const metadata = { title: "Create group session" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<EventSearch>;
}) {
  const search = await searchParams;
  if (
    Object.keys(search).some((key) => key !== "draftId") ||
    Array.isArray(search.draftId)
  )
    return (
      <CoachEventsFrame>
        <CoachEventsState status="invalid" />
      </CoachEventsFrame>
    );
  if (!search.draftId) redirect(`/coach/events/new?draftId=${randomUUID()}`);
  const id = ownerEventId(search.draftId);
  if (!id)
    return (
      <CoachEventsFrame>
        <CoachEventsState status="invalid" />
      </CoachEventsFrame>
    );
  const permalink = `/coach/events/new?draftId=${id}`;
  const state = await ownerEventContext();
  if (state.status === "signed-out" || state.status === "preview")
    redirect(signInHref(permalink));
  if (state.status !== "ready")
    return (
      <CoachEventsFrame>
        <CoachEventsState status={state.status} href={permalink} />
      </CoachEventsFrame>
    );
  return (
    <CoachEventsFrame>
      <CoachEventsAccess
        identity={state.context.identity}
        scope={state.context.scope}
      >
        <header className="events-heading">
          <span className="eyebrow">NEW GROUP TRAINING</span>
          <h1>Create a group session</h1>
          <p>
            Save a private draft, then review its actual time, venue, capacity
            and price before publishing.
          </p>
        </header>
        {state.context.canDraft &&
        state.context.locations.length &&
        state.context.disciplines.length ? (
          <CoachEventDraftForm
            id={id}
            revision={null}
            context={state.context}
            initial={draftValues()}
            permalink={permalink}
          />
        ) : (
          <section className="coach-event-notice">
            <p>
              An approved/demo coach account, active training venue and coach
              discipline are required to save a draft.
            </p>
            <Link href="/profile/coach">Review coach profile and venues</Link>
          </section>
        )}
      </CoachEventsAccess>
    </CoachEventsFrame>
  );
}
