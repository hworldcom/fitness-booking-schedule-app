import { parseGroupNotification } from "@/notifications/groups";
import "server-only";
import postgres from "postgres";
import { parseDatabaseUrl } from "../config";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { parseCoachApplicationEmail } from "@/server/notifications/coach-application";
import { parseBookingNotification } from "@/notifications/bookings";
import type {
  DeliveryRepository,
  EmailClaim,
  EmailPayload,
} from "@/server/notifications/delivery";

export async function withNotificationWorker<T>(
  url: string | undefined,
  work: (repository: DeliveryRepository) => Promise<T>,
  version: 3 | 4 = 4,
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
        const [row] =
          version === 3
            ? await db`select app.claim_notification_emails_v3(5) result`
            : await db`select app.claim_notification_emails_v4(5) result`;
        if (!Array.isArray(row.result) || row.result.length > 5)
          throw Error("Invalid notification claims.");
        return row.result.map((v: EmailClaim) => {
          if (
            !v ||
            !isCanonicalUuid(v.id) ||
            !isCanonicalUuid(v.leaseId) ||
            ![
              "message",
              "booking",
              "group",
              ...(version === 4 ? ["coach-application"] : []),
            ].includes(v.kind ?? "")
          )
            throw Error("Invalid notification claim.");
          return { id: v.id, leaseId: v.leaseId, kind: v.kind };
        });
      },
      async prepare(claim) {
        const [row] =
          claim.kind === "coach-application"
            ? await db`select app.prepare_coach_application_email(${claim.id}::uuid,${claim.leaseId}::uuid) result`
            : claim.kind === "group"
              ? await db`select app.prepare_group_notification_email(${claim.id}::uuid,${claim.leaseId}::uuid) result`
              : claim.kind === "booking"
                ? await db`select app.prepare_booking_notification_email(${claim.id}::uuid,${claim.leaseId}::uuid) result`
                : await db`select app.prepare_notification_email(${claim.id}::uuid,${claim.leaseId}::uuid) result`;
        if (row.result === null) return null;
        const payload = row.result as EmailPayload;
        if (claim.kind === "coach-application") {
          const event = parseCoachApplicationEmail(payload);
          if (event.id !== claim.id)
            throw Error("Invalid application email job.");
          return event;
        }
        if (claim.kind === "group") {
          if (payload.id !== claim.id || typeof payload.email !== "string")
            throw Error("Invalid group email job.");
          return {
            ...parseGroupNotification(payload),
            id: payload.id,
            email: payload.email,
          };
        }
        if (claim.kind === "booking") {
          if (payload.id !== claim.id || typeof payload.email !== "string")
            throw Error("Invalid booking email job.");
          return {
            ...parseBookingNotification(payload),
            id: payload.id,
            email: payload.email,
          };
        }
        if (
          payload.id !== claim.id ||
          !("conversationId" in payload) ||
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
          claim.kind === "coach-application"
            ? await db`select app.finish_coach_application_email(${claim.id}::uuid,${claim.leaseId}::uuid,${outcome.status}::text,${outcome.providerId ?? null}::text) result`
            : claim.kind === "group"
              ? await db`select app.finish_group_notification_email(${claim.id}::uuid,${claim.leaseId}::uuid,${outcome.status}::text,${outcome.providerId ?? null}::text) result`
              : claim.kind === "booking"
                ? await db`select app.finish_booking_notification_email(${claim.id}::uuid,${claim.leaseId}::uuid,${outcome.status}::text,${outcome.providerId ?? null}::text) result`
                : await db`select app.finish_notification_email(${claim.id}::uuid,${claim.leaseId}::uuid,${outcome.status}::text,${outcome.providerId ?? null}::text) result`;
        return row.result === true;
      },
    };
    return await work(repository);
  } finally {
    await db.end({ timeout: 1 });
  }
}
