import Link from "next/link";
import { MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/ui";

export function AccountShell({
  actor,
  children,
  messageBadge,
  authControl,
  pathname = "/account",
}: {
  actor: ActorSnapshot;
  children?: ReactNode;
  messageBadge?: ReactNode;
  authControl?: ReactNode;
  pathname?: string;
}) {
  const profilePage =
    pathname === "/profile" || pathname.startsWith("/profile/");
  return (
    <div className={`account-shell${profilePage ? " profile-shell" : ""}`}>
      <a className="skip-link" href="#main-content">
        {profilePage ? "Skip to profile" : "Skip to account settings"}
      </a>
      <header className="account-shell-header">
        <Link href="/" className="brand-home" aria-label="MovX Club home">
          <Brand />
        </Link>
        <div className="account-shell-actions">
          {actor.status === "authorized" ? (
            <>
              <Link
                href="/messages"
                className="account-messages-link"
                aria-label="Messages"
              >
                <MessageSquare size={21} aria-hidden="true" />
                <span>Messages</span>
                {messageBadge}
              </Link>
              <AccountMenu actor={actor} pathname={pathname} />
            </>
          ) : (
            authControl
          )}
        </div>
      </header>
      <main
        id="main-content"
        className={profilePage ? "profile-page-content" : undefined}
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
