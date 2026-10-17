const MAXIMUM_RETURN_TO_LENGTH = 2_048;

export function safeReturnTo(
  value: string | string[] | null | undefined,
  siteOrigin: string,
) {
  if (typeof value !== "string" || value.length > MAXIMUM_RETURN_TO_LENGTH) {
    return "/";
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return "/";
  }

  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return "/";
    }
    const site = new URL(siteOrigin);
    const target = new URL(value, `${site.origin}/`);
    if (
      target.origin !== site.origin ||
      target.username ||
      target.password ||
      unsafeReturnPath(target.pathname) ||
      target.pathname === "/api" ||
      target.pathname.startsWith("/api/") ||
      target.pathname === "/_next" ||
      target.pathname.startsWith("/_next/")
    ) {
      return "/";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

function unsafeReturnPath(path: string) {
  let decoded = path;
  for (let i = 0; i < 6; i++) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) break;
    decoded = next;
    if (i === 5) return true;
  }
  if (
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(decoded)
  )
    return true;
  const normalized = new URL(
    decoded,
    "https://return.invalid",
  ).pathname.toLowerCase();
  return [
    "/sign-in",
    "/register",
    "/check-email",
    "/forgot-password",
    "/reset-password",
    "/complete-profile",
    "/auth",
    "/api",
    "/_next",
  ].some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix + "/"),
  );
}

export function signInHref(returnTo: string) {
  return `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
}
