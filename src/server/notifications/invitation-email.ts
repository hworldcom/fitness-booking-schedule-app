import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
export type InvitationEmailPayload = {
  kind: "coach-invitation";
  id: string;
  email: string;
  coachName: string;
  token: string;
};
export function parseInvitationEmail(value: unknown): InvitationEmailPayload {
  const v = value as InvitationEmailPayload;
  if (
    !v ||
    v.kind !== "coach-invitation" ||
    !isCanonicalUuid(v.id) ||
    typeof v.email !== "string" ||
    v.email.length > 254 ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v.email) ||
    typeof v.coachName !== "string" ||
    v.coachName.length > 240 ||
    typeof v.token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(v.token)
  )
    throw Error("Invalid invitation email");
  return v;
}
export function invitationEmail(
  payload: InvitationEmailPayload,
  siteUrl: string,
) {
  const v = parseInvitationEmail(payload),
    site = new URL(siteUrl);
  if (
    site.username ||
    site.password ||
    site.pathname !== "/" ||
    site.search ||
    site.hash ||
    (site.protocol !== "https:" &&
      !(
        site.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(site.hostname)
      ))
  )
    throw Error("Invalid invitation origin");
  const link = new URL("/invitations", site);
  link.hash = v.token;
  const escape = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return {
    from: "MovX Club <notification@movx.club>",
    to: [v.email],
    reply_to: "hello@movx.club",
    subject: `${v.coachName} invited you to MovX Club`,
    text: `${v.coachName} invited you to connect on MovX Club and access your shared session records.\n\nReview invitation: ${link.href}\n\nSign in or create an account with the email that received this invitation, then choose Accept. Opening this link does not accept. This invitation expires in 14 days.`,
    html: `<p>${escape(v.coachName)} invited you to connect on MovX Club and access your shared session records.</p><p><a href="${escape(link.href)}">Review invitation</a></p><p>Sign in or create an account with the email that received this invitation, then choose Accept. Opening this link does not accept. This invitation expires in 14 days.</p>`,
  };
}
