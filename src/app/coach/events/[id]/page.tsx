import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import type { EventSearch } from "@/events/contracts";
import {
  coachEventHref,
  ownerEventId,
  ownerIssueMessage,
  ownerPageCursor,
} from "@/features/coach-events/contract";
import { CoachEventsAccess } from "@/features/coach-events/access";
import {
  CoachEventDetail,
  CoachEventsFrame,
  CoachEventsState,
} from "@/features/coach-events/screens";
import { ownedGroupEvent } from "@/server/group-sessions/owner-service";
import { currentEventBanner } from "@/server/group-sessions/banner-service";
import { EventBannerEditor } from "@/features/coach-events/banner-editor";

export const metadata = { title: "Manage group session" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<EventSearch>;
}) {
  const id = ownerEventId((await params).id),
    search = await searchParams;
  const after = ownerPageCursor(search, true);
  if (!id || after === false)
    return (
      <CoachEventsFrame>
        <CoachEventsState status="invalid" />
      </CoachEventsFrame>
    );
  const href = coachEventHref(id);
  const state = await ownedGroupEvent(id, after);
  if (state.status === "signed-out" || state.status === "preview")
    redirect(signInHref(href));
  if (state.status !== "ready")
    return (
      <CoachEventsFrame>
        <CoachEventsState status={state.status} href={href} />
      </CoachEventsFrame>
    );
  const message = ownerIssueMessage(search.issue);
  const banner = await currentEventBanner(id);
  const bannerKey =
    banner.status === "ready" || banner.status === "saved"
      ? `${id}:${banner.eventBanner.revision}:${banner.eventBanner.editable}`
      : `${id}:${banner.status}`;
  return (
    <CoachEventsFrame>
      <CoachEventsAccess
        identity={state.context.identity}
        scope={state.context.scope}
      >
        <Link href="/coach/events">← All coach events</Link>
        {message && (
          <section className="coach-event-notice" role="alert">
            <p>{message}</p>
            <a href={href}>Reload saved session</a>
          </section>
        )}
        <CoachEventDetail
          session={state.value.session}
          roster={state.value.roster}
          context={state.context}
          after={!!after}
          bannerEditor={
            <EventBannerEditor key={bannerKey} eventId={id} initial={banner} />
          }
        />
      </CoachEventsAccess>
    </CoachEventsFrame>
  );
}
