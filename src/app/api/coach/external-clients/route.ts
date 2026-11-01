import { revalidatePath } from "next/cache";
import {
  loadExternalClients,
  saveExternalClient,
  manageExternalInvitation,
} from "@/server/external-clients/service";
import { externalBody, externalResponse } from "@/server/external-clients/http";
import { deliverOwnedInvitation } from "@/server/notifications/invitations";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return externalResponse(
    await loadExternalClients(
      q.get("id"),
      q.get("after"),
      q.has("offset") ? Number(q.get("offset")) : 0,
      q.get("unlinked") === "true",
    ),
  );
}
export async function POST(request: Request) {
  const value = await externalBody(request);
  if (!value) return externalResponse({ status: "invalid" });
  const invitation =
    new URL(request.url).searchParams.get("invitation") === "true";
  const result = invitation
    ? await manageExternalInvitation(value)
    : await saveExternalClient(value);
  if (result.status === "ready") {
    revalidatePath("/coach/athletes");
    if (
      invitation &&
      "invitation" in result &&
      result.invitation &&
      typeof result.invitation === "object" &&
      "id" in result.invitation &&
      typeof result.invitation.id === "string"
    )
      await deliverOwnedInvitation(result.invitation.id);
  }
  return externalResponse(result);
}
