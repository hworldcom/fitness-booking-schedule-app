"use client";

import type { ReactNode } from "react";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { AccountMenu } from "./account-menu";

export function HeaderAccountControl({
  actor,
  pathname,
  authControl,
}: {
  actor: ActorSnapshot;
  pathname: string;
  authControl: ReactNode;
}) {
  return actor.status === "authorized" ? (
    <AccountMenu actor={actor} pathname={pathname} />
  ) : (
    authControl
  );
}
