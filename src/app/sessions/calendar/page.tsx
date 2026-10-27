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
import { TrainingCalendar } from "@/features/training/training-calendar";
import { MySessionsHeading } from "@/features/profile/my-sessions-navigation";
import { signInHref } from "@/auth/return-to";
import "@/features/training/training.css";
export const metadata: Metadata = {
  title: "My training",
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
  const view = search.view === "month" ? "month" : "week";
  const period = calendarPeriod(date, view);
  const result = await trainingCommand({
    action: "list",
    args: { from: period.from, through: period.through, timezone },
  });
  if (
    result.status === "signed-out" ||
    result.status === "preview" ||
    result.status === "forbidden"
  )
    redirect(signInHref("/sessions/calendar"));
  return (
    <div className="training-page">
      <MySessionsHeading active="calendar" />
      {result.status === "ready" && "items" in result.value ? (
        <TrainingCalendar
          key={`${result.scope}:${date}:${view}:${timezone}`}
          initial={result.value}
          scope={result.scope}
          date={date}
          view={view}
          timezone={timezone}
          selected={
            typeof search.selected === "string" ? search.selected : undefined
          }
        />
      ) : (
        <section role="alert">
          <h2>Training calendar unavailable</h2>
          <p>Your training could not be loaded. Please try again.</p>
          <Link
            href={`/sessions/calendar?date=${date}&view=${view}&timezone=${encodeURIComponent(timezone)}`}
            className="button secondary"
          >
            Try again
          </Link>
        </section>
      )}
    </div>
  );
}
