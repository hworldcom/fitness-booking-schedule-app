import type { CoachProjection } from "@/domain/coaches";

export type CoachPortraitOverride = {
  profileId: string;
  baseImageUrl: string | null;
  imageUrl: string | null;
};

/** A local mutation result expires when the server supplies a newer image or owner. */
export function coachWithPortraitOverride<
  T extends Pick<CoachProjection, "profileId" | "portraitUrl">,
>(coach: T | null, override: CoachPortraitOverride | null) {
  return coach &&
    override?.profileId === coach.profileId &&
    override.baseImageUrl === coach.portraitUrl
    ? { ...coach, portraitUrl: override.imageUrl }
    : coach;
}
