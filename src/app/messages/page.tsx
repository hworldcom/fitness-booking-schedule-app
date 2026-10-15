import type { Metadata } from "next";
import Link from "next/link";
import { signInHref } from "@/auth/return-to";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { Mailbox } from "@/features/messages/mailbox";
import "@/features/messages/messages.css";
export const metadata: Metadata = { title: "Messages" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    coach?: string;
    conversation?: string;
    pair?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.coach) query.set("coach", params.coach);
  if (params.conversation) query.set("conversation", params.conversation);
  if (params.pair) query.set("pair", params.pair);
  const destination = `/messages${query.size ? "?" + query : ""}`;
  const access = await protectedPageAccess(destination);
  if (access.status === "unavailable") return <ProtectedAccessUnavailable />;
  if (access.status === "preview")
    return (
      <section className="protected-access-state">
        <h1>Messages</h1>
        <p>
          Sign in to ask a coach a question or follow your session requests.
        </p>
        <Link className="button dark" href={signInHref(destination)}>
          Sign in to message
        </Link>
      </section>
    );
  return (
    <Mailbox
      pairId={params.pair}
      coachId={params.coach}
      conversationId={params.conversation}
    />
  );
}
