import {
  invitationEmail,
  type InvitationEmailPayload,
} from "./invitation-email";
import { coachReviewLink } from "@/notifications/coach-review-link";
import {
  parseCoachApprovalEmail,
  type CoachApprovalEmailPayload,
} from "./coach-approval";
import {
  COACH_APPROVAL_TITLE,
  COACH_APPROVAL_NEXT_STEPS,
} from "@/notifications/coach-approvals";
import {
  GROUP_EVENTS,
  parseGroupNotification,
  groupNotificationHref,
  groupNotificationSummary,
  groupNotificationExplanation,
  type GroupNotification,
} from "@/notifications/groups";
import "server-only";
import {
  parseVerificationEmail,
  type VerificationEmailPayload,
} from "./verification";
import {
  parseRegistrationEmail,
  type RegistrationEmailPayload,
} from "./registration";
import { trainingEmail, type TrainingEmailPayload } from "./training";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  parseCoachApplicationEmail,
  type CoachApplicationEmailPayload,
} from "./coach-application";
import {
  BOOKING_EVENTS,
  bookingNotificationHref,
  bookingNotificationSummary,
  parseBookingNotification,
  type BookingNotification,
} from "@/notifications/bookings";

export type EmailClaim = {
  id: string;
  leaseId: string;
  kind?:
    | "message"
    | "booking"
    | "group"
    | "coach-application"
    | "training"
    | "coach-approval"
    | "coach-invitation"
    | "registration"
    | "verification";
};
export type MessageEmailPayload = {
  id: string;
  conversationId: string;
  email: string;
};
export type EmailPayload =
  | MessageEmailPayload
  | InvitationEmailPayload
  | TrainingEmailPayload
  | CoachApprovalEmailPayload
  | CoachApplicationEmailPayload
  | RegistrationEmailPayload
  | VerificationEmailPayload
  | ((BookingNotification | GroupNotification) & { id: string; email: string });
export type DeliveryOutcome = {
  status: "accepted" | "retry" | "failed" | "unknown";
  providerId?: string;
};
export type DeliveryRepository = {
  claim: () => Promise<EmailClaim[]>;
  prepare: (claim: EmailClaim) => Promise<EmailPayload | null>;
  finish: (claim: EmailClaim, outcome: DeliveryOutcome) => Promise<boolean>;
};
export async function dispatchNotificationBatch(
  repository: DeliveryRepository,
  send: (payload: EmailPayload) => Promise<DeliveryOutcome>,
  now = () => Date.now(),
  budgetMs = 45000,
) {
  const deadline = now() + budgetMs;
  const claims = await repository.claim();
  const result = {
    claimed: claims.length,
    accepted: 0,
    retry: 0,
    failed: 0,
    unknown: 0,
    suppressed: 0,
    stale: 0,
    deferred: 0,
  };
  for (const claim of claims) {
    if (now() >= deadline) {
      result.deferred++;
      continue;
    }
    const payload = await repository.prepare(claim);
    if (!payload) {
      result.suppressed++;
      continue;
    }
    let outcome: DeliveryOutcome;
    try {
      outcome = await send(payload);
    } catch {
      outcome = { status: "unknown" };
    }
    if (await repository.finish(claim, outcome)) result[outcome.status]++;
    else result.stale++;
  }
  return result;
}
export function messageEmail(payload: MessageEmailPayload, siteUrl: string) {
  const site = new URL(siteUrl);
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
      )) ||
    !isCanonicalUuid(payload.conversationId) ||
    !isCanonicalUuid(payload.id) ||
    !/^[^\s<>@\r\n]+@[^\s<>@\r\n]+\.[^\s<>@\r\n]+$/.test(payload.email) ||
    payload.email.length > 320
  )
    throw Error("Invalid notification email configuration.");
  const link = new URL(`/messages?conversation=${payload.conversationId}`, site)
    .href;
  const escaped = link
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return {
    from: "MovX Club <notification@movx.club>",
    to: [payload.email],
    reply_to: "hello@movx.club",
    subject: "You have unread messages on MovX Club",
    text: `You have unread messages on MovX Club.\n\nOpen your conversation: ${link}\n\nSign in to read and reply.`,
    html: `<p>You have unread messages on MovX Club.</p><p><a href="${escaped}">Open your conversation</a></p><p>Sign in to read and reply.</p>`,
  };
}
export function bookingEmail(
  payload: BookingNotification & { id: string; email: string },
  siteUrl: string,
) {
  const event = parseBookingNotification(payload);
  const base = messageEmail(
    { id: payload.id, email: payload.email, conversationId: event.sourceId },
    siteUrl,
  );
  const title = BOOKING_EVENTS[event.event];
  const summary = bookingNotificationSummary(event);
  const link = new URL(bookingNotificationHref(event), siteUrl).href;
  const explanation =
    event.event === "requested"
      ? "The request was submitted for coach confirmation. It was not a confirmed booking."
      : "This notice records a booking event. Open your bookings for the current status.";
  const escape = (v: string) =>
    v
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return {
    ...base,
    subject: `${title} on MovX Club`,
    text: `${title}\n\n${summary}\n\n${explanation}\n\nOpen your bookings: ${link}\n\nSign in to view the current details.`,
    html: `<p>${escape(title)}</p><p>${escape(summary)}</p><p>${escape(explanation)}</p><p><a href="${escape(link)}">Open your bookings</a></p><p>Sign in to view the current details.</p>`,
  };
}
export function groupEmail(
  payload: GroupNotification & { id: string; email: string },
  siteUrl: string,
) {
  const event = parseGroupNotification(payload);
  const base = messageEmail(
    { id: payload.id, email: payload.email, conversationId: event.sessionId },
    siteUrl,
  );
  const title = GROUP_EVENTS[event.event],
    summary = groupNotificationSummary(event),
    explanation = groupNotificationExplanation(event),
    link = new URL(groupNotificationHref(event), siteUrl).href;
  const escape = (v: string) =>
    v
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return {
    ...base,
    subject: `${title} on MovX Club`,
    text: `${title}\n\n${summary}\n\n${explanation}\n\nOpen your event: ${link}\n\nSign in to view the current details.`,
    html: `<p>${escape(title)}</p><p>${escape(summary)}</p><p>${escape(explanation)}</p><p><a href="${escape(link)}">Open your event</a></p><p>Sign in to view the current details.</p>`,
  };
}
export function verificationEmail(
  payload: VerificationEmailPayload,
  siteUrl: string,
) {
  const event = parseVerificationEmail(payload);
  const base = messageEmail(
    { id: event.id, conversationId: event.authUserId, email: event.email },
    siteUrl,
  );
  const lines = [
    "An account's email address was verified.",
    `Verified email: ${event.verifiedEmail}`,
    `Verified (UTC): ${event.verifiedAt}`,
    `Registered (UTC): ${event.registeredAt}`,
    `Registration method: ${{ email: "Email", google: "Google", other: "Other" }[event.provider]}`,
    `Account ID: ${event.authUserId}`,
    `Workspace: ${new URL(siteUrl).origin}`,
    "This notice records email verification. Profile setup may still be incomplete; check the current account state before taking action.",
  ];
  const escape = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return {
    ...base,
    subject: "User email verified on MovX Club",
    text: lines.join("\n\n"),
    html: lines.map((line) => `<p>${escape(line)}</p>`).join(""),
  };
}
export function registrationEmail(
  payload: RegistrationEmailPayload,
  siteUrl: string,
) {
  const event = parseRegistrationEmail(payload);
  const base = messageEmail(
    { id: event.id, conversationId: event.authUserId, email: event.email },
    siteUrl,
  );
  const lines = [
    "A new account was registered.",
    `Email at signup: ${event.signupEmail}`,
    `Email verified at signup: ${event.verifiedAtSignup ? "Yes" : "No (unverified)"}`,
    `Registration method: ${{ email: "Email", google: "Google", other: "Other" }[event.provider]}`,
    `Registered (UTC): ${event.registeredAt}`,
    `Account ID: ${event.authUserId}`,
    `Workspace: ${new URL(siteUrl).origin}`,
    "This notice records signup details. Profile setup may still be incomplete; check the current account state before taking action.",
  ];
  const escape = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return {
    ...base,
    subject: "New user registered on MovX Club",
    text: lines.join("\n\n"),
    html: lines.map((line) => `<p>${escape(line)}</p>`).join(""),
  };
}
export function coachApplicationEmail(
  payload: CoachApplicationEmailPayload,
  siteUrl: string,
  reviewOrigin?: string,
) {
  const event = parseCoachApplicationEmail(payload);
  const base = messageEmail(
    { id: event.id, conversationId: event.profileId, email: event.email },
    siteUrl,
  );
  const lines = [
    "A coach application was submitted for review.",
    `Applicant: ${event.displayName}`,
    `Contact email: ${event.applicantEmail}`,
    ...(event.applicationContact
      ? [
          `Phone number: ${event.applicationContact.phoneNumber}`,
          ...(event.applicationContact.instagramUrl
            ? [`Instagram: ${event.applicationContact.instagramUrl}`]
            : []),
          ...(event.applicationContact.facebookUrl
            ? [`Facebook: ${event.applicationContact.facebookUrl}`]
            : []),
          ...(event.applicationContact.linkedinUrl
            ? [`LinkedIn: ${event.applicationContact.linkedinUrl}`]
            : []),
        ]
      : []),
    `Profile ID: ${event.profileId}`,
    `Application revision: ${event.applicationRevision}`,
    `Submitted (UTC): ${event.submittedAt}`,
    `Workspace: ${new URL(siteUrl).origin}`,
    ...(coachReviewLink(reviewOrigin, new URL(siteUrl).origin, event.profileId)
      ? [
          `Review application: ${coachReviewLink(reviewOrigin, new URL(siteUrl).origin, event.profileId)}`,
        ]
      : []),
    "Use the platform's authorized application review process. This records a submission; check the current application state before deciding.",
  ];
  const escape = (v: string) =>
    v
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return {
    ...base,
    subject: "Coach application submitted on MovX Club",
    text: lines.join("\n\n"),
    html: lines.map((line) => `<p>${escape(line)}</p>`).join(""),
  };
}

export function coachApprovalEmail(
  payload: CoachApprovalEmailPayload,
  siteUrl: string,
) {
  const event = parseCoachApprovalEmail(payload);
  const base = messageEmail(
    { id: event.id, conversationId: event.id, email: event.email },
    siteUrl,
  );
  const link = new URL("/profile/coach", siteUrl).href;
  const escape = (v: string) =>
    v
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return {
    ...base,
    subject: "Your coach application was approved on MovX Club",
    text: `Hi ${event.displayName},\n\n${COACH_APPROVAL_TITLE}.\n\n${COACH_APPROVAL_NEXT_STEPS}\n\nYour profile remains hidden until you publish it.\n\nOpen your coach profile: ${link}\n\nQuestions? Contact hello@movx.club.`,
    html: `<p>Hi ${escape(event.displayName)},</p><p>${escape(COACH_APPROVAL_TITLE)}.</p><p>${escape(COACH_APPROVAL_NEXT_STEPS)}</p><p>Your profile remains hidden until you publish it.</p><p><a href="${escape(link)}">Open your coach profile</a></p><p>Questions? Contact hello@movx.club.</p>`,
  };
}

export function createEmailTransport(
  config: {
    transport: "resend" | "mailpit";
    siteUrl: string;
    apiKey?: string;
    mailpitUrl?: string;
    reviewOrigin?: string;
  },
  fetcher: typeof fetch = fetch,
) {
  let endpoint = "https://api.resend.com/emails";
  if (config.transport === "mailpit") {
    const url = new URL(config.mailpitUrl ?? "http://127.0.0.1:55324");
    if (
      url.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw Error("Mailpit must use an explicit loopback origin.");
    endpoint = new URL("/api/v1/send", url).href;
  } else if (!config.apiKey || !/^re_[A-Za-z0-9_-]+$/.test(config.apiKey))
    throw Error("Notification sending key is missing.");
  // Validate configuration before claiming any work.
  messageEmail(
    {
      id: "00000000-0000-4000-8000-000000000001",
      conversationId: "00000000-0000-4000-8000-000000000002",
      email: "check@example.test",
    },
    config.siteUrl,
  );
  return async (payload: EmailPayload): Promise<DeliveryOutcome> => {
    const isVerification = "kind" in payload && payload.kind === "verification";
    const isRegistration = "kind" in payload && payload.kind === "registration";
    const isInvitation =
      "kind" in payload && payload.kind === "coach-invitation";
    const isApproval = "kind" in payload && payload.kind === "coach-approval";
    const isApplication =
      "kind" in payload && payload.kind === "coach-application";
    const isGroup = "kind" in payload && payload.kind === "group";
    const isBooking = "kind" in payload && payload.kind === "booking";
    const isTraining = "kind" in payload && payload.kind === "training";
    const email = isVerification
      ? verificationEmail(payload, config.siteUrl)
      : isRegistration
        ? registrationEmail(payload, config.siteUrl)
        : isInvitation
          ? invitationEmail(payload, config.siteUrl)
          : isApproval
            ? coachApprovalEmail(payload, config.siteUrl)
            : isTraining
              ? trainingEmail(payload, config.siteUrl)
              : isApplication
                ? coachApplicationEmail(
                    payload,
                    config.siteUrl,
                    config.reviewOrigin,
                  )
                : isGroup
                  ? groupEmail(payload, config.siteUrl)
                  : isBooking
                    ? bookingEmail(payload, config.siteUrl)
                    : messageEmail(
                        payload as MessageEmailPayload,
                        config.siteUrl,
                      );
    const key = `${isVerification ? "verification" : isRegistration ? "registration" : isInvitation ? "coach-invitation" : isApproval ? "coach-approval" : isTraining ? "training" : isApplication ? "coach-application" : isGroup ? "group" : isBooking ? "booking" : "message"}-notice/${payload.id}`;
    const local = config.transport === "mailpit";
    const body = local
      ? {
          From: { Email: "notification@movx.club", Name: "MovX Club" },
          To: [{ Email: payload.email }],
          ReplyTo: [{ Email: email.reply_to }],
          Subject: email.subject,
          Text: email.text,
          HTML: email.html,
          Tags: ["movx-notification"],
          Headers: { "X-MovX-Notification": payload.id },
        }
      : email;
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(local
            ? {}
            : {
                Authorization: `Bearer ${config.apiKey}`,
                "Idempotency-Key": key,
              }),
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 429) {
        await response.body?.cancel();
        return { status: "retry" };
      }
      if (
        response.status >= 400 &&
        response.status < 500 &&
        ![408, 409].includes(response.status)
      ) {
        await response.body?.cancel();
        return { status: "failed" };
      }
      if (!response.ok) {
        await response.body?.cancel();
        return { status: "unknown" };
      }
      const raw = await response.text();
      if (raw.length > 2048) return { status: "unknown" };
      const result = JSON.parse(raw) as { id?: unknown; ID?: unknown };
      const id = local ? result.ID : result.id;
      return typeof id === "string" && id.length > 0 && id.length <= 200
        ? { status: "accepted", providerId: id }
        : { status: "unknown" };
    } catch {
      return { status: "unknown" };
    }
  };
}
