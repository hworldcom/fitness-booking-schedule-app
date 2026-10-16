"use server";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { parseParticipationForm } from "@/features/events/event-contract";
import { changeGroupParticipation } from "@/server/group-sessions/participation-action";

export async function submitGroupParticipationAction(
  form: FormData,
): Promise<void> {
  const parsed = form instanceof FormData ? parseParticipationForm(form) : null;
  if (!parsed) redirect("/events");
  const href = `/events/group-${parsed.command.args.id.replaceAll("-", "")}`;
  const result = await changeGroupParticipation(form);
  if (result.status === "signed-out") redirect(signInHref(href));
  if (result.status === "joined" || result.status === "withdrawn")
    redirect(href);
  redirect(`${href}?issue=${result.status}`);
}
