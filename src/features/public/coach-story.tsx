import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import { type CoachDirectoryState } from "@/domain/coaches";
import { HomeCoachDiscovery } from "@/features/coaches/home-coach-discovery";
import { HomeMarketplaceSearch } from "@/features/coaches/home-marketplace-search";
import { MarketplaceHero } from "./marketplace-hero";

type StoryStep = Readonly<{
  number: string;
  title: string;
  description: string;
  Icon: typeof UserRoundSearch;
}>;

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
  steps = homeSchedulingSteps,
  headingLevel = 3,
}: {
  steps?: readonly StoryStep[];
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={`coach-step-grid ${steps.length === 3 ? "three" : ""}`}>
      {steps.map(({ number, title, description, Icon }) => (
        <article className="coach-step-card" key={number}>
          <span className="coach-step-number">{number}</span>
          <Icon size={23} aria-hidden="true" />
          <Heading>{title}</Heading>
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
    <div className="coach-story coach-story-home">
      <MarketplaceHero
        image="/images/home-battle-ropes.jpg"
        alt="Athlete training with battle ropes in a covered outdoor space."
        titleId="coach-hero-title"
      >
        <span>Find your coach.</span> <span>Achieve your goals.</span>
      </MarketplaceHero>
      <HomeMarketplaceSearch filters={directory.filters} />

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
