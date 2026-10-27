import { isCanonicalUuid } from "@/domain/coach-bookings";
import { validTimezone } from "@/training/contracts";
export type TrainingEmailPayload = {
  kind: "training";
  id: string;
  email: string;
  title: string;
  startsAt: string;
  timezone: string;
  href: string;
};
export function parseTrainingEmail(value: unknown): TrainingEmailPayload {
  const p = value as TrainingEmailPayload;
  if (
    !p ||
    p.kind !== "training" ||
    !isCanonicalUuid(p.id) ||
    typeof p.email !== "string" ||
    p.email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ||
    typeof p.title !== "string" ||
    p.title.length > 80 ||
    !Number.isFinite(Date.parse(p.startsAt)) ||
    !validTimezone(p.timezone) ||
    !/^\/sessions\/calendar\?date=20\d\d-\d\d-\d\d(?:&timezone=[A-Za-z0-9_%+.-]+)?&selected=(p:[0-9a-f-]{36}:20\d\d-\d\d-\d\d|(manual|booking|group):[0-9a-f-]{36})$/.test(
      p.href,
    )
  )
    throw Error("Invalid training reminder");
  return p;
}
export function trainingEmail(payload: TrainingEmailPayload, origin: string) {
  const p = parseTrainingEmail(payload);
  const url = new URL(origin);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw Error("Invalid notification origin");
  const href = new URL(p.href, url).href;
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: p.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(p.startsAt));
  const text = `Your training is coming up: ${p.title}\n${when} (${p.timezone})\nView your training: ${href}`;
  const escape = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  return {
    from: "MovX Club <notification@movx.club>",
    to: [p.email],
    reply_to: "hello@movx.club",
    subject: "Your training is coming up",
    text,
    html: `<p>${escape(p.title)}</p><p>${escape(when)} (${escape(p.timezone)})</p><p><a href="${escape(href)}">View your training</a></p>`,
  };
}
