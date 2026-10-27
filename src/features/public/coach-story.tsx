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
          Discover coaches and group sessions, plan your weekly workouts, and
          track your activity in one personal calendar.
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
          <h2 id="home-coach-cta-title">Are you a coach?</h2>
          <p>Build your profile and connect with athletes on MovX.</p>
        </div>
        <Link
          className="text-link"
          href="/sign-in?intent=coach&returnTo=%2Fprofile%2Fcoach"
        >
          Become a coach <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
