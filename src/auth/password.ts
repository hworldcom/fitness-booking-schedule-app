export const MINIMUM_PASSWORD_CHARACTERS = 8;
export const MAXIMUM_PASSWORD_BYTES = 72;

export type PasswordValidation =
  | Readonly<{ valid: true; password: string }>
  | Readonly<{
      valid: false;
      message: "password-too-short" | "password-too-long" | "password-invalid";
    }>;

// Count Unicode code points, not UTF-16 code units. Never normalize the secret.
export function validateNewPassword(value: unknown): PasswordValidation {
  if (typeof value !== "string" || !value.isWellFormed()) {
    return { valid: false, message: "password-invalid" };
  }
  if ([...value].length < MINIMUM_PASSWORD_CHARACTERS) {
    return { valid: false, message: "password-too-short" };
  }
  if (new TextEncoder().encode(value).byteLength > MAXIMUM_PASSWORD_BYTES) {
    return { valid: false, message: "password-too-long" };
  }
  return { valid: true, password: value };
}

export function isSignInPassword(value: unknown): value is string {
  // Existing credentials may predate the new-password minimum.
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.isWellFormed() &&
    new TextEncoder().encode(value).byteLength <= MAXIMUM_PASSWORD_BYTES
  );
}
