import "server-only";
import { revalidatePath } from "next/cache";
import { parseParticipationForm } from "@/features/events/event-contract";
import { changeAthleteParticipation } from "./athlete-service";

export async function changeGroupParticipation(form: FormData) {
  const parsed = form instanceof FormData ? parseParticipationForm(form) : null;
  if (!parsed) return { status: "invalid" as const };
  const result = await changeAthleteParticipation(parsed.command, parsed.scope);
  if (result.status !== "ready") {
    return {
      status:
        result.status === "preview" ? ("signed-out" as const) : result.status,
    };
  }
  revalidatePath("/events");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/sessions/groups");
  const outcome = result.value.outcome;
  return {
    status:
      outcome === "joined" || outcome === "withdrawn"
        ? outcome
        : ("conflict" as const),
  };
}
