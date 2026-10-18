"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import { COACH_WORKSPACE_DESTINATIONS } from "./coach-workspace-destinations";
import { selectedCoachWorkspaceDestination } from "@/domain/coach-workspace";

type Props = {
  navigation: readonly Readonly<{
    label: string;
    href: string;
    Icon: LucideIcon;
  }>[];
  pathname: string;
  mobile?: boolean;
};

export function WorkspaceNavigation({ navigation, pathname, mobile }: Props) {
  return (
    <Suspense
      fallback={
        <WorkspaceNavigationItems
          navigation={navigation}
          pathname={pathname}
          mobile={mobile}
          viewValues={null}
        />
      }
    >
      <QueryNavigation
        navigation={navigation}
        pathname={pathname}
        mobile={mobile}
      />
    </Suspense>
  );
}

function QueryNavigation(props: Props) {
  const params = useSearchParams();
  return (
    <WorkspaceNavigationItems
      {...props}
      viewValues={params?.getAll("view") ?? []}
    />
  );
}

export function WorkspaceNavigationItems({
  navigation,
  pathname,
  mobile = false,
  viewValues,
}: Props & { viewValues: readonly string[] | null }) {
  const selected =
    viewValues === null
      ? null
      : selectedCoachWorkspaceDestination(pathname, viewValues);
  return navigation.map(({ label, href, Icon }) => {
    const coachDestination = COACH_WORKSPACE_DESTINATIONS.find(
      (item) => item.href === href,
    );
    const active = coachDestination
      ? coachDestination.id === selected
      : href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        key={href}
        className={
          mobile
            ? active
              ? "active"
              : ""
            : `nav-item ${active ? "active" : ""}`
        }
        aria-current={active ? "page" : undefined}
        aria-label={mobile ? label : undefined}
      >
        <Icon
          size={mobile ? 21 : 22}
          strokeWidth={1.7}
          aria-hidden="true"
          fill={href === "/" && active ? "currentColor" : "none"}
        />
        <span>
          {mobile && label === "My sessions"
            ? "Sessions"
            : mobile && label === "My coaches"
              ? "Coaches"
              : label}
        </span>
      </Link>
    );
  });
}
