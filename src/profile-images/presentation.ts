export type AccountProfileImagePresentation = Readonly<{
  imageUrl: string | null;
  source: "account" | "coach" | null;
}>;

export function accountProfileImagePresentation(
  accountAvatarUrl: string | null,
  coachPortraitUrl: string | null,
): AccountProfileImagePresentation {
  if (accountAvatarUrl) {
    return Object.freeze({ imageUrl: accountAvatarUrl, source: "account" });
  }
  if (coachPortraitUrl) {
    return Object.freeze({ imageUrl: coachPortraitUrl, source: "coach" });
  }
  return Object.freeze({ imageUrl: null, source: null });
}
