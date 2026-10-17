import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import {
  EMPTY_COACH_WEBSITE_CONTENT,
  parseCoachWebsiteContent,
} from "@/domain/coach-website";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  ownedCoachWebsiteRecord,
  mutateOwnedCoachWebsiteRecord,
  publicCoachWebsiteRecord,
  publicCoachWebsiteCards,
  CoachWebsiteError,
} from "@/server/db/coaches/website-repository";

const connection = process.env.DATABASE_TEST_URL;
const isolated =
  connection && new URL(connection).pathname.startsWith("/dev0321_");
test(
  "website migrations, owner/dataset/public boundaries, atomic revisions and private banner policies",
  { skip: !isolated },
  async (t) => {
    const admin = postgres(connection!, {
      max: 1,
      prepare: false,
      ssl: false,
      onnotice: () => {},
    });
    const runtimeUrl = new URL(connection!);
    runtimeUrl.username = "repx_runtime_login";
    runtimeUrl.password = "postgres";
    process.env.DATABASE_URL = runtimeUrl.toString();
    const runtime = postgres(runtimeUrl.toString(), {
      max: 1,
      prepare: false,
      ssl: false,
    });
    const people: AuthorizedActor[] = [];
    let slug = "";
    const work = <T>(
      actor: AuthorizedActor,
      fn: Parameters<typeof withActorDatabaseContext<T>>[1],
    ) => withActorDatabaseContext(actor, fn);
    try {
      for (let i = 1; i <= 3; i++) {
        const id = `93210000-0000-4000-8000-${String(i).padStart(12, "0")}`;
        await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
        const enrolled = await enrollApplicationProfile(
          id,
          `Website Coach ${i}`,
        );
        assert.ok(enrolled);
        const actor: AuthorizedActor = {
          authUserId: id,
          profileId: enrolled.profileId,
          runId: enrolled.runId,
          runRole: "member",
        };
        people.push(actor);
        await work(actor, submitOwnedCoachApplicationRecord);
        const ownSlug = await work(actor, (tx) =>
          upsertOwnedCoachProfileRecord(tx, {
            displayName: `Website Coach ${i}`,
            bio: "Private training with a deliberate and supportive approach for developing athletes.",
            disciplines: ["Boxing"],
            timezone: "Europe/Berlin",
            visibility: "hidden",
            selectedGymId: "40000000-0000-4000-8000-000000000001",
            independentLocation: null,
          }),
        );
        if (i === 1) slug = ownSlug;
      }
      const [owner, other, pending] = people;
      const content = parseCoachWebsiteContent({
        brandLabel: "Example Boxing",
        introduction: "Personal coaching",
        experience: "Coach-supplied claim",
        focusLabels: ["Beginner"],
        faqs: [{ question: "Where?", answer: "At the listed venue." }],
        links: [{ label: "Site", url: "https://example.com/" }],
      })!;
      await t.test(
        "old profiles need no content row; hidden drafts are exact-owner and direct writes are denied",
        async () => {
          const existing = await work(owner, (tx) =>
            ownedCoachWebsiteRecord(tx, owner),
          );
          assert.equal(existing?.revision, 0);
          assert.deepEqual(existing?.content, EMPTY_COACH_WEBSITE_CONTENT);
          assert.equal(await publicCoachWebsiteRecord(slug), null);
          await work(owner, (tx) =>
            mutateOwnedCoachWebsiteRecord(tx, owner, 0, content),
          );
          assert.equal(
            (
              await runtime`select * from app.coach_website_content where profile_id=${owner.profileId}::uuid`
            ).length,
            0,
          );
          assert.equal(
            (
              await work(other, (tx) =>
                tx.execute(
                  sql`select * from app.coach_website_content where profile_id=${owner.profileId}::uuid`,
                ),
              )
            ).length,
            0,
          );
          await assert.rejects(
            runtime`update app.coach_website_content set revision=9`,
            /permission denied/,
          );
          await assert.rejects(
            work(
              { ...owner, runId: "10000000-0000-4000-8000-000000000099" },
              (tx) => ownedCoachWebsiteRecord(tx, owner),
            ),
            /no longer authorized/,
          );
          assert.equal(await publicCoachWebsiteRecord(slug), null);
        },
      );
      await t.test(
        "database content constraints reject injected fields, unsafe links and overlong nested content",
        async () => {
          for (const invalid of [
            { ...content, brandLabel: "x".repeat(81) },
            { ...content, approach: "<b>html</b>" },
            {
              ...content,
              links: [{ label: "Bad", url: "javascript:alert(1)" }],
            },
            { ...content, faqs: [{ question: "Q", answer: "x".repeat(1001) }] },
            { ...content, privateAvatar: "secret" },
          ]) {
            assert.equal(
              (
                await admin`select app.valid_coach_website_content(${JSON.stringify(invalid)}::jsonb) valid`
              )[0].valid,
              false,
            );
          }
          await assert.rejects(
            work(owner, (tx) =>
              tx.execute(
                sql`select * from app.mutate_owned_coach_website(1,'{"bad":"value"}'::jsonb,null,null,false)`,
              ),
            ),
            (error: unknown) =>
              error instanceof Error &&
              error.cause instanceof Error &&
              /coach website invalid/.test(error.cause.message),
          );
        },
      );
      await t.test(
        "simultaneous writes have one winner; pending/rejected can draft and suspension blocks writes",
        async () => {
          const results = await Promise.allSettled(
            [1, 2].map(() =>
              work(owner, (tx) =>
                mutateOwnedCoachWebsiteRecord(tx, owner, 1, content),
              ),
            ),
          );
          assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1,
          );
          const failure = results.find(
            (result) => result.status === "rejected",
          );
          assert.ok(
            failure?.status === "rejected" &&
              failure.reason instanceof CoachWebsiteError &&
              failure.reason.status === "conflict",
          );
          await work(pending, (tx) =>
            mutateOwnedCoachWebsiteRecord(tx, pending, 0, content),
          );
          await admin`select app.review_coach_application(${pending.profileId}::uuid,'pending','rejected','Test rejection.','database-test','movx-identity-application-v1')`;
          await work(pending, (tx) =>
            mutateOwnedCoachWebsiteRecord(tx, pending, 1, content),
          );
          await admin`select app.review_coach_application(${owner.profileId}::uuid,'pending','approved','Test approval.','database-test','movx-identity-application-v1')`;
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
          assert.equal(
            (await publicCoachWebsiteRecord(slug))?.content.brandLabel,
            content.brandLabel,
          );
          const cards = await publicCoachWebsiteCards([
            owner.profileId,
            pending.profileId,
          ]);
          assert.equal(cards.size, 1);
          assert.deepEqual(Object.keys(cards.get(owner.profileId)!).sort(), [
            "banner",
            "brandLabel",
            "focusLabels",
            "introduction",
            "revision",
            "schemaVersion",
          ]);
        },
      );
      const card = `${owner.profileId}/93210000-0000-4000-8000-000000000101.webp`,
        hero = `${owner.profileId}/93210000-0000-4000-8000-000000000102.webp`;
      await t.test(
        "missing/cross-owner assets cannot attach and only current public variants pass Storage RLS",
        async () => {
          await assert.rejects(
            work(owner, (tx) =>
              mutateOwnedCoachWebsiteRecord(tx, owner, 2, null, {
                cardPath: card,
                heroPath: hero,
              }),
            ),
            (error: unknown) =>
              error instanceof CoachWebsiteError && error.status === "invalid",
          );
          await admin`insert into storage.objects(bucket_id,name,metadata) values('coach-banners',${card},'{"mimetype":"image/webp","size":100}'::jsonb),('coach-banners',${hero},'{"mimetype":"image/webp","size":200}'::jsonb)`;
          await assert.rejects(
            work(other, (tx) =>
              mutateOwnedCoachWebsiteRecord(tx, other, 0, null, {
                cardPath: card,
                heroPath: hero,
              }),
            ),
            (error: unknown) =>
              error instanceof CoachWebsiteError && error.status === "invalid",
          );
          const saved = await work(owner, (tx) =>
            mutateOwnedCoachWebsiteRecord(tx, owner, 2, null, {
              cardPath: card,
              heroPath: hero,
            }),
          );
          assert.equal(saved.record.revision, 3);
          const anon = async () =>
            admin.begin(async (tx) => {
              await tx`set local role anon`;
              return tx`select name from storage.objects where bucket_id='coach-banners'`;
            });
          assert.equal((await anon()).length, 2);
          await assert.rejects(
            admin.begin(async (tx) => {
              await tx`set local role anon`;
              return tx`select app.storage_website_banner_is_current(${card},false)`;
            }),
            /permission denied/,
          );
          const deleted = await admin.begin(async (tx) => {
            // This isolated database contains metadata-only fixtures. Match the
            // Storage API's delete-query guard to exercise RLS without real files.
            await tx`select set_config('storage.allow_delete_query','true',true)`;
            await tx`set local role authenticated`;
            await tx`select set_config('request.jwt.claim.sub',${owner.authUserId},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner.authUserId, role: "authenticated" })},true)`;
            return tx`delete from storage.objects where bucket_id='coach-banners' and name=${card} returning name`;
          });
          assert.equal(
            deleted.length,
            0,
            "Current referenced objects cannot be deleted through Storage.",
          );
          await admin`update app.coach_profiles set visibility='hidden' where profile_id=${owner.profileId}::uuid`;
          assert.equal((await anon()).length, 0);
          assert.equal(await publicCoachWebsiteRecord(slug), null);
          const removed = await work(owner, (tx) =>
            mutateOwnedCoachWebsiteRecord(tx, owner, 3, null, {
              cardPath: null,
              heroPath: null,
            }),
          );
          assert.deepEqual(removed.previousPaths, [card, hero]);
          await assert.rejects(
            work(owner, (tx) =>
              mutateOwnedCoachWebsiteRecord(tx, owner, 3, content),
            ),
            (error: unknown) =>
              error instanceof CoachWebsiteError && error.status === "conflict",
          );
        },
      );
      await t.test(
        "attachment and Storage cleanup serialize in both commit orders",
        async () => {
          const raceCard = `${owner.profileId}/93210000-0000-4000-8000-000000000201.webp`;
          const raceHero = `${owner.profileId}/93210000-0000-4000-8000-000000000202.webp`;
          await admin`insert into storage.objects(bucket_id,name,metadata) values('coach-banners',${raceCard},'{"mimetype":"image/webp","size":100}'::jsonb),('coach-banners',${raceHero},'{"mimetype":"image/webp","size":200}'::jsonb)`;
          let reached!: () => void, release!: () => void;
          const attached = new Promise<void>((resolve) => {
            reached = resolve;
          });
          const hold = new Promise<void>((resolve) => {
            release = resolve;
          });
          const attaching = work(owner, async (tx) => {
            const value = await mutateOwnedCoachWebsiteRecord(
              tx,
              owner,
              4,
              null,
              { cardPath: raceCard, heroPath: raceHero },
            );
            reached();
            await hold;
            return value;
          });
          const remove = () =>
            admin.begin(async (tx) => {
              await tx`select set_config('storage.allow_delete_query','true',true)`;
              await tx`set local role authenticated`;
              await tx`select set_config('request.jwt.claim.sub',${owner.authUserId},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner.authUserId, role: "authenticated" })},true)`;
              return tx`delete from storage.objects where bucket_id='coach-banners' and name in (${raceCard},${raceHero}) returning name`;
            });
          let deletion: ReturnType<typeof remove> | undefined;
          try {
            await Promise.race([attached, attaching]);
            let finished = false;
            deletion = remove().then((value) => {
              finished = true;
              return value;
            });
            await new Promise((resolve) => setTimeout(resolve, 80));
            assert.equal(
              finished,
              false,
              "Cleanup must wait for attachment outcome.",
            );
          } finally {
            release();
          }
          await attaching;
          assert.equal((await deletion!).length, 0);
          await work(owner, (tx) =>
            mutateOwnedCoachWebsiteRecord(tx, owner, 5, null, {
              cardPath: null,
              heroPath: null,
            }),
          );

          let deletedSignal!: () => void, commitDelete!: () => void;
          const deleted = new Promise<void>((resolve) => {
            deletedSignal = resolve;
          });
          const holdDelete = new Promise<void>((resolve) => {
            commitDelete = resolve;
          });
          const removing = admin.begin(async (tx) => {
            await tx`select set_config('storage.allow_delete_query','true',true)`;
            await tx`set local role authenticated`;
            await tx`select set_config('request.jwt.claim.sub',${owner.authUserId},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner.authUserId, role: "authenticated" })},true)`;
            const value =
              await tx`delete from storage.objects where bucket_id='coach-banners' and name in (${raceCard},${raceHero}) returning name`;
            deletedSignal();
            await holdDelete;
            return value;
          });
          let secondAttachment: typeof attaching | undefined;
          try {
            await Promise.race([deleted, removing]);
            let finished = false;
            secondAttachment = work(owner, (tx) =>
              mutateOwnedCoachWebsiteRecord(tx, owner, 6, null, {
                cardPath: raceCard,
                heroPath: raceHero,
              }),
            ).then(
              (value) => {
                finished = true;
                return value;
              },
              (error) => {
                finished = true;
                throw error;
              },
            );
            await new Promise((resolve) => setTimeout(resolve, 80));
            assert.equal(finished, false);
          } finally {
            commitDelete();
          }
          assert.equal((await removing).length, 2);
          await assert.rejects(
            secondAttachment!,
            (error) =>
              error instanceof CoachWebsiteError && error.status === "invalid",
          );
          assert.equal(
            (await work(owner, (tx) => ownedCoachWebsiteRecord(tx, owner)))
              ?.revision,
            6,
          );
        },
      );
      await t.test(
        "suspension, retired datasets and inactive venues revoke public access",
        async () => {
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
          await admin`update app.gyms set status='inactive' where id='40000000-0000-4000-8000-000000000001'::uuid`;
          assert.equal(await publicCoachWebsiteRecord(slug), null);
          await admin`update app.gyms set status='active' where id='40000000-0000-4000-8000-000000000001'::uuid`;
          await admin`update app.demo_runs set status='retired',retired_at=clock_timestamp() where id=${owner.runId}::uuid`;
          assert.equal(await publicCoachWebsiteRecord(slug), null);
          await admin`update app.demo_runs set status='active',retired_at=null where id=${owner.runId}::uuid`;
          await admin`select app.review_coach_application(${owner.profileId}::uuid,'approved','suspended','Test suspension.','database-test','movx-identity-application-v1')`;
          assert.equal(await publicCoachWebsiteRecord(slug), null);
          await assert.rejects(
            work(owner, (tx) =>
              mutateOwnedCoachWebsiteRecord(tx, owner, 6, content),
            ),
            (error: unknown) =>
              error instanceof CoachWebsiteError &&
              error.status === "forbidden",
          );
          // The public predicate uses the existing venue and active-public dataset gates.
          const [predicate] =
            await admin`select app.coach_website_is_public(${owner.runId}::uuid,${pending.profileId}::uuid) valid`;
          assert.equal(predicate.valid, false);
        },
      );
    } finally {
      await runtime.end();
      await admin.end();
    }
  },
);
