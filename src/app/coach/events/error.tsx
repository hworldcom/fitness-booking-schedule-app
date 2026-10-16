"use client";
import Link from "next/link";
export default function Error({ retry }: { retry: () => void }) {
  return (
    <section className="events-page" role="alert">
      <h1>Coach Events could not be verified</h1>
      <p>
        Your last action may have been saved. Reload the original session before
        assuming publication, confirmation or cancellation succeeded.
      </p>
      <button className="button secondary" onClick={() => retry()}>
        Retry loading
      </button>
      <Link href="/coach/events">Review saved events</Link>
    </section>
  );
}
