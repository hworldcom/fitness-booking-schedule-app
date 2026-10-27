import Link from "next/link";
import { Avatar } from "@/components/ui";
import { profileInitials } from "@/auth/profile-presentation";
import type { MessageConversation } from "@/domain/private-messages";

export function CounterpartIdentity({
  conversation,
}: {
  conversation: MessageConversation;
}) {
  const content = (
    <>
      <Avatar
        initials={
          conversation.role === "movx"
            ? "M"
            : profileInitials(conversation.counterpartName)
        }
        imageUrl={conversation.counterpartImageUrl}
        color={conversation.role === "movx" ? "purple" : "blue"}
      />
      <div>
        <h2>{conversation.counterpartName}</h2>
        <p>
          {conversation.role === "movx"
            ? "Official MovX welcome"
            : conversation.role === "coach"
              ? "You’re the coach in this conversation"
              : "You’re the athlete in this conversation"}
        </p>
      </div>
    </>
  );
  return conversation.counterpartProfileHref ? (
    <Link
      className="mailbox-counterpart"
      href={conversation.counterpartProfileHref}
      prefetch={false}
      aria-label={`View ${conversation.counterpartName}’s profile`}
      title="View profile"
    >
      {content}
    </Link>
  ) : (
    <div className="mailbox-counterpart">{content}</div>
  );
}
