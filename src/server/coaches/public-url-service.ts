import "server-only";
import {
  parseCoachHandleConfirmation,
  type CoachPublicHandleResult,
} from "@/domain/coach-public-url";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  ownedCoachPublicHandleRecord,
  confirmCoachPublicHandleRecord,
} from "@/server/db/coaches/public-url-repository";

export async function currentCoachPublicHandle(): Promise<CoachPublicHandleResult> {
  const result = await withAuthorizedActor(ownedCoachPublicHandleRecord);
  return result.status === "authorized"
    ? result.value
    : { status: result.status === "preview" ? "forbidden" : result.status };
}
export async function confirmCoachPublicHandle(
  input: unknown,
): Promise<CoachPublicHandleResult> {
  const value = parseCoachHandleConfirmation(input);
  if (!value) return { status: "invalid" };
  const result = await withAuthorizedActor((tx) =>
    confirmCoachPublicHandleRecord(tx, value.username, value.expectedRevision),
  );
  return result.status === "authorized"
    ? result.value
    : { status: result.status === "preview" ? "forbidden" : result.status };
}
