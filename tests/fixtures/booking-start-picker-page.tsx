"use client";

// Copied only into the isolated mounted rehearsal's temporary app route.
import { useEffect } from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { BookingEditor } from "@/features/session-types/booking-editor";

export default function BookingPickerFixture() {
  const { refreshActor } = useActor();
  const { refreshSession } = useAuthSession();
  useEffect(() => {
    const refresh = () => void refreshActor();
    window.addEventListener("mov197-refresh", refresh);
    return () => window.removeEventListener("mov197-refresh", refresh);
  }, [refreshActor]);
  useEffect(() => {
    const refresh = () => void refreshSession();
    window.addEventListener("mov197-session", refresh);
    return () => window.removeEventListener("mov197-session", refresh);
  }, [refreshSession]);
  return (
    <>
      <p>Explicit picker fixture: no real account, database or booking.</p>
      <BookingEditor bookingId="19700000-0000-4000-8000-000000000001" />
    </>
  );
}
