import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type CoachDirectoryState } from "@/domain/coaches";
import { HomeCoachDiscovery } from "@/features/coaches/home-coach-discovery";
import { HomeMarketplaceSearch } from "@/features/coaches/home-marketplace-search";
import type { StaticImageData } from "next/image";
import { MarketplaceHero } from "./marketplace-hero";
import { TrainingCalendarIntro } from "./training-calendar-intro";

export function CoachStoryHome({
  directory,
  background,
}: {
  directory: CoachDirectoryState;
  background: StaticImageData;
}) {
  return (
    <div className="coach-story coach-story-home">
      <MarketplaceHero
        image={background}
        alt="Athlete training with battle ropes in a covered outdoor space."
        titleId="coach-hero-title"
      >
        <span>Find your training.</span> <span>Build your routine.</span>
      </MarketplaceHero>
      <div className="home-training-intro">
        <p>
          Discover coaches and group sessions, plan your weekly workouts and
          recovery, and track your activity in one personal calendar.
        </p>
        <div className="home-training-actions">
          <Link className="button primary" href="/explore">
            Explore coaches
          </Link>
          <Link className="button secondary" href="/sessions/routine">
            Plan my routine
          </Link>
        </div>
      </div>
      <HomeMarketplaceSearch filters={directory.filters} />

      <HomeCoachDiscovery state={directory} />

      <TrainingCalendarIntro
        id="home-training-calendar-title"
        title={
          <>
            All your training. <br />
            One calendar.
          </>
        }
        description="Your own workouts, private sessions and group training, together. Plan your week and keep a private record of what you’ve done."
        showGuideLink
      />

      <section
        className="home-coach-invitation"
        aria-labelledby="home-coach-cta-title"
      >
        <div>
          <h2 id="home-coach-cta-title">Coach on MovX</h2>
          <p>
            Offer private training and group sessions, with your schedule in one
            place.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native navigation focuses the destination section for keyboard users. */}
        <a className="text-link" href="/how-it-works#coaches">
          Explore coaching on MovX <ArrowRight size={16} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
