import "server-only";
import postgres from "postgres";
import { parseDatabaseUrl } from "../config";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import type {
  DeliveryRepository,
  EmailClaim,
  EmailPayload,
} from "@/server/notifications/delivery";

export async function withNotificationWorker<T>(
  url: string | undefined,
  work: (repository: DeliveryRepository) => Promise<T>,
) {
  const config = parseDatabaseUrl(url);
  const db = postgres(config.connectionString, {
    ssl: config.ssl,
    max: 1,
    prepare: false,
    connect_timeout: 10,
    onnotice: () => {},
  });
  try {
    const [role] =
      await db`select r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb
      or pg_has_role(current_user,'app_owner','MEMBER') or pg_has_role(current_user,'app_runtime','MEMBER') unsafe,
      pg_has_role(current_user,'app_notification_worker','MEMBER') worker from pg_roles r where r.rolname=current_user`;
    if (!role?.worker || role.unsafe)
      throw Error(
        "Notification database login must inherit only the restricted worker role.",
      );
    await db`set statement_timeout='10s'`;
    const repository: DeliveryRepository = {
      async claim() {
        const [row] = await db`select app.claim_notification_emails(5) result`;
        if (!Array.isArray(row.result) || row.result.length > 5)
          throw Error("Invalid notification claims.");
        return row.result.map((v: EmailClaim) => {
          if (!v || !isCanonicalUuid(v.id) || !isCanonicalUuid(v.leaseId))
            throw Error("Invalid notification claim.");
          return { id: v.id, leaseId: v.leaseId };
        });
      },
      async prepare(claim) {
        const [row] =
          await db`select app.prepare_notification_email(${claim.id}::uuid,${claim.leaseId}::uuid) result`;
        if (row.result === null) return null;
        const payload = row.result as EmailPayload;
        if (
          payload.id !== claim.id ||
          !isCanonicalUuid(payload.conversationId) ||
          typeof payload.email !== "string"
        )
          throw Error("Invalid notification email job.");
        return {
          id: payload.id,
          conversationId: payload.conversationId,
          email: payload.email,
        };
      },
      async finish(claim, outcome) {
        const [row] =
          await db`select app.finish_notification_email(${claim.id}::uuid,${claim.leaseId}::uuid,${outcome.status}::text,${outcome.providerId ?? null}::text) result`;
        return row.result === true;
      },
    };
    return await work(repository);
  } finally {
    await db.end({ timeout: 1 });
  }
}
