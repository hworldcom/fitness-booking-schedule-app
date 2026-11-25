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
import { submitGroupDraft } from "@/server/group-sessions/direct-submission";
import {
  ownedGroupEvent,
  changeOwnedGroupEvent,
} from "@/server/group-sessions/owner-service";

function refreshEvents() {
  for (const path of ["/coach", "/coach/events", "/events", "/sessions/groups"])
    revalidatePath(path);
  revalidatePath("/coach/events/[id]", "page");
  revalidatePath("/coach/events/[id]/edit", "page");
  revalidatePath("/events/[slug]", "page");
}
export async function saveCoachEventDraftAction(
  previous: DraftFormState,
  form: FormData,
): Promise<DraftFormState> {
  if (
    !previous ||
    typeof previous !== "object" ||
    Array.isArray(previous) ||
    (previous.pending &&
      (typeof previous.pending !== "object" || Array.isArray(previous.pending)))
  )
    return { issue: "invalid" };
  const resumed = !!previous.pending;
  if (previous.pending) {
    if (
      Object.keys(previous.pending).length > 25 ||
      Object.values(previous.pending).some(
        (v) => typeof v !== "string" || v.length > 5000,
      )
    )
      return { issue: "invalid" };
    form = new FormData();
    for (const [key, value] of Object.entries(previous.pending))
      form.set(key, value);
  }
  if (!(form instanceof FormData) || form.getAll("submission").length > 1)
    return { issue: "invalid" };
  const mode = form.get("submission") ?? "draft";
  if (mode !== "draft" && mode !== "submit")
    return { issue: "invalid", values: submittedDraftValues(form) };
  const snapshot = Object.fromEntries(
    [...form.entries()].filter(([key]) => !key.startsWith("$ACTION_")),
  ) as Record<string, string>;
  form.delete("submission");
  const parsed = parseOwnerForm(form);
  if (!parsed || parsed.command.action !== "save-draft")
    return { issue: "invalid", values: submittedDraftValues(form) };
  const result = await submitGroupDraft(
    parsed.command,
    parsed.scope,
    mode,
    resumed,
    { change: changeOwnedGroupEvent, read: ownedGroupEvent },
  );
  if (!result.issue) {
    refreshEvents();
    redirect(coachEventHref(parsed.command.args.id));
  }
  const denied = ["actor-changed", "forbidden", "signed-out"].includes(
    result.issue,
  );
  return {
    issue: result.issue,
    ...(!denied
      ? {
          values: submittedDraftValues(form),
          ...(result.pending ? { pending: snapshot } : {}),
          ...(result.revision && !result.pending
            ? { revision: result.revision }
            : {}),
        }
      : {}),
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
  if (
    ["published", "confirmed", "cancelled", "approved", "declined"].includes(
      result.value.outcome,
    )
  )
    redirect(coachEventHref(parsed.command.args.id));
  const issue =
    "reason" in result.value && result.value.reason
      ? result.value.reason
      : result.value.outcome === "forbidden"
        ? "forbidden"
        : "conflict";
  redirect(`${coachEventHref(parsed.command.args.id)}?issue=${issue}`);
}
