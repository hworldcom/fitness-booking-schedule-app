import { notFound } from "next/navigation";
import { sessionUuid } from "@/domain/session-types";
import { BookingEditor } from "@/features/session-types/booking-editor";
import {
  historyPreviewHref,
  historyPreviewView,
} from "@/features/profile/session-history-preview-model";

export const metadata = { title: "Session & notes | My training preview" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { bookingId } = await params;
  if (!sessionUuid(bookingId)) notFound();
  return (
    <BookingEditor
      bookingId={bookingId}
      returnHref={historyPreviewHref(
        historyPreviewView((await searchParams).view),
      )}
    />
  );
}
