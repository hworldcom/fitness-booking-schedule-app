import "server-only";
import { sql } from "drizzle-orm";
import {
  EMPTY_COACH_WEBSITE_CONTENT,
  isWebsiteRevision,
  parseCoachWebsiteContent,
  coachBannerUrl,
  COACH_BANNER_VARIANTS,
  type CoachWebsiteCard,
  type CoachWebsiteContent,
} from "@/domain/coach-website";
import { isOwnedProfileImageStoragePath } from "@/profile-images/contracts";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";

type WebsiteRow = {
  profile_id: string;
  public_slug: string;
  revision: number;
  content: unknown;
  card_path: string | null;
  hero_path: string | null;
};
export type WebsiteRecord = Readonly<{
  profileId: string;
  slug: string;
  revision: number;
  content: CoachWebsiteContent;
  cardPath: string | null;
  heroPath: string | null;
}>;
export class CoachWebsiteError extends Error {
  constructor(public readonly status: "conflict" | "invalid" | "forbidden") {
    super("Coach website operation failed.");
  }
}
function mappedError(error: unknown): never {
  let current = error;
  for (
    let depth = 0;
    depth < 6 && current && typeof current === "object";
    depth++
  ) {
    const value = current as {
      code?: string;
      message?: string;
      cause?: unknown;
    };
    if (value.code === "42501") throw new CoachWebsiteError("forbidden");
    if (["22023", "23514"].includes(value.code ?? ""))
      throw new CoachWebsiteError("invalid");
    if (value.code === "P0001" && value.message?.startsWith("coach website"))
      throw new CoachWebsiteError("conflict");
    current = value.cause;
  }
  throw error;
}
function mapRecord(row: WebsiteRow): WebsiteRecord {
  const content = parseCoachWebsiteContent(row.content);
  if (
    !content ||
    !isWebsiteRevision(row.revision) ||
    (row.card_path === null) !== (row.hero_path === null) ||
    (row.card_path !== null &&
      (!isOwnedProfileImageStoragePath(row.card_path, row.profile_id) ||
        !isOwnedProfileImageStoragePath(row.hero_path!, row.profile_id) ||
        row.card_path === row.hero_path))
  )
    throw new Error("Invalid coach website record.");
  return Object.freeze({
    profileId: row.profile_id,
    slug: row.public_slug,
    revision: row.revision,
    content,
    cardPath: row.card_path,
    heroPath: row.hero_path,
  });
}
export async function ownedCoachWebsiteRecord(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
): Promise<WebsiteRecord | null> {
  const rows = await transaction.execute<WebsiteRow>(sql`
    select c.profile_id,c.public_slug,coalesce(w.revision,0) as revision,
      coalesce(w.content,${JSON.stringify(EMPTY_COACH_WEBSITE_CONTENT)}::jsonb) as content,w.card_path,w.hero_path
    from app.coach_profiles c left join app.coach_website_content w on w.run_id=c.run_id and w.profile_id=c.profile_id
    where c.run_id=${actor.runId}::uuid and c.profile_id=${actor.profileId}::uuid
  `);
  if (rows.length > 1) throw new Error("Invalid coach website ownership.");
  return rows[0] ? mapRecord(rows[0]) : null;
}
export async function mutateOwnedCoachWebsiteRecord(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
  expectedRevision: number,
  content: CoachWebsiteContent | null,
  banner?: Readonly<{ cardPath: string | null; heroPath: string | null }>,
) {
  try {
    const rows = await transaction.execute<
      WebsiteRow & {
        previous_card_path: string | null;
        previous_hero_path: string | null;
      }
    >(sql`
      select ${actor.profileId}::text as profile_id,''::text as public_slug,*
      from app.mutate_owned_coach_website(${expectedRevision}::integer,${content ? JSON.stringify(content) : null}::jsonb,
        ${banner?.cardPath ?? null}::text,${banner?.heroPath ?? null}::text,${banner !== undefined}::boolean)
    `);
    if (rows.length !== 1 || !rows[0])
      throw new Error("Missing coach website mutation result.");
    return {
      record: mapRecord(rows[0]),
      previousPaths: [
        rows[0].previous_card_path,
        rows[0].previous_hero_path,
      ].filter((path): path is string => path !== null),
    };
  } catch (error) {
    return mappedError(error);
  }
}
export async function publicCoachWebsiteRecord(
  slug: string,
): Promise<WebsiteRecord | null> {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<WebsiteRow>(
      sql`select * from app.public_coach_website(${slug}::text)`,
    );
    if (rows.length > 1) throw new Error("Invalid public coach website.");
    return rows[0] ? mapRecord(rows[0]) : null;
  });
}
export async function publicCoachWebsiteCards(profileIds: readonly string[]) {
  const cards = new Map<string, CoachWebsiteCard>();
  if (!profileIds.length) return cards;
  await withDatabaseConnection(async ({ db }) => {
    for (let start = 0; start < profileIds.length; start += 100) {
      const ids = profileIds.slice(start, start + 100);
      const rows = await db.execute<Omit<WebsiteRow, "hero_path">>(
        sql`select * from app.public_coach_website_cards(array[${sql.join(
          ids.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}]::uuid[])`,
      );
      for (const row of rows) {
        const content = parseCoachWebsiteContent(row.content);
        if (
          !content ||
          !isWebsiteRevision(row.revision) ||
          (row.card_path &&
            !isOwnedProfileImageStoragePath(row.card_path, row.profile_id))
        )
          throw new Error("Invalid coach website card.");
        cards.set(
          row.profile_id,
          Object.freeze({
            schemaVersion: 1,
            revision: row.revision,
            brandLabel: content.brandLabel,
            introduction: content.introduction,
            focusLabels: content.focusLabels,
            banner: row.card_path
              ? Object.freeze({
                  url: coachBannerUrl(row.public_slug, row.revision, "card"),
                  width: COACH_BANNER_VARIANTS.card.width,
                  height: COACH_BANNER_VARIANTS.card.height,
                })
              : null,
          }),
        );
      }
    }
  });
  return cards;
}
