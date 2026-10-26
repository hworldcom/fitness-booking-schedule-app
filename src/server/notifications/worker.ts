import "server-only";
import { createEmailTransport, dispatchNotificationBatch } from "./delivery";
import { withNotificationWorker } from "@/server/db/notifications/worker";

export async function runNotificationWorker(
  env: Readonly<Record<string, string | undefined>> = process.env,
  version: 3 | 4 | 5 = 4,
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
  // The reminder lane gets its own bounded claims and time budget. Legacy queues
  // retain five claims even when reminders are backlogged, and vice versa.
  const training =
    version === 5
      ? await withNotificationWorker(
          env.NOTIFICATION_DATABASE_URL,
          (repository) =>
            dispatchNotificationBatch(repository, send, undefined, 12000),
          "training",
        )
      : undefined;
  const result = await withNotificationWorker(
    env.NOTIFICATION_DATABASE_URL,
    (repository) =>
      dispatchNotificationBatch(
        repository,
        send,
        undefined,
        training ? 28000 : 45000,
      ),
    version === 5 ? 4 : version,
  );
  return { ...result, ...(training ? { training } : {}) };
}
