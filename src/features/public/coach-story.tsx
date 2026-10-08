import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  Clock3,
  Compass,
  MapPin,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";

const schedulingSteps = [
  {
    number: "01",
    title: "Find your coach",
    description:
      "Compare fictional coaches by discipline, profile and coach-selected public training place.",
    Icon: UserRoundSearch,
  },
  {
    number: "02",
    title: "See real open hours",
    description:
      "Review one-hour occurrences published from that coach’s recurring weekly schedule.",
    Icon: CalendarDays,
  },
  {
    number: "03",
    title: "Book directly",
    description:
      "Sign in by email and reserve one capacity-one hour directly from the published schedule.",
    Icon: CalendarCheck2,
  },
  {
    number: "04",
    title: "Keep the schedule clear",
    description:
      "Clients or coaches can cancel future sessions, and coaches complete elapsed sessions.",
    Icon: Clock3,
  },
] as const;

function StoryStepGrid({
  steps = schedulingSteps,
}: {
  steps?: typeof schedulingSteps;
}) {
  return (
    <div className="coach-step-grid">
      {steps.map(({ number, title, description, Icon }) => (
        <article key={number}>
          <span className="coach-step-number">{number}</span>
          <Icon size={23} aria-hidden="true" />
          <h3>{title}</h3>
          <p>{description}</p>
        </article>
      ))}
    </div>
  );
}

export function CoachStoryHome() {
  return (
    <div className="coach-story">
      <section className="coach-hero" aria-labelledby="coach-hero-title">
        <div className="coach-hero-copy">
          <span className="eyebrow">COACH DISCOVERY · DIRECT SCHEDULING</span>
          <h1 id="coach-hero-title">
            Find the right coach. Book one clear hour.
          </h1>
          <p>
            Explore martial-arts coaches, compare their confirmed training
            places and choose from real published availability. Email sign-in is
            all you need to reserve a private session.
          </p>
          <div className="coach-story-actions">
            <Link className="button lime" href="/explore">
              Explore coaches <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button coach-button-ghost" href="/how-it-works">
              See how scheduling works
            </Link>
          </div>
          <div className="coach-preview-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              Public product preview · fictional coaches and locations
            </span>
          </div>
        </div>
        <div className="coach-hero-visual" aria-label="Scheduling preview">
          <span className="coach-visual-label">ONE FOCUSED LOOP</span>
          <div className="coach-location-preview">
            <span className="coach-location-icon" aria-hidden="true">
              <MapPin size={22} />
            </span>
            <span>
              <small>DISCOVER</small>
              <strong>A coach and confirmed training place</strong>
            </span>
          </div>
          <div className="coach-week-preview">
            <span>
              <small>SCHEDULE</small>
              <strong>Published one-hour availability</strong>
            </span>
            <span className="coach-time-chip">
              <Clock3 size={14} aria-hidden="true" /> One hour
            </span>
          </div>
          <div className="coach-group-preview">
            <span className="coach-group-count" aria-hidden="true">
              <CalendarCheck2 size={21} />
            </span>
            <span>
              <small>BOOK</small>
              <strong>Capacity one · confirmed immediately</strong>
            </span>
          </div>
          <p>
            Availability and bookings come from PostgreSQL. Empty and
            unavailable states stay explicit.
          </p>
        </div>
      </section>

      <section className="coach-story-section" aria-labelledby="loop-title">
        <div className="coach-section-heading">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2 id="loop-title">Discovery and scheduling in four steps.</h2>
          <p>
            The coach, place, exact time and booking status remain connected.
          </p>
        </div>
        <StoryStepGrid />
      </section>

      <section className="coach-two-sides" aria-labelledby="two-sides-title">
        <div className="coach-section-heading">
          <span className="eyebrow">BUILT FOR BOTH SIDES</span>
          <h2 id="two-sides-title">One schedule, clear permissions.</h2>
        </div>
        <div className="coach-benefit-grid">
          <article className="coach-benefit-card member">
            <span className="coach-benefit-icon" aria-hidden="true">
              <Compass size={23} />
            </span>
            <span className="eyebrow">FOR CLIENTS</span>
            <h3>Choose and manage your private sessions.</h3>
            <ul>
              <li>
                <Check size={15} aria-hidden="true" /> Compare coaches, places
                and open times
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Book one exact future
                hour
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Cancel your future
                confirmed booking
              </li>
            </ul>
          </article>
          <article className="coach-benefit-card coach">
            <span className="coach-benefit-icon" aria-hidden="true">
              <UsersRound size={23} />
            </span>
            <span className="eyebrow">FOR COACHES</span>
            <h3>Apply, get approved and manage booked time.</h3>
            <ul>
              <li>
                <Check size={15} aria-hidden="true" /> Prepare a private coach
                application and profile
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Publish recurring
                one-hour availability
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Cancel future or complete
                elapsed sessions
              </li>
            </ul>
            <Link
              className="text-link"
              href="/sign-in?intent=coach&returnTo=%2Fprofile%2Fcoach"
            >
              Become a coach <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <section className="coach-final-cta">
        <span className="eyebrow">READY TO EXPLORE?</span>
        <h2>Start with a coach and an open hour.</h2>
        <div className="coach-story-actions">
          <Link className="button lime" href="/explore">
            Browse schedules <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link
            className="button coach-button-ghost"
            href="/sign-in?intent=coach&returnTo=%2Fprofile%2Fcoach"
          >
            Apply to coach
          </Link>
        </div>
      </section>
    </div>
  );
}

export function HowItWorksStory() {
  return (
    <div className="coach-story">
      <section className="coach-story-section coach-how-hero">
        <div className="coach-section-heading">
          <span className="eyebrow">HOW MOVX SCHEDULING WORKS</span>
          <h1>Published time in. Confirmed booking out.</h1>
          <p>
            Approved coaches own their profiles and recurring schedules. Clients
            reserve only open future occurrences, and the database prevents
            double booking.
          </p>
        </div>
        <StoryStepGrid />
      </section>
      <section className="coach-pass-story">
        <div className="coach-pass-story-copy">
          <span className="eyebrow">TRUTHFUL SCHEDULE STATE</span>
          <h2>One occurrence has one active booking.</h2>
          <p>
            Booking is atomic: the session becomes confirmed while its time
            becomes booked. Cancellation reopens a future occurrence. Completion
            is available only to the owning coach after the session begins.
          </p>
        </div>
        <div className="coach-pass-options" aria-label="Booking lifecycle">
          <article>
            <span>1×</span>
            <div>
              <h3>Confirmed</h3>
              <p>The exact hour is reserved for one client.</p>
            </div>
          </article>
          <article>
            <span>✓</span>
            <div>
              <h3>Cancelled or completed</h3>
              <p>Terminal outcomes remain visible after reload.</p>
            </div>
          </article>
        </div>
      </section>
      <section className="coach-final-cta">
        <span className="eyebrow">TRY THE PREVIEW</span>
        <h2>Browse without signing in. Book with email.</h2>
        <Link className="button lime" href="/explore">
          Explore coaches <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
