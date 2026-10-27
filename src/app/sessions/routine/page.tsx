import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { trainingCommand } from "@/server/training/service";
import {
  calendarPeriod,
  localDate,
  validDate,
  validTimezone,
} from "@/training/contracts";
import { PlanRoutine } from "@/features/training/plan-routine";
import { MySessionsHeading } from "@/features/profile/my-sessions-navigation";
import { signInHref } from "@/auth/return-to";
import { routineHref } from "@/features/training/routine-model";
import "@/features/training/training.css";

export const metadata: Metadata = {
  title: "Plan routine",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const timezone = validTimezone(search.timezone)
    ? search.timezone
    : "Europe/Berlin";
  const date = validDate(search.date)
    ? search.date
    : localDate(new Date(), timezone);
  const period = calendarPeriod(date, "week");
  const result = await trainingCommand({
    action: "list",
    args: { from: period.from, through: period.through, timezone },
  });
  if (
    result.status === "signed-out" ||
    result.status === "preview" ||
    result.status === "forbidden"
  )
    redirect(signInHref("/sessions/routine"));
  return (
    <div className="training-page">
      <MySessionsHeading active="routine" />
      {result.status === "ready" && "items" in result.value ? (
        <PlanRoutine
          key={`${result.scope}:${date}:${timezone}`}
          initial={result.value}
          scope={result.scope}
          date={date}
          timezone={timezone}
        />
      ) : (
        <section role="alert">
          <h2>Routine planner unavailable</h2>
          <p>Your training could not be loaded. Please try again.</p>
          <Link className="button secondary" href={routineHref(date, timezone)}>
            Try again
          </Link>
        </section>
      )}
    </div>
  );
}
