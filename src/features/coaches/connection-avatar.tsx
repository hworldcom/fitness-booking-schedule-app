"use client";

import { useSyncExternalStore } from "react";
import { profileInitials } from "@/auth/profile-presentation";
import { Avatar } from "@/components/ui";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ConnectionAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string | null;
}) {
  // A cold private image can fail before SSR hydration installs onError.
  // Initials match server/client hydration; mount the image with ready handlers.
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  return (
    <Avatar
      initials={profileInitials(name)}
      color="blue"
      imageUrl={mounted ? imageUrl : null}
      alt=""
    />
  );
}
