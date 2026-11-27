"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, UsersRound } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import {
  myCoachesHref,
  type MyCoachesSection,
} from "@/domain/my-coaches-navigation";
import { myCoachesOwnerAccess } from "./my-coaches-model";
import type { AthleteCoachFilter } from "@/domain/athlete-coaches";
import {
  ConnectionRequestCountProvider,
  ConnectionRequestCountBadge,
  ConnectionRequestCountRetry,
  connectionRequestCountLabel,
  useConnectionRequestCount,
} from "./connection-request-count";

const MyCoachesAccess = createContext(true);
const MyCoachesBusy = createContext<(value: boolean) => void>(() => {});
export const useMyCoachesAccess = () => useContext(MyCoachesAccess);
export const useMyCoachesBusy = () => useContext(MyCoachesBusy);

export function MyCoachesNavigation({
  active,
  disabled = false,
}: {
  active: MyCoachesSection;
  disabled?: boolean;
}) {
  const { count } = useConnectionRequestCount();
  return (
    <nav
      className="workspace-section-navigation"
      aria-label="My coaches sections"
    >
      <Link
        href={myCoachesHref("connected")}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
        aria-current={active === "connected" ? "page" : undefined}
      >
        <UsersRound size={16} aria-hidden="true" /> All coaches
      </Link>
      <Link
        href={myCoachesHref("requests")}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
        aria-current={active === "requests" ? "page" : undefined}
        aria-label={connectionRequestCountLabel(count)}
      >
        <ClipboardList size={16} aria-hidden="true" /> Connection requests
        <ConnectionRequestCountBadge />
      </Link>
      <ConnectionRequestCountRetry />
    </nav>
  );
}

export function MyCoachesWorkspace({
  active,
  subject,
  actorIdentity,
  filter = "all",
  children,
}: {
  active: MyCoachesSection;
  subject: string;
  actorIdentity: string;
  filter?: AthleteCoachFilter;
  children: ReactNode;
}) {
  const { session } = useAuthSession();
  const { actor } = useActor();
  const [blocked, setBlocked] = useState(false);
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
          <Link
            className="button secondary"
            href={myCoachesHref(active, filter)}
          >
            Reload My coaches
          </Link>
        </section>
      )}
      {access !== "denied" && (
        <div hidden={access !== "allowed"}>
          <div className="coach-workspace my-coaches-page">
            <ConnectionRequestCountProvider role="athlete" viewKey={active}>
              <header className="coach-workspace-header">
                <div>
                  <span className="eyebrow">YOUR COACHES</span>
                  <h1>My coaches</h1>
                  <p>Coaches from your sessions and connections.</p>
                </div>
              </header>
              <MyCoachesNavigation active={active} disabled={blocked} />
              <MyCoachesAccess value={access === "allowed"}>
                <MyCoachesBusy value={setBlocked}>
                  <div className="my-coaches-tab-content">{children}</div>
                </MyCoachesBusy>
              </MyCoachesAccess>
            </ConnectionRequestCountProvider>
          </div>
        </div>
      )}
    </>
  );
}
