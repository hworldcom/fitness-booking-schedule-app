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
}: {
  actor: ActorSnapshot;
  children?: ReactNode;
  messageBadge?: ReactNode;
  authControl?: ReactNode;
}) {
  return (
    <div className="account-shell">
      <a className="skip-link" href="#main-content">
        Skip to account settings
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
              <AccountMenu actor={actor} pathname="/account" />
            </>
          ) : (
            authControl
          )}
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
