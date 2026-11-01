import "server-only";
import { withDatabaseConnection } from "@/server/db/client";
import { sql } from "drizzle-orm";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { sessionMutationError } from "@/server/db/coaches/session-type-repository";
import {
  parseExternalClient,
  parseClientInvitation,
  parseInvitationReview,
  parseExternalPage,
  type ExternalClientDetail,
} from "@/domain/external-clients";
import { sessionUuid } from "@/domain/session-types";
export async function externalClientRecord(
  tx: ActorDatabaseTransaction,
  action: string,
  args: object,
) {
  try {
    const [r] = await tx.execute<{ result: unknown }>(
      sql`select app.external_clients(${action},${JSON.stringify(args)}::jsonb) result`,
    );
    return r.result;
  } catch (e) {
    return sessionMutationError(e);
  }
}
export async function externalClientsPage(
  tx: ActorDatabaseTransaction,
  after: string | null = null,
  unlinked = false,
) {
  return parseExternalPage(
    await externalClientRecord(tx, "list", {
      ...(after ? { after } : {}),
      unlinked,
    }),
  );
}
export async function externalClientDetail(
  tx: ActorDatabaseTransaction,
  id: string,
  offset: number,
) {
  const d = (await externalClientRecord(tx, "detail", {
    id,
    offset,
  })) as ExternalClientDetail;
  parseExternalClient(d?.client);
  if (
    !Array.isArray(d.sessions) ||
    d.sessions.length > 20 ||
    d.sessions.some(
      (s) =>
        !sessionUuid(s.id) ||
        !Number.isFinite(Date.parse(s.startsAt)) ||
        !Number.isFinite(Date.parse(s.endsAt)),
    ) ||
    (d.nextOffset !== null &&
      (!Number.isSafeInteger(d.nextOffset) ||
        d.nextOffset < 1 ||
        d.nextOffset > 500))
  )
    throw Error("Invalid client sessions");
  const [r] = await tx.execute<{
    invitation: ExternalClientDetail["invitation"];
  }>(sql`select app.owned_client_invitation(${id}::uuid) invitation`);
  return {
    client: parseExternalClient(d.client),
    sessions: d.sessions.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
    })),
    nextOffset: d.nextOffset,
    invitation: parseClientInvitation(r.invitation),
  };
}

export async function manageInvitationRecord(
  tx: ActorDatabaseTransaction,
  action: string,
  args: object,
  token: string | null,
) {
  try {
    const [r] = await tx.execute<{ result: { invitation: unknown } }>(
      sql`select app.manage_client_invitation(${action},${JSON.stringify(args)}::jsonb,${token}::text) result`,
    );
    return { invitation: parseClientInvitation(r.result.invitation) };
  } catch (e) {
    return sessionMutationError(e);
  }
}
export async function reviewInvitationRecord(hash: string) {
  return withDatabaseConnection(async ({ db }) => {
    const [r] = await db.execute<{
      result: { state: string; coachName?: string };
    }>(sql`select app.review_client_invitation(${hash}) result`);
    return parseInvitationReview(r.result);
  });
}
export async function decideInvitationRecord(
  tx: ActorDatabaseTransaction,
  hash: string,
  action: string,
) {
  try {
    const [r] = await tx.execute<{ result: { state: string } }>(
      sql`select app.decide_client_invitation(${hash},${action}) result`,
    );
    if (!r.result || !["accepted", "declined"].includes(r.result.state))
      throw Error("Invalid invitation decision");
    return { state: r.result.state };
  } catch (e) {
    return sessionMutationError(e);
  }
}
