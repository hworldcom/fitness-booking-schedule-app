import {
  parseCoachStartingRateText,
  publicCoachStartingRate,
} from "@/domain/coach-starting-rate";
import {
  EMPTY_COACH_WEBSITE_CONTENT,
  type CoachWebsite,
} from "@/domain/coach-website";
import type { CoachWebsiteEditorSnapshot } from "./coach-website-editor";

/** Only opted-in rates can enter the visitor-shaped projection, including drafts. */
export function profilePreviewWebsite(
  snapshot: CoachWebsiteEditorSnapshot | null,
  savedOnly: boolean,
  initial?: CoachWebsite,
): CoachWebsite {
  const saved = snapshot?.content.saved ?? initial;
  const rate = snapshot?.rate;
  const amount =
    !savedOnly && rate?.editing && rate.draft
      ? parseCoachStartingRateText(rate.draft.amount)
      : rate?.saved;
  const disclosed =
    !savedOnly && rate?.editing
      ? rate.draft?.showPublicly
      : rate?.saved?.showPublicly;
  return {
    schemaVersion: 1,
    revision: saved?.revision ?? 0,
    banner: saved?.banner ?? null,
    content:
      !savedOnly && snapshot?.content.editing && snapshot.content.draft
        ? snapshot.content.draft
        : (saved?.content ?? EMPTY_COACH_WEBSITE_CONTENT),
    ...(amount?.amountCents != null && disclosed
      ? { startingRate: publicCoachStartingRate(amount.amountCents) }
      : !rate && initial?.startingRate
        ? { startingRate: initial.startingRate }
        : {}),
  };
}
