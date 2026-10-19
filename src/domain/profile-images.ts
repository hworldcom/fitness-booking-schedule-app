// Shared presentation validation belongs to the domain, not an image transport.
const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const COACH_PORTRAIT_BUCKET = "coach-portraits";

export function isPublicCoachPortraitUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 1024) {
    return false;
  }
  if (/^\/images\/coaches\/[a-z0-9]+(?:-[a-z0-9]+)*[.]webp$/.test(value)) {
    return true;
  }
  if (value.startsWith("/api/coaches/portraits/")) {
    const url = new URL(value, "https://movx.invalid");
    return (
      new RegExp(`^/api/coaches/portraits/${UUID_PATTERN}$`, "i").test(
        url.pathname,
      ) &&
      !url.hash &&
      url.searchParams.size === 1 &&
      Number.isFinite(Date.parse(url.searchParams.get("v") ?? ""))
    );
  }
  try {
    const url = new URL(value);
    const pathPattern = new RegExp(
      `^/storage/v1/object/public/${COACH_PORTRAIT_BUCKET}/${UUID_PATTERN}/${UUID_PATTERN}[.]webp$`,
      "i",
    );
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      !url.hash &&
      pathPattern.test(url.pathname) &&
      url.searchParams.size === 1 &&
      Boolean(url.searchParams.get("v"))
    );
  } catch {
    return false;
  }
}
