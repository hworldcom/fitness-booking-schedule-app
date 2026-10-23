import { coachProfileHref } from "@/domain/coach-public-url";
import type { CoachProjection } from "@/domain/coaches";
import type { CoachWebsite } from "@/domain/coach-website";
import type { GroupSession } from "@/domain/group-sessions";

/** The origin must come from the existing validated site configuration, never a request Host. */
export function publicWebsiteIdentity(
  coach: CoachProjection,
  website: CoachWebsite | undefined,
  origin: string | null,
) {
  const path = coachProfileHref(coach);
  const title = website?.content.brandLabel
    ? `${coach.displayName} · ${website.content.brandLabel}`
    : `${coach.displayName} · Coach`;
  const description = (website?.content.introduction || coach.bio).slice(
    0,
    220,
  );
  const url = origin ? new URL(path, origin).href : null;
  const image = website?.banner?.hero.url || coach.portraitUrl;
  return {
    path,
    title,
    description,
    url,
    image: origin && image ? new URL(image, origin).href : null,
  };
}

export type CoachPublicGroups =
  | { status: "ready"; sessions: readonly GroupSession[] }
  | { status: "unavailable" };
