import { isCanonicalUuid } from "./coach-bookings";

export type MemberProfile = Readonly<{
  id: string;
  displayName: string;
  imageUrl: string | null;
}>;

export function memberProfileHref(id: string) {
  if (!isCanonicalUuid(id)) throw Error("Invalid member profile.");
  return `/members/${id}`;
}

export function memberAvatarUrl(id: string, updatedAt: string | null) {
  if (!updatedAt) return null;
  if (!isCanonicalUuid(id) || !Number.isFinite(Date.parse(updatedAt)))
    throw Error("Invalid member photo.");
  return `/api/members/${id}/avatar?v=${encodeURIComponent(new Date(updatedAt).toISOString())}`;
}

export function isMemberAvatarUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^\/api\/members\/([^/]+)\/avatar\?v=([^&]+)$/.exec(value);
  if (!match || !isCanonicalUuid(match[1])) return false;
  try {
    return Number.isFinite(Date.parse(decodeURIComponent(match[2])));
  } catch {
    return false;
  }
}
