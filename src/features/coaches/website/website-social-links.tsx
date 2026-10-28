import {
  publicCoachProfileLinks,
  type CoachWebsiteContent,
} from "@/domain/coach-website";
import { WebsiteLinkIcon } from "./website-link-icon";

export function CoachSocialLinks({
  content,
}: {
  content: CoachWebsiteContent;
}) {
  return (
    <div className="coach-website-social-links">
      {publicCoachProfileLinks(content).map((platform) => (
        <a
          key={platform.key}
          href={platform.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WebsiteLinkIcon platform={platform.key} /> {platform.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
    </div>
  );
}
