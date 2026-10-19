"use client";
/* eslint-disable @next/next/no-img-element -- normalized public card variants already have bounded dimensions */
import { useState } from "react";
import type { CoachBannerImage } from "@/domain/coach-website";

export function visibleEventCover(
  event: CoachBannerImage | null,
  coach: CoachBannerImage | null,
  failed: readonly string[],
) {
  return (
    [event, coach].find((image) => image && !failed.includes(image.url)) ?? null
  );
}
export function EventCardCover({
  event,
  coach,
}: {
  event: CoachBannerImage | null;
  coach: CoachBannerImage | null;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const image = visibleEventCover(event, coach, failed);
  const reject = () =>
    image &&
    setFailed((old) => (old.includes(image.url) ? old : [...old, image.url]));
  return (
    <span
      className={`event-card-cover${image ? " has-banner" : ""}`}
      aria-hidden="true"
    >
      {image && (
        <img
          src={image.url}
          width={image.width}
          height={image.height}
          loading="lazy"
          alt=""
          ref={(node) => {
            if (node?.complete && node.naturalWidth === 0) reject();
          }}
          onError={reject}
        />
      )}
    </span>
  );
}
