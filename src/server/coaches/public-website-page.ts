import "server-only";
import { cache } from "react";
import type { Metadata } from "next";
import { publicSiteOrigin } from "@/server/auth/site-origin";
import { publicCoachProfile } from "./service";
import {
  publicWebsiteIdentity,
  loadCoachPublicGroups,
} from "@/features/coaches/website/public-website-model";
import { publicGroupSessions } from "@/server/group-sessions/service";

// React cache is request-scoped: metadata and page agree without caching publication changes.
export const publicWebsiteProfile = cache(publicCoachProfile);
export const publicWebsiteOrigin = publicSiteOrigin;
export async function publicCoachWebsiteMetadata(
  slug: string,
): Promise<Metadata> {
  const state = await publicWebsiteProfile(slug);
  if (state.status !== "ready")
    return {
      title: "Coach profile unavailable",
      robots: { index: false, follow: false },
    };
  const identity = publicWebsiteIdentity(
    state.coach,
    state.website,
    publicWebsiteOrigin(),
  );
  return {
    title: identity.title,
    description: identity.description,
    ...(identity.url ? { alternates: { canonical: identity.url } } : {}),
    openGraph: {
      title: identity.title,
      description: identity.description,
      type: "profile",
      ...(identity.url ? { url: identity.url } : {}),
      images: identity.image
        ? [{ url: identity.image, alt: `${state.coach.displayName} coaching` }]
        : [],
    },
    twitter: {
      card: identity.image ? "summary_large_image" : "summary",
      title: identity.title,
      description: identity.description,
      images: identity.image ? [identity.image] : [],
    },
  };
}
export async function publicCoachWebsiteGroups(slug: string) {
  return loadCoachPublicGroups(slug, async (after) => {
    const result = await publicGroupSessions({
      action: "list",
      args: { after },
    });
    return result.status === "ready" && "items" in result.value
      ? result.value
      : null;
  });
}
