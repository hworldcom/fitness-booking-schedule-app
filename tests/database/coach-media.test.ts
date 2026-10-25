import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import postgres from "postgres";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  ownedCoachMediaRecord,
  mutateCoachMediaRecord,
  publicCoachMediaRecord,
  applyCoachMediaVideo,
  workerCoachMediaAsset,
} from "@/server/db/coaches/media-repository";

const target = process.env.DATABASE_TEST_URL;
test(
  "coach media real SQL: owner/public isolation, quotas, retries, publication and provider races",
  { skip: !target || !new URL(target).pathname.startsWith("/mov19_") },
  async (t) => {
    assert.ok(
      process.env.COACH_MEDIA_TEST_RUNTIME_URL &&
        process.env.COACH_MEDIA_TEST_WORKER_URL,
    );
    process.env.DATABASE_URL = process.env.COACH_MEDIA_TEST_RUNTIME_URL;
    process.env.COACH_MEDIA_DATABASE_URL =
      process.env.COACH_MEDIA_TEST_WORKER_URL;
    const admin = postgres(target!, {
      max: 1,
      prepare: false,
      onnotice: () => {},
    });
    const runtime = postgres(process.env.DATABASE_URL!, {
      max: 1,
      prepare: false,
    });
    const actors: AuthorizedActor[] = [];
    const slugs: string[] = [];
    const work = <T>(
      actor: AuthorizedActor,
      callback: Parameters<typeof withActorDatabaseContext<T>>[1],
    ) => withActorDatabaseContext(actor, callback);
    const read = (actor = actors[0]) => work(actor, ownedCoachMediaRecord);
    const command = (
      action: string,
      input: Record<string, unknown>,
      revision: number,
      actor = actors[0],
    ) =>
      work(actor, (tx) => mutateCoachMediaRecord(tx, revision, action, input));
    const hash = (value: string) =>
      createHash("sha256").update(value).digest("hex");
    const reserve = async (
      kind = "photo",
      replaceId?: string,
      actor = actors[0],
    ) => {
      const id = randomUUID();
      const state = await read(actor);
      const input = {
        id,
        kind,
        description: "Strength training",
        fingerprint: hash(id),
        ...(replaceId ? { replaceId } : {}),
        ...(kind === "photo" ? { width: 1600, height: 900 } : {}),
      };
      const record = await command("reserve", input, state.revision, actor);
      return { id, input, record, revision: state.revision };
    };
    const photo = async (replaceId?: string) => {
      const upload = await reserve("photo", replaceId);
      const claim = await command("claim", { id: upload.id }, upload.revision);
      const asset = claim.uploads.find((u) => u.id === upload.id)!;
      await admin`insert into storage.objects(bucket_id,name,metadata) values('coach-gallery',${asset.thumbnail_path},' {"mimetype":"image/webp","size":500}'::jsonb),('coach-gallery',${asset.full_path},'{"mimetype":"image/webp","size":1000}'::jsonb)`;
      return command("finish-photo", { id: upload.id }, upload.revision);
    };
    try {
      for (let i = 0; i < 3; i++) {
        const authId = randomUUID();
        await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${authId},false,false)`;
        const enrolled = await enrollApplicationProfile(
          authId,
          `Media Coach ${i}`,
        );
        assert.ok(enrolled);
        const actor: AuthorizedActor = {
          authUserId: authId,
          profileId: enrolled.profileId,
          runId: enrolled.runId,
          runRole: "member",
        };
        actors.push(actor);
        await work(actor, submitOwnedCoachApplicationRecord);
        slugs.push(
          await work(actor, (tx) =>
            upsertOwnedCoachProfileRecord(tx, {
              displayName: `Media Coach ${i}`,
              bio: "Supportive strength and fitness coaching for personal goals and everyday confidence.",
              disciplines: ["Fitness"],
              timezone: "Europe/Berlin",
              visibility: "hidden",
              selectedGymId: "40000000-0000-4000-8000-000000000001",
              independentLocation: null,
            }),
          ),
        );
        if (i < 2)
          await admin`select app.review_coach_application(${actor.profileId},'pending','approved','Isolated media test','test','movx-identity-application-v1')`;
      }
      const [owner, other, pending] = actors;
      await t.test(
        "empty legacy profiles require no backfill, direct table access and worker escalation are denied",
        async () => {
          const state = await read();
          assert.equal(state.revision, 0);
          assert.deepEqual(state.photos, []);
          assert.equal(await publicCoachMediaRecord(slugs[0]), null);
          await assert.rejects(runtime`select * from app.coach_media_assets`);
          await assert.rejects(
            runtime`select app.apply_coach_media_video(${randomUUID()},'uploadABC','assetABC','playbackABC','ready',30)`,
          );
          await assert.rejects(
            work({ ...owner, runId: other.profileId }, ownedCoachMediaRecord),
          );
        },
      );
      await t.test(
        "claim is exclusive, exact retries recover and altered/other-owner retries fail",
        async () => {
          const upload = await reserve();
          const results = await Promise.all([
            command("claim", { id: upload.id }, 0),
            command("claim", { id: upload.id }, 0),
          ]);
          assert.equal(results.filter((r) => r.claimed).length, 1);
          await command("reserve", upload.input, 0);
          await assert.rejects(
            command("reserve", { ...upload.input, description: "Changed" }, 0),
          );
          await assert.rejects(command("reserve", upload.input, 0, other));
          await assert.rejects(command("finish-photo", { id: upload.id }, 0));
          await command("cancel", { id: upload.id }, 0);
          const id = randomUUID();
          await assert.rejects(
            command(
              "reserve",
              {
                id,
                kind: "video",
                description: "Hello",
                fingerprint: hash(id),
              },
              0,
              pending,
            ),
          );
        },
      );
      await t.test(
        "six photos plus concurrent reservation cannot overfill the gallery",
        async () => {
          for (let i = 0; i < 5; i++) await photo();
          const before = await read();
          const attempts = await Promise.allSettled([reserve(), reserve()]);
          assert.equal(
            attempts.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const winner = attempts.find(
            (r) => r.status === "fulfilled",
          ) as PromiseFulfilledResult<Awaited<ReturnType<typeof reserve>>>;
          const claimed = await command(
            "claim",
            { id: winner.value.id },
            before.revision,
          );
          const asset = claimed.uploads.find((a) => a.id === winner.value.id)!;
          await admin`insert into storage.objects(bucket_id,name,metadata) values('coach-gallery',${asset.thumbnail_path},'{"mimetype":"image/webp","size":500}'::jsonb),('coach-gallery',${asset.full_path},'{"mimetype":"image/webp","size":500}'::jsonb)`;
          const full = await command(
            "finish-photo",
            { id: asset.id },
            before.revision,
          );
          assert.equal(full.photos.length, 6);
          await assert.rejects(reserve());
          assert.equal(
            (await command("finish-photo", { id: asset.id }, 0)).revision,
            full.revision,
          );
        },
      );
      await t.test(
        "publication and private object policies follow exact references and current visibility",
        async () => {
          let state = await read();
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}`;
          assert.deepEqual(
            (await publicCoachMediaRecord(slugs[0]))?.photos,
            [],
          );
          state = await command("publish", {}, state.revision);
          assert.equal(
            (await publicCoachMediaRecord(slugs[0]))?.photos.length,
            6,
          );
          const path = state.photos[0].full_path!;
          assert.equal(
            (
              await admin`select app.coach_media_object_access(${path},'public') allowed`
            )[0].allowed,
            true,
          );
          await assert.rejects(
            admin`delete from storage.objects where bucket_id='coach-gallery' and name=${path}`,
          );
          await admin`update app.coach_profiles set visibility='hidden' where profile_id=${owner.profileId}`;
          assert.equal(await publicCoachMediaRecord(slugs[0]), null);
          assert.equal(
            (
              await admin`select app.coach_media_object_access(${path},'public') allowed`
            )[0].allowed,
            false,
          );
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}`;
        },
      );
      await t.test(
        "replacement at capacity preserves old published photos; reorder rejects foreign IDs and stale writes",
        async () => {
          const before = await read();
          const old = before.photos[0];
          const replaced = await photo(old.id);
          assert.equal(replaced.photos.length, 6);
          assert.equal(replaced.publishedPhotos[0].id, old.id);
          assert.ok(replaced.photos.every((p) => p.id !== old.id));
          await assert.rejects(
            command(
              "reorder",
              {
                ids: replaced.photos.map((p, i) =>
                  i === 0 ? randomUUID() : p.id,
                ),
              },
              replaced.revision,
            ),
          );
          await assert.rejects(command("publish", {}, before.revision));
          const reordered = await command(
            "reorder",
            { ids: [...replaced.photos].reverse().map((p) => p.id) },
            replaced.revision,
          );
          const discarded = await command("discard", {}, reordered.revision);
          assert.deepEqual(
            discarded.photos.map((p) => p.id),
            before.photos.map((p) => p.id),
          );
          assert.ok(discarded.cleanup.length > 0);
        },
      );
      await t.test(
        "video reservation is exclusive, exact 60 seconds is accepted and callbacks are idempotent",
        async () => {
          const u = await reserve("video");
          await assert.rejects(reserve("video"));
          await command("claim", { id: u.id }, u.revision);
          for (const uploadUrl of [
            "https://direct-uploads-us.mux.com.evil.test/upload",
            "https://evil@direct-uploads-us.mux.com/upload",
            "https://direct-uploads-us.mux.com/upload#fragment",
            "https://direct-uploads-us.mux.com/upload\n",
          ])
            await assert.rejects(
              command(
                "set-upload",
                { id: u.id, uploadId: "upload000001", uploadUrl },
                u.revision,
              ),
            );
          await command(
            "set-upload",
            {
              id: u.id,
              uploadId: "upload000001",
              uploadUrl:
                "https://direct-uploads-oci-us-phoenix-1-vop1.mux.com/example?upload=1",
            },
            u.revision,
          );
          assert.equal(
            await applyCoachMediaVideo(
              u.id,
              "differentupload",
              "asset000001",
              "playback000001",
              "ready",
              60,
            ),
            false,
          );
          assert.equal(
            await applyCoachMediaVideo(
              u.id,
              "upload000001",
              "asset000001",
              "playback000001",
              "ready",
              60,
            ),
            true,
          );
          const ready = await read();
          assert.equal(Number(ready.video?.duration), 60);
          await applyCoachMediaVideo(
            u.id,
            "upload000001",
            "asset000001",
            null,
            "processing",
            null,
          );
          await applyCoachMediaVideo(
            u.id,
            "upload000001",
            "asset000001",
            "playback000001",
            "ready",
            60,
          );
          assert.equal((await read()).revision, ready.revision);
          assert.equal(ready.publishedVideo, null);
          await command("publish", {}, ready.revision);
        },
      );
      await t.test(
        "over-limit and cancelled video callbacks cannot replace published media",
        async () => {
          const existing = (await read()).publishedVideo!;
          const u = await reserve("video");
          await command("claim", { id: u.id }, u.revision);
          await command(
            "set-upload",
            {
              id: u.id,
              uploadId: "upload000002",
              uploadUrl: "https://storage.googleapis.com/example?upload=2",
            },
            u.revision,
          );
          await applyCoachMediaVideo(
            u.id,
            "upload000002",
            "asset000002",
            "playback000002",
            "ready",
            60.001,
          );
          assert.equal((await workerCoachMediaAsset(u.id))?.status, "failed");
          assert.equal((await read()).publishedVideo?.id, existing.id);
          const cancelled = await reserve("video");
          await command("claim", { id: cancelled.id }, cancelled.revision);
          await command(
            "set-upload",
            {
              id: cancelled.id,
              uploadId: "upload000003",
              uploadUrl: "https://storage.googleapis.com/example?upload=3",
            },
            cancelled.revision,
          );
          await command("cancel", { id: cancelled.id }, cancelled.revision);
          assert.equal(
            await applyCoachMediaVideo(
              cancelled.id,
              "upload000003",
              "asset000003",
              "playback000003",
              "ready",
              20,
            ),
            false,
          );
          const retired = await workerCoachMediaAsset(cancelled.id);
          assert.equal(retired?.status, "retired");
          assert.equal(retired?.mux_asset_id, "asset000003");
          await assert.rejects(
            applyCoachMediaVideo(
              cancelled.id,
              "upload000003",
              "foreignasset003",
              "playback000003",
              "ready",
              20,
            ),
          );
          assert.equal((await read()).publishedVideo?.id, existing.id);
        },
      );
      await t.test(
        "draft removal preserves publication until publish; revoked actors cannot read/write",
        async () => {
          const uncertain = await reserve("video");
          await command("claim", { id: uncertain.id }, uncertain.revision);
          await command("cancel", { id: uncertain.id }, uncertain.revision);
          await assert.rejects(
            command("deleted", { id: uncertain.id }, uncertain.revision),
          );
          assert.ok(
            (await read()).cleanup.some(
              (asset) =>
                asset.id === uncertain.id &&
                asset.external_claimed &&
                !asset.mux_upload_id,
            ),
          );
          const before = await read();
          const id = before.photos[0].id;
          const removed = await command(
            "remove-photo",
            { id },
            before.revision,
          );
          assert.equal(
            (await publicCoachMediaRecord(slugs[0]))?.photos.length,
            6,
          );
          await command("publish", {}, removed.revision);
          assert.equal(
            (await publicCoachMediaRecord(slugs[0]))?.photos.length,
            5,
          );
          await assert.rejects(
            command("remove-photo", { id }, removed.revision, other),
          );
          await admin`select app.review_coach_application(${owner.profileId},'approved','suspended','Isolated suspension','test','movx-identity-application-v1')`;
          await assert.rejects(read());
          assert.equal(await publicCoachMediaRecord(slugs[0]), null);
        },
      );
    } finally {
      await runtime.end({ timeout: 1 });
      await admin.end({ timeout: 1 });
    }
  },
);
