"use client";

import Link from "next/link";
import { UserRoundSearch } from "lucide-react";
import { type CoachDirectoryState } from "@/domain/coaches";
import { CoachExploreResults } from "./coach-explore-results";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import type { LocationSearchConfiguration } from "@/location";
import { explorePreferenceScope } from "./explore-discovery-model";
import { type CoachExploreView } from "./marketplace-search-contract";

export function CoachDirectory({
  state,
  view = "list",
  searchView = null,
  locationSearchConfiguration = { status: "missing" },
}: {
  state: CoachDirectoryState;
  view?: CoachExploreView;
  searchView?: CoachExploreView | null;
  locationSearchConfiguration?: LocationSearchConfiguration;
}) {
  const { actor } = useActor();
  const { session } = useAuthSession();
  const scope = explorePreferenceScope(session, actor);
  return (
    <CoachExploreResults
      key={scope ?? "unverified"}
      state={state}
      preferenceScope={scope}
      requestedView={searchView ?? (view === "map" ? "map" : null)}
      locationSearchConfiguration={locationSearchConfiguration}
    />
  );
}

export { PublicCoachWebsite as CoachProfileView } from "./website/public-coach-website";

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
