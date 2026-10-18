import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { GET as publicReviewRoute } from "@/app/api/coaches/[slug]/reviews/route";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type {
  PublishReview,
  ReviewCommand,
  ReviewState,
} from "@/domain/coach-reviews";
import {
  mutateCoachReviewRecord,
  currentCoachReviewRecord,
  publicCoachReviewPageRecord,
  publicCoachReviewSummaryRecords,
  decodeReviewCursor,
} from "@/server/db/coaches/review-repository";

const connection = process.env.DATABASE_TEST_URL;
const isolated =
  connection &&
  new URL(connection).hostname === "127.0.0.1" &&
  new URL(connection).pathname.startsWith("/dev0314_");
test(
  "coach pair reviews: real restricted-runtime eligibility, races, lifecycle, moderation, paging and privacy",
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
    const command = (actor: AuthorizedActor, input: ReviewCommand) =>
      work(actor, (tx) => mutateCoachReviewRecord(tx, input));
    const state = (actor: AuthorizedActor, slug: string) =>
      work(actor, (tx) =>
        currentCoachReviewRecord(tx, slug),
      ) as Promise<ReviewState>;
    let index = 0;
    try {
      for (let i = 0; i < 27; i++) {
        const id = randomUUID();
        await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
        const result = await enrollApplicationProfile(
          id,
          `Private Reviewer ${i}`,
        );
        assert.ok(result);
        actors.push({
          authUserId: id,
          profileId: result.profileId,
          runId: result.runId,
          runRole: "member",
        });
      }
      const [athlete, other, , outsider] = actors;
      const operator: AuthorizedActor = { ...actors[2], runRole: "operator" };
      await admin`update app.demo_run_participants set role='operator' where run_id=${operator.runId}::uuid and profile_id=${operator.profileId}::uuid`;
      const coaches =
        await admin`select c.profile_id,c.public_slug from app.coach_profiles c where c.run_id=${athlete.runId}::uuid and app.coach_website_is_public(c.run_id,c.profile_id) order by c.public_slug limit 2`;
      assert.equal(coaches.length, 2);
      const coach = coaches[0],
        second = coaches[1];
      async function booking(
        actor: AuthorizedActor,
        status = "confirmed",
        future = false,
        coachId = coach.profile_id,
      ) {
        const slotId = randomUUID(),
          id = randomUUID();
        index++;
        const start = new Date(
          Math.floor(Date.now() / 3600000) * 3600000 +
            (future ? 300 : -300) * 86400000 +
            index * 7200000,
        ).toISOString();
        const end = new Date(Date.parse(start) + 3600000).toISOString();
        const slots =
          await admin`insert into app.coach_availability_slots(id,run_id,profile_id,starts_at,ends_at,coach_timezone,status,location_kind,selected_gym_id,gym_name,public_location_label,latitude,longitude,location_source,location_provider,location_confirmed_at)
          select ${slotId}::uuid,c.run_id,c.profile_id,${start}::timestamptz,${end}::timestamptz,c.timezone,'open',c.location_kind,c.selected_gym_id,g.name,c.public_location_label,c.latitude,c.longitude,c.location_source,c.location_provider,c.location_confirmed_at
          from app.coach_profiles c left join app.gyms g on g.id=c.selected_gym_id where c.run_id=${actor.runId}::uuid and c.profile_id=${coachId}::uuid returning id`;
        assert.equal(
          slots.length,
          1,
          "Test occurrence must belong to the exact coach/dataset.",
        );
        await admin`insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at,cancelled_by_profile_id,cancelled_at,completed_at,created_at)
        values(${id}::uuid,${actor.runId}::uuid,${slotId}::uuid,${coachId}::uuid,${actor.profileId}::uuid,${status},${start}::timestamptz,${end}::timestamptz,${start}::timestamptz,${start}::timestamptz,${status === "cancelled" ? actor.profileId : null}::uuid,${status === "cancelled" ? new Date().toISOString() : null}::timestamptz,${status === "completed" ? end : null}::timestamptz,${start}::timestamptz-interval '1 day')`;
        return id;
      }
      const first = await booking(athlete),
        again = await booking(athlete, "completed"),
        foreign = await booking(other),
        future = await booking(athlete, "confirmed", true),
        cancelled = await booking(athlete, "cancelled"),
        secondCoach = await booking(
          athlete,
          "completed",
          false,
          second.profile_id,
        );
      const publish = (
        bookingId: string,
        rating = 4,
        comment = "Helpful training",
      ): PublishReview => ({
        action: "publish",
        bookingId,
        rating,
        comment,
        attribution: "Consented athlete",
        consent: true,
        expectedRevision: 0,
      });
      // Real foreign keys remain enabled for self/cross-dataset negative evidence.
      await admin`insert into app.coach_profiles select (jsonb_populate_record(null::app.coach_profiles,to_jsonb(c)||jsonb_build_object('profile_id',${outsider.profileId}::text,'public_slug','self-review-test','visibility','hidden','portrait_source',null,'portrait_path',null,'portrait_updated_at',null))).* from app.coach_profiles c where c.profile_id=${coach.profile_id}::uuid limit 1`;
      const selfBooking = await booking(
        outsider,
        "confirmed",
        false,
        outsider.profileId,
      );
      const crossRun = randomUUID();
      await admin`insert into app.demo_runs select (jsonb_populate_record(null::app.demo_runs,to_jsonb(r)||jsonb_build_object('id',${crossRun}::text,'slug','cross-review-test','catalogue_visibility','private'))).* from app.demo_runs r where r.id=${athlete.runId}::uuid`;
      await admin`insert into app.demo_run_participants select (jsonb_populate_record(null::app.demo_run_participants,to_jsonb(p)||jsonb_build_object('run_id',${crossRun}::text))).* from app.demo_run_participants p where p.run_id=${athlete.runId}::uuid and p.profile_id in (${athlete.profileId}::uuid,${coach.profile_id}::uuid)`;
      await admin`insert into app.coach_profiles select (jsonb_populate_record(null::app.coach_profiles,to_jsonb(c)||jsonb_build_object('run_id',${crossRun}::text,'public_slug','cross-review-coach','visibility','hidden','portrait_source',null,'portrait_path',null,'portrait_updated_at',null))).* from app.coach_profiles c where c.profile_id=${coach.profile_id}::uuid limit 1`;
      const crossBooking = await booking({ ...athlete, runId: crossRun });
      let own: ReviewState;
      await t.test(
        "fresh public summaries are genuinely empty, and reads are bounded to actor identity",
        async () => {
          const page = await publicCoachReviewPageRecord(
            coach.public_slug,
            null,
          );
          assert.equal(page.status, "ready");
          if (page.status === "ready") {
            assert.deepEqual(page.summary, {
              count: 0,
              mean: null,
              fictional: true,
            });
            assert.deepEqual(page.reviews, []);
          }
          const current = await state(athlete, coach.public_slug);
          assert.equal(current.eligible, true);
          assert.equal(current.review, null);
          assert.equal(
            (await state(outsider, coach.public_slug)).eligible,
            false,
          );
          assert.equal(
            (
              await runtime`select app.current_coach_pair_review(${coach.public_slug}) result`
            )[0].result.status,
            "forbidden",
          );
          await assert.rejects(
            work({ ...athlete, profileId: other.profileId }, (tx) =>
              currentCoachReviewRecord(tx, coach.public_slug),
            ),
            /no longer authorized/,
          );
          for (const table of [
            "coach_pair_reviews",
            "coach_review_moderation_audit",
          ])
            await assert.rejects(
              runtime.unsafe(`select * from app.${table}`),
              /permission denied/,
            );
          assert.equal(
            (
              await admin`select has_function_privilege('anon','app.mutate_coach_pair_review(jsonb)','execute') allowed`
            )[0].allowed,
            false,
          );
        },
      );
      await t.test(
        "unrelated, future, cancelled, absent and cross-dataset session evidence is rejected",
        async () => {
          for (const id of [
            foreign,
            future,
            cancelled,
            crossBooking,
            randomUUID(),
          ])
            assert.deepEqual(await command(athlete, publish(id)), {
              status: "not-eligible",
            });
          assert.deepEqual(await command(outsider, publish(first)), {
            status: "not-eligible",
          });
          assert.deepEqual(await command(outsider, publish(selfBooking)), {
            status: "not-eligible",
          });
          const invalid = [
            { ...publish(first), consent: false },
            { ...publish(first), rating: 6 },
            { ...publish(first), attribution: "A" },
            { ...publish(first), athleteId: athlete.profileId },
            { ...publish(first), comment: "<script>bad</script>" },
          ];
          for (const input of invalid) {
            const result = await work(
              athlete,
              async (tx) =>
                (
                  await tx.execute<{ result: { status: string } }>(
                    sql`select app.mutate_coach_pair_review(${JSON.stringify(input)}::jsonb) result`,
                  )
                )[0].result,
            );
            assert.equal(result.status, "invalid");
          }
        },
      );
      await t.test(
        "different-booking simultaneous first claims have one pair winner and one conflict",
        async () => {
          const results = await Promise.all([
            command(athlete, publish(first, 5, "First claim")),
            command(athlete, publish(again, 3, "Second claim")),
          ]);
          assert.deepEqual(results.map((x) => x.status).sort(), [
            "conflict",
            "saved",
          ]);
          own = await state(athlete, coach.public_slug);
          assert.equal(own.review!.revision, 1);
          const rows =
            await admin`select qualifying_booking_id from app.coach_pair_reviews where athlete_profile_id=${athlete.profileId}::uuid and coach_profile_id=${coach.profile_id}::uuid`;
          assert.equal(rows.length, 1);
          assert.ok([first, again].includes(rows[0].qualifying_booking_id));
          const current = own.review!;
          const retry = {
            ...publish(
              rows[0].qualifying_booking_id,
              current.rating,
              current.comment,
            ),
            attribution: current.attribution,
          };
          assert.equal((await command(athlete, retry)).status, "saved");
          assert.equal(
            (await state(athlete, coach.public_slug)).review!.revision,
            1,
          );
          assert.equal(
            (
              await command(athlete, {
                ...retry,
                comment: "Altered old request",
              })
            ).status,
            "conflict",
          );
        },
      );
      await t.test(
        "author edits, withdrawal, reconnection-independent republishing and usernames keep one identity",
        async () => {
          const id = own.review!.id;
          const updated = await command(athlete, {
            ...publish(again, 5),
            expectedRevision: 1,
          });
          assert.equal(updated.status, "saved");
          assert.equal(
            (
              await command(athlete, {
                action: "withdraw",
                coachSlug: coach.public_slug,
                expectedRevision: 2,
              })
            ).status,
            "saved",
          );
          let page = await publicCoachReviewPageRecord(coach.public_slug, null);
          assert.equal(page.status, "ready");
          if (page.status === "ready") assert.equal(page.summary.count, 0);
          assert.equal(
            (
              await command(athlete, {
                action: "withdraw",
                coachSlug: coach.public_slug,
                expectedRevision: 2,
              })
            ).status,
            "saved",
          );
          assert.equal(
            (
              await command(athlete, {
                ...publish(first, 4),
                expectedRevision: 3,
              })
            ).status,
            "saved",
          );
          await work(athlete, (tx) =>
            tx.execute(
              sql`select app.update_current_account_settings('login-security',${JSON.stringify({ username: "review_" + athlete.profileId.replaceAll("-", "").slice(0, 16) })}::jsonb,0)`,
            ),
          );
          own = await state(athlete, coach.public_slug);
          assert.equal(own.review!.id, id);
          assert.equal(own.review!.revision, 4);
          assert.equal(
            (
              await admin`select count(*)::int n from app.coach_pair_reviews where athlete_profile_id=${athlete.profileId}::uuid`
            )[0].n,
            1,
          );
          assert.equal(
            (await command(athlete, publish(secondCoach, 2))).status,
            "saved",
          );
          page = await publicCoachReviewPageRecord(second.public_slug, null);
          if (page.status === "ready") assert.equal(page.summary.mean, 2);
        },
      );
      await t.test(
        "operators alone moderate with reason/audit; authors cannot undo a hide",
        async () => {
          const input = {
            action: "hide" as const,
            reviewId: own.review!.id,
            reason: "Policy review",
            expectedRevision: 4,
          };
          assert.equal((await command(athlete, input)).status, "forbidden");
          assert.deepEqual(await command(operator, input), {
            status: "saved",
            revision: 5,
          });
          assert.deepEqual(await command(operator, input), {
            status: "saved",
            revision: 5,
          });
          assert.equal(
            (
              await admin`select count(*)::int n from app.coach_review_moderation_audit where review_id=${own.review!.id}::uuid`
            )[0].n,
            1,
          );
          assert.equal(
            (
              await command(athlete, {
                ...publish(first, 4),
                expectedRevision: 4,
              })
            ).status,
            "conflict",
          );
          let page = await publicCoachReviewPageRecord(coach.public_slug, null);
          if (page.status === "ready") assert.equal(page.summary.count, 0);
          assert.equal(
            (
              await command(athlete, {
                ...publish(first, 4),
                expectedRevision: 5,
              })
            ).status,
            "saved",
          );
          own = await state(athlete, coach.public_slug);
          assert.equal(own.review!.moderationHidden, true);
          assert.equal(own.review!.revision, 6);
          assert.equal(
            (
              await command(operator, {
                ...input,
                action: "restore",
                reason: "Reviewed and restored",
                expectedRevision: 6,
              })
            ).status,
            "saved",
          );
          page = await publicCoachReviewPageRecord(coach.public_slug, null);
          if (page.status === "ready") assert.equal(page.summary.count, 1);
          assert.equal(
            (await command(operator, { ...input, expectedRevision: 6 })).status,
            "conflict",
          );
          assert.equal(
            (
              await admin`select count(*)::int n from app.coach_review_moderation_audit where review_id=${own.review!.id}::uuid`
            )[0].n,
            2,
          );
        },
      );
      await t.test(
        "public means count each pair once and exclude all private evidence",
        async () => {
          assert.equal(
            (await command(other, publish(foreign, 5))).status,
            "saved",
          );
          const page = await publicCoachReviewPageRecord(
            coach.public_slug,
            null,
          );
          assert.equal(page.status, "ready");
          if (page.status === "ready") {
            assert.deepEqual(page.summary, {
              count: 2,
              mean: 4.5,
              fictional: true,
            });
            assert.equal(page.reviews.length, 2);
            for (const row of page.reviews)
              assert.deepEqual(Object.keys(row).sort(), [
                "attribution",
                "comment",
                "createdAt",
                "rating",
                "updatedAt",
              ]);
          }
          const raw = JSON.stringify(page);
          for (const secret of [
            athlete.profileId,
            athlete.authUserId,
            first,
            again,
            own.review!.id,
            "qualifying_booking_id",
            "avatar",
            "legalName",
            "Private Reviewer",
          ])
            assert.ok(!raw.includes(secret));
          const response = await publicReviewRoute(
            new Request(
              `http://localhost:3100/api/coaches/${coach.public_slug}/reviews`,
            ),
            { params: Promise.resolve({ slug: coach.public_slug }) },
          );
          assert.equal(response.status, 200);
          assert.equal(
            response.headers.get("cache-control"),
            "private, no-store",
          );
          assert.deepEqual(await response.json(), page);
          const summary = await publicCoachReviewSummaryRecords([
            coach.public_slug,
            second.public_slug,
            "not-real",
          ]);
          assert.equal(summary.size, 2);
          assert.equal(summary.get(coach.public_slug)?.mean, 4.5);
        },
      );
      await t.test(
        "deterministic 20-item pages retain microsecond positions and matching aggregate population",
        async () => {
          for (const actor of actors.slice(4, 25))
            assert.equal(
              (await command(actor, publish(await booking(actor), 3))).status,
              "saved",
            );
          const firstPage = await publicCoachReviewPageRecord(
            coach.public_slug,
            null,
          );
          assert.equal(firstPage.status, "ready");
          if (firstPage.status !== "ready") return;
          assert.equal(firstPage.reviews.length, 20);
          assert.equal(firstPage.summary.count, 23);
          assert.ok(firstPage.nextCursor);
          const position = decodeReviewCursor(firstPage.nextCursor);
          assert.ok(position);
          const secondPage = await publicCoachReviewPageRecord(
            coach.public_slug,
            position!,
          );
          assert.equal(secondPage.status, "ready");
          if (secondPage.status === "ready") {
            assert.equal(secondPage.reviews.length, 3);
            assert.equal(secondPage.nextCursor, null);
            assert.deepEqual(secondPage.summary, firstPage.summary);
            const times = [...firstPage.reviews, ...secondPage.reviews].map(
              (row) => row.createdAt,
            );
            assert.equal(new Set(times).size, 23);
          }
        },
      );
      await t.test(
        "hiding coach visibility removes page and batch summaries without erasing private author state",
        async () => {
          await admin`update app.coach_profiles set visibility='hidden' where profile_id=${coach.profile_id}::uuid`;
          assert.deepEqual(
            await publicCoachReviewPageRecord(coach.public_slug, null),
            { status: "not-found" },
          );
          assert.equal(
            (await publicCoachReviewSummaryRecords([coach.public_slug])).size,
            0,
          );
          assert.ok((await state(athlete, coach.public_slug)).review);
          assert.equal(
            (await state(outsider, coach.public_slug)).status,
            "not-found",
          );
          assert.equal(
            (
              await command(outsider, {
                action: "withdraw",
                coachSlug: coach.public_slug,
                expectedRevision: 99,
              })
            ).status,
            "not-found",
          );
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${coach.profile_id}::uuid`;
          assert.equal(
            (await publicCoachReviewPageRecord(coach.public_slug, null)).status,
            "ready",
          );
        },
      );
    } finally {
      await runtime.end({ timeout: 1 });
      await admin.end({ timeout: 1 });
    }
  },
);
