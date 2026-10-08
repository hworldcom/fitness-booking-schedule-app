"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  CircleHelp,
  House,
  Info,
  ListChecks,
  MapPin,
  UserRound,
} from "lucide-react";
import { AuthStatusLink } from "@/auth/client/auth-status-link";
import { useActor } from "@/auth/client/actor-provider";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { profileInitials } from "@/auth/profile-presentation";
import { accountProfileImagePresentation } from "@/profile-images/presentation";
import { Avatar, Brand, Modal, Pill } from "./ui";

const publicNavigationBeforeAccount = [
  { label: "Home", href: "/", Icon: House },
  { label: "Explore", href: "/explore", Icon: MapPin },
];

const howItWorksNavigation = {
  label: "How it works",
  href: "/how-it-works",
  Icon: ListChecks,
};

const accountProfileNavigation = {
  label: "Profile",
  href: "/profile",
  Icon: UserRound,
};

const coachProfileNavigation = {
  label: "Profile",
  href: "/profile/coach",
  Icon: UserRound,
};

const clientNavigation = {
  label: "My sessions",
  href: "/sessions",
  Icon: CalendarCheck2,
};

const coachNavigation = {
  label: "Coach workspace",
  href: "/coach",
  Icon: CalendarCheck2,
};

function hasCoachWorkspaceNavigation(actor: ActorSnapshot) {
  return (
    actor.status === "authorized" &&
    (actor.coachAccessStatus === "approved" ||
      actor.coachAccessStatus === "demo" ||
      actor.coachAccessStatus === "suspended")
  );
}

export function navigationForActor(actor: ActorSnapshot) {
  const accountNavigation =
    actor.status !== "authorized"
      ? []
      : hasCoachWorkspaceNavigation(actor)
        ? [clientNavigation, coachNavigation]
        : [clientNavigation];
  const profileNavigation =
    actor.status === "authorized" &&
    (actor.coachAccessStatus === "approved" ||
      actor.coachAccessStatus === "demo")
      ? coachProfileNavigation
      : accountProfileNavigation;
  return [
    ...publicNavigationBeforeAccount,
    ...accountNavigation,
    howItWorksNavigation,
    profileNavigation,
  ];
}

export function isNavigationHrefActive(path: string, href: string) {
  return href === "/"
    ? path === href
    : path === href || path.startsWith(`${href}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { actor } = useActor();
  const [aboutOpen, setAboutOpen] = useState(false);
  const currentProfile = actor.status === "authorized" ? actor.profile : null;
  const currentProfileImage = currentProfile
    ? accountProfileImagePresentation(
        currentProfile.avatarUrl,
        currentProfile.coachPortraitUrl,
      )
    : null;
  const visibleNavigation = navigationForActor(actor);
  const active = (href: string) => isNavigationHrefActive(path, href);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand-home" aria-label="MovX Club home">
          <Brand />
        </Link>
        <div className="sidebar-caption">
          FIND YOUR COACH.
          <br />
          BOOK YOUR HOUR.
        </div>
        <nav aria-label="Main navigation">
          {visibleNavigation.map(({ label, href, Icon }) => (
            <Link
              href={href}
              key={href}
              className={`nav-item ${active(href) ? "active" : ""}`}
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon
                size={22}
                strokeWidth={1.7}
                aria-hidden="true"
                fill={href === "/" && active(href) ? "currentColor" : "none"}
              />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="club-note">
            <span className="little-spark">✳</span>
            <strong>Meet the demo coaches.</strong>
            <p>Browse disciplines, places and published one-hour sessions.</p>
            <Link href="/explore">
              Explore schedules <ArrowUpRight size={16} />
            </Link>
          </div>
          <button className="preview-link" onClick={() => setAboutOpen(true)}>
            <Info size={15} aria-hidden="true" />
            About this preview
          </button>
          {currentProfile && (
            <Link href="/profile" className="sidebar-profile">
              <Avatar
                initials={profileInitials(currentProfile.displayName)}
                imageUrl={currentProfileImage?.imageUrl}
              />
              <span>
                <strong>{currentProfile.displayName}</strong>
                <small>Your account profile</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
          )}
          <span className="sidebar-tagline">
            Discover. Schedule.
            <br />
            <span>Train with clarity.</span>
          </span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <Link href="/" className="mobile-brand" aria-label="MovX Club home">
            <Brand compact />
          </Link>
          <span className="location">
            <MapPin size={16} aria-hidden="true" />
            <span>Berlin, Germany</span>
          </span>
          <div className="header-right">
            <Link href="/how-it-works" className="how-it-works-link">
              <CircleHelp size={17} aria-hidden="true" />
              <span>How it works</span>
            </Link>
            <AuthStatusLink />
            {currentProfile && (
              <Link
                href="/profile"
                className="header-avatar"
                aria-label={`Your profile: ${currentProfile.displayName}`}
              >
                <Avatar
                  initials={profileInitials(currentProfile.displayName)}
                  imageUrl={currentProfileImage?.imageUrl}
                  small
                />
              </Link>
            )}
          </div>
        </header>
        <div className="demo-strip">
          <span>
            <i /> DEMO WORLD
          </span>
          <p>Coach discovery and direct scheduling preview.</p>
          <button onClick={() => setAboutOpen(true)}>
            Fictional profiles <Info size={13} aria-hidden="true" />
          </button>
        </div>
        <main id="main-content" className="page-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span className="footer-contact-line">
            <span>MovX Club © 2026</span>
            <a className="footer-contact" href="mailto:hello@movx.club">
              hello@movx.club
            </a>
          </span>
          <span className="footer-tagline">Find a coach. Book your time.</span>
          <Pill>Scheduling preview</Pill>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {visibleNavigation.map(({ label, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className={active(href) ? "active" : ""}
            aria-current={active(href) ? "page" : undefined}
          >
            <Icon
              size={21}
              strokeWidth={1.7}
              aria-hidden="true"
              fill={href === "/" && active(href) ? "currentColor" : "none"}
            />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {aboutOpen && (
        <Modal
          title="A first look at MovX Club."
          onClose={() => setAboutOpen(false)}
        >
          <p className="dialog-copy">
            MovX Club is a focused scheduling preview: discover a coach, inspect
            their real published availability and reserve one private hour.
          </p>
          <div className="notice">
            <strong>Everything here is demonstration data.</strong>
            <p>
              Coaches and locations are fictional fixtures. Availability and
              bookings come from the scheduling database, not placeholder cards.
            </p>
          </div>
          <button
            className="button lime full"
            onClick={() => setAboutOpen(false)}
          >
            Let’s explore <ArrowRight size={17} aria-hidden="true" />
          </button>
        </Modal>
      )}
    </>
  );
}
