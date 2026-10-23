import "server-only";
import { randomUUID } from "node:crypto";
import {
  COACH_BANNER_VARIANTS,
  coachBannerUrl,
  isWebsiteRevision,
} from "@/domain/coach-website";
import {
  eventBannerSnapshot,
  eventBannerUrl,
  isEventId,
  type EventBannerResult,
  type EventBanner,
  type EventCardPresentation,
} from "@/domain/event-banners";
import { eventIdFromSlug } from "@/events/parsers";
import { profileImageStoragePath } from "@/profile-images/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import {
  EventBannerError,
  ownedEventBannerRecord,
  mutateEventBannerRecord,
  publicEventMediaRecords,
  type EventBannerRecord,
} from "@/server/db/group-sessions/banner-repository";
import { publicCoachPathsRecord } from "@/server/db/coaches/public-url-repository";
import {
  normalizeCoachBanner,
  InvalidCoachBannerError,
} from "@/server/coaches/banner-normalization";
import {
  cleanupCoachBanner,
  storeAndAttachCoachBanner,
  readCurrentCoachBanner,
} from "@/server/coaches/banner-workflow";
import { profileImageStorage } from "@/server/storage/profile-images";

async function owner<T>(
  id: string,
  work: (
    tx: ActorDatabaseTransaction,
    actor: AuthorizedActor,
    record: EventBannerRecord,
  ) => Promise<T>,
) {
  if (!isEventId(id)) return { status: "invalid" as const };
  try {
    const result = await withAuthorizedActor(
      async (tx, actor) =>
        work(tx, actor, await ownedEventBannerRecord(tx, id)),
      { rethrow: (error) => error instanceof EventBannerError },
    );
    return result.status === "authorized"
      ? result.value
      : {
          status:
            result.status === "preview"
              ? ("forbidden" as const)
              : result.status,
        };
  } catch (error) {
    return error instanceof EventBannerError
      ? { status: error.status }
      : { status: "unavailable" as const };
  }
}
const snapshot = (record: EventBannerRecord) =>
  eventBannerSnapshot(
    record.session_id,
    record.revision,
    record.editable,
    record.card_path !== null,
  );
export async function currentEventBanner(
  id: string,
): Promise<EventBannerResult> {
  return owner(id, async (_tx, _actor, record) => ({
    status: "ready" as const,
    eventBanner: snapshot(record),
  }));
}
export async function uploadEventBanner(
  id: string,
  bytes: Uint8Array,
  revision: number,
): Promise<EventBannerResult> {
  if (!isWebsiteRevision(revision)) return { status: "invalid" };
  const before = await owner(id, async (_tx, actor, record) => ({
    status: "ready" as const,
    actor,
    record,
  }));
  if (before.status !== "ready") return before;
  if (!before.record.editable || before.record.revision !== revision)
    return { status: "conflict" };
  let normalized: Awaited<ReturnType<typeof normalizeCoachBanner>>;
  try {
    normalized = await normalizeCoachBanner(bytes);
  } catch (error) {
    return {
      status:
        error instanceof InvalidCoachBannerError ? "invalid" : "unavailable",
    };
  }
  const variants = (["card", "hero"] as const).map((variant) => ({
    path: profileImageStoragePath(before.actor.profileId, randomUUID()),
    bytes: normalized[variant],
  }));
  const result = await storeAndAttachCoachBanner<EventBanner>(
    profileImageStorage,
    variants,
    async () =>
      owner(id, async (tx, actor) => {
        if (
          actor.profileId !== before.actor.profileId ||
          actor.runId !== before.actor.runId ||
          actor.authUserId !== before.actor.authUserId
        )
          return { status: "forbidden" as const };
        const saved = await mutateEventBannerRecord(tx, id, revision, {
          cardPath: variants[0].path,
          heroPath: variants[1].path,
        });
        return {
          status: "saved" as const,
          value: snapshot(saved.record),
          previousPaths: saved.previousPaths,
        };
      }),
    "event-banner",
  );
  return result.status === "saved"
    ? {
        status: "saved",
        eventBanner: result.value,
        cleanupPending: result.cleanupPending,
      }
    : result;
}
export async function removeEventBanner(
  id: string,
  revision: number,
): Promise<EventBannerResult> {
  if (!isWebsiteRevision(revision)) return { status: "invalid" };
  const result = await owner(id, async (tx) => {
    const saved = await mutateEventBannerRecord(tx, id, revision, null);
    return {
      status: "saved" as const,
      eventBanner: snapshot(saved.record),
      paths: saved.previousPaths,
    };
  });
  if (result.status !== "saved") return result;
  return {
    status: "saved",
    eventBanner: result.eventBanner,
    cleanupPending: await cleanupCoachBanner(
      profileImageStorage,
      result.paths,
      "event-banner",
    ),
  };
}
export async function eventBannerBytes(
  idOrSlug: string,
  variant: "card" | "hero",
  revision: number,
  publicRead: boolean,
) {
  const id = publicRead ? eventIdFromSlug(idOrSlug) : idOrSlug;
  if (!id || !isEventId(id) || !isWebsiteRevision(revision))
    return { status: "not-found" as const };
  return readCurrentCoachBanner(
    revision,
    async () => {
      if (!publicRead)
        return owner(id, async (_tx, _actor, record) => ({
          status: "ready" as const,
          revision: record.revision,
          path: variant === "card" ? record.card_path : record.hero_path,
        }));
      const row = (await publicEventMediaRecords([id]))[0];
      return row
        ? {
            status: "ready" as const,
            revision: row.event_revision,
            path:
              variant === "card" ? row.event_card_path : row.event_hero_path,
          }
        : { status: "not-found" as const };
    },
    profileImageStorage,
    "event-banner",
  );
}
export async function publicEventPresentations(ids: readonly string[]) {
  try {
    const rows = await publicEventMediaRecords(ids);
    const paths = await publicCoachPathsRecord(rows.map((r) => r.coach_slug));
    const presentations = new Map<string, EventCardPresentation>();
    for (const r of rows) {
      const portraitUrl =
        r.portrait_source && r.portrait_path && r.portrait_updated_at
          ? profileImageStorage.publicPortraitUrl({
              source: r.portrait_source,
              path: r.portrait_path,
              updatedAt: new Date(r.portrait_updated_at).toISOString(),
            })
          : null;
      if (r.portrait_source === "storage" && !portraitUrl)
        throw new Error("Public portrait configuration unavailable.");
      const dimensions = COACH_BANNER_VARIANTS.card;
      presentations.set(r.session_id, {
        coachHref:
          paths.get(r.coach_slug) ??
          `/coaches/${encodeURIComponent(r.coach_slug)}`,
        portraitUrl,
        eventBanner: r.event_card_path
          ? {
              url: eventBannerUrl(r.session_id, "card", r.event_revision, true),
              width: dimensions.width,
              height: dimensions.height,
            }
          : null,
        coachBanner: r.coach_card_path
          ? {
              url: coachBannerUrl(r.coach_slug, r.coach_revision, "card"),
              width: dimensions.width,
              height: dimensions.height,
            }
          : null,
      });
    }
    return { status: "ready" as const, presentations };
  } catch {
    return { status: "unavailable" as const };
  }
}
