import Link from "next/link";
import { ArrowRight, SearchX, UserRoundSearch } from "lucide-react";
import {
  homeCoachDirectoryPreview,
  type CoachDirectoryState,
} from "@/domain/coaches";
import { CompactCoachCard } from "./compact-coach-card";

export function HomeCoachDiscovery({ state }: { state: CoachDirectoryState }) {
  const preview =
    state.status === "ready" ? homeCoachDirectoryPreview(state.entries) : [];

  return (
    <section
      className="home-coach-discovery"
      aria-labelledby="home-coach-discovery-title"
    >
      <div className="home-coach-discovery-heading">
        <div>
          <span className="eyebrow">DISCOVER COACHES</span>
          <h2 id="home-coach-discovery-title">
            A first look at the directory.
          </h2>
          <p>
            A bounded preview in coach-name order—not a proximity or
            recommendation ranking.
          </p>
        </div>
        <Link className="text-link" href="/explore">
          View every coach <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {state.status === "unavailable" ? (
        <div className="home-coach-discovery-state" role="alert">
          <UserRoundSearch size={27} aria-hidden="true" />
          <div>
            <h3>Coach previews are temporarily unavailable.</h3>
            <p>
              No fallback profiles or opening times were inserted. Open Explore
              to try the live directory again.
            </p>
          </div>
          <Link className="button secondary" href="/explore">
            Open Explore
          </Link>
        </div>
      ) : preview.length === 0 ? (
        <div className="home-coach-discovery-state">
          <SearchX size={27} aria-hidden="true" />
          <div>
            <h3>No public coaches yet.</h3>
            <p>
              The directory is available, but it has no visible coach profiles
              to preview right now.
            </p>
          </div>
          <Link className="button secondary" href="/explore">
            Open Explore
          </Link>
        </div>
      ) : (
        <>
          <p className="home-coach-discovery-summary">
            Showing {preview.length} of {state.entries.length} coach
            {state.entries.length === 1 ? "" : "es"} · ordered by coach name
          </p>
          <div className="home-coach-preview-grid">
            {preview.map((entry) => (
              <CompactCoachCard entry={entry} key={entry.coach.profileId} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
