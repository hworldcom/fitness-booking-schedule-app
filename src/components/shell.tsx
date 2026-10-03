"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  House,
  UserRound,
  MapPin,
  ArrowUpRight,
  Info,
  ArrowRight,
  CircleHelp,
  ListChecks,
} from "lucide-react";
import { Avatar, Brand, Modal, Pill } from "./ui";
import { AuthStatusLink } from "@/auth/client/auth-status-link";
import { useActor } from "@/auth/client/actor-provider";
import { profileInitials } from "@/auth/profile-presentation";
import {
  WalletConnectionPanel,
  WalletStatusButton,
} from "@/solana/client/wallet-connection";

const navigation = [
  { label: "Home", href: "/", Icon: House },
  { label: "How it works", href: "/how-it-works", Icon: ListChecks },
  { label: "Profile", href: "/profile", Icon: UserRound },
];
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { actor } = useActor();
  const [modal, setModal] = useState<"wallet" | "about" | null>(null);
  const currentProfile = actor.status === "authorized" ? actor.profile : null;
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);
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
          TRAIN TOGETHER.
        </div>
        <nav aria-label="Main navigation">
          {navigation.map(({ label, href, Icon }) => (
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
            <strong>Coach-first MovX is coming.</strong>
            <p>Join the early-access list while we rebuild the experience.</p>
            <Link href="/coming-soon">
              Join the waitlist <ArrowUpRight size={16} />
            </Link>
          </div>
          <button className="preview-link" onClick={() => setModal("about")}>
            <Info size={15} />
            About this preview
          </button>
          {currentProfile && (
            <Link href="/profile" className="sidebar-profile">
              <Avatar initials={profileInitials(currentProfile.displayName)} />
              <span>
                <strong>{currentProfile.displayName}</strong>
                <small>Your account profile</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
          )}
          <span className="sidebar-tagline">
            Coaches. Packages.
            <br />
            <span>Sessions that stay clear.</span>
          </span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <Link href="/" className="mobile-brand" aria-label="MovX Club home">
            <Brand compact />
          </Link>
          <span className="location">
            <MapPin size={16} />
            <span>Berlin, Germany</span>
          </span>
          <div className="header-right">
            <Link href="/how-it-works" className="how-it-works-link">
              <CircleHelp size={17} aria-hidden="true" />
              <span>How it works</span>
            </Link>
            <AuthStatusLink />
            <WalletStatusButton onOpen={() => setModal("wallet")} />
            {currentProfile && (
              <Link
                href="/profile"
                className="header-avatar"
                aria-label={`Your profile: ${currentProfile.displayName}`}
              >
                <Avatar
                  initials={profileInitials(currentProfile.displayName)}
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
          <p>Coach-first rebuild in progress.</p>
          <button onClick={() => setModal("about")}>
            Fixtures · No real funds <Info size={13} />
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
          <span className="footer-tagline">
            Find a coach. Train with clarity.
          </span>
          <Pill>Solana Devnet target · Test USDC</Pill>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ label, href, Icon }) => (
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
      {modal && (
        <Modal
          title={
            modal === "wallet"
              ? "Your club. Your wallet."
              : "A first look at MovX Club."
          }
          onClose={() => setModal(null)}
        >
          {modal === "wallet" ? (
            <WalletConnectionPanel onSignIn={() => setModal(null)} />
          ) : (
            <>
              <p className="dialog-copy">
                MovX Club is becoming a coach-first marketplace for prepaid
                training packages and verifiable session balances.
              </p>
              <div className="notice">
                <strong>Everything here is demonstration data.</strong>
                <p>
                  The current public preview is transitional. Coaches, offers,
                  packages and posts shown during the rebuild are fixtures, not
                  live partnerships or financial records.
                </p>
              </div>
              <p className="small-copy">
                Coach-package purchase and redemption are not live yet.
              </p>
              <button
                className="button lime full"
                onClick={() => setModal(null)}
              >
                Let’s explore <ArrowRight size={17} />
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
