"use client";

import { BookingEditor } from "@/features/session-types/booking-editor";

export default function ManualClientBookingFixture() {
  return (
    <>
      <p>
        Explicit manual booking fixture: no real account, database or booking.
      </p>
      <BookingEditor />
    </>
  );
}
