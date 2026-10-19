import {
  COACH_BANNER_VARIANTS,
  isWebsiteRevision,
  type CoachBannerImage,
  type CoachWebsiteFailure,
} from "./coach-website";

export const EVENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isEventId = (value: unknown): value is string =>
  typeof value === "string" && EVENT_ID_PATTERN.test(value);
export type EventBanner = Readonly<{
  schemaVersion: 1;
  eventId: string;
  revision: number;
  editable: boolean;
  banner: Readonly<Record<"card" | "hero", CoachBannerImage>> | null;
}>;
export type EventBannerResult =
  | Readonly<{
      status: "ready" | "saved";
      eventBanner: EventBanner;
      cleanupPending?: boolean;
    }>
  | CoachWebsiteFailure;
export type EventCardPresentation = Readonly<{
  coachHref: string;
  portraitUrl: string | null;
  eventBanner: CoachBannerImage | null;
  coachBanner: CoachBannerImage | null;
}>;
export function eventBannerUrl(
  id: string,
  variant: "card" | "hero",
  revision: number,
  publicRead = false,
) {
  if (!isEventId(id) || !isWebsiteRevision(revision))
    throw new Error("Invalid event banner reference.");
  return publicRead
    ? `/api/events/group-${id.replaceAll("-", "")}/banner/${variant}?v=${revision}`
    : `/api/coach/events/${id}/banner/${variant}?v=${revision}`;
}
export function eventBannerSnapshot(
  id: string,
  revision: number,
  editable: boolean,
  hasBanner: boolean,
): EventBanner {
  if (!isEventId(id) || !isWebsiteRevision(revision))
    throw new Error("Invalid event banner snapshot.");
  const image = (variant: "card" | "hero"): CoachBannerImage => ({
    url: eventBannerUrl(id, variant, revision),
    width: COACH_BANNER_VARIANTS[variant].width,
    height: COACH_BANNER_VARIANTS[variant].height,
  });
  return {
    schemaVersion: 1,
    eventId: id,
    revision,
    editable,
    banner: hasBanner ? { card: image("card"), hero: image("hero") } : null,
  };
}
export function isEventBannerResult(
  value: unknown,
): value is EventBannerResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (r.status !== "ready" && r.status !== "saved")
    return (
      Object.keys(r).join() === "status" &&
      [
        "invalid",
        "conflict",
        "signed-out",
        "forbidden",
        "not-found",
        "unavailable",
      ].includes(String(r.status))
    );
  if (
    Object.keys(r).some(
      (key) => !["status", "eventBanner", "cleanupPending"].includes(key),
    ) ||
    (r.cleanupPending !== undefined && typeof r.cleanupPending !== "boolean")
  )
    return false;
  if (
    !r.eventBanner ||
    typeof r.eventBanner !== "object" ||
    Array.isArray(r.eventBanner)
  )
    return false;
  const b = r.eventBanner as Record<string, unknown>;
  if (
    Object.keys(b).sort().join() !==
      "banner,editable,eventId,revision,schemaVersion" ||
    b.schemaVersion !== 1 ||
    !isEventId(b.eventId) ||
    !isWebsiteRevision(b.revision) ||
    typeof b.editable !== "boolean"
  )
    return false;
  if (b.banner === null) return true;
  if (
    !b.banner ||
    typeof b.banner !== "object" ||
    Array.isArray(b.banner) ||
    Object.keys(b.banner).sort().join() !== "card,hero"
  )
    return false;
  return (["card", "hero"] as const).every((variant) => {
    const image = (b.banner as Record<string, unknown>)[variant];
    if (!image || typeof image !== "object" || Array.isArray(image))
      return false;
    const i = image as Record<string, unknown>;
    return (
      Object.keys(i).sort().join() === "height,url,width" &&
      i.url ===
        eventBannerUrl(b.eventId as string, variant, b.revision as number) &&
      i.width === COACH_BANNER_VARIANTS[variant].width &&
      i.height === COACH_BANNER_VARIANTS[variant].height
    );
  });
}
