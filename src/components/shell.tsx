"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  House,
  Info,
  ListChecks,
  MapPin,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { AuthStatusLink } from "@/auth/client/auth-status-link";
import { useActor } from "@/auth/client/actor-provider";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { profileInitials } from "@/auth/profile-presentation";
import { accountProfileImagePresentation } from "@/profile-images/presentation";
import { useUnreadMessages } from "@/messages/use-unread-messages";
import { AccountMenu } from "./account-menu";
import { HeaderAccountControl } from "./header-account-control";
import { AccountShell } from "@/components/account-shell";
import { Avatar, Brand, Modal, Pill } from "./ui";

const publicNavigationBeforeAccount = [
  { label: "Home", href: "/", Icon: House },
  { label: "Explore", href: "/explore", Icon: MapPin },
  { label: "Events", href: "/events", Icon: CalendarDays },
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

const messagesNavigation = {
  label: "Messages",
  href: "/messages",
  Icon: MessageSquare,
};

const publicHeaderNavigation = [
  publicNavigationBeforeAccount[1],
  publicNavigationBeforeAccount[2],
  howItWorksNavigation,
];

const publicMarketplacePaths = new Set([
  "/",
  "/explore",
  "/events",
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

function isCoachWorkspacePath(path: string) {
  return (
    isNavigationHrefActive(path, coachNavigation.href) ||
    isNavigationHrefActive(path, coachProfileNavigation.href)
  );
}

function allNavigationForActor(actor: ActorSnapshot, path = "") {
  const accountNavigation =
    actor.status !== "authorized"
      ? []
      : hasCoachWorkspaceNavigation(actor)
        ? [clientNavigation, messagesNavigation, coachNavigation]
        : [clientNavigation, messagesNavigation];
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
  ].filter(
    ({ href }) =>
      (!isCoachWorkspacePath(path) &&
        !isNavigationHrefActive(path, clientNavigation.href) &&
        !isNavigationHrefActive(path, accountProfileNavigation.href)) ||
      !["/explore", "/events", howItWorksNavigation.href].includes(href),
  );
}

// The desktop header owns Messages; keep it in the independent mobile menu.
export function navigationForActor(actor: ActorSnapshot, path = "") {
  return allNavigationForActor(actor, path).filter(
    ({ href }) => href !== "/messages",
  );
}

export function mobileNavigationForActor(actor: ActorSnapshot, path = "") {
  const navigationPath = isCoachWorkspacePath(path) ? path : "";
  return allNavigationForActor(actor, navigationPath).filter(
    ({ href }) =>
      (href !== "/" || isCoachWorkspacePath(path)) &&
      href !== "/how-it-works" &&
      href !== "/events",
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
    ? [messagesNavigation, coachNavigation]
    : [messagesNavigation];
}

export function isPublicMarketplacePath(path: string) {
  const coachSlug = path.startsWith("/coaches/")
    ? path.slice("/coaches/".length)
    : "";
  const eventSlug = path.startsWith("/events/")
    ? path.slice("/events/".length)
    : "";
  return (
    publicMarketplacePaths.has(path) ||
    (eventSlug.length > 0 && !eventSlug.includes("/")) ||
    (coachSlug.length > 0 && !coachSlug.includes("/"))
  );
}

export function isNavigationHrefActive(path: string, href: string) {
  return href === "/"
    ? path === href
    : path === href || path.startsWith(`${href}/`);
}

export function MessageShell({
  actor,
  children,
  authControl,
}: {
  actor: ActorSnapshot;
  children?: ReactNode;
  authControl?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const profile = actor.status === "authorized" ? actor.profile : null;
  const coachWorkspace = hasCoachWorkspaceNavigation(actor);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const fit = () => {
      if (viewport.scale === 1)
        root.current?.style.setProperty(
          "--messages-height",
          `${viewport.height}px`,
        );
    };
    fit();
    viewport.addEventListener("resize", fit);
    return () => viewport.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="messages-shell" ref={root}>
      <a className="skip-link" href="#main-content">
        Skip to messages
      </a>
      <header className="messages-shell-header">
        <Link href="/" className="brand-home" aria-label="MovX Club home">
          <Brand compact />
        </Link>
        <nav aria-label="Messaging navigation">
          {profile ? (
            <>
              <Link
                href={coachWorkspace ? "/coach" : "/sessions"}
                className="messages-workspace-return"
                aria-label={`Back to ${coachWorkspace ? "Coach workspace" : "My sessions"}`}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>
                  {coachWorkspace ? "Coach workspace" : "My sessions"}
                </span>
              </Link>
              <AccountMenu actor={actor} pathname="/messages" />
            </>
          ) : (
            authControl
          )}
        </nav>
      </header>
      <main id="main-content" className="messages-shell-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { actor } = useActor();
  const [aboutOpen, setAboutOpen] = useState(false);
  const unreadCount = useUnreadMessages(
    actor.status === "authorized"
      ? `${actor.demoRun.slug}:${actor.profile.slug}`
      : null,
  );
  const messageBadge =
    unreadCount === 0 ? null : (
      <span
        className="mailbox-nav-badge"
        title={
          unreadCount === null
            ? "Message count unavailable"
            : `${unreadCount} unread conversations`
        }
        aria-label={
          unreadCount === null
            ? "Message count unavailable"
            : `${unreadCount} unread conversations`
        }
      >
        {unreadCount === null ? "?" : unreadCount || null}
      </span>
    );
  const publicShell = isPublicMarketplacePath(path);
  const currentProfile = actor.status === "authorized" ? actor.profile : null;
  const currentProfileImage = currentProfile
    ? accountProfileImagePresentation(
        currentProfile.avatarUrl,
        currentProfile.coachPortraitUrl,
      )
    : null;
  const visibleNavigation = navigationForActor(actor, path);
  const mobileNavigation = mobileNavigationForActor(actor, path);
  const publicAccountNavigation = publicAccountNavigationForActor(actor);
  const roleLabel = workspaceRoleLabel(actor);
  const active = (href: string) => isNavigationHrefActive(path, href);

  if (path === "/messages")
    return (
      <MessageShell actor={actor} authControl={<AuthStatusLink />}>
        {children}
      </MessageShell>
    );

  if (path === "/account")
    return (
      <AccountShell
        actor={actor}
        messageBadge={messageBadge}
        authControl={<AuthStatusLink />}
      >
        {children}
      </AccountShell>
    );

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
                {href === "/messages" && messageBadge}
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
                    {href === "/messages" && messageBadge}
                  </Link>
                ))}
                <HeaderAccountControl
                  actor={actor}
                  pathname={path}
                  authControl={<AuthStatusLink />}
                />
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
              {currentProfile && (
                <Link
                  href="/messages"
                  className="header-messages"
                  aria-label="Messages"
                >
                  <MessageSquare
                    size={21}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span className="header-messages-label">Messages</span>
                  {messageBadge}
                </Link>
              )}
              <HeaderAccountControl
                actor={actor}
                pathname={path}
                authControl={<AuthStatusLink />}
              />
            </div>
          </header>
        )}
        <main
          id="main-content"
          className={`page-content ${
            publicShell ? "" : "authenticated-page-content"
          } ${path === "/" ? "home-page-content" : ""}`}
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
          {publicShell ? (
            <button
              className="footer-demo-info"
              onClick={() => setAboutOpen(true)}
            >
              Fictional profiles <Info size={13} aria-hidden="true" />
            </button>
          ) : (
            <Pill>Scheduling preview</Pill>
          )}
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
              {href === "/messages" && messageBadge}
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
