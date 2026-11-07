/** Athlete planning and bookings share /sessions but have separate navigation. */
export function isNavigationHrefActive(path: string, href: string) {
  const training = ["/sessions/calendar", "/sessions/routine"].some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
  if (href === "/sessions/calendar") return training;
  if (href === "/sessions")
    return !training && (path === href || path.startsWith(`${href}/`));
  return href === "/"
    ? path === href
    : path === href || path.startsWith(`${href}/`);
}
