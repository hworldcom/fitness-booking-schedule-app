"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeftRight,
  CalendarCheck2,
  Menu,
  Settings2,
  UserRound,
} from "lucide-react";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { useWorkspaceView } from "@/auth/client/use-workspace-view";
import {
  hasCoachWorkspace,
  workspaceHref,
  workspaceProfileHref,
  workspaceSwitchHref,
} from "@/auth/workspace-view";
import { profileInitials } from "@/auth/profile-presentation";
import { accountProfileImagePresentation } from "@/profile-images/presentation";
import { Avatar } from "./ui";

type AuthorizedActor = Extract<ActorSnapshot, { status: "authorized" }>;

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
      key={`${actor.demoRun.slug}:${actor.profile.slug}:${actor.coachAccessStatus}:${pathname}`}
      actor={actor}
      pathname={pathname}
    />
  );
}

function AccountDisclosure({
  actor,
  pathname,
}: {
  actor: AuthorizedActor;
  pathname: string;
}) {
  const profile = actor.profile;
  const view = useWorkspaceView(actor, pathname);
  const profileHref = workspaceProfileHref(actor, view);
  const trainingsHref = workspaceHref(view);
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
          href={profileHref}
          className="account-menu-link"
          aria-current={pathname === profileHref ? "page" : undefined}
          onClick={choose}
        >
          <UserRound size={18} aria-hidden="true" />
          <span>Profile</span>
        </Link>
        <Link
          href={trainingsHref}
          className="account-menu-link"
          aria-current={
            pathname === trainingsHref ||
            pathname.startsWith(`${trainingsHref}/`)
              ? "page"
              : undefined
          }
          onClick={choose}
        >
          <CalendarCheck2 size={18} aria-hidden="true" />
          <span>Trainings</span>
        </Link>
        <Link
          href="/account"
          className="account-menu-link"
          aria-current={pathname === "/account" ? "page" : undefined}
          onClick={choose}
        >
          <Settings2 size={18} aria-hidden="true" />
          <span>Account settings</span>
        </Link>
        {hasCoachWorkspace(actor) && (
          <div className="account-menu-view">
            <span className="account-menu-view-label">
              {view === "coach" ? "Coach view" : "Athlete view"}
            </span>
            <Link
              href={workspaceSwitchHref(
                actor,
                pathname,
                view === "coach" ? "athlete" : "coach",
              )}
              className="account-menu-link"
              onClick={choose}
            >
              <ArrowLeftRight size={18} aria-hidden="true" />
              <span>
                Switch to {view === "coach" ? "athlete" : "coach"} view
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
