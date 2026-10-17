export const ACCOUNT_SECTIONS = [
  "personal-details",
  "login-security",
  "language",
] as const;
export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];
export function accountSection(value: unknown): AccountSection {
  return typeof value === "string" &&
    ACCOUNT_SECTIONS.some((section) => section === value)
    ? (value as AccountSection)
    : "personal-details";
}
export function accountSectionHref(section: AccountSection) {
  return `/account?section=${section}`;
}
