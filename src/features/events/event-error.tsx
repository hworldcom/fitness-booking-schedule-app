"use client";
import { usePathname } from "next/navigation";
import "./events.css";

export function EventError({ retry }: { retry: () => void }) {
  const path = usePathname();
  return (
    <div className="events-page">
      <section className="events-state" role="alert">
        <h1>The latest session status could not be verified</h1>
        <p>
          A submitted registration action may have succeeded. Reload the current
          status before assuming a seat is reserved or released.
        </p>
        <div className="events-state-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => retry()}
          >
            Retry loading status
          </button>
          <a href={path}>Reload this page</a>
          <a href="/sessions/groups">Review my group registrations</a>
        </div>
      </section>
    </div>
  );
}
