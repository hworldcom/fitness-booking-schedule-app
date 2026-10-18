import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { SessionTypeCommand } from "@/domain/session-types";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  ownedSessionTypes,
  mutateSessionType,
  publicSessionTypes,
  SessionTypeError,
} from "@/server/db/coaches/session-type-repository";
const connection = process.env.DATABASE_TEST_URL;
const isolated =
  connection && /^\/dev034[02]_/.test(new URL(connection).pathname);
test(
  "session type defaults, archive, isolation and exact/stale commands",
  { skip: !isolated },
  async () => {
    const admin = postgres(connection!, {
      max: 1,
      prepare: false,
      ssl: false,
      onnotice: () => {},
    });
    const url = new URL(connection!);
    url.username = "repx_runtime_login";
    url.password = "postgres";
    process.env.DATABASE_URL = url.toString();
    const runtime = postgres(url.toString(), {
      max: 1,
      prepare: false,
      ssl: false,
    });
    const actors: AuthorizedActor[] = [];
    const work = <T>(
      actor: AuthorizedActor,
      fn: Parameters<typeof withActorDatabaseContext<T>>[1],
    ) => withActorDatabaseContext(actor, fn);
    try {
      for (let i = 0; i < 2; i++) {
        const id = randomUUID();
        await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
        const p = await enrollApplicationProfile(id, `Type Coach ${i}`);
        assert.ok(p);
        const actor: AuthorizedActor = {
          authUserId: id,
          profileId: p.profileId,
          runId: p.runId,
          runRole: "member",
        };
        actors.push(actor);
        await work(actor, submitOwnedCoachApplicationRecord);
        await work(actor, (tx) =>
          upsertOwnedCoachProfileRecord(tx, {
            displayName: `Type Coach ${i}`,
            bio: "Individual coaching with deliberate practice and feedback for developing athletes.",
            disciplines: ["Boxing"],
            timezone: "Europe/Berlin",
            visibility: "hidden",
            selectedGymId: "40000000-0000-4000-8000-000000000001",
            independentLocation: null,
          }),
        );
      }
      const [owner, other] = actors;
      const initial = await work(owner, (tx) => ownedSessionTypes(tx, owner));
      assert.equal(initial.length, 2);
      assert.deepEqual(initial.map((t) => t.format).sort(), [
        "group",
        "private",
      ]);
      assert.ok(initial.every((t) => t.durationMinutes === 60 && !t.archived));
      const type = initial.find((t) => t.format === "private")!;
      const edit: SessionTypeCommand = {
        commandId: randomUUID(),
        action: "save",
        id: type.id,
        expectedRevision: 0,
        format: "private",
        name: "Boxing technique",
        description: "Pads and footwork",
        color: "#123456",
        durationMinutes: 75,
        defaultLocationId: null,
        bookable: true,
      };
      const saved = await work(owner, (tx) => mutateSessionType(tx, edit));
      assert.equal(saved[0].durationMinutes, 75);
      assert.equal(saved[0].revision, 1);
      await assert.rejects(
        work(owner, (tx) =>
          mutateSessionType(tx, {
            ...edit,
            commandId: randomUUID(),
            expectedRevision: 1,
            format: "group",
          }),
        ),
        (e: unknown) => e instanceof SessionTypeError && e.status === "invalid",
      );
      await assert.rejects(
        work(owner, (tx) =>
          mutateSessionType(tx, {
            ...edit,
            commandId: randomUUID(),
            expectedRevision: 1,
            durationMinutes: 45 as 75,
          }),
        ),
        (e: unknown) => e instanceof SessionTypeError && e.status === "invalid",
      );
      await assert.rejects(
        work({ ...owner, runId: randomUUID() }, (tx) =>
          ownedSessionTypes(tx, owner),
        ),
        /no longer authorized/,
      );

      assert.deepEqual(
        await work(owner, (tx) => mutateSessionType(tx, edit)),
        saved,
      );
      await assert.rejects(
        work(owner, (tx) =>
          mutateSessionType(tx, { ...edit, name: "Altered retry" }),
        ),
        (e: unknown) =>
          e instanceof SessionTypeError && e.status === "conflict",
      );
      await assert.rejects(
        work(owner, (tx) =>
          mutateSessionType(tx, { ...edit, commandId: randomUUID() }),
        ),
        (e: unknown) =>
          e instanceof SessionTypeError && e.status === "conflict",
      );
      await assert.rejects(
        work(other, (tx) =>
          mutateSessionType(tx, {
            commandId: randomUUID(),
            action: "archive",
            id: type.id,
            expectedRevision: 1,
          }),
        ),
        (e: unknown) =>
          e instanceof SessionTypeError && e.status === "forbidden",
      );
      assert.equal(
        (await runtime`select * from app.coach_session_types`).length,
        0,
      );
      assert.equal(
        (
          await work(other, (tx) =>
            tx.execute(
              sql`select * from app.coach_session_types where id=${type.id}::uuid`,
            ),
          )
        ).length,
        0,
      );
      await assert.rejects(
        runtime`delete from app.coach_session_types`,
        /permission denied/,
      );
      assert.deepEqual(await publicSessionTypes("unknown-coach"), []);
      const [coach] =
        await admin`select public_slug from app.coach_profiles where profile_id=${owner.profileId}::uuid`;
      assert.deepEqual(await publicSessionTypes(coach.public_slug), []);
      await admin`select app.review_coach_application(${owner.profileId}::uuid,'pending','approved','Types test approval.','database-test','movx-identity-application-v1')`;
      await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
      assert.equal((await publicSessionTypes(coach.public_slug)).length, 2);
      const archive = {
        commandId: randomUUID(),
        action: "archive" as const,
        id: type.id,
        expectedRevision: 1,
      };
      await work(owner, (tx) => mutateSessionType(tx, archive));
      assert.equal((await publicSessionTypes(coach.public_slug)).length, 1);
      assert.equal(
        (await work(owner, (tx) => ownedSessionTypes(tx, owner))).length,
        2,
      );
      await work(owner, (tx) =>
        mutateSessionType(tx, {
          commandId: randomUUID(),
          action: "restore",
          id: type.id,
          expectedRevision: 2,
        }),
      );
      assert.equal((await publicSessionTypes(coach.public_slug)).length, 2);
      for (const t of await work(owner, (tx) => ownedSessionTypes(tx, owner)))
        await work(owner, (tx) =>
          mutateSessionType(tx, {
            commandId: randomUUID(),
            action: "archive",
            id: t.id,
            expectedRevision: t.revision,
          }),
        );
      for (let i = 0; i < 2; i++)
        assert.ok(
          (await work(owner, (tx) => ownedSessionTypes(tx, owner))).every(
            (t) => t.archived,
          ),
        );
      await assert.rejects(
        work(owner, (tx) =>
          mutateSessionType(tx, {
            commandId: randomUUID(),
            action: "defaults",
          }),
        ),
        (e: unknown) =>
          e instanceof SessionTypeError && e.status === "conflict",
      );
      const customId = randomUUID();
      const custom = await work(owner, (tx) =>
        mutateSessionType(tx, {
          ...edit,
          id: customId,
          commandId: randomUUID(),
          expectedRevision: -1,
          name: "Private class 90 min",
          durationMinutes: 90,
          bookable: false,
        }),
      );
      assert.equal(custom.find((t) => t.id === customId)?.durationMinutes, 90);
      assert.deepEqual(await publicSessionTypes(coach.public_slug), []);
      // Simulate an untouched pre-extension owner opting in with a group only.
      await admin`delete from app.coach_session_types where coach_profile_id=${other.profileId}::uuid`;
      const otherTypes = await work(other, (tx) =>
        mutateSessionType(tx, {
          ...edit,
          commandId: randomUUID(),
          id: randomUUID(),
          expectedRevision: -1,
          format: "group",
          name: "Group class 60 min",
          durationMinutes: 60,
        }),
      );
      assert.equal(otherTypes.length, 1);
      await admin`select app.review_coach_application(${other.profileId}::uuid,'pending','approved','Group-only type test.','database-test','movx-identity-application-v1')`;
      await admin`update app.coach_profiles set visibility='visible' where profile_id=${other.profileId}::uuid`;
      const [groupOnly] =
        await admin`select app.public_session_type_catalog(public_slug) catalog from app.coach_profiles where profile_id=${other.profileId}::uuid`;
      assert.equal(groupOnly.catalog.enabled, true);
      assert.deepEqual(
        groupOnly.catalog.types.map((t: { format: string }) => t.format),
        ["group"],
      );
    } finally {
      await runtime.end();
      await admin.end();
    }
  },
);
