import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  !/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov117_[a-z0-9_]+$/.test(
    url,
  )
)
  throw Error("Use the MOV-117 owned scratch database rehearsal.");
class Rollback extends Error {}

test("message profile links retain authenticated basic identity without connection authority", async (t) => {
  const db = postgres(url, { max: 1, ssl: false, onnotice: () => {} });
  try {
    await db
      .begin(async (tx) => {
        const actors = [];
        for (let i = 0; i < 3; i++) {
          const authId = randomUUID();
          await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${authId}::uuid,false,false)`;
          const [p] =
            await tx`select * from app.enroll_application_identity(${authId}::uuid,${"Profile link fixture " + i})`;
          actors.push({
            authId,
            id: String(p.identity_profile_id),
            run: String(p.identity_run_id),
          });
        }
        const [coach, athlete, outsider] = actors;
        async function source(
          a: typeof coach,
          query: string,
          args: postgres.JSONValue[] = [],
        ) {
          return tx.savepoint(async (s) => {
            await s.unsafe("set local role app_runtime");
            await s`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
            return s.unsafe(query, args);
          });
        }
        async function command(
          a: typeof coach,
          action: string,
          args: object = {},
        ) {
          return (
            await source(a, "select app.message_command($1,$2::jsonb) result", [
              action,
              args as postgres.JSONValue,
            ])
          )[0].result;
        }
        await source(coach, "select app.submit_owned_coach_application()");
        await source(
          coach,
          "select app.save_owned_coach_application_contact(0,$1::jsonb)",
          [
            {
              phoneNumber: "+4915112345678",
              instagramUrl: null,
              facebookUrl: null,
              linkedinUrl: null,
            },
          ],
        );
        await source(
          coach,
          "select app.upsert_owned_coach_profile('Profile link coach','Focused private boxing practice with clear session preparation for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)",
        );
        await tx.unsafe("reset role");
        await tx`select app.review_coach_application(${coach.id}::uuid,'pending','approved','Isolated MOV-117 fixture approval.','database-test','movx-identity-application-v1')`;
        await tx`update app.coach_profiles set visibility='visible' where profile_id=${coach.id}::uuid`;
        const [profile] =
          await tx`select public_slug from app.coach_profiles where profile_id=${coach.id}::uuid`;
        const saved = await command(athlete, "inquire", {
          coachId: coach.id,
          body: "Fixture profile navigation inquiry",
          submissionId: randomUUID(),
        });
        const conversationId = saved.conversationId;
        const thread = (a: typeof coach) =>
          command(a, "thread", { conversationId });
        const profileFor = (viewer: typeof coach, id: string) =>
          source(viewer, "select * from app.current_member_profile($1::uuid)", [
            id,
          ]);
        await t.test(
          "any active member can read another member without booking, conversation or connection",
          async () => {
            const result = await profileFor(outsider, athlete.id);
            assert.equal(result.length, 1);
            assert.deepEqual(
              Object.keys(result[0]).sort(),
              [
                "profile_id",
                "display_name",
                "avatar_storage_path",
                "avatar_updated_at",
              ].sort(),
            );
            assert.equal(result[0].profile_id, athlete.id);
            assert.equal((await profileFor(athlete, outsider.id)).length, 1);
            assert.equal((await profileFor(coach, coach.id)).length, 1);
          },
        );
        await t.test(
          "plain chat links athlete to member profile; eligible coach keeps public website",
          async () => {
            assert.equal(
              (await thread(coach)).conversation.counterpartProfileHref,
              `/members/${athlete.id}`,
            );
            assert.equal(
              (await thread(athlete)).conversation.counterpartProfileHref,
              `/coaches/${profile.public_slug}`,
            );
            await tx.unsafe("reset role");
            await tx`update app.coach_profiles set visibility='hidden' where profile_id=${coach.id}::uuid`;
            assert.equal(
              (await thread(athlete)).conversation.counterpartProfileHref,
              `/members/${coach.id}`,
            );
          },
        );
        const path = `${athlete.id}/${randomUUID()}.webp`;
        await source(
          athlete,
          "select * from app.set_current_account_avatar_reference($1,null)",
          [path],
        );
        await t.test(
          "new current member photo reference replaces relationship requirement without leaking path into messages",
          async () => {
            const c = (await thread(coach)).conversation;
            assert.equal(c.counterpartMedia.kind, "member-avatar");
            assert.equal(c.counterpartMedia.id, athlete.id);
            assert.doesNotMatch(
              JSON.stringify(c),
              /avatar_storage_path|\.webp/,
            );
            assert.equal(
              (await profileFor(outsider, athlete.id))[0].avatar_storage_path,
              path,
            );
          },
        );
        await tx.unsafe("reset role");
        const oldPath = `${athlete.id}/${randomUUID()}.webp`;
        await tx`insert into storage.objects(bucket_id,name) values('account-avatars',${path}),('account-avatars',${oldPath})`;
        async function storage(
          viewer: typeof coach | null,
          objectPath: string,
          operation = "object.get_authenticated",
        ) {
          return tx.savepoint(async (s) => {
            await s.unsafe("reset role");
            await s`select set_config('request.jwt.claim.sub',${viewer?.authId ?? ""},true),set_config('request.jwt.claims',${JSON.stringify(viewer ? { sub: viewer.authId, role: "authenticated" } : { role: "anon" })},true)`;
            await s`select set_config('storage.operation',${operation},true)`;
            await s.unsafe("set local role authenticated");
            return (
              await s`select exists(select 1 from storage.objects where bucket_id='account-avatars' and name=${objectPath}) allowed`
            )[0].allowed;
          });
        }
        await t.test(
          "Storage policy allows exact current shared-dataset object, denies old, missing and guest references",
          async () => {
            assert.equal(await storage(outsider, path), true);
            for (const operation of ["object.list", "object.sign", ""])
              assert.equal(await storage(outsider, path, operation), false);
            assert.equal(
              await storage(outsider, `${athlete.id}/${randomUUID()}.webp`),
              false,
            );
            assert.equal(await storage(null, path), false);
          },
        );
        await t.test(
          "invalid actor, wrong dataset, missing member and direct guest calls fail closed",
          async () => {
            assert.equal(
              (
                await profileFor(
                  { ...outsider, authId: coach.authId },
                  athlete.id,
                )
              ).length,
              0,
            );
            assert.equal(
              (await profileFor({ ...outsider, run: randomUUID() }, athlete.id))
                .length,
              0,
            );
            assert.equal((await profileFor(outsider, randomUUID())).length, 0);
            for (const role of ["anon", "authenticated"]) {
              await assert.rejects(
                tx.savepoint(async (s) => {
                  await s.unsafe(`set local role ${role}`);
                  await s`select * from app.current_member_profile(${athlete.id}::uuid)`;
                }),
                /permission denied/,
              );
            }
          },
        );
        await t.test(
          "target revocation removes projection, link and Storage authority immediately",
          async () => {
            await tx.unsafe("reset role");
            await tx`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where run_id=${athlete.run}::uuid and profile_id=${athlete.id}::uuid`;
            assert.equal((await profileFor(outsider, athlete.id)).length, 0);
            assert.equal(await storage(outsider, path), false);
            const c = (await thread(coach)).conversation;
            assert.equal(c.counterpartProfileHref, null);
            assert.equal(c.counterpartMedia, null);
            await tx.unsafe("reset role");
            await tx`update app.demo_run_participants set status='active',revoked_at=null where run_id=${athlete.run}::uuid and profile_id=${athlete.id}::uuid`;
          },
        );
        await t.test(
          "viewer revocation denies SQL and Storage without changing target",
          async () => {
            await tx.unsafe("reset role");
            await tx`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where run_id=${outsider.run}::uuid and profile_id=${outsider.id}::uuid`;
            assert.equal((await profileFor(outsider, athlete.id)).length, 0);
            assert.equal(await storage(outsider, path), false);
          },
        );
        throw new Rollback();
      })
      .catch((error) => {
        if (!(error instanceof Rollback)) throw error;
      });
  } finally {
    await db.end();
  }
});
