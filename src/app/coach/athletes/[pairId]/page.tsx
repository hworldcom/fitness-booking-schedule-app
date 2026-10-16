import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { currentConnectedAthleteDetail } from "@/server/coaches/athlete-detail-service";
import { AthleteDetail } from "@/features/coaches/athlete-detail";

export const metadata: Metadata = { title: "Athlete details" };
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ pairId: string }>;
}) {
  const { pairId } = await params;
  const destination = `/coach/athletes/${pairId}`;
  const result = await currentConnectedAthleteDetail(pairId);
  if (result.status === "signed-out" || result.status === "preview")
    redirect(signInHref(destination));
  if (
    result.status === "not-found" ||
    result.status === "forbidden" ||
    (result.status === "authorized" && result.value.bookings.length === 0)
  )
    notFound();
  if (result.status !== "authorized")
    return (
      <section className="protected-access-state" role="alert">
        <h1>Athlete details unavailable</h1>
        <p>We couldn’t verify your connection right now.</p>
        <Link href={destination} className="button secondary">
          Try again
        </Link>
      </section>
    );
  return (
    <AthleteDetail
      actorKey={result.value.actorKey}
      pairId={pairId}
      bookings={result.value.bookings}
      referenceTime={new Date().toISOString()}
    />
  );
}
