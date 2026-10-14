"use server";
import { revalidatePath } from "next/cache";
import {
  isConnectionDecision,
  isConnectionRole,
  isConnectionSection,
  isConnectionCursor,
  type ConnectionCursor,
  type ConnectionProjection,
} from "@/domain/coach-athlete-connections";
import {
  currentConnectionHistory,
  currentConnectionPage,
  decideCoachAthleteConnection,
  sendCoachAthleteConnection,
} from "@/server/connections/service";

export type ConnectionActionState = Readonly<{
  status:
    | "idle"
    | "saved"
    | "invalid"
    | "conflict"
    | "signed-out"
    | "forbidden"
    | "unavailable";
  message: string;
  connection: ConnectionProjection | null;
}>;
function state(
  status: ConnectionActionState["status"],
  message: string,
  connection: ConnectionProjection | null = null,
): ConnectionActionState {
  return Object.freeze({ status, message, connection });
}
export async function mutateConnectionAction(
  _previous: ConnectionActionState,
  form: FormData,
): Promise<ConnectionActionState> {
  if (!(form instanceof FormData))
    return state("invalid", "Choose a valid connection action.");
  const action = form.get("intent");
  let result;
  if (action === "send") {
    const previous = form.get("previousId");
    if (previous !== null && typeof previous !== "string")
      return state("invalid", "Choose a valid connection request.");
    result = await sendCoachAthleteConnection(
      String(form.get("bookingId") ?? ""),
      String(form.get("operationId") ?? ""),
      previous || null,
    );
  } else if (isConnectionDecision(action)) {
    result = await decideCoachAthleteConnection(
      String(form.get("connectionId") ?? ""),
      action,
    );
  } else return state("invalid", "Choose a valid connection action.");
  if (result.status !== "ready") {
    if (result.status === "invalid")
      return state("invalid", "Choose a valid connection request.");
    if (result.status === "conflict")
      return state(
        "conflict",
        "This connection changed or no longer qualifies. Reload its current status.",
      );
    if (result.status === "signed-out")
      return state("signed-out", "Sign in again to manage this connection.");
    if (result.status === "forbidden" || result.status === "preview")
      return state("forbidden", "This account cannot manage that connection.");
    return state(
      "unavailable",
      "MovX could not verify this connection right now.",
    );
  }
  revalidatePath("/coach");
  revalidatePath("/sessions");
  const message =
    result.value.status === "pending"
      ? "Connection request pending acceptance."
      : result.value.status === "accepted"
        ? "Connected."
        : result.value.status === "removed"
          ? "Disconnected. Shared history is retained."
          : result.value.status === "declined"
            ? "Connection request declined."
            : "Connection request withdrawn.";
  return state("saved", message, result.value);
}
export async function loadConnectionPageAction(
  role: unknown,
  section: unknown,
  cursor: ConnectionCursor | null = null,
) {
  if (
    !isConnectionRole(role) ||
    !isConnectionSection(section) ||
    (cursor !== null && !isConnectionCursor(cursor))
  )
    return { status: "invalid" as const };
  return currentConnectionPage(role, section, { cursor });
}
export async function loadConnectionHistoryAction(
  pairId: string,
  cursor: ConnectionCursor | null = null,
) {
  if (cursor !== null && !isConnectionCursor(cursor))
    return { status: "invalid" as const };
  return currentConnectionHistory(pairId, { cursor });
}
