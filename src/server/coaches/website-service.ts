import "server-only";
import { randomUUID } from "node:crypto";
import {
  isWebsiteRecord,
  isWebsiteRevision,
  parseCoachWebsiteContent,
  projectCoachWebsite,
  type CoachBannerVariant,
  type CoachWebsiteResult,
  type CoachWebsiteFailure,
  type CoachWebsite,
} from "@/domain/coach-website";
import { isCoachPublicSlug } from "@/domain/coaches";
import { profileImageStoragePath } from "@/profile-images/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import {
  currentActorProjection,
  type ActorDatabaseTransaction,
} from "@/server/db/authorization/repository";
import {
  CoachWebsiteError,
  ownedCoachWebsiteRecord,
  mutateOwnedCoachWebsiteRecord,
  publicCoachWebsiteRecord,
  type WebsiteRecord,
} from "@/server/db/coaches/website-repository";
import { profileImageStorage } from "@/server/storage/profile-images";
import {
  InvalidCoachBannerError,
  normalizeCoachBanner,
} from "./banner-normalization";
import {
  cleanupCoachBanner,
  readCurrentCoachBanner,
  storeAndAttachCoachBanner,
} from "./banner-workflow";

async function ownerWork<T>(
  work: (
    transaction: ActorDatabaseTransaction,
    actor: AuthorizedActor,
    record: WebsiteRecord,
  ) => Promise<T>,
): Promise<T | CoachWebsiteFailure> {
  try {
    const result = await withAuthorizedActor(
      async (transaction, actor) => {
        const projection = await currentActorProjection(transaction, actor);
        if (
          !["pending", "approved", "rejected", "demo"].includes(
            projection.coachAccess.status,
          )
        )
          return { status: "forbidden" as const };
        const record = await ownedCoachWebsiteRecord(transaction, actor);
        if (!record) return { status: "forbidden" as const };
        return work(transaction, actor, record);
      },
      { rethrow: (error) => error instanceof CoachWebsiteError },
    );
    if (result.status === "authorized") return result.value;
    return {
      status:
        result.status === "preview" ? ("forbidden" as const) : result.status,
    };
  } catch (error) {
    // Translate only after rollback; swallowing a SQL error inside a transaction
    // leaves it aborted and incorrectly turns a normal stale save into a 503.
    if (error instanceof CoachWebsiteError) return { status: error.status };
    throw error;
  }
}
function project(record: WebsiteRecord, publicRead = false) {
  return projectCoachWebsite(
    record.content,
    record.revision,
    record.cardPath !== null,
    publicRead ? record.slug : null,
    publicRead ? record.startingRate : undefined,
  );
}
export async function currentCoachWebsite(): Promise<CoachWebsiteResult> {
  return ownerWork(async (_transaction, _actor, record) => ({
    status: "ready" as const,
    website: project(record),
  }));
}
export async function saveCoachWebsite(
  input: unknown,
): Promise<CoachWebsiteResult> {
  if (
    !isWebsiteRecord(input) ||
    Object.keys(input).some(
      (key) => !["schemaVersion", "expectedRevision", "content"].includes(key),
    ) ||
    input.schemaVersion !== 1 ||
    !isWebsiteRevision(input.expectedRevision)
  )
    return { status: "invalid" };
  const content = parseCoachWebsiteContent(input.content);
  if (!content) return { status: "invalid" };
  const revision = input.expectedRevision;
  return ownerWork(async (transaction, actor) => {
    const saved = await mutateOwnedCoachWebsiteRecord(
      transaction,
      actor,
      revision,
      content,
    );
    return { status: "saved" as const, website: project(saved.record) };
  });
}
export async function publicCoachWebsite(
  slug: string,
): Promise<CoachWebsiteResult> {
  if (!isCoachPublicSlug(slug)) return { status: "not-found" };
  try {
    const record = await publicCoachWebsiteRecord(slug);
    return record
      ? { status: "ready", website: project(record, true) }
      : { status: "not-found" };
  } catch {
    return { status: "unavailable" };
  }
}
export async function uploadCoachWebsiteBanner(
  bytes: Uint8Array,
  expectedRevision: number,
): Promise<CoachWebsiteResult> {
  if (!isWebsiteRevision(expectedRevision)) return { status: "invalid" };
  const initial = await ownerWork(async (_transaction, actor, record) => ({
    status: "ready" as const,
    actor,
    record,
  }));
  if (initial.status !== "ready") return initial;
  if (initial.record.revision !== expectedRevision)
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
    variant,
    path: profileImageStoragePath(initial.actor.profileId, randomUUID()),
    bytes: normalized[variant],
  }));
  const result = await storeAndAttachCoachBanner<CoachWebsite>(
    profileImageStorage,
    variants,
    async () =>
      ownerWork(async (transaction, actor) => {
        if (
          actor.profileId !== initial.actor.profileId ||
          actor.runId !== initial.actor.runId
        )
          return { status: "forbidden" as const };
        const saved = await mutateOwnedCoachWebsiteRecord(
          transaction,
          actor,
          expectedRevision,
          null,
          { cardPath: variants[0].path, heroPath: variants[1].path },
        );
        return {
          status: "saved" as const,
          value: project(saved.record),
          previousPaths: saved.previousPaths,
        };
      }),
  );
  return result.status === "saved"
    ? {
        status: "saved",
        website: result.value,
        cleanupPending: result.cleanupPending,
      }
    : result;
}
export async function removeCoachWebsiteBanner(
  expectedRevision: number,
): Promise<CoachWebsiteResult> {
  if (!isWebsiteRevision(expectedRevision)) return { status: "invalid" };
  const result = await ownerWork(async (transaction, actor) => {
    const saved = await mutateOwnedCoachWebsiteRecord(
      transaction,
      actor,
      expectedRevision,
      null,
      { cardPath: null, heroPath: null },
    );
    return {
      status: "saved" as const,
      value: project(saved.record),
      paths: saved.previousPaths,
    };
  });
  if (result.status !== "saved") return result;
  const cleanupPending = await cleanupCoachBanner(
    profileImageStorage,
    result.paths,
  );
  return { status: "saved", website: result.value, cleanupPending };
}

export async function coachWebsiteBannerBytes(
  slug: string | null,
  variant: CoachBannerVariant,
  revision: number,
) {
  if (
    !isWebsiteRevision(revision) ||
    (slug !== null && !isCoachPublicSlug(slug))
  )
    return { status: "not-found" as const };
  const reference = () =>
    slug === null
      ? ownerWork(async (_transaction, _actor, record) => ({
          status: "ready" as const,
          record,
        }))
      : publicCoachWebsiteRecord(slug).then((record) =>
          record
            ? { status: "ready" as const, record }
            : { status: "not-found" as const },
        );
  return readCurrentCoachBanner(
    revision,
    async () => {
      const result = await reference();
      if (result.status !== "ready") return result;
      return {
        status: "ready",
        revision: result.record.revision,
        path:
          variant === "card" ? result.record.cardPath : result.record.heroPath,
      };
    },
    profileImageStorage,
  );
}
