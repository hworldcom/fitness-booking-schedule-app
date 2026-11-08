"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, UsersRound } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import {
  myCoachesHref,
  type MyCoachesSection,
} from "@/domain/my-coaches-navigation";
import { myCoachesOwnerAccess } from "./my-coaches-model";

export function MyCoachesNavigation({ active }: { active: MyCoachesSection }) {
  return (
    <nav
      className="workspace-section-navigation"
      aria-label="My coaches sections"
    >
      <Link
        href={myCoachesHref("connected")}
        aria-current={active === "connected" ? "page" : undefined}
      >
        <UsersRound size={16} aria-hidden="true" /> Connected coaches
      </Link>
      <Link
        href={myCoachesHref("requests")}
        aria-current={active === "requests" ? "page" : undefined}
      >
        <ClipboardList size={16} aria-hidden="true" /> Connection requests
      </Link>
    </nav>
  );
}

export function MyCoachesWorkspace({
  active,
  subject,
  actorIdentity,
  children,
}: {
  active: MyCoachesSection;
  subject: string;
  actorIdentity: string;
  children: ReactNode;
}) {
  const { session } = useAuthSession();
  const { actor } = useActor();
  const access = myCoachesOwnerAccess(session, actor, {
    subject,
    actorIdentity,
  });
  return (
    <>
      {access !== "allowed" && (
        <section className="availability-notice" role="alert">
          {access === "denied" && <h1>My coaches</h1>}
          <p>
            {access === "pending"
              ? "Verifying your account. Your coaches are hidden until access can be checked."
              : "Your account or workspace changed. Reload My coaches to continue."}
          </p>
          <Link className="button secondary" href={myCoachesHref(active)}>
            Reload My coaches
          </Link>
        </section>
      )}
      {access !== "denied" && (
        <div hidden={access !== "allowed"}>
          <div className="coach-workspace my-coaches-page">
            <header className="coach-workspace-header">
              <div>
                <span className="eyebrow">YOUR COACHES</span>
                <h1>My coaches</h1>
                <p>Manage your connected coaches and connection requests.</p>
              </div>
            </header>
            <MyCoachesNavigation active={active} />
            <div className="my-coaches-tab-content">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
