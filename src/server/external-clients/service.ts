import "server-only";
import { randomBytes, createHash } from "node:crypto";
import {
  parseClientCommand,
  parseInvitationCommand,
  parseExternalClient,
} from "@/domain/external-clients";
import { sessionUuid } from "@/domain/session-types";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  externalClientRecord,
  externalClientsPage,
  externalClientDetail,
  manageInvitationRecord,
  reviewInvitationRecord,
  decideInvitationRecord,
} from "@/server/db/external-clients/repository";
import { SessionTypeError } from "@/server/db/coaches/session-type-repository";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
async function authorized<T extends object>(
  work: (tx: ActorDatabaseTransaction) => Promise<T>,
) {
  try {
    const r = await withAuthorizedActor(work, {
      rethrow: (e) => e instanceof SessionTypeError,
    });
    return r.status === "authorized"
      ? { status: "ready" as const, ...r.value }
      : { status: r.status === "preview" ? ("forbidden" as const) : r.status };
  } catch (e) {
    return {
      status:
        e instanceof SessionTypeError ? e.status : ("unavailable" as const),
    };
  }
}
export async function loadExternalClients(
  id: string | null,
  after: string | null,
  offset: number,
  unlinked = false,
) {
  if (
    (id !== null && !sessionUuid(id)) ||
    (after !== null && !sessionUuid(after)) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 500
  )
    return { status: "invalid" as const };
  return authorized(async (tx) =>
    id
      ? { detail: await externalClientDetail(tx, id, offset) }
      : { page: await externalClientsPage(tx, after, unlinked) },
  );
}
export async function saveExternalClient(value: unknown) {
  const input = parseClientCommand(value);
  if (!input) return { status: "invalid" as const };
  const result = await authorized(async (tx) => {
    const result = (await externalClientRecord(
      tx,
      input.action,
      input.args,
    )) as { client: unknown };
    return { client: parseExternalClient(result.client) };
  });
  if (result.status === "conflict" && input.action === "update") {
    // The failed write has rolled back. Re-authorize a fresh read; never rebase
    // the retained draft or expose another actor's record automatically.
    const latest = await authorized(async (tx) => ({
      current: (await externalClientDetail(tx, String(input.args.id), 0))
        .client,
    }));
    return latest.status === "ready"
      ? { status: "conflict" as const, current: latest.current }
      : result;
  }
  return result;
}
export async function manageExternalInvitation(value: unknown) {
  const input = parseInvitationCommand(value);
  if (!input) return { status: "invalid" as const };
  return authorized((tx) =>
    manageInvitationRecord(
      tx,
      input.action,
      input.args,
      input.action === "revoke" ? null : randomBytes(32).toString("base64url"),
    ),
  );
}
export const invitationTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const invitationReviewContext = (hash: string) =>
  invitationTokenHash(`review:${hash}`);
export async function reviewInvitation(hash: string) {
  try {
    return {
      status: "ready" as const,
      ...(await reviewInvitationRecord(hash)),
    };
  } catch {
    return { status: "unavailable" as const };
  }
}
export async function decideInvitation(hash: string, action: string) {
  if (!["accept", "decline"].includes(action))
    return { status: "invalid" as const };
  return authorized((tx) => decideInvitationRecord(tx, hash, action));
}
