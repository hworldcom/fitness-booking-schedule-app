import {
  GROUP_EVENTS,
  parseGroupNotification,
  groupNotificationHref,
  groupNotificationSummary,
  groupNotificationExplanation,
  type GroupNotification,
} from "@/notifications/groups";
import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
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
  kind?: "message" | "booking" | "group";
};
export type MessageEmailPayload = {
  id: string;
  conversationId: string;
  email: string;
};
export type EmailPayload =
  | MessageEmailPayload
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
) {
  const deadline = now() + 45000;
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
export function createEmailTransport(
  config: {
    transport: "resend" | "mailpit";
    siteUrl: string;
    apiKey?: string;
    mailpitUrl?: string;
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
    const isGroup = "kind" in payload && payload.kind === "group";
    const isBooking = "kind" in payload && payload.kind === "booking";
    const email = isGroup
      ? groupEmail(payload, config.siteUrl)
      : isBooking
        ? bookingEmail(payload, config.siteUrl)
        : messageEmail(payload as MessageEmailPayload, config.siteUrl);
    const key = `${isGroup ? "group" : isBooking ? "booking" : "message"}-notice/${payload.id}`;
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
