import { publicSessionCatalog } from "@/server/coaches/typed-session-service";
import { TypeFirstBooking } from "@/features/session-types/public-booking";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CoachProfileUnavailable,
  CoachProfileView,
} from "@/features/coaches/coach-discovery";
import { CoachMarketplace } from "@/features/coaches/coach-marketplace";
import { currentClientCoachMarketplaceWorkspace } from "@/server/coaches/booking-request-service";
import {
  publicWebsiteProfile,
  publicWebsiteOrigin,
  publicCoachWebsiteGroups,
} from "@/server/coaches/public-website-page";
import { publicCoachReviews } from "@/server/coaches/review-service";
import { publicPrivateScheduleSummary } from "@/server/coaches/private-schedule-summary-service";
import { PrivateScheduleAccess } from "@/features/coaches/private-schedule-access";
import { calendarDate } from "@/domain/coach-calendar";
import { coachRedirectHref } from "@/domain/coach-public-url";
import {
  publicScheduleSelection,
  publicScheduleSlots,
} from "@/domain/public-coach-schedule";

export async function PublicCoachPage({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = await publicWebsiteProfile(slug);
  if (state.status !== "ready") {
    if (state.status === "not-found") notFound();
    return <CoachProfileUnavailable />;
  }
  let catalog;
  let catalogUnavailable = false;
  try {
    catalog = await publicSessionCatalog(slug);
    catalogUnavailable = catalog === null;
  } catch {
    catalogUnavailable = true;
  }
  const [reviews, groups, summary] = await Promise.all([
    publicCoachReviews(slug, null),
    publicCoachWebsiteGroups(slug),
    publicPrivateScheduleSummary(
      slug,
      catalog ?? null,
      state.slots,
      state.databaseTime,
    ),
  ]);
  const query = await searchParams;
  const selection = publicScheduleSelection(query.date, state.databaseTime);
  const daySlots = publicScheduleSlots(state.slots, state.databaseTime).filter(
    (slot) => calendarDate(slot.startsAt) === selection.date,
  );
  const bookingState = await currentClientCoachMarketplaceWorkspace(
    daySlots.map((slot) => slot.id),
  );
  const actor =
    bookingState.status === "authorized"
      ? {
          status: "authorized" as const,
          actorProfileId: bookingState.actorProfileId,
          subject: bookingState.subject,
          actorIdentity: bookingState.actorIdentity,
          bookings: bookingState.bookings.filter(
            (booking) => booking.coachProfileId === state.coach.profileId,
          ),
          pendingRequests: bookingState.pendingRequests.filter(
            (request) => request.coachProfileId === state.coach.profileId,
          ),
        }
      : bookingState;
  return (
    <CoachProfileView
      state={{ ...state, slots: [] }}
      catalog={catalog ?? null}
      reviews={reviews}
      groups={groups}
      origin={publicWebsiteOrigin()}
      ownProfile={
        actor.status === "authorized" &&
        actor.actorProfileId === state.coach.profileId
      }
      marketplace={
        <PrivateScheduleAccess
          expected={
            actor.status === "authorized"
              ? { subject: actor.subject, actorIdentity: actor.actorIdentity }
              : null
          }
          summary={summary}
          returnTo={coachRedirectHref(
            state.coach.publicPath ?? `/coaches/${slug}`,
            { date: selection.date, section: "private-schedule" },
          )}
        >
          {actor.status !== "authorized" ? null : catalogUnavailable ? (
            <section
              id="private-schedule"
              className="coach-open-slots public-schedule"
              aria-labelledby="booking-unavailable"
            >
              <h2 id="booking-unavailable">Session booking is unavailable</h2>
              <p role="status">
                We couldn’t load available sessions. You can still browse this
                coach’s profile and try again.
              </p>
              <Link
                className="button secondary"
                href={coachRedirectHref(
                  state.coach.publicPath ?? `/coaches/${slug}`,
                  { date: selection.date },
                )}
                prefetch={false}
              >
                Retry available sessions
              </Link>
            </section>
          ) : catalog?.enabled ? (
            <section
              id="private-schedule"
              tabIndex={-1}
              aria-label="Private session booking"
            >
              <TypeFirstBooking
                catalog={catalog}
                selectedDate={
                  typeof query.date === "string" ? query.date : undefined
                }
                slug={slug}
                ownProfile={
                  actor.status === "authorized" &&
                  actor.actorProfileId === state.coach.profileId
                }
                referenceTime={state.databaseTime}
                returnTo={state.coach.publicPath ?? `/coaches/${slug}`}
              />
            </section>
          ) : (
            <CoachMarketplace
              key={`${slug}:${selection.date}:${actor.subject + actor.actorIdentity}`}
              coachProfileId={state.coach.profileId}
              coachDisplayName={state.coach.displayName}
              coachSlug={state.coach.slug}
              publicPath={state.coach.publicPath}
              slots={state.slots}
              actor={actor}
              referenceTime={state.databaseTime}
              selectedDate={query.date}
            />
          )}
        </PrivateScheduleAccess>
      }
    />
  );
}
