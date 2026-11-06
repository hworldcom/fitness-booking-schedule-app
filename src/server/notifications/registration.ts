import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";

export const REGISTRATION_RECIPIENT = "hello@movx.club";
export type RegistrationEmailPayload = {
  kind: "registration";
  id: string;
  email: typeof REGISTRATION_RECIPIENT;
  authUserId: string;
  signupEmail: string;
  registeredAt: string;
  provider: "email" | "google" | "other";
  verifiedAtSignup: boolean;
};

export function parseRegistrationEmail(
  value: unknown,
): RegistrationEmailPayload {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid registration email.");
  const v = value as RegistrationEmailPayload;
  if (
    v.kind !== "registration" ||
    v.email !== REGISTRATION_RECIPIENT ||
    !isCanonicalUuid(v.id) ||
    !isCanonicalUuid(v.authUserId) ||
    typeof v.signupEmail !== "string" ||
    v.signupEmail.length > 320 ||
    !/^[^\s<>@\r\n]+@[^\s<>@\r\n]+\.[^\s<>@\r\n]+$/.test(v.signupEmail) ||
    typeof v.registeredAt !== "string" ||
    v.registeredAt.length > 40 ||
    !/^\d{4}-\d\d-\d\dT/.test(v.registeredAt) ||
    !Number.isFinite(Date.parse(v.registeredAt)) ||
    !["email", "google", "other"].includes(v.provider) ||
    typeof v.verifiedAtSignup !== "boolean"
  )
    throw Error("Invalid registration email.");
  return {
    kind: v.kind,
    id: v.id,
    email: v.email,
    authUserId: v.authUserId,
    signupEmail: v.signupEmail,
    registeredAt: new Date(v.registeredAt).toISOString(),
    provider: v.provider,
    verifiedAtSignup: v.verifiedAtSignup,
  };
}
