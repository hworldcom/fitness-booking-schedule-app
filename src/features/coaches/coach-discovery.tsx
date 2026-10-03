import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import { profileInitials } from "@/auth/profile-presentation";
import {
  COACH_DISCIPLINES,
  type CoachDirectoryState,
  type CoachDirectoryFilters,
  type PublicCoachProfileState,
} from "@/domain/coaches";
import type {
  CoachFollowState,
  PublicCoachPostsState,
} from "@/domain/coach-social";
import { Avatar, Pill } from "@/components/ui";
import { CoachFollowControl, CoachRecentPosts } from "./coach-social";

export function CoachDirectory({ state }: { state: CoachDirectoryState }) {
  const filters = state.filters;
  return (
    <div className="coach-discovery">
      <header className="coach-directory-hero">
        <div>
          <span className="eyebrow">FICTIONAL DEMO COACHES · BERLIN</span>
          <h1>
            Find a coach who fits your training
            <span className="lime-text">.</span>
          </h1>
          <p>
            Compare disciplines and coach-confirmed public training places.
            Availability and passes appear only when their authoritative
            features are live.
          </p>
        </div>
        <div className="coach-directory-disclosure">
          <ShieldCheck size={23} aria-hidden="true" />
          <div>
            <strong>Discovery preview</strong>
            <span>No real coaches, gyms, schedules or endorsements.</span>
          </div>
        </div>
      </header>

      <CoachFilters filters={filters} />

      {state.status === "unavailable" ? (
        <section className="coach-directory-state" role="alert">
          <UserRoundSearch size={29} aria-hidden="true" />
          <h2>Coach discovery is temporarily unavailable.</h2>
          <p>
            MovX could not verify the public coach catalogue. No fixture
            fallback or invented availability was shown.
          </p>
          <Link className="button secondary" href="/explore">
            Try again
          </Link>
        </section>
      ) : state.coaches.length === 0 ? (
        <section className="coach-directory-state">
          <Search size={29} aria-hidden="true" />
          <h2>No coaches match these filters.</h2>
          <p>Clear the filters to see every visible demonstration profile.</p>
          <Link className="button secondary" href="/explore">
            Clear filters
          </Link>
        </section>
      ) : (
        <section
          className="coach-results"
          aria-label={`${state.coaches.length} matching coaches`}
        >
          <div className="coach-results-summary">
            <span>
              {state.coaches.length} coach
              {state.coaches.length === 1 ? "" : "es"}
            </span>
            <small>Ordered by coach name</small>
          </div>
          <div className="coach-card-grid">
            {state.coaches.map((coach) => (
              <article className="coach-card" key={coach.profileId}>
                <div className="coach-card-topline">
                  <Avatar initials={profileInitials(coach.displayName)} />
                  <Pill tone="lime">Demo coach</Pill>
                </div>
                <div>
                  <h2>{coach.displayName}</h2>
                  <div className="coach-discipline-list">
                    {coach.disciplines.map((discipline) => (
                      <span key={discipline}>{discipline}</span>
                    ))}
                  </div>
                </div>
                <p className="coach-card-bio">{coach.bio}</p>
                <div className="coach-location-line">
                  <MapPin size={17} aria-hidden="true" />
                  <span>
                    <strong>
                      {coach.gymName ?? "Independent training place"}
                    </strong>
                    <small>{coach.location.label}</small>
                  </span>
                </div>
                <Link
                  href={`/coaches/${coach.slug}`}
                  className="coach-card-link"
                  aria-label={`View ${coach.displayName}'s coach profile`}
                >
                  View profile <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CoachFilters({ filters }: { filters: CoachDirectoryFilters }) {
  return (
    <form className="coach-filters" action="/explore" method="get">
      <label>
        <span>Search coach or focus</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.query}
          placeholder="Try fundamentals or footwork"
          maxLength={80}
        />
      </label>
      <label>
        <span>Discipline</span>
        <select name="discipline" defaultValue={filters.discipline ?? ""}>
          <option value="">All disciplines</option>
          {COACH_DISCIPLINES.map((discipline) => (
            <option key={discipline} value={discipline}>
              {discipline}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Location</span>
        <input
          type="search"
          name="location"
          defaultValue={filters.location}
          placeholder="Gym or public place"
          maxLength={120}
        />
      </label>
      <input type="hidden" name="service" value="private-training" />
      <button className="button dark" type="submit">
        <Search size={16} aria-hidden="true" /> Apply filters
      </button>
    </form>
  );
}

export function CoachProfileView({
  state,
  postsState,
  followState,
}: {
  state: Extract<PublicCoachProfileState, { status: "ready" }>;
  postsState: PublicCoachPostsState;
  followState: CoachFollowState;
}) {
  const { coach, slots } = state;
  return (
    <article className="public-coach-profile">
      <Link className="coach-back-link" href="/explore">
        <ArrowLeft size={16} aria-hidden="true" /> Back to coaches
      </Link>
      <header className="public-coach-header">
        <div className="public-coach-identity">
          <Avatar initials={profileInitials(coach.displayName)} />
          <div>
            <span className="eyebrow">SELF-DECLARED · DEMO COACH</span>
            <h1>{coach.displayName}</h1>
            <div className="coach-discipline-list">
              {coach.disciplines.map((discipline) => (
                <span key={discipline}>{discipline}</span>
              ))}
            </div>
            <CoachFollowControl
              coachProfileId={coach.profileId}
              coachSlug={coach.slug}
              coachDisplayName={coach.displayName}
              state={followState}
            />
          </div>
        </div>
        <div className="public-coach-place">
          <MapPin size={23} aria-hidden="true" />
          <div>
            <small>COACH-CONFIRMED PUBLIC PLACE</small>
            <strong>{coach.gymName ?? "Independent training place"}</strong>
            <span>{coach.location.label}</span>
          </div>
        </div>
      </header>

      <div className="public-coach-content">
        <section className="public-coach-about">
          <span className="eyebrow">ABOUT THE COACH</span>
          <h2>Training with {coach.displayName}</h2>
          <p>{coach.bio}</p>
          <div className="coach-location-note">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>
              This is a fictional profile. The place is a public discovery point
              selected by the coach—not live tracking, current presence or a gym
              endorsement.
            </p>
          </div>
        </section>

        <aside className="public-coach-next">
          <CalendarClock size={24} aria-hidden="true" />
          <span className="eyebrow">PRIVATE TRAINING · NEXT 7 DAYS</span>
          {slots.length === 0 ? (
            <>
              <h2>No open times right now.</h2>
              <p>
                Only database-backed open slots appear here. No placeholder
                availability or price is being presented as live inventory.
              </p>
              <Link className="button secondary" href="/coming-soon">
                Join early access
              </Link>
            </>
          ) : (
            <>
              <h2>
                {slots.length} open time{slots.length === 1 ? "" : "s"} this
                week.
              </h2>
              <ul className="public-coach-slot-list">
                {slots.map((slot) => (
                  <li key={slot.id}>
                    <Clock3 size={17} aria-hidden="true" />
                    <span>
                      <strong>
                        {new Intl.DateTimeFormat("en-GB", {
                          timeZone: slot.coachTimezone,
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(slot.startsAt))}
                      </strong>
                      <small>
                        {new Intl.DateTimeFormat("en-GB", {
                          timeZone: slot.coachTimezone,
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(slot.endsAt))}
                        {" · "}
                        {slot.location.gymName ?? "Independent place"}
                      </small>
                    </span>
                    <em>Open</em>
                  </li>
                ))}
              </ul>
              <p>
                Booking and pass purchase are being connected next. These
                capacity-one times are the coach’s current public inventory.
              </p>
            </>
          )}
        </aside>
      </div>

      <section className="coach-future-sections" aria-label="Coach offers">
        <article>
          <span>TrainingPass offers</span>
          <strong>No active indexed offer yet</strong>
          <p>
            Prices and session counts will appear only after an authoritative
            Devnet offer has been indexed.
          </p>
        </article>
      </section>
      {postsState.status === "ready" ? (
        <CoachRecentPosts posts={postsState.posts} />
      ) : (
        <section className="coach-recent-posts" role="alert">
          <span className="eyebrow">COACH NOTES</span>
          <h2>Recent posts are temporarily unavailable.</h2>
          <p>No fabricated post fallback was shown.</p>
        </section>
      )}
    </article>
  );
}

export function CoachProfileUnavailable() {
  return (
    <section className="coach-directory-state" role="alert">
      <UserRoundSearch size={29} aria-hidden="true" />
      <h1>We couldn’t verify this coach profile.</h1>
      <p>No cached or fixture profile was substituted for unavailable data.</p>
      <Link className="button secondary" href="/explore">
        Return to coach discovery
      </Link>
    </section>
  );
}
