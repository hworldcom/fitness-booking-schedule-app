// Brand paths: Tabler Icons, MIT © 2020–2026 Paweł Kuna.
// Sources: https://github.com/tabler/tabler-icons/tree/main/icons/outline
// Retained license: ./website-brand-icons.LICENSE.txt
import { Globe2 } from "lucide-react";
import {
  COACH_SOCIAL_PLATFORMS,
  coachSocialUrl,
  type CoachSocialPlatform,
} from "@/domain/coach-website";

export function websiteLinkPlatform(url: string) {
  return (
    COACH_SOCIAL_PLATFORMS.find((platform) =>
      coachSocialUrl(url, platform.host),
    )?.key ?? "website"
  );
}

export function WebsiteLinkIcon({
  platform,
}: {
  platform: CoachSocialPlatform | "website";
}) {
  if (platform === "website")
    return (
      <Globe2 size={18} aria-hidden="true" className="website-platform-icon" />
    );
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="website-platform-icon"
    >
      {platform === "instagram" && (
        <>
          <path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4l0 -10" />
          <path d="M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 0 0 -7 0" />
          <path d="M17 7v.01" />
        </>
      )}
      {platform === "facebook" && (
        <path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3" />
      )}
      {platform === "linkedin" && (
        <>
          <path d="M8 11v5M8 8v.01M12 16v-5M16 16v-3a2 2 0 1 0 -4 0" />
          <path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4l0 -10" />
        </>
      )}
    </svg>
  );
}
