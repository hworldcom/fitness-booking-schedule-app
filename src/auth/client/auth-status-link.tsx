"use client";

import Link from "next/link";
import { LogIn, UserCheck } from "lucide-react";
import { useAuthSession } from "./session-provider";

export function AuthStatusLink() {
  const { session } = useAuthSession();
  const signedIn = session.status === "signed-in";
  const label = signedIn
    ? "Account"
    : session.status === "unavailable"
      ? "Check sign-in"
      : "Sign in";
  const Icon = signedIn ? UserCheck : LogIn;

  return (
    <Link
      href={signedIn ? "/account" : "/sign-in"}
      className={`auth-status-link ${signedIn ? "signed-in" : ""}`}
      aria-label={signedIn ? `MovX Club signed in as ${session.email}` : label}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
