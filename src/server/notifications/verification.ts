import "server-only";
import {
  parseRegistrationEmail,
  type RegistrationEmailPayload,
} from "./registration";

export type VerificationEmailPayload = Omit<
  RegistrationEmailPayload,
  "kind" | "signupEmail" | "verifiedAtSignup"
> & {
  kind: "verification";
  verifiedEmail: string;
  verifiedAt: string;
};
export function parseVerificationEmail(
  value: unknown,
): VerificationEmailPayload {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid verification email.");
  const v = value as VerificationEmailPayload;
  if (
    v.kind !== "verification" ||
    typeof v.verifiedAt !== "string" ||
    v.verifiedAt.length > 40 ||
    !/^\d{4}-\d\d-\d\dT/.test(v.verifiedAt) ||
    !Number.isFinite(Date.parse(v.verifiedAt))
  )
    throw Error("Invalid verification email.");
  const common = parseRegistrationEmail({
    ...v,
    kind: "registration",
    signupEmail: v.verifiedEmail,
    verifiedAtSignup: true,
  });
  return {
    kind: "verification",
    id: common.id,
    email: common.email,
    authUserId: common.authUserId,
    registeredAt: common.registeredAt,
    provider: common.provider,
    verifiedEmail: common.signupEmail,
    verifiedAt: new Date(v.verifiedAt).toISOString(),
  };
}
