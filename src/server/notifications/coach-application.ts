import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  parseCoachApplicationContact,
  type CoachApplicationContactDetails,
} from "@/domain/coach-application-contact";

export const COACH_APPLICATION_RECIPIENT = "hello@movx.club";
export type CoachApplicationEmailPayload = {
  kind: "coach-application";
  id: string;
  email: typeof COACH_APPLICATION_RECIPIENT;
  profileId: string;
  applicationRevision: number;
  displayName: string;
  submittedAt: string;
  applicantEmail: string;
  applicationContact?: CoachApplicationContactDetails | null;
};

export function parseCoachApplicationEmail(
  value: unknown,
): CoachApplicationEmailPayload {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid application email.");
  const v = value as CoachApplicationEmailPayload;
  if (
    v.kind !== "coach-application" ||
    v.email !== COACH_APPLICATION_RECIPIENT ||
    !isCanonicalUuid(v.id) ||
    !isCanonicalUuid(v.profileId) ||
    !Number.isInteger(v.applicationRevision) ||
    v.applicationRevision < 1 ||
    v.applicationRevision > 1000000 ||
    typeof v.displayName !== "string" ||
    v.displayName.trim().length < 2 ||
    v.displayName.length > 80 ||
    /[\u0000-\u001f\u007f]/u.test(v.displayName) ||
    typeof v.submittedAt !== "string" ||
    v.submittedAt.length > 40 ||
    !/^\d{4}-\d\d-\d\dT/.test(v.submittedAt) ||
    !Number.isFinite(Date.parse(v.submittedAt)) ||
    typeof v.applicantEmail !== "string" ||
    v.applicantEmail.length > 320 ||
    !/^[^\s<>@\r\n]+@[^\s<>@\r\n]+\.[^\s<>@\r\n]+$/.test(v.applicantEmail)
  )
    throw Error("Invalid application email.");
  return {
    kind: v.kind,
    id: v.id,
    email: v.email,
    profileId: v.profileId,
    applicationRevision: v.applicationRevision,
    displayName: v.displayName,
    submittedAt: new Date(v.submittedAt).toISOString(),
    applicantEmail: v.applicantEmail,
    ...(v.applicationContact === undefined
      ? {}
      : {
          applicationContact:
            v.applicationContact === null
              ? null
              : (() => {
                  const contact = parseCoachApplicationContact({
                    ...v.applicationContact,
                    revision: 1,
                  });
                  return {
                    phoneNumber: contact.phoneNumber,
                    instagramUrl: contact.instagramUrl,
                    facebookUrl: contact.facebookUrl,
                    linkedinUrl: contact.linkedinUrl,
                  };
                })(),
        }),
  };
}
