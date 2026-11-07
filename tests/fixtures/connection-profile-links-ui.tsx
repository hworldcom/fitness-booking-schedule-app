"use client";

import { useState } from "react";
import type { ConnectionProjection } from "@/domain/coach-athlete-connections";
import { ConnectionLists } from "@/features/connections/connection-lists";
import {
  applyConnectionResult,
  CONNECTION_SECTIONS,
  type ConnectionPages,
} from "@/features/connections/connection-model";

const coach: ConnectionProjection = {
  id: "92010000-0000-4000-8000-000000000001",
  pairId: "92010000-0000-4000-8000-000000000002",
  attemptNumber: 1,
  coachProfileId: "92010000-0000-4000-8000-000000000003",
  athleteProfileId: "92010000-0000-4000-8000-000000000004",
  senderProfileId: "92010000-0000-4000-8000-000000000003",
  recipientProfileId: "92010000-0000-4000-8000-000000000004",
  status: "accepted",
  createdAt: "2026-11-07T10:00:00Z",
  updatedAt: "2026-11-07T10:01:00Z",
  decidedAt: "2026-11-07T10:01:00Z",
  removedAt: null,
  coachDisplayName: "Fixture Coach",
  athleteDisplayName: "Fixture Athlete",
  coachSlug: "test-coach",
  coachPublic: true,
  coachPortraitUrl: "/fixture-coach.svg",
  athleteAvatarUrl: null,
  canAccept: false,
  canDecline: false,
  canWithdraw: false,
  canDisconnect: true,
};
const initial: ConnectionPages = {
  accepted: { items: [coach], nextCursor: null },
  incoming: { items: [], nextCursor: null },
  outgoing: { items: [], nextCursor: null },
  history: { items: [], nextCursor: null },
};

export default function ConnectionProfileLinksFixture() {
  const [pages, setPages] = useState(initial);
  const [published, setPublished] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const shown = Object.fromEntries(
    CONNECTION_SECTIONS.map((section) => [
      section,
      unavailable
        ? null
        : {
            ...pages[section]!,
            items: pages[section]!.items.map((row) => ({
              ...row,
              coachPublic: published,
            })),
          },
    ]),
  ) as ConnectionPages;
  return (
    <div className="my-coaches-page">
      <p>
        Isolated fictional component fixture. No account or database writes.
      </p>
      <div>
        <button type="button" onClick={() => setPublished(!published)}>
          Toggle public profile fixture
        </button>{" "}
        <button type="button" onClick={() => setUnavailable(true)}>
          Simulate unavailable read
        </button>
      </div>
      <ConnectionLists
        role="athlete"
        headingLevel={1}
        pages={shown}
        busy={false}
        mayInitiate
        onRefresh={() => setUnavailable(false)}
        onPage={() => setUnavailable(false)}
        onHistory={() => {}}
        renderHistory={() => null}
        onDecision={(row, action) => {
          if (action === "disconnect")
            setPages((previous) =>
              applyConnectionResult(
                previous,
                { ...row, status: "removed", canDisconnect: false },
                "athlete",
              ),
            );
        }}
      />
    </div>
  );
}
