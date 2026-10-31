const hosted = new Set([
  "https://admin.movx.club",
  "https://admin-uat.movx.club",
]);
function adminOrigin(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? "");
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return hosted.has(url.origin) ||
      (url.protocol === "http:" && url.hostname === "localhost")
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
// An optional staff-email link must point to the matching environment, never
// silently manufacture a domain that has not been configured by its operator.
export function coachReviewLink(
  origin: string | undefined,
  publicSite: string,
  profile: string,
): string | null {
  const review = adminOrigin(origin);
  if (
    !review ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      profile,
    )
  )
    return null;
  if (
    publicSite === "https://movx.club"
      ? review !== "https://admin.movx.club"
      : publicSite === "https://uat.movx.club"
        ? review !== "https://admin-uat.movx.club"
        : !publicSite.startsWith("http://localhost:")
  )
    return null;
  if (
    publicSite.startsWith("http://localhost:") &&
    !review.startsWith("http://localhost:")
  )
    return null;
  return new URL(`/admin/coaches/${profile}`, review).href;
}
