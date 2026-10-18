export type EnrolledApplicationIdentity = Readonly<{
  status: "enrolled";
  profile: Readonly<{
    id: string;
    slug: string;
    displayName: string;
  }>;
  demoRun: Readonly<{
    id: string;
    slug: string;
    name: string;
  }>;
  role: string;
}>;

export type ApplicationIdentitySnapshot =
  | EnrolledApplicationIdentity
  | Readonly<{
      status: "profile-required" | "signed-out" | "unavailable";
    }>;

export type ProfileCompletionResult =
  | ApplicationIdentitySnapshot
  | Readonly<{ status: "username-taken" | "invalid" }>;

export function isProfileCompletionResult(
  value: unknown,
): value is ProfileCompletionResult {
  return (
    isApplicationIdentitySnapshot(value) ||
    (isRecord(value) &&
      hasExactKeys(value, ["status"]) &&
      (value.status === "username-taken" || value.status === "invalid"))
  );
}

export const UNAVAILABLE_APPLICATION_IDENTITY: ApplicationIdentitySnapshot =
  Object.freeze({ status: "unavailable" });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function isBoundedText(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength
  );
}

export function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const displayName = value.trim().replace(/\s+/g, " ");
  if (
    displayName.length < 2 ||
    displayName.length > 80 ||
    /[\p{Cc}\p{Cf}]/u.test(displayName) ||
    !/[\p{L}\p{N}]/u.test(displayName)
  ) {
    return null;
  }
  return displayName;
}

export function isApplicationIdentitySnapshot(
  value: unknown,
): value is ApplicationIdentitySnapshot {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  if (
    value.status === "profile-required" ||
    value.status === "signed-out" ||
    value.status === "unavailable"
  ) {
    return hasExactKeys(value, ["status"]);
  }
  if (value.status !== "enrolled") return false;
  if (!hasExactKeys(value, ["status", "profile", "demoRun", "role"])) {
    return false;
  }

  const profile = value.profile;
  const demoRun = value.demoRun;
  return (
    isRecord(profile) &&
    hasExactKeys(profile, ["id", "slug", "displayName"]) &&
    isUuid(profile.id) &&
    isSlug(profile.slug) &&
    isBoundedText(profile.displayName, 120) &&
    isRecord(demoRun) &&
    hasExactKeys(demoRun, ["id", "slug", "name"]) &&
    isUuid(demoRun.id) &&
    isSlug(demoRun.slug) &&
    isBoundedText(demoRun.name, 120) &&
    isSlug(value.role)
  );
}
