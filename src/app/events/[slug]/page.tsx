import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GroupEventDetail } from "@/features/group-events/group-event-detail";
import {
  currentGroupEventActorState,
  publicGroupEventDetail,
} from "@/server/group-events/service";

type PageProps = { params: Promise<{ slug: string }> };

async function requestTimestamp() {
  return Date.now();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const event = await publicGroupEventDetail(slug);
    return { title: event?.title ?? "Group event" };
  } catch {
    return { title: "Group event" };
  }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  let event;
  try {
    event = await publicGroupEventDetail(slug);
  } catch {
    return (
      <section className="group-events-empty" role="alert">
        <span className="eyebrow">EVENT UNAVAILABLE</span>
        <h1>We couldn’t verify this event right now.</h1>
        <p>No funding action was shown.</p>
        <Link className="button secondary" href={`/events/${slug}`}>
          Try again
        </Link>
      </section>
    );
  }
  if (!event) notFound();
  const [actor, now] = await Promise.all([
    currentGroupEventActorState(event.id),
    requestTimestamp(),
  ]);
  return <GroupEventDetail event={event} actor={actor} now={now} />;
}
