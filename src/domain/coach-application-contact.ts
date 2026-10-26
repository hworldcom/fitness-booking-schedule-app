export type CoachApplicationContactDetails = Readonly<{
  phoneNumber: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
}>;

export type CoachApplicationContact = CoachApplicationContactDetails &
  Readonly<{ revision: number }>;

const SOCIAL_HOSTS = {
  instagramUrl: "instagram.com",
  facebookUrl: "facebook.com",
  linkedinUrl: "linkedin.com",
} as const;

// Full HTTPS profile links only. These are stored as text, never fetched.
export function applicationSocialUrl(value: string, host: string) {
  if (value.length > 500 || /[\u0000-\u0020\u007f]/u.test(value)) return null;
  const escapedHost = host.replaceAll(".", "\\.");
  return new RegExp(
    `^https://(?:www\\.)?${escapedHost}/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@/%?-]*$`,
  ).test(value) && !/%(?:00|0a|0d)/i.test(value)
    ? value
    : null;
}

export function validateCoachApplicationContact(input: {
  phoneNumber: unknown;
  instagramUrl: unknown;
  facebookUrl: unknown;
  linkedinUrl: unknown;
}):
  | Readonly<{ valid: true; value: CoachApplicationContactDetails }>
  | Readonly<{ valid: false; errors: readonly string[] }> {
  const errors: string[] = [];
  const rawPhone =
    typeof input.phoneNumber === "string" ? input.phoneNumber.trim() : "";
  const phoneNumber = rawPhone.replace(/[ ().-]/g, "");
  if (
    rawPhone.length > 40 ||
    !/^[+0-9 ().-]+$/.test(rawPhone) ||
    !/^\+[1-9][0-9]{6,14}$/.test(phoneNumber)
  )
    errors.push(
      "Enter a phone number with its country code, for example +49 151 23456789.",
    );
  const socials: Record<string, string | null> = {};
  for (const [field, host] of Object.entries(SOCIAL_HOSTS)) {
    const raw = input[field as keyof typeof SOCIAL_HOSTS];
    const value =
      typeof raw === "string" ? raw.trim() : raw == null ? "" : null;
    socials[field] = value ? applicationSocialUrl(value, host) : null;
    if (value === null || (value && !socials[field]))
      errors.push(
        `Enter a full HTTPS ${host} profile link, or leave it empty.`,
      );
  }
  return errors.length
    ? { valid: false, errors: Object.freeze(errors) }
    : {
        valid: true,
        value: Object.freeze({
          phoneNumber,
          instagramUrl: socials.instagramUrl,
          facebookUrl: socials.facebookUrl,
          linkedinUrl: socials.linkedinUrl,
        }),
      };
}

export function parseCoachApplicationContact(
  value: unknown,
): CoachApplicationContact {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid application contact.");
  const v = value as CoachApplicationContact;
  const result = validateCoachApplicationContact(v);
  if (
    !result.valid ||
    !Number.isInteger(v.revision) ||
    v.revision < 1 ||
    v.revision > 1000000 ||
    Object.entries(result.value).some(
      ([key, val]) => v[key as keyof typeof v] !== val,
    )
  )
    throw Error("Invalid application contact.");
  return Object.freeze({ ...result.value, revision: v.revision });
}
