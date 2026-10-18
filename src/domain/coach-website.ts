import type { PublicCoachStartingRate } from "./coach-starting-rate";

export const COACH_WEBSITE_SCHEMA_VERSION = 1;
export const COACH_BANNER_MAX_SOURCE_BYTES = 4 * 1024 * 1024;
export const COACH_BANNER_VARIANTS = {
  card: { width: 800, height: 300, maxBytes: 384 * 1024 },
  hero: { width: 1600, height: 600, maxBytes: 1024 * 1024 },
} as const;
export type CoachBannerVariant = keyof typeof COACH_BANNER_VARIANTS;
export type CoachWebsiteContent = Readonly<{
  brandLabel: string;
  introduction: string;
  approach: string;
  experience: string;
  focusLabels: readonly string[];
  faqs: readonly Readonly<{ question: string; answer: string }>[];
  links: readonly Readonly<{ label: string; url: string }>[];
}>;
export type CoachBannerImage = Readonly<{
  url: string;
  width: number;
  height: number;
}>;
export type CoachWebsite = Readonly<{
  schemaVersion: 1;
  revision: number;
  content: CoachWebsiteContent;
  banner: Readonly<Record<CoachBannerVariant, CoachBannerImage>> | null;
  startingRate?: PublicCoachStartingRate;
}>;
export type CoachWebsiteCard = Readonly<{
  schemaVersion: 1;
  revision: number;
  brandLabel: string;
  introduction: string;
  focusLabels: readonly string[];
  banner: CoachBannerImage | null;
  startingRate?: PublicCoachStartingRate;
}>;
export type CoachWebsiteFailure = Readonly<{
  status:
    | "invalid"
    | "conflict"
    | "signed-out"
    | "forbidden"
    | "unavailable"
    | "not-found";
}>;
export type CoachWebsiteResult =
  | Readonly<{
      status: "ready" | "saved";
      website: CoachWebsite;
      cleanupPending?: boolean;
    }>
  | CoachWebsiteFailure;

export const EMPTY_COACH_WEBSITE_CONTENT: CoachWebsiteContent = Object.freeze({
  brandLabel: "",
  introduction: "",
  approach: "",
  experience: "",
  focusLabels: Object.freeze([]),
  faqs: Object.freeze([]),
  links: Object.freeze([]),
});

export function isWebsiteRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isWebsiteRevision(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 0 &&
    Number(value) <= 2147483647
  );
}
function plain(value: unknown, max: number, multiline = false): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n/g, "\n").trim();
  if (
    [...text].length > max ||
    /[<>\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/u.test(
      text,
    ) ||
    (!multiline && /[\n\t]/.test(text))
  )
    return null;
  return text;
}
function externalUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\s\\]/u.test(value))
    return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      url.hostname.endsWith(".localhost")
    )
      return null;
    const normalized = url.toString();
    return normalized.length <= 2048 ? normalized : null;
  } catch {
    return null;
  }
}

// Rebuild the DTO rather than forwarding arbitrary object fields to SQL/browser props.
export function parseCoachWebsiteContent(
  value: unknown,
): CoachWebsiteContent | null {
  if (
    !isWebsiteRecord(value) ||
    Object.keys(value).some(
      (key) => !Object.hasOwn(EMPTY_COACH_WEBSITE_CONTENT, key),
    )
  )
    return null;
  const optional = (key: string) =>
    value[key] === undefined ? "" : value[key];
  const brandLabel = plain(optional("brandLabel"), 80);
  const introduction = plain(optional("introduction"), 220);
  const approach = plain(optional("approach"), 2000, true);
  const experience = plain(optional("experience"), 2000, true);
  if ([brandLabel, introduction, approach, experience].includes(null))
    return null;
  const labels = value.focusLabels === undefined ? [] : value.focusLabels;
  const faqs = value.faqs === undefined ? [] : value.faqs;
  const links = value.links === undefined ? [] : value.links;
  if (
    !Array.isArray(labels) ||
    labels.length > 8 ||
    !Array.isArray(faqs) ||
    faqs.length > 6 ||
    !Array.isArray(links) ||
    links.length > 4
  )
    return null;
  const focusLabels = labels.map((label) => plain(label, 60));
  if (
    focusLabels.some((label) => !label) ||
    new Set(focusLabels).size !== focusLabels.length
  )
    return null;
  const parsedFaqs: { question: string; answer: string }[] = [];
  for (const faq of faqs) {
    if (
      !isWebsiteRecord(faq) ||
      Object.keys(faq).some((key) => !["question", "answer"].includes(key))
    )
      return null;
    const question = plain(faq.question, 160),
      answer = plain(faq.answer, 1000, true);
    if (!question || !answer) return null;
    parsedFaqs.push(Object.freeze({ question, answer }));
  }
  const parsedLinks: { label: string; url: string }[] = [];
  for (const link of links) {
    if (
      !isWebsiteRecord(link) ||
      Object.keys(link).some((key) => !["label", "url"].includes(key))
    )
      return null;
    const label = plain(link.label, 60),
      url = externalUrl(link.url);
    if (!label || !url) return null;
    parsedLinks.push(Object.freeze({ label, url }));
  }
  return Object.freeze({
    brandLabel: brandLabel!,
    introduction: introduction!,
    approach: approach!,
    experience: experience!,
    focusLabels: Object.freeze(focusLabels as string[]),
    faqs: Object.freeze(parsedFaqs),
    links: Object.freeze(parsedLinks),
  });
}

export function coachBannerUrl(
  slug: string | null,
  revision: number,
  variant: CoachBannerVariant,
) {
  const base =
    slug === null
      ? "/api/coach/website/banner"
      : `/api/coaches/${encodeURIComponent(slug)}/website/banner`;
  return `${base}/${variant}?v=${revision}`;
}

export function projectCoachWebsite(
  content: CoachWebsiteContent,
  revision: number,
  hasBanner: boolean,
  slug: string | null,
  startingRate?: PublicCoachStartingRate,
): CoachWebsite {
  const image = (variant: CoachBannerVariant) =>
    Object.freeze({
      url: coachBannerUrl(slug, revision, variant),
      width: COACH_BANNER_VARIANTS[variant].width,
      height: COACH_BANNER_VARIANTS[variant].height,
    });
  return Object.freeze({
    schemaVersion: 1,
    revision,
    content,
    banner: hasBanner
      ? Object.freeze({ card: image("card"), hero: image("hero") })
      : null,
    ...(startingRate ? { startingRate } : {}),
  });
}
