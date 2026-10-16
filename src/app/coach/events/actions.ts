"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  coachEventHref,
  ownerEventId,
  parseOwnerForm,
  submittedDraftValues,
  type DraftFormState,
} from "@/features/coach-events/contract";
import { changeOwnedGroupEvent } from "@/server/group-sessions/owner-service";

function refreshEvents() {
  for (const path of ["/coach", "/coach/events", "/events", "/sessions/groups"])
    revalidatePath(path);
  revalidatePath("/coach/events/[id]", "page");
  revalidatePath("/coach/events/[id]/edit", "page");
  revalidatePath("/events/[slug]", "page");
}
export async function saveCoachEventDraftAction(
  _previous: DraftFormState,
  form: FormData,
): Promise<DraftFormState> {
  const parsed = form instanceof FormData ? parseOwnerForm(form) : null;
  if (!parsed || parsed.command.action !== "save-draft")
    return {
      issue: "invalid",
      ...(form instanceof FormData
        ? { values: submittedDraftValues(form) }
        : {}),
    };
  const result = await changeOwnedGroupEvent(parsed.command, parsed.scope);
  if (result.status === "ready" && result.value.outcome === "saved") {
    refreshEvents();
    redirect(coachEventHref(parsed.command.args.id));
  }
  const issue =
    result.status === "ready"
      ? result.value.outcome === "forbidden"
        ? "forbidden"
        : "conflict"
      : result.status === "preview"
        ? "unavailable"
        : result.status;
  return {
    issue,
    ...(["actor-changed", "forbidden", "signed-out"].includes(issue)
      ? {}
      : { values: submittedDraftValues(form) }),
  };
}
export async function decideCoachEventAction(form: FormData): Promise<void> {
  const parsed = form instanceof FormData ? parseOwnerForm(form) : null;
  const id =
    form instanceof FormData
      ? ownerEventId(String(form.get("sessionId") ?? ""))
      : null;
  if (!parsed || parsed.command.action === "save-draft")
    redirect(id ? `${coachEventHref(id)}?issue=invalid` : "/coach/events");
  const result = await changeOwnedGroupEvent(parsed.command, parsed.scope);
  if (result.status !== "ready")
    redirect(
      `${coachEventHref(parsed.command.args.id)}?issue=${result.status === "preview" ? "unavailable" : result.status}`,
    );
  refreshEvents();
  if (result.value.outcome === "deleted") redirect("/coach/events");
  if (["published", "confirmed", "cancelled"].includes(result.value.outcome))
    redirect(coachEventHref(parsed.command.args.id));
  const issue =
    "reason" in result.value && result.value.reason
      ? result.value.reason
      : result.value.outcome === "forbidden"
        ? "forbidden"
        : "conflict";
  redirect(`${coachEventHref(parsed.command.args.id)}?issue=${issue}`);
}
