import Link from "next/link";
import { profileInitials } from "@/auth/profile-presentation";
import { Avatar } from "@/components/ui";

export function ClientSessionCoachIdentity({
  displayName,
  slug,
  portraitUrl,
}: {
  displayName: string;
  slug: string;
  portraitUrl: string | null;
}) {
  return (
    <Link
      className="client-session-coach-link"
      href={`/coaches/${slug}`}
      aria-label={`View ${displayName}'s coach profile`}
    >
      <Avatar
        initials={profileInitials(displayName)}
        color="peach"
        imageUrl={portraitUrl}
        alt=""
      />
      <span>
        <span className="eyebrow">PRIVATE SESSION</span>
        <strong>{displayName}</strong>
      </span>
    </Link>
  );
}
