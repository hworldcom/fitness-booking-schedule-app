export const COACH_POST_PAGE_SIZE = 20;
export const COACH_POST_MAX_LENGTH = 500;

export type CoachPostVisibility = "visible" | "hidden";

export type CoachPost = Readonly<{
  id: string;
  coachProfileId: string;
  coachSlug: string;
  coachDisplayName: string;
  body: string;
  visibility: CoachPostVisibility;
  publishedAt: string;
  recordSource: "fixture" | "user";
}>;

export type CoachPostCursor = Readonly<{
  publishedAt: string;
  id: string;
}>;

export type CoachPostPage = Readonly<{
  posts: readonly CoachPost[];
  nextCursor: string | null;
}>;

export type CoachFollowState =
  | Readonly<{
      status: "authorized";
      following: boolean;
      isOwnProfile: boolean;
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type FollowingFeedState =
  | Readonly<{ status: "authorized"; page: CoachPostPage }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type CoachPostEditorState =
  | Readonly<{
      status: "authorized";
      coach: Readonly<{ slug: string; visible: boolean }> | null;
      posts: readonly CoachPost[];
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type PublicCoachPostsState =
  | Readonly<{ status: "ready"; posts: readonly CoachPost[] }>
  | Readonly<{ status: "unavailable" }>;

export type CoachPostInputResult =
  | Readonly<{ valid: true; body: string }>
  | Readonly<{ valid: false; message: string }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCoachSocialId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function validateCoachPostBody(value: unknown): CoachPostInputResult {
  const body =
    typeof value === "string" ? value.trim().replaceAll(/\s+/g, " ") : "";
  if (body.length < 1 || body.length > COACH_POST_MAX_LENGTH) {
    return Object.freeze({
      valid: false,
      message: `Post text must be between 1 and ${COACH_POST_MAX_LENGTH} characters.`,
    });
  }
  return Object.freeze({ valid: true, body });
}

export function encodeCoachPostCursor(
  post: Pick<CoachPost, "publishedAt" | "id">,
) {
  return `${post.publishedAt}~${post.id}`;
}

export function parseCoachPostCursor(value: unknown): CoachPostCursor | null {
  if (typeof value !== "string" || value.length > 80) return null;
  const separator = value.lastIndexOf("~");
  if (separator < 1) return null;
  const publishedAt = value.slice(0, separator);
  const id = value.slice(separator + 1);
  const timestamp = new Date(publishedAt);
  if (
    !UUID_PATTERN.test(id) ||
    Number.isNaN(timestamp.valueOf()) ||
    timestamp.toISOString() !== publishedAt
  ) {
    return null;
  }
  return Object.freeze({ publishedAt, id });
}

export function isCoachPostVisibility(
  value: unknown,
): value is CoachPostVisibility {
  return value === "visible" || value === "hidden";
}
