import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { withNotificationWorker } from "@/server/db/notifications/worker";
import { createEmailTransport, dispatchNotificationBatch } from "./delivery";
function databaseTarget(value: string | undefined) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return `${u.hostname === "localhost" ? "127.0.0.1" : u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return null;
  }
}
/** Dispatch only this owner-authorized job after commit, never unrelated queues. */
export async function deliverOwnedInvitation(
  id: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (
    !isCanonicalUuid(id) ||
    env.NOTIFICATION_DELIVERY_ENABLED !== "true" ||
    !env.NOTIFICATION_DATABASE_URL ||
    databaseTarget(env.DATABASE_URL) !==
      databaseTarget(env.NOTIFICATION_DATABASE_URL) ||
    !env.NEXT_PUBLIC_SITE_URL ||
    !["mailpit", "resend"].includes(env.NOTIFICATION_TRANSPORT ?? "")
  )
    return;
  try {
    const send = createEmailTransport({
      transport: env.NOTIFICATION_TRANSPORT as "mailpit" | "resend",
      siteUrl: env.NEXT_PUBLIC_SITE_URL,
      apiKey: env.RESEND_API_KEY,
      mailpitUrl: env.NOTIFICATION_MAILPIT_URL,
    });
    await withNotificationWorker(
      env.NOTIFICATION_DATABASE_URL,
      (r) => dispatchNotificationBatch(r, send, undefined, 9000),
      "invitations",
      id,
    );
  } catch {
    /* The committed queue remains authoritative; never claim that mail was sent. */
  }
}
