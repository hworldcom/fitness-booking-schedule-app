import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import {
  normalizeCoachDirectoryFilters,
  type CoachDirectoryState,
} from "@/domain/coaches";
import { HomeCoachDiscovery } from "@/features/coaches/home-coach-discovery";
import { PublicMarketplaceSearch } from "@/features/coaches/public-marketplace-search";

const emptyMarketplaceSearch = normalizeCoachDirectoryFilters({});

type StoryStep = Readonly<{
  number: string;
  title: string;
  description: string;
  Icon: typeof UserRoundSearch;
}>;

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
    title: "Request coach confirmation",
    description:
      "Sign in by email and request any published hour before training starts.",
    Icon: CalendarCheck2,
  },
  {
    number: "04",
    title: "Keep the schedule clear",
    description:
      "Clients or coaches can cancel future sessions, and coaches complete elapsed sessions.",
    Icon: Clock3,
  },
] as const satisfies readonly StoryStep[];

const homeSchedulingSteps = [
  {
    number: "01",
    title: "Find your coach",
    description:
      "Compare public profiles, disciplines and coach-selected primary training places.",
    Icon: UserRoundSearch,
  },
  {
    number: "02",
    title: "Pick a published hour",
    description:
      "Choose one exact time and place from the coach’s real database-backed schedule.",
    Icon: CalendarDays,
  },
  {
    number: "03",
    title: "Request confirmation",
    description:
      "Your request stays pending until the coach accepts it. It is not an instant booking.",
    Icon: CalendarCheck2,
  },
] as const satisfies readonly StoryStep[];

function StoryStepGrid({
  steps = schedulingSteps,
}: {
  steps?: readonly StoryStep[];
}) {
  return (
    <div className={`coach-step-grid ${steps.length === 3 ? "three" : ""}`}>
      {steps.map(({ number, title, description, Icon }) => (
        <article className="coach-step-card" key={number}>
          <span className="coach-step-number">{number}</span>
          <Icon size={23} aria-hidden="true" />
          <h3>{title}</h3>
          <p>{description}</p>
        </article>
      ))}
    </div>
  );
}

export function CoachStoryHome({
  directory,
}: {
  directory: CoachDirectoryState;
}) {
  return (
    <div className="coach-story">
      <section
        className="marketplace-home-hero"
        aria-labelledby="coach-hero-title"
      >
        <div className="marketplace-home-hero-copy">
          <span className="eyebrow">
            PRIVATE MARTIAL-ARTS COACHING · BERLIN
          </span>
          <h1 id="coach-hero-title">
            Find your coach. Request a time that works.
          </h1>
          <p>
            Search public coach profiles by name, focus, discipline or training
            place. Choose from real published availability when you open a full
            profile.
          </p>
          <div className="marketplace-home-confirmation-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              A request is pending until the coach confirms it. No instant
              booking is promised.
            </span>
          </div>
          <Link className="marketplace-home-how-link" href="/how-it-works">
            How coach confirmation works
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="marketplace-home-search-panel">
          <span className="eyebrow">START YOUR SEARCH</span>
          <h2>Coach, focus or place.</h2>
          <p>
            These are the filters MovX can verify today. Search opens the full
            directory.
          </p>
          <PublicMarketplaceSearch filters={emptyMarketplaceSearch} />
        </div>
      </section>

      <HomeCoachDiscovery state={directory} />

      <section className="coach-story-section" aria-labelledby="loop-title">
        <div className="coach-section-heading">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2 id="loop-title">Three steps from search to a clear answer.</h2>
          <p>
            The coach, place, exact hour and pending status remain connected.
          </p>
        </div>
        <StoryStepGrid steps={homeSchedulingSteps} />
      </section>

      <section
        className="marketplace-home-coach-cta"
        aria-labelledby="home-coach-cta-title"
      >
        <span className="marketplace-home-coach-cta-icon" aria-hidden="true">
          <UsersRound size={27} />
        </span>
        <div>
          <span className="eyebrow">COACH ON MOVX</span>
          <h2 id="home-coach-cta-title">
            Publish your places and decide which requests to confirm.
          </h2>
          <p>
            Build a private application first. Approved coaches can publish a
            profile, location-aware availability and manage their own request
            queue.
          </p>
        </div>
        <Link
          className="button lime"
          href="/sign-in?intent=coach&returnTo=%2Fprofile%2Fcoach"
        >
          Become a coach <ArrowRight size={16} aria-hidden="true" />
        </Link>
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
          <h1>Published time in. Coach-confirmed session out.</h1>
          <p>
            Approved coaches own their profiles and recurring schedules. Clients
            request eligible future occurrences, and the coach chooses whether
            to confirm one client.
          </p>
        </div>
        <StoryStepGrid />
      </section>
      <section className="coach-pass-story">
        <div className="coach-pass-story-copy">
          <span className="eyebrow">TRUTHFUL SCHEDULE STATE</span>
          <h2>One occurrence has one active booking.</h2>
          <p>
            Coach acceptance is atomic: one session becomes confirmed while its
            time becomes booked. Cancellation reopens a future occurrence.
            Completion is available only to the owning coach after the session
            begins.
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
        <h2>Browse without signing in. Request with email.</h2>
        <Link className="button lime" href="/explore">
          Explore coaches <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
