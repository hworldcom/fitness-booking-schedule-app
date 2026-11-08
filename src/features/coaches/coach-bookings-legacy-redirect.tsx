"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keep old request-queue hash links while the default Bookings view is sessions. */
export function CoachBookingsLegacyRedirect({
  active,
}: {
  active: "sessions" | "requests";
}) {
  const router = useRouter();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (
      active !== "sessions" ||
      url.searchParams.has("section") ||
      url.hash !== "#booking-requests"
    )
      return;
    url.searchParams.set("section", "requests");
    router.replace(url.pathname + url.search + url.hash);
  }, [active, router]);
  return null;
}
