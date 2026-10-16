"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ConnectionAvatar } from "@/features/connections/connection-avatar";

export function AthleteIdentity({
  name,
  imageUrl,
  href,
  heading: Heading = "h3",
  children,
}: {
  name: string;
  imageUrl: string | null;
  href: string | null;
  heading?: "h3" | "h4";
  children?: ReactNode;
}) {
  const content = (
    <>
      <ConnectionAvatar name={name} imageUrl={imageUrl} />
      <div>
        <Heading>{name}</Heading>
        {children}
      </div>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="coach-athlete-identity"
      aria-label={`View ${name}’s athlete details`}
    >
      {content}
    </Link>
  ) : (
    <div className="coach-athlete-identity">{content}</div>
  );
}
