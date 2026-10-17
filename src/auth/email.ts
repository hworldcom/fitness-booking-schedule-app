const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 &&
    !/[\u0000-\u001f\u007f]/.test(email) &&
    EMAIL_PATTERN.test(email)
    ? email
    : null;
}
