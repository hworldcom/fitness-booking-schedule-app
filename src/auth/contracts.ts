export type AuthSessionSnapshot =
  | Readonly<{ status: "disabled" }>
  | Readonly<{ status: "signed-out" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "recovery-required" }>
  | Readonly<{
      status: "signed-in";
      subject: string;
      email: string;
      expiresAt: number | null;
    }>;

export const DISABLED_AUTH_SESSION: AuthSessionSnapshot = Object.freeze({
  status: "disabled",
});

export const SIGNED_OUT_AUTH_SESSION: AuthSessionSnapshot = Object.freeze({
  status: "signed-out",
});

export const UNAVAILABLE_AUTH_SESSION: AuthSessionSnapshot = Object.freeze({
  status: "unavailable",
});

export function isAuthSessionSnapshot(
  value: unknown,
): value is AuthSessionSnapshot {
  if (!value || typeof value !== "object" || !("status" in value)) {
    return false;
  }

  const session = value as Record<string, unknown>;
  if (
    session.status === "disabled" ||
    session.status === "signed-out" ||
    session.status === "unavailable" ||
    session.status === "recovery-required"
  ) {
    return true;
  }

  return (
    session.status === "signed-in" &&
    typeof session.subject === "string" &&
    typeof session.email === "string" &&
    session.email.length > 3 &&
    session.email.length <= 254 &&
    session.email.includes("@") &&
    (typeof session.expiresAt === "number" || session.expiresAt === null)
  );
}
