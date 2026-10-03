import Link from "next/link";

export function ProtectedAccessUnavailable() {
  return (
    <section className="protected-access-state" role="alert">
      <span className="eyebrow">Private area unavailable</span>
      <h1>We couldn’t verify access right now.</h1>
      <p>
        Your session or the local database may be unavailable. No private data
        was shown and no action was performed.
      </p>
      <div className="protected-access-actions">
        <Link href="/sign-in" className="button dark">
          Check sign-in
        </Link>
        <Link href="/" className="button secondary">
          Continue public browsing
        </Link>
      </div>
    </section>
  );
}
