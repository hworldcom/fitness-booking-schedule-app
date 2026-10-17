import type { MessageConversation } from "@/domain/private-messages";

// Preserve opening text that was visible in the retired approval banner.
// Accepted openings already exist as messages and must not appear twice.
export function HistoricalContact({
  conversation,
}: {
  conversation: MessageConversation;
}) {
  const contact = conversation.consent;
  if (contact?.status !== "pending") return null;
  const own = contact.senderProfileId === conversation.actorProfileId;
  return (
    <article className={`mailbox-message ${own ? "own" : ""}`}>
      <span className="sr-only">
        {own ? "You" : conversation.counterpartName}
      </span>
      <p>{contact.body}</p>
      <small>Earlier contact</small>
    </article>
  );
}
