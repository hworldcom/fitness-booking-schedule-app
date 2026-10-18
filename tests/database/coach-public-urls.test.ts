import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import {
  completeApplicationRegistration,
  UsernameTakenError,
} from "@/server/db/identity/repository";
import {
  currentAccountDetailsRecord,
  saveAccountDetailsRecord,
} from "@/server/db/account/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import {
  upsertOwnedCoachProfileRecord,
  publicCoachProfileRecord,
} from "@/server/db/coaches/repository";
import {
  ownedCoachPublicHandleRecord,
  confirmCoachPublicHandleRecord,
  publicCoachHandleRecord,
  publicCoachPathsRecord,
} from "@/server/db/coaches/public-url-repository";

const connection = process.env.DATABASE_TEST_URL;
const isolated =
  connection &&
  new URL(connection).hostname === "127.0.0.1" &&
  new URL(connection).pathname.startsWith("/dev0331_");
test(
  "public coach handles: consent, live visibility, atomic claims, aliases and private identity",
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
    const work = <T>(
      actor: AuthorizedActor,
      fn: Parameters<typeof withActorDatabaseContext<T>>[1],
    ) => withActorDatabaseContext(actor, fn);
    async function enroll(username: string) {
      const id = randomUUID();
      await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
      const result = await completeApplicationRegistration(id, {
        username,
        fullName: "Private Legal Canary",
        displayName: "URL Test Coach",
      });
      assert.ok(result);
      return {
        authUserId: id,
        profileId: result.profileId,
        runId: result.runId,
        runRole: "member",
      } satisfies AuthorizedActor;
    }
    async function rename(actor: AuthorizedActor, username: string | null) {
      const current = await work(actor, currentAccountDetailsRecord);
      assert.equal(current.status, "ready");
      return work(actor, (tx) =>
        saveAccountDetailsRecord(tx, {
          section: "login-security",
          username,
          revision: current.details.revision,
        }),
      );
    }
    async function confirm(actor: AuthorizedActor) {
      const state = await work(actor, ownedCoachPublicHandleRecord);
      assert.equal(state.status, "ready");
      return state.status === "ready"
        ? work(actor, (tx) =>
            confirmCoachPublicHandleRecord(tx, state.username!, state.revision),
          )
        : state;
    }
    try {
      const owner = await enroll("url_coach_one"),
        other = await enroll("url_other"),
        applicant = await enroll("url_applicant");
      let slug = "";
      for (const actor of [owner, applicant]) {
        await work(actor, submitOwnedCoachApplicationRecord);
        const saved = await work(actor, (tx) =>
          upsertOwnedCoachProfileRecord(tx, {
            displayName: "Public URL Coach",
            bio: "Deliberate coaching and practice with individual feedback for developing athletes.",
            disciplines: ["Boxing"],
            timezone: "Europe/Berlin",
            visibility: "hidden",
            selectedGymId: "40000000-0000-4000-8000-000000000001",
            independentLocation: null,
          }),
        );
        if (actor === owner) slug = saved;
      }
      await admin`select app.review_coach_application(${owner.profileId}::uuid,'pending','approved','Handle fixture approval.','database-test','movx-identity-application-v1')`;
      await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
      await t.test(
        "saved private usernames never activate public routes, and registry is inaccessible",
        async () => {
          assert.equal(await publicCoachHandleRecord("url_coach_one"), null);
          assert.equal(await publicCoachHandleRecord(slug, true), null);
          const state = await work(owner, ownedCoachPublicHandleRecord);
          assert.equal(state.status, "ready");
          assert.equal(state.status === "ready" && state.confirmed, false);
          assert.deepEqual(await work(other, ownedCoachPublicHandleRecord), {
            status: "forbidden",
          });
          assert.deepEqual(
            await work(applicant, ownedCoachPublicHandleRecord),
            { status: "forbidden" },
          );
          await assert.rejects(
            runtime`select * from app.coach_public_handles`,
            (e) => (e as { code: string }).code === "42501",
          );
          await assert.rejects(
            runtime`select app.owned_coach_public_handle()`,
            (e) => (e as { code: string }).code === "42501",
          );
        },
      );
      await t.test(
        "stale confirmation fails; exact consent publishes only a bounded public URL",
        async () => {
          const before = await work(owner, ownedCoachPublicHandleRecord);
          assert.equal(before.status, "ready");
          assert.equal((await rename(owner, "url_coach_two")).status, "ready");
          if (before.status === "ready")
            assert.deepEqual(
              await work(owner, (tx) =>
                confirmCoachPublicHandleRecord(
                  tx,
                  before.username!,
                  before.revision,
                ),
              ),
              { status: "conflict" },
            );
          assert.equal(await publicCoachHandleRecord("url_coach_two"), null);
          const saved = await confirm(owner);
          assert.equal(saved.status === "ready" && saved.confirmed, true);
          assert.deepEqual(await publicCoachHandleRecord("url_coach_two"), {
            slug,
            publicPath: "/@url_coach_two",
          });
          assert.equal(
            (await publicCoachPathsRecord([slug])).get(slug),
            "/@url_coach_two",
          );
          assert.deepEqual(
            await confirm(owner),
            saved,
            "Exact confirmation retry is idempotent",
          );
          assert.equal(
            await publicCoachHandleRecord("url_coach_one"),
            null,
            "Never published handles do not become aliases",
          );
        },
      );
      await t.test(
        "rename preserves aliases, Account revision/privacy and every unrelated identity/data row",
        async () => {
          const snapshot = async () =>
            admin`select table_name,md5(coalesce((xpath('/row/value/text()',query_to_xml(format('select coalesce(jsonb_agg(to_jsonb(v) order by to_jsonb(v)::text)::text,''[]'') as value from app.%I v',table_name),false,true,'')))[1]::text,'')) as hash from information_schema.tables where table_schema='app' and table_type='BASE TABLE' and table_name not in ('account_personal_details','coach_public_handles') order by table_name`;
          const before = await snapshot();
          assert.equal(
            (await rename(owner, "url_coach_three")).status,
            "ready",
          );
          assert.deepEqual(await snapshot(), before);
          for (const handle of ["url_coach_two", "url_coach_three"])
            assert.deepEqual(await publicCoachHandleRecord(handle), {
              slug,
              publicPath: "/@url_coach_three",
            });
          assert.deepEqual(await rename(owner, null), {
            status: "username-required",
          });
          assert.equal(
            (await rename(other, "url_coach_two")).status,
            "username-taken",
          );
          const id = randomUUID();
          await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
          await assert.rejects(
            completeApplicationRegistration(id, {
              username: "url_coach_two",
              fullName: "Other Private Person",
              displayName: "Other",
            }),
            UsernameTakenError,
          );
          assert.equal(
            Number(
              (
                await admin`select count(*) from app.profiles where auth_user_id=${id}::uuid`
              )[0].count,
            ),
            0,
            "Enrollment collision rolls back partial identity",
          );
          assert.equal(
            (await rename(owner, "url_coach_two")).status,
            "ready",
            "Owner can return to own alias",
          );
        },
      );
      await t.test(
        "simultaneous Account claims and enrollment/rename have one winner without takeover",
        async () => {
          const fourth = await enroll("url_fourth");
          const claims = await Promise.all([
            rename(other, "url_race"),
            rename(fourth, "url_race"),
          ]);
          assert.deepEqual(claims.map((x) => x.status).sort(), [
            "ready",
            "username-taken",
          ]);
          const id = randomUUID();
          await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
          const results = await Promise.allSettled([
            rename(owner, "url_race_registration"),
            completeApplicationRegistration(id, {
              username: "url_race_registration",
              fullName: "Race Private Person",
              displayName: "Race Person",
            }),
          ]);
          const renamed = results[0];
          assert.equal(renamed.status, "fulfilled");
          if (
            renamed.status === "fulfilled" &&
            renamed.value.status === "ready"
          ) {
            assert.equal(results[1].status, "rejected");
            assert.deepEqual(await publicCoachHandleRecord("url_coach_two"), {
              slug,
              publicPath: "/@url_race_registration",
            });
          } else {
            assert.equal(results[1].status, "fulfilled");
            assert.deepEqual(await publicCoachHandleRecord("url_coach_two"), {
              slug,
              publicPath: "/@url_coach_two",
            });
          }
          const expected = (await publicCoachHandleRecord("url_coach_two"))!;
          const blocked = await Promise.all([
            rename(other, "url_coach_three"),
            rename(fourth, "url_coach_two"),
          ]);
          assert.deepEqual(
            blocked.map((x) => x.status),
            ["username-taken", "username-taken"],
          );
          assert.deepEqual(
            await publicCoachHandleRecord("url_coach_two"),
            expected,
          );
        },
      );
      await t.test(
        "a different coach's legacy slug cannot shadow a public handle; confirmation racing rename never publishes an unreviewed first handle",
        async () => {
          await work(other, submitOwnedCoachApplicationRecord);
          await work(other, (tx) =>
            upsertOwnedCoachProfileRecord(tx, {
              displayName: "Legacy Collision Coach",
              bio: "A separate isolated coach proving legacy slug and public username ownership remain distinct.",
              disciplines: ["Boxing"],
              timezone: "Europe/Berlin",
              visibility: "hidden",
              selectedGymId: "40000000-0000-4000-8000-000000000001",
              independentLocation: null,
            }),
          );
          await admin`select app.review_coach_application(${other.profileId}::uuid,'pending','approved','Namespace fixture approval.','database-test','movx-identity-application-v1')`;
          await admin`update app.coach_profiles set visibility='visible',public_slug='collisioncoach' where profile_id=${other.profileId}::uuid`;
          assert.equal((await rename(owner, "collisioncoach")).status, "ready");
          assert.deepEqual(await publicCoachHandleRecord("collisioncoach"), {
            slug,
            publicPath: "/@collisioncoach",
          });
          assert.equal(
            await publicCoachHandleRecord("collisioncoach", true),
            null,
          );
          assert.equal(
            (await publicCoachProfileRecord("collisioncoach"))?.profileId,
            other.profileId,
          );
          const before = await work(other, ownedCoachPublicHandleRecord);
          assert.equal(before.status, "ready");
          if (before.status === "ready") {
            const [confirmation, renamed] = await Promise.all([
              work(other, (tx) =>
                confirmCoachPublicHandleRecord(
                  tx,
                  before.username!,
                  before.revision,
                ),
              ),
              rename(other, "collision_new"),
            ]);
            assert.equal(renamed.status, "ready");
            if (confirmation.status === "ready")
              assert.deepEqual(
                await publicCoachHandleRecord(before.username!),
                { slug: "collisioncoach", publicPath: "/@collision_new" },
              );
            else {
              assert.equal(confirmation.status, "conflict");
              assert.equal(
                await publicCoachHandleRecord("collision_new"),
                null,
              );
              assert.equal(
                await publicCoachHandleRecord(before.username!),
                null,
              );
            }
          }
        },
      );
      await t.test(
        "all aliases obey hidden/suspended/catalogue gates and private accounts stay indistinguishable",
        async () => {
          for (const name of ["url_applicant", "unknown_handle"])
            assert.equal(await publicCoachHandleRecord(name), null);
          await admin`update app.coach_profiles set visibility='hidden' where profile_id=${owner.profileId}::uuid`;
          for (const name of ["url_coach_two", "url_coach_three"])
            assert.equal(await publicCoachHandleRecord(name), null);
          assert.equal(await publicCoachHandleRecord(slug, true), null);
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
          assert.ok(await publicCoachHandleRecord("url_coach_two"));
          await admin`select app.review_coach_application(${owner.profileId}::uuid,'approved','suspended','Handle fixture suspension.','database-test','movx-identity-application-v1')`;
          assert.equal(await publicCoachHandleRecord("url_coach_two"), null);
          assert.deepEqual(await work(owner, ownedCoachPublicHandleRecord), {
            status: "forbidden",
          });
          await admin`insert into app.coach_public_handles(username,profile_id) values('deleted_reserved',null)`;
          assert.equal(
            (await rename(other, "deleted_reserved")).status,
            "username-taken",
          );
          assert.equal(await publicCoachHandleRecord("deleted_reserved"), null);
        },
      );
    } finally {
      await runtime.end();
      await admin.end();
    }
  },
);
