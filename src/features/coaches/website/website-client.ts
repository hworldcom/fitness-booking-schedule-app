import {
  COACH_BANNER_VARIANTS,
  isWebsiteRecord,
  isWebsiteRevision,
  parseCoachWebsiteContent,
  coachBannerUrl,
  type CoachWebsite,
} from "@/domain/coach-website";
import {
  isStartingRateAmount,
  type OwnedCoachStartingRate,
} from "@/domain/coach-starting-rate";
import type { EditorReply } from "./revision-editor";

export function parseOwnedWebsite(value: unknown): CoachWebsite | null {
  if (
    !isWebsiteRecord(value) ||
    value.schemaVersion !== 1 ||
    !isWebsiteRevision(value.revision)
  )
    return null;
  const content = parseCoachWebsiteContent(value.content);
  if (!content) return null;
  if (value.banner === null)
    return {
      schemaVersion: 1,
      revision: value.revision,
      content,
      banner: null,
    };
  if (!isWebsiteRecord(value.banner)) return null;
  for (const variant of ["card", "hero"] as const) {
    const image = value.banner[variant];
    if (
      !isWebsiteRecord(image) ||
      image.url !== coachBannerUrl(null, value.revision, variant) ||
      image.width !== COACH_BANNER_VARIANTS[variant].width ||
      image.height !== COACH_BANNER_VARIANTS[variant].height
    )
      return null;
  }
  return {
    schemaVersion: 1,
    revision: value.revision,
    content,
    banner: {
      card: {
        ...COACH_BANNER_VARIANTS.card,
        url: coachBannerUrl(null, value.revision, "card"),
      },
      hero: {
        ...COACH_BANNER_VARIANTS.hero,
        url: coachBannerUrl(null, value.revision, "hero"),
      },
    },
  };
}
export function parseOwnedRate(value: unknown): OwnedCoachStartingRate | null {
  if (
    !isWebsiteRecord(value) ||
    value.schemaVersion !== 1 ||
    !isWebsiteRevision(value.revision) ||
    value.currency !== "EUR" ||
    value.context !== "private-session" ||
    typeof value.showPublicly !== "boolean" ||
    (value.amountCents !== null && !isStartingRateAmount(value.amountCents))
  )
    return null;
  return {
    schemaVersion: 1,
    revision: value.revision,
    amountCents: value.amountCents,
    currency: "EUR",
    context: "private-session",
    showPublicly: value.showPublicly,
  };
}

export async function editorRequest<T>(
  path: string,
  parse: (value: unknown) => T | null,
  field: "website" | "startingRate",
  init?: RequestInit,
): Promise<EditorReply<T>> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 401) return { status: "signed-out" };
  if (response.status === 403) return { status: "forbidden" };
  const result: unknown = await response.json();
  if (!isWebsiteRecord(result)) throw new Error("Invalid editor response");
  if (response.ok && (result.status === "ready" || result.status === "saved")) {
    const value = parse(result[field]);
    if (value)
      return {
        status: result.status,
        value,
        cleanupPending: result.cleanupPending === true,
      };
  }
  const statuses = {
    invalid: 400,
    conflict: 409,
    unavailable: 503,
    "not-found": 404,
  };
  for (const [status, code] of Object.entries(statuses))
    if (result.status === status && response.status === code)
      return {
        status: status as "invalid" | "conflict" | "unavailable" | "not-found",
      };
  throw new Error("Invalid editor response");
}
export type RateDraft = { amount: string; showPublicly: boolean };
export function rateDraft(value: OwnedCoachStartingRate): RateDraft {
  return {
    amount:
      value.amountCents === null
        ? ""
        : `${Math.floor(value.amountCents / 100)}.${String(value.amountCents % 100).padStart(2, "0")}`,
    showPublicly: value.showPublicly,
  };
}
