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

export type CoachWebsiteContentIssue = Readonly<{
  field: string;
  message: string;
}>;

/** One validation pass supplies both authoritative parsing and owner feedback. */
export function validateCoachWebsiteContent(value: unknown): {
  content: CoachWebsiteContent | null;
  issues: readonly CoachWebsiteContentIssue[];
} {
  const issues: CoachWebsiteContentIssue[] = [];
  const issue = (field: string, message: string) =>
    issues.push({ field, message });
  if (!isWebsiteRecord(value))
    return {
      content: null,
      issues: [
        {
          field: "content",
          message:
            "Website content could not be read. Reload the saved version before editing.",
        },
      ],
    };
  const record = value;
  if (
    Object.keys(value).some(
      (key) => !Object.hasOwn(EMPTY_COACH_WEBSITE_CONTENT, key),
    )
  )
    issue(
      "content",
      "Website content contains an unrecognized field. Reload the saved version before editing.",
    );
  function text(
    raw: unknown,
    field: string,
    label: string,
    max: number,
    multiline = false,
    emptyMessage?: string,
  ) {
    if (typeof raw !== "string") {
      issue(field, `${label} must be text.`);
      return "";
    }
    const result = raw.replace(/\r\n/g, "\n").trim();
    if ([...result].length > max)
      issue(
        field,
        `${label} must be ${max.toLocaleString("en-US")} characters or fewer (currently ${[...result].length.toLocaleString("en-US")}).`,
      );
    if (
      /[<>\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/u.test(
        result,
      )
    )
      issue(
        field,
        `${label} contains unsupported characters. Remove angle brackets and hidden control characters.`,
      );
    if (!multiline && /[\n\t]/.test(result))
      issue(field, `${label} must be on one line, without tabs.`);
    if (!result && emptyMessage) issue(field, emptyMessage);
    return result;
  }
  const optional = (key: string) =>
    record[key] === undefined ? "" : record[key];
  const brandLabel = text(
    optional("brandLabel"),
    "brandLabel",
    "Brand label",
    80,
  );
  const introduction = text(
    optional("introduction"),
    "introduction",
    "Short introduction",
    220,
  );
  const approach = text(
    optional("approach"),
    "approach",
    "Your approach",
    2000,
    true,
  );
  const experience = text(
    optional("experience"),
    "experience",
    "Experience & qualifications",
    2000,
    true,
  );
  function rows(key: string, max: number, label: string): unknown[] {
    const raw = record[key] === undefined ? [] : record[key];
    if (!Array.isArray(raw)) {
      issue(
        key,
        `${label} could not be read. Reload the saved version before editing.`,
      );
      return [];
    }
    if (raw.length > max)
      issue(
        key,
        `${label} allows up to ${max} entries. Remove the extra entries.`,
      );
    return raw;
  }
  const labels = rows("focusLabels", 8, "Focus & levels");
  const seen = new Map<string, number>();
  const focusLabels = labels.map((raw, i) => {
    const label = text(
      raw,
      "focusLabels",
      `Focus & levels line ${i + 1}`,
      60,
      false,
      `Focus & levels line ${i + 1} is empty. Add a label or remove this line.`,
    );
    if (label && seen.has(label))
      issue(
        "focusLabels",
        `Focus & levels line ${i + 1} duplicates line ${seen.get(label)! + 1}. Change or remove the duplicate label.`,
      );
    else if (label) seen.set(label, i);
    return label;
  });
  const faqs = rows("faqs", 6, "Frequently asked questions").map((raw, i) => {
    const field = `faqs.${i}`;
    if (
      !isWebsiteRecord(raw) ||
      Object.keys(raw).some((key) => !["question", "answer"].includes(key))
    ) {
      issue(
        "faqs",
        `FAQ ${i + 1} could not be read. Remove it and add the question again.`,
      );
      return { question: "", answer: "" };
    }
    return Object.freeze({
      question: text(
        raw.question,
        `${field}.question`,
        `FAQ ${i + 1} question`,
        160,
        false,
        `FAQ ${i + 1} question is empty. Add a question or remove FAQ ${i + 1}.`,
      ),
      answer: text(
        raw.answer,
        `${field}.answer`,
        `FAQ ${i + 1} answer`,
        1000,
        true,
        `FAQ ${i + 1} answer is empty. Add an answer or remove FAQ ${i + 1}.`,
      ),
    });
  });
  const links = rows("links", 4, "External links").map((raw, i) => {
    const field = `links.${i}`;
    if (
      !isWebsiteRecord(raw) ||
      Object.keys(raw).some((key) => !["label", "url"].includes(key))
    ) {
      issue(
        "links",
        `Link ${i + 1} could not be read. Remove it and add the link again.`,
      );
      return { label: "", url: "" };
    }
    const label = text(
      raw.label,
      `${field}.label`,
      `Link ${i + 1} label`,
      60,
      false,
      `Link ${i + 1} label is empty. Add a label or remove link ${i + 1}.`,
    );
    const url = externalUrl(raw.url);
    if (!url)
      issue(
        `${field}.url`,
        typeof raw.url === "string" && !raw.url.trim()
          ? `Link ${i + 1} address is empty. Add a full HTTPS address or remove link ${i + 1}.`
          : `Link ${i + 1} address must be a valid HTTPS URL with a public domain, no login details, spaces or backslashes, and at most 2,048 characters (for example https://example.com).`,
      );
    return Object.freeze({ label, url: url ?? "" });
  });
  return {
    content: issues.length
      ? null
      : Object.freeze({
          brandLabel,
          introduction,
          approach,
          experience,
          focusLabels: Object.freeze(focusLabels),
          faqs: Object.freeze(faqs),
          links: Object.freeze(links),
        }),
    issues: Object.freeze(issues),
  };
}

// Rebuild the DTO rather than forwarding arbitrary object fields to SQL/browser props.
export function parseCoachWebsiteContent(
  value: unknown,
): CoachWebsiteContent | null {
  return validateCoachWebsiteContent(value).content;
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
