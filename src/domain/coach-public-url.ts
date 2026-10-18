/** Public routing never accepts an email, private name, or arbitrary return URL. */
export function publicCoachHandle(segment: string): string | null {
  // Next.js 16 supplies the leading at-sign as %40 in this dynamic param.
  // Decode that marker only; encoded separators and repeated encoding stay invalid.
  const value = segment.replace(/^%40/i, "@");
  return /^@[a-z][a-z0-9_]{2,29}$/i.test(value)
    ? value.slice(1).toLowerCase()
    : null;
}
export function coachProfileHref(coach: { slug: string; publicPath?: string }) {
  return coach.publicPath && /^\/@[a-z][a-z0-9_]{2,29}$/.test(coach.publicPath)
    ? coach.publicPath
    : `/coaches/${encodeURIComponent(coach.slug)}`;
}
export type PublicCoachQuery = Record<string, string | string[] | undefined>;
export function coachRedirectHref(path: string, query: PublicCoachQuery) {
  const date = query.date;
  const validDate =
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  return `${path}${validDate ? `?date=${date}` : ""}${validDate || query.section === "private-schedule" ? "#private-schedule" : ""}`;
}
export type OwnedCoachPublicHandle = Readonly<{
  status: "ready";
  schemaVersion: 1;
  username: string | null;
  revision: number;
  confirmed: boolean;
}>;
export type CoachPublicHandleResult =
  | OwnedCoachPublicHandle
  | Readonly<{
      status:
        "invalid" | "conflict" | "forbidden" | "signed-out" | "unavailable";
    }>;
export function parseCoachHandleConfirmation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return Object.keys(v).sort().join(",") ===
    "consent,expectedRevision,username" &&
    v.consent === true &&
    typeof v.username === "string" &&
    /^[a-z][a-z0-9_]{2,29}$/.test(v.username) &&
    Number.isSafeInteger(v.expectedRevision) &&
    Number(v.expectedRevision) >= 0 &&
    Number(v.expectedRevision) < 2147483647
    ? { username: v.username, expectedRevision: Number(v.expectedRevision) }
    : null;
}
export function isCoachPublicHandleResult(
  value: unknown,
): value is CoachPublicHandleResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.status !== "ready")
    return (
      Object.keys(v).join() === "status" &&
      [
        "invalid",
        "conflict",
        "forbidden",
        "signed-out",
        "unavailable",
      ].includes(String(v.status))
    );
  return (
    Object.keys(v).sort().join(",") ===
      "confirmed,revision,schemaVersion,status,username" &&
    v.schemaVersion === 1 &&
    typeof v.confirmed === "boolean" &&
    (v.username === null ||
      (typeof v.username === "string" &&
        /^[a-z][a-z0-9_]{2,29}$/.test(v.username))) &&
    !(v.confirmed && v.username === null) &&
    Number.isSafeInteger(v.revision) &&
    Number(v.revision) >= 0 &&
    Number(v.revision) < 2147483647
  );
}
