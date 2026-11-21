import Link from "next/link";

export function ProtectedAccessUnavailable({
  headingLevel = 1,
}: {
  headingLevel?: 1 | 2;
} = {}) {
  const Heading = headingLevel === 2 ? "h2" : "h1";
  return (
    <section className="protected-access-state" role="alert">
      <span className="eyebrow">Private area unavailable</span>
      <Heading
        className={headingLevel === 2 ? "protected-access-title" : undefined}
      >
        We couldn’t verify access right now.
      </Heading>
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
