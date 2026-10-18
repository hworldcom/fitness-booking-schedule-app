import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { COACH_STARTING_RATE_MAX_CENTS } from "@/domain/coach-starting-rate";
import { EMPTY_COACH_WEBSITE_CONTENT } from "@/domain/coach-website";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  CoachStartingRateError,
  ownedCoachStartingRateRecord,
  saveOwnedCoachStartingRateRecord,
  publicCoachStartingRateRecord,
} from "@/server/db/coaches/starting-rate-repository";
import {
  ownedCoachWebsiteRecord,
  mutateOwnedCoachWebsiteRecord,
  publicCoachWebsiteRecord,
  publicCoachWebsiteCards,
} from "@/server/db/coaches/website-repository";
const connection = process.env.DATABASE_TEST_URL;
const isolated =
  connection && new URL(connection).pathname.startsWith("/dev0313_");
test(
  "coach starting-rate authority, exact money, revisions and public absence of hidden values",
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
    const actors: AuthorizedActor[] = [];
    const work = <T>(
      actor: AuthorizedActor,
      fn: Parameters<typeof withActorDatabaseContext<T>>[1],
    ) => withActorDatabaseContext(actor, fn);
    const save = (
      actor: AuthorizedActor,
      revision: number,
      amount: number | null,
      shown: boolean,
      currency = "EUR",
    ) =>
      work(actor, (tx) =>
        saveOwnedCoachStartingRateRecord(tx, revision, amount, currency, shown),
      );
    const expectedError = (status: string) => (error: unknown) =>
      error instanceof CoachStartingRateError && error.status === status;
    let slug = "";
    try {
      for (let i = 1; i <= 3; i++) {
        const id = `91310000-0000-4000-8000-${String(i).padStart(12, "0")}`;
        await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
        const enrolled = await enrollApplicationProfile(id, `Rate Coach ${i}`);
        assert.ok(enrolled);
        const actor: AuthorizedActor = {
          authUserId: id,
          profileId: enrolled.profileId,
          runId: enrolled.runId,
          runRole: "member",
        };
        actors.push(actor);
        await work(actor, submitOwnedCoachApplicationRecord);
        const ownedSlug = await work(actor, (tx) =>
          upsertOwnedCoachProfileRecord(tx, {
            displayName: `Rate Coach ${i}`,
            bio: "Private coaching with deliberate practice and clear feedback for developing athletes.",
            disciplines: ["Boxing"],
            timezone: "Europe/Berlin",
            visibility: "hidden",
            selectedGymId: "40000000-0000-4000-8000-000000000001",
            independentLocation: null,
          }),
        );
        if (i === 1) slug = ownedSlug;
      }
      const [owner, other, applicant] = actors;
      await admin`select app.review_coach_application(${owner.profileId}::uuid,'pending','approved','Rate test approval.','database-test','movx-identity-application-v1')`;
      await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
      await t.test(
        "old profiles have unknown initially hidden rates; only exact owner context reads the private table",
        async () => {
          const original = await work(owner, (tx) =>
            ownedCoachStartingRateRecord(tx, owner),
          );
          assert.deepEqual(original, {
            schemaVersion: 1,
            revision: 0,
            amountCents: null,
            currency: "EUR",
            showPublicly: false,
            context: "private-session",
          });
          assert.deepEqual(await publicCoachStartingRateRecord(slug), {
            startingRate: undefined,
          });
          assert.equal(
            await publicCoachStartingRateRecord("unknown-rate-coach"),
            null,
          );
          await save(owner, 0, 97654321, false);
          assert.equal(
            (
              await runtime`select * from app.coach_starting_rates where profile_id=${owner.profileId}::uuid`
            ).length,
            0,
          );
          assert.equal(
            (
              await work(other, (tx) =>
                tx.execute(
                  sql`select * from app.coach_starting_rates where profile_id=${owner.profileId}::uuid`,
                ),
              )
            ).length,
            0,
          );
          await assert.rejects(
            runtime`update app.coach_starting_rates set amount_cents=1`,
            /permission denied/,
          );
          await assert.rejects(
            work(
              { ...owner, runId: "10000000-0000-4000-8000-000000000099" },
              (tx) => ownedCoachStartingRateRecord(tx, owner),
            ),
            /no longer authorized/,
          );
          await assert.rejects(
            runtime`select app.public_coach_starting_rate_projection(${owner.runId}::uuid,${owner.profileId}::uuid)`,
            /permission denied/,
          );
          await assert.rejects(
            admin.begin(async (tx) => {
              await tx`set local role anon`;
              return tx`select * from app.coach_starting_rates`;
            }),
            /permission denied/,
          );
        },
      );
      await t.test(
        "public SQL/full/card projections never return hidden numeric amounts, disclosure flags or owner revisions",
        async () => {
          const raw =
            await runtime`select * from app.public_coach_website_pricing(${slug})`;
          assert.equal(raw[0].starting_rate, null);
          assert.doesNotMatch(
            JSON.stringify(raw),
            /97654321|amount_cents|show_publicly/,
          );
          const publicRow = await publicCoachWebsiteRecord(slug);
          assert.ok(publicRow);
          assert.equal("startingRate" in publicRow, false);
          const cards = await publicCoachWebsiteCards([owner.profileId]);
          assert.equal("startingRate" in cards.get(owner.profileId)!, false);
          assert.equal(
            (await work(owner, (tx) => ownedCoachStartingRateRecord(tx, owner)))
              ?.amountCents,
            97654321,
          );
        },
      );
      await t.test(
        "zero, paid, hide and clear are independent and preserve truthful EUR/private-session labels",
        async () => {
          await save(owner, 1, 0, true);
          assert.equal(
            (await publicCoachStartingRateRecord(slug))?.startingRate?.label,
            "Sessions start from €0 (Free)",
          );
          await save(owner, 2, 6050, true);
          const shown = (await publicCoachStartingRateRecord(slug))
            ?.startingRate;
          assert.equal(shown?.amountCents, 6050);
          assert.equal(shown?.label, "Sessions start from €60.50");
          assert.equal(shown?.context, "private-session");
          assert.deepEqual(
            (await publicCoachWebsiteRecord(slug))?.startingRate,
            shown,
          );
          assert.deepEqual(
            (await publicCoachWebsiteCards([owner.profileId])).get(
              owner.profileId,
            )?.startingRate,
            shown,
          );
          assert.doesNotMatch(
            JSON.stringify(shown),
            /revision|showPublicly|profileId|runId/,
          );
          await save(owner, 3, 6050, false);
          assert.equal(
            (await publicCoachStartingRateRecord(slug))?.startingRate,
            undefined,
          );
          assert.equal(
            (await work(owner, (tx) => ownedCoachStartingRateRecord(tx, owner)))
              ?.amountCents,
            6050,
          );
          await save(owner, 4, null, true);
          assert.equal(
            (await publicCoachStartingRateRecord(slug))?.startingRate,
            undefined,
          );
          assert.equal(
            (await work(owner, (tx) => ownedCoachStartingRateRecord(tx, owner)))
              ?.showPublicly,
            true,
          );
        },
      );
      await t.test(
        "database bounds/currency guards and stale/concurrent edits retain one complete state",
        async () => {
          for (const amount of [-1, COACH_STARTING_RATE_MAX_CENTS + 1])
            await assert.rejects(
              save(owner, 5, amount, true),
              expectedError("invalid"),
            );
          await assert.rejects(
            save(owner, 5, 100, true, "USD"),
            expectedError("invalid"),
          );
          const results = await Promise.allSettled(
            [17700, 18800].map((amount) => save(owner, 5, amount, true)),
          );
          assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1,
          );
          assert.equal(
            results.filter(
              (result) =>
                result.status === "rejected" &&
                expectedError("conflict")(result.reason),
            ).length,
            1,
          );
          const before = await work(owner, (tx) =>
            ownedCoachStartingRateRecord(tx, owner),
          );
          assert.equal(before?.revision, 6);
          await assert.rejects(
            save(owner, 5, 9999, false),
            expectedError("conflict"),
          );
          assert.deepEqual(
            await work(owner, (tx) => ownedCoachStartingRateRecord(tx, owner)),
            before,
          );
          await assert.rejects(
            work(owner, (tx) =>
              tx.execute(
                sql`select * from app.save_owned_coach_starting_rate(6,${60.5}::bigint,'EUR',false)`,
              ),
            ),
          );
          assert.deepEqual(
            await work(owner, (tx) => ownedCoachStartingRateRecord(tx, owner)),
            before,
          );
        },
      );
      await t.test(
        "pricing and content revisions are independent; all eligible applicant states stay private",
        async () => {
          const content = {
            ...EMPTY_COACH_WEBSITE_CONTENT,
            introduction: "Existing content remains separate.",
          };
          await work(owner, (tx) =>
            mutateOwnedCoachWebsiteRecord(tx, owner, 0, content),
          );
          await save(owner, 6, 5999, false);
          const website = await work(owner, (tx) =>
            ownedCoachWebsiteRecord(tx, owner),
          );
          assert.equal(website?.revision, 1);
          assert.deepEqual(website?.content, content);
          await work(owner, (tx) =>
            mutateOwnedCoachWebsiteRecord(tx, owner, 1, {
              ...content,
              introduction: "Changed content.",
            }),
          );
          assert.equal(
            (await work(owner, (tx) => ownedCoachStartingRateRecord(tx, owner)))
              ?.revision,
            7,
          );
          await save(applicant, 0, 5000, true);
          const [draft] =
            await admin`select public_slug from app.coach_profiles where profile_id=${applicant.profileId}::uuid`;
          assert.equal(
            await publicCoachStartingRateRecord(draft.public_slug),
            null,
          );
          await admin`select app.review_coach_application(${applicant.profileId}::uuid,'pending','rejected','Rate test rejection.','database-test','movx-identity-application-v1')`;
          await save(applicant, 1, 5100, false);
          assert.equal(
            await publicCoachStartingRateRecord(draft.public_slug),
            null,
          );
        },
      );
      await t.test(
        "hidden/suspended coaches, inactive venues and retired datasets cannot publish a rate",
        async () => {
          await save(owner, 7, 6000, true);
          await admin`update app.coach_profiles set visibility='hidden' where profile_id=${owner.profileId}::uuid`;
          assert.equal(await publicCoachStartingRateRecord(slug), null);
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
          await admin`update app.gyms set status='inactive' where id='40000000-0000-4000-8000-000000000001'::uuid`;
          assert.equal(await publicCoachStartingRateRecord(slug), null);
          await admin`update app.gyms set status='active' where id='40000000-0000-4000-8000-000000000001'::uuid`;
          await admin`update app.demo_runs set status='retired',retired_at=clock_timestamp() where id=${owner.runId}::uuid`;
          assert.equal(await publicCoachStartingRateRecord(slug), null);
          await admin`update app.demo_runs set status='active',retired_at=null where id=${owner.runId}::uuid`;
          await admin`select app.review_coach_application(${owner.profileId}::uuid,'approved','suspended','Rate test suspension.','database-test','movx-identity-application-v1')`;
          assert.equal(await publicCoachStartingRateRecord(slug), null);
          await assert.rejects(
            save(owner, 8, 6000, true),
            expectedError("forbidden"),
          );
        },
      );
    } finally {
      await runtime.end();
      await admin.end();
    }
  },
);
