"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
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
  Icon: BriefcaseBusiness,
};

const publicHeaderNavigation = [
  publicNavigationBeforeAccount[1],
  howItWorksNavigation,
];

const publicMarketplacePaths = new Set([
  "/",
  "/explore",
  "/how-it-works",
  "/sign-in",
]);

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

export function mobileNavigationForActor(actor: ActorSnapshot) {
  return navigationForActor(actor).filter(
    ({ href }) => href !== "/" && href !== "/how-it-works",
  );
}

export function workspaceRoleLabel(actor: ActorSnapshot) {
  if (actor.status !== "authorized") return "MovX preview";
  switch (actor.coachAccessStatus) {
    case "approved":
    case "demo":
      return "Coach and athlete";
    case "suspended":
      return "Coach access limited";
    case "pending":
      return "Coach application pending";
    case "rejected":
      return "Coach application needs changes";
    case "not-applied":
      return "Athlete account";
  }
}

export function publicAccountNavigationForActor(actor: ActorSnapshot) {
  if (actor.status !== "authorized") return [];
  return hasCoachWorkspaceNavigation(actor)
    ? [clientNavigation, coachNavigation]
    : [clientNavigation];
}

export function isPublicMarketplacePath(path: string) {
  const coachSlug = path.startsWith("/coaches/")
    ? path.slice("/coaches/".length)
    : "";
  return (
    publicMarketplacePaths.has(path) ||
    (coachSlug.length > 0 && !coachSlug.includes("/"))
  );
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
  const publicShell = isPublicMarketplacePath(path);
  const currentProfile = actor.status === "authorized" ? actor.profile : null;
  const currentProfileImage = currentProfile
    ? accountProfileImagePresentation(
        currentProfile.avatarUrl,
        currentProfile.coachPortraitUrl,
      )
    : null;
  const visibleNavigation = navigationForActor(actor);
  const mobileNavigation = mobileNavigationForActor(actor);
  const publicAccountNavigation = publicAccountNavigationForActor(actor);
  const roleLabel = workspaceRoleLabel(actor);
  const active = (href: string) => isNavigationHrefActive(path, href);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {!publicShell && (
        <aside className="sidebar authenticated-sidebar">
          <div className="authenticated-sidebar-heading">
            <Link href="/" className="brand-home" aria-label="MovX Club home">
              <Brand />
            </Link>
            <span>PRIVATE WORKSPACE</span>
          </div>
          <nav aria-label="Main navigation">
            <span className="authenticated-nav-label">Navigate</span>
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
            <button
              className="preview-link authenticated-preview-card"
              onClick={() => setAboutOpen(true)}
            >
              <Info size={15} aria-hidden="true" />
              <span>
                <strong>Scheduling preview</strong>
                <small>Fictional coaches and places</small>
              </span>
            </button>
            {currentProfile && (
              <Link
                href="/profile"
                className="sidebar-profile authenticated-account-card"
              >
                <Avatar
                  initials={profileInitials(currentProfile.displayName)}
                  imageUrl={currentProfileImage?.imageUrl}
                />
                <span>
                  <strong>{currentProfile.displayName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ArrowUpRight size={18} />
              </Link>
            )}
          </div>
        </aside>
      )}
      <div
        className={`app-main ${
          publicShell ? "public-app-main" : "authenticated-app-main"
        }`}
      >
        {publicShell ? (
          <header className="public-header">
            <div className="public-header-inner">
              <Link href="/" className="brand-home" aria-label="MovX Club home">
                <Brand compact />
              </Link>
              <nav
                className="public-primary-navigation"
                aria-label="Public navigation"
              >
                {publicHeaderNavigation.map(({ label, href }) => (
                  <Link
                    href={href}
                    key={href}
                    className={active(href) ? "active" : ""}
                    aria-current={active(href) ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="public-header-actions">
                {!hasCoachWorkspaceNavigation(actor) && (
                  <Link
                    href={
                      actor.status === "authorized"
                        ? "/profile/coach"
                        : "/sign-in?returnTo=%2Fprofile%2Fcoach&intent=coach"
                    }
                    className="public-coach-entry"
                    aria-label="Become a coach"
                  >
                    <span className="public-coach-entry-wide">
                      Become a coach
                    </span>
                    <span className="public-coach-entry-short">Coach</span>
                  </Link>
                )}
                {publicAccountNavigation.map(({ label, href, Icon }) => (
                  <Link href={href} key={href} className="public-account-link">
                    <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                ))}
                {currentProfile ? (
                  <Link
                    href="/profile"
                    className="public-account-avatar"
                    aria-label={`Your account profile: ${currentProfile.displayName}`}
                  >
                    <Avatar
                      initials={profileInitials(currentProfile.displayName)}
                      imageUrl={currentProfileImage?.imageUrl}
                      small
                    />
                  </Link>
                ) : (
                  <AuthStatusLink />
                )}
              </div>
            </div>
          </header>
        ) : (
          <header className="topbar authenticated-topbar">
            <Link href="/" className="mobile-brand" aria-label="MovX Club home">
              <Brand compact />
            </Link>
            <span className="authenticated-mobile-role">{roleLabel}</span>
            <div className="authenticated-topbar-context">
              <span>AUTHENTICATED WORKSPACE</span>
              <strong>{roleLabel}</strong>
            </div>
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
        )}
        <div
          role={publicShell ? "region" : undefined}
          aria-label={publicShell ? "Demonstration data" : undefined}
          className={`demo-strip ${
            publicShell ? "" : "authenticated-demo-strip"
          }`}
        >
          <span>
            <i /> DEMO WORLD
          </span>
          <p>Coach discovery and coach-confirmed scheduling preview.</p>
          <button onClick={() => setAboutOpen(true)}>
            Fictional profiles <Info size={13} aria-hidden="true" />
          </button>
        </div>
        <main
          id="main-content"
          className={`page-content ${
            publicShell ? "" : "authenticated-page-content"
          }`}
          tabIndex={-1}
        >
          {children}
        </main>
        <footer
          className={`app-footer ${
            publicShell ? "" : "authenticated-app-footer"
          }`}
        >
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
      {!publicShell && (
        <nav
          className="mobile-nav authenticated-mobile-nav"
          aria-label="Mobile navigation"
        >
          {mobileNavigation.map(({ label, href, Icon }) => (
            <Link
              key={href}
              href={href}
              className={active(href) ? "active" : ""}
              aria-current={active(href) ? "page" : undefined}
              aria-label={label}
            >
              <Icon
                size={21}
                strokeWidth={1.7}
                aria-hidden="true"
                fill={href === "/" && active(href) ? "currentColor" : "none"}
              />
              <span>
                {label === "My sessions"
                  ? "Sessions"
                  : label === "Coach workspace"
                    ? "Workspace"
                    : label}
              </span>
            </Link>
          ))}
        </nav>
      )}
      {aboutOpen && (
        <Modal
          title="A first look at MovX Club."
          onClose={() => setAboutOpen(false)}
        >
          <p className="dialog-copy">
            MovX Club is a focused scheduling preview: discover a coach, inspect
            their real published availability and request one private hour.
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
