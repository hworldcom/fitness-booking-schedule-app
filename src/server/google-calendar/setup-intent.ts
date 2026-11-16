import "server-only";
import { calendarUuid } from "@/calendar/connection";

export type CalendarSyncIntent = Readonly<{
  version: string;
  commandId: string;
}>;
export type CalendarSyncOutcome = "enabled" | "changed" | "unavailable";

export function authorizationProof(
  verifier: string,
  sync?: CalendarSyncIntent,
) {
  return sync ? JSON.stringify({ v: 2, verifier, sync }) : verifier;
}

export function readAuthorizationProof(value: string): {
  verifier: string;
  sync?: CalendarSyncIntent;
} {
  // Existing pending authorizations contain only the encrypted verifier.
  if (/^[\w.~-]{1,128}$/.test(value)) return { verifier: value };
  try {
    const proof = JSON.parse(value);
    if (
      !proof ||
      Object.keys(proof).length !== 3 ||
      proof.v !== 2 ||
      typeof proof.verifier !== "string" ||
      !/^[\w.~-]{43,128}$/.test(proof.verifier) ||
      !proof.sync ||
      Object.keys(proof.sync).length !== 2 ||
      !calendarUuid(proof.sync.version) ||
      !calendarUuid(proof.sync.commandId)
    )
      throw Error();
    return { verifier: proof.verifier, sync: proof.sync };
  } catch {
    throw new Error("Calendar setup proof unavailable.");
  }
}
