import "server-only";
import { createEmailTransport, dispatchNotificationBatch } from "./delivery";
import { withNotificationWorker } from "@/server/db/notifications/worker";

export async function runNotificationWorker(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (env.NOTIFICATION_DELIVERY_ENABLED !== "true")
    throw Error("Notification delivery is disabled.");
  if (
    env.NOTIFICATION_TRANSPORT !== "resend" &&
    env.NOTIFICATION_TRANSPORT !== "mailpit"
  )
    throw Error("Notification transport must be explicit.");
  if (!env.NEXT_PUBLIC_SITE_URL)
    throw Error("Notification site origin is missing.");
  const send = createEmailTransport({
    transport: env.NOTIFICATION_TRANSPORT,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    apiKey: env.RESEND_API_KEY,
    mailpitUrl: env.NOTIFICATION_MAILPIT_URL,
  });
  return withNotificationWorker(env.NOTIFICATION_DATABASE_URL, (repository) =>
    dispatchNotificationBatch(repository, send),
  );
}
