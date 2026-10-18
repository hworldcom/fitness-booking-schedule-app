"use client";
/* eslint-disable @next/next/no-img-element -- use the normalized public card variant directly; no hero or optimizer request */
import { useState } from "react";
import { Avatar } from "@/components/ui";
import type { CoachWebsiteCard } from "@/domain/coach-website";

export function CoachCardMedia({
  banner,
  portraitUrl,
  initials,
}: {
  banner: CoachWebsiteCard["banner"];
  portraitUrl: string | null;
  initials: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const visibleBanner = banner && banner.url !== failedUrl ? banner : null;
  return (
    <span
      className={`coach-card-media${visibleBanner ? " has-banner" : ""}`}
      aria-hidden="true"
    >
      <span className="coach-card-cover">
        {visibleBanner && (
          <img
            className="coach-card-banner"
            src={visibleBanner.url}
            width={visibleBanner.width}
            height={visibleBanner.height}
            alt=""
            loading="lazy"
            ref={(image) => {
              if (image?.complete && image.naturalWidth === 0)
                setFailedUrl(visibleBanner.url);
            }}
            onError={() => setFailedUrl(visibleBanner.url)}
          />
        )}
      </span>
      <Avatar initials={initials} imageUrl={portraitUrl} alt="" />
    </span>
  );
}
