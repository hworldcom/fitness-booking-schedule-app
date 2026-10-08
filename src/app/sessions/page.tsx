import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { ClientSessions } from "@/features/profile/client-sessions";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { currentPrivateBookingWorkspace } from "@/server/coaches/booking-service";

export const metadata: Metadata = { title: "My sessions" };

export default async function Page() {
  const access = await protectedPageAccess("/sessions");
  if (access.status === "unavailable") {
    return <ProtectedAccessUnavailable />;
  }
  if (access.status === "preview") {
    return (
      <section className="protected-access-state">
        <span className="eyebrow">MY SESSIONS</span>
        <h1>Sign in to see your future sessions.</h1>
        <p>
          MovX shows only bookings owned by the verified account. Public coach
          discovery remains available without signing in.
        </p>
        <div className="protected-access-actions">
          <Link className="button dark" href={signInHref("/sessions")}>
            Go to sign-in
          </Link>
          <Link className="button secondary" href="/explore">
            Find a coach
          </Link>
        </div>
      </section>
    );
  }

  const bookingState = await currentPrivateBookingWorkspace();
  if (bookingState.status === "signed-out") {
    redirect(signInHref("/sessions"));
  }
  if (bookingState.status === "forbidden") {
    redirect(`${signInHref("/sessions")}&reason=forbidden`);
  }
  if (bookingState.status !== "authorized") {
    return <ProtectedAccessUnavailable />;
  }

  return (
    <ClientSessions
      bookings={bookingState.bookings}
      referenceTime={new Date().toISOString()}
    />
  );
}
