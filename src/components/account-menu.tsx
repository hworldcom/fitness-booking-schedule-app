"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CalendarCheck2, Menu, UserRound } from "lucide-react";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { profileInitials } from "@/auth/profile-presentation";
import { accountProfileImagePresentation } from "@/profile-images/presentation";
import { Avatar } from "./ui";

type Profile = Extract<ActorSnapshot, { status: "authorized" }>["profile"];

export function AccountMenu({
  actor,
  pathname,
}: {
  actor: ActorSnapshot;
  pathname: string;
}) {
  if (actor.status !== "authorized") return null;
  // Navigation or an actor change discards the former disclosure state.
  return (
    <AccountDisclosure
      key={`${actor.demoRun.slug}:${actor.profile.slug}:${pathname}`}
      profile={actor.profile}
      pathname={pathname}
    />
  );
}

function AccountDisclosure({
  profile,
  pathname,
}: {
  profile: Profile;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const image = accountProfileImagePresentation(
    profile.avatarUrl,
    profile.coachPortraitUrl,
  );
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        root.current?.contains(document.activeElement)
      ) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const choose = () => {
    setOpen(false);
    // A link to the current route must not leave focus in a hidden panel.
    trigger.current?.focus();
  };
  return (
    <div className="account-menu" ref={root}>
      <button
        type="button"
        className="account-menu-trigger"
        ref={trigger}
        aria-label={`Account menu for ${profile.displayName}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <Menu size={20} strokeWidth={1.8} aria-hidden="true" />
        <Avatar
          initials={profileInitials(profile.displayName)}
          imageUrl={image.imageUrl}
          small
        />
      </button>
      <div id={panelId} className="account-menu-panel" hidden={!open}>
        <Link
          href="/account"
          className="account-menu-link"
          aria-current={pathname === "/account" ? "page" : undefined}
          onClick={choose}
        >
          <UserRound size={18} aria-hidden="true" />
          <span>Account</span>
        </Link>
        <Link
          href="/sessions"
          className="account-menu-link"
          aria-current={pathname === "/sessions" ? "page" : undefined}
          onClick={choose}
        >
          <CalendarCheck2 size={18} aria-hidden="true" />
          <span>My sessions</span>
        </Link>
      </div>
    </div>
  );
}
