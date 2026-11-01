import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  !/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/movexternal_[a-z0-9_]+$/.test(
    url,
  )
)
  throw Error("Use the isolated external-client rehearsal");
type Actor = { authId: string; id: string; run: string; email: string };
test("external client authority, canonical reservations and explicit invitation handoff", async (t) => {
  const db = postgres(url, { max: 6, prepare: false, onnotice() {} });
  async function raw(a: Actor, query: string, args: postgres.JSONValue[] = []) {
    return db.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      await tx`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
      return tx.unsafe(query, args);
    });
  }
  async function fn(a: Actor, name: string, ...args: postgres.JSONValue[]) {
    const [r] = await raw(
      a,
      `select app.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) result`,
      args,
    );
    return r.result;
  }
  async function person(name: string) {
    const authId = randomUUID(),
      email = `external-${authId}@example.test`;
    await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${authId}::uuid,${email},now(),false,false)`;
    const [p] =
      await db`select * from app.enroll_application_identity(${authId}::uuid,${name})`;
    return {
      authId,
      id: String(p.identity_profile_id),
      run: String(p.identity_run_id),
      email,
    };
  }
  const json = (x: object) => x as postgres.JSONValue;
  try {
    const coach = await person("External coach"),
      athlete = await person("Invited athlete"),
      other = await person("Other athlete");
    await fn(coach, "submit_owned_coach_application");
    await fn(
      coach,
      "save_owned_coach_application_contact",
      0,
      json({
        phoneNumber: "+4915112345678",
        instagramUrl: null,
        facebookUrl: null,
        linkedinUrl: null,
      }),
    );
    await raw(
      coach,
      "select app.upsert_owned_coach_profile('External Coach','Disposable external-client booking and invitation authority fixture.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)",
    );
    await db`select app.review_coach_application(${coach.id}::uuid,'pending','approved','Disposable external-client fixture','movexternal','movx-identity-application-v1')`;
    await db`update app.coach_profiles set visibility='visible' where profile_id=${coach.id}::uuid`;
    const [venue] =
      await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.id}::uuid and is_primary`;
    const [day] =
      await db`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text date`;
    await fn(
      coach,
      "save_owned_effective_coach_availability",
      json({
        kind: "dates",
        operationId: randomUUID(),
        expectedRevision: 0,
        dates: [
          {
            date: day.date,
            mode: "custom",
            hours: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"].map(
              (localStartTime) => ({
                localStartTime,
                locationId: venue.id,
                locationUpdatedAt: venue.stamp,
              }),
            ),
          },
        ],
      }),
    );
    const [type] =
      await db`select id,revision from app.coach_session_types where coach_profile_id=${coach.id}::uuid and format='private' limit 1`;
    const start = (time: string) => `${day.date}T${time}:00 Europe/Berlin`;
    let clientId: string, bookingId: string;
    const create = {
      operationId: randomUUID(),
      name: "Name-only client",
      email: null,
    };
    await t.test(
      "name-only creation is idempotent and not an Auth/profile identity",
      async () => {
        const before =
          await db`select (select count(*) from auth.users)::int auth,(select count(*) from app.profiles)::int profiles`;
        const result = await fn(
          coach,
          "external_clients",
          "create",
          json(create),
        );
        clientId = result.client.id;
        assert.deepEqual(
          await fn(coach, "external_clients", "create", json(create)),
          result,
        );
        await assert.rejects(
          fn(
            coach,
            "external_clients",
            "create",
            json({ ...create, name: "Altered" }),
          ),
        );
        assert.deepEqual(
          await db`select (select count(*) from auth.users)::int auth,(select count(*) from app.profiles)::int profiles`,
          before,
        );
        await assert.rejects(
          fn(other, "external_clients", "detail", json({ id: clientId })),
        );
        await assert.rejects(
          fn(
            { ...coach, run: randomUUID() },
            "external_clients",
            "detail",
            json({ id: clientId }),
          ),
        );
        await assert.rejects(
          fn(
            { ...coach, authId: athlete.authId },
            "external_clients",
            "detail",
            json({ id: clientId }),
          ),
        );
        await assert.rejects(
          raw(coach, "select * from app.coach_external_clients"),
        );
      },
    );
    const book = (
      externalId: string,
      time: string,
      operationId = randomUUID(),
    ) =>
      fn(
        coach,
        "coach_session_booking",
        operationId,
        json({
          action: "create",
          externalClientId: externalId,
          typeId: type.id,
          typeRevision: type.revision,
          locationId: venue.id,
          startsAt: start(time),
          durationMinutes: 60,
        }),
      );
    await t.test(
      "real reservation prevents concurrent overlaps and keeps owner projection/notes",
      async () => {
        const cmd = randomUUID();
        const results = await Promise.allSettled([
          book(clientId, "09:00", cmd),
          book(clientId, "09:00", randomUUID()),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        bookingId = String(
          results.find((r) => r.status === "fulfilled")!.value.bookingId,
        );
        const [b] =
          await db`select * from app.coach_private_bookings where id=${bookingId}::uuid`;
        assert.equal(b.client_profile_id, null);
        assert.equal(b.external_client_id, clientId);
        assert.ok(
          (
            await raw(
              coach,
              "select * from app.current_direct_private_bookings()",
            )
          ).some((x) => x.id === bookingId),
        );
        assert.deepEqual(
          await fn(coach, "current_booking_connection_context", bookingId),
          { connection: null, canSend: false },
        );
        await assert.rejects(fn(other, "session_booking_detail", bookingId));
        const note = (kind: string, body: string) =>
          fn(
            coach,
            "session_notes_command",
            "save",
            json({
              bookingId,
              kind,
              operationId: randomUUID(),
              revision: 0,
              body,
              videos: [],
            }),
          );
        await note("plan", "Original preparation");
        await note("shared", "Original shared note");
        await note("private", "Coach private record");
        await assert.rejects(
          fn(
            athlete,
            "session_notes_command",
            "read",
            json({ bookingId, kind: "shared" }),
          ),
        );
        const [events] =
          await db`select count(*)::int n from app.booking_notification_events where source_id=${bookingId}::uuid`;
        assert.equal(events.n, 0);
      },
    );
    await t.test(
      "external reschedule retains identity and cancellation stays read-only",
      async () => {
        const original = await fn(coach, "session_booking_detail", bookingId);
        const changed = {
          action: "override",
          bookingId,
          expectedRevision: 0,
          typeId: type.id,
          typeRevision: type.revision,
          locationId: venue.id,
          startsAt: start("10:00"),
          durationMinutes: 60,
        };
        const op = randomUUID();
        const result = await fn(
          coach,
          "coach_session_booking",
          op,
          json(changed),
        );
        assert.equal(result.bookingId, bookingId);
        assert.equal(result.revision, 1);
        assert.deepEqual(
          await fn(coach, "coach_session_booking", op, json(changed)),
          result,
        );
        assert.equal(
          (await fn(coach, "session_booking_detail", bookingId)).changes.length,
          1,
        );
        assert.equal(
          (await fn(coach, "session_booking_detail", bookingId)).externalClient
            .id,
          clientId,
        );
        await assert.rejects(
          fn(coach, "coach_session_booking", randomUUID(), json(changed)),
        );
        const cancelled = await book(clientId, "14:00");
        await fn(coach, "cancel_direct_private_booking", cancelled.bookingId);
        assert.equal(
          (
            await fn(
              coach,
              "session_notes_command",
              "read",
              json({ bookingId: cancelled.bookingId, kind: "shared" }),
            )
          ).canWrite,
          false,
        );
        await assert.rejects(
          fn(
            coach,
            "session_notes_command",
            "save",
            json({
              bookingId: cancelled.bookingId,
              kind: "shared",
              operationId: randomUUID(),
              revision: 0,
              body: "Denied",
              videos: [],
            }),
          ),
        );
        const elapsed = await book(clientId, "16:00");
        await db`update app.coach_private_bookings set scheduled_start_at=statement_timestamp()-interval '2 hours',scheduled_end_at=statement_timestamp()-interval '1 hour',early_return_until=statement_timestamp()-interval '2 hours' where id=${elapsed.bookingId}::uuid`;
        await fn(coach, "complete_direct_private_booking", elapsed.bookingId);
        assert.equal(
          (await fn(coach, "session_booking_detail", elapsed.bookingId)).status,
          "completed",
        );
        assert.equal(original.athleteId, null);
      },
    );
    let token = randomBytes(32).toString("base64url");
    const hash = () => createHash("sha256").update(token).digest("hex");
    await t.test(
      "email is optional until send; exact recipient and consent are required",
      async () => {
        const args = {
          operationId: randomUUID(),
          externalClientId: clientId,
          clientRevision: 0,
          expectedInvitationId: null,
          expectedRevision: null,
        };
        await assert.rejects(
          fn(coach, "manage_client_invitation", "send", json(args), token),
        );
        await fn(
          coach,
          "external_clients",
          "update",
          json({
            operationId: randomUUID(),
            id: clientId,
            revision: 0,
            name: "Name-only client",
            email: athlete.email.toUpperCase(),
          }),
        );
        const operation = { ...args, clientRevision: 1 };
        const result = await fn(
          coach,
          "manage_client_invitation",
          "send",
          json(operation),
          token,
        );

        assert.deepEqual(
          await fn(
            coach,
            "manage_client_invitation",
            "send",
            json(operation),
            randomBytes(32).toString("base64url"),
          ),
          result,
        );
        const offer = await fn(other, "review_client_invitation", hash());
        assert.deepEqual(Object.keys(offer).sort(), ["coachName", "state"]);
        assert.equal(offer.state, "pending");
        assert.equal(
          (
            await db`select client_profile_id from app.coach_private_bookings where id=${bookingId}::uuid`
          )[0].client_profile_id,
          null,
        );
        await assert.rejects(
          fn(other, "decide_client_invitation", hash(), "accept"),
        );
        await db`update auth.users set email_confirmed_at=null where id=${athlete.authId}::uuid`;
        await assert.rejects(
          fn(athlete, "decide_client_invitation", hash(), "accept"),
        );
        await db`update auth.users set email_confirmed_at=now() where id=${athlete.authId}::uuid`;
        await assert.rejects(
          raw(coach, "select * from app.coach_invitation_emails"),
        );
      },
    );
    await t.test(
      "accept atomically associates original IDs and shared history, never private notes or old notifications",
      async () => {
        const [before] =
          await db`select b.id,b.slot_id,b.created_at,b.scheduled_start_at,(select jsonb_agg(to_jsonb(n) order by n.id) from app.session_note_entries n where n.booking_id=b.id) notes from app.coach_private_bookings b where b.id=${bookingId}::uuid`;
        assert.equal(
          (await fn(athlete, "decide_client_invitation", hash(), "accept"))
            .state,
          "accepted",
        );
        const [after] =
          await db`select b.id,b.slot_id,b.created_at,b.scheduled_start_at,(select jsonb_agg(to_jsonb(n) order by n.id) from app.session_note_entries n where n.booking_id=b.id) notes from app.coach_private_bookings b where b.id=${bookingId}::uuid`;
        assert.deepEqual(after, before);
        const shared = await fn(
          athlete,
          "session_notes_command",
          "read",
          json({ bookingId, kind: "shared" }),
        );
        assert.equal(shared.entries[0].body, "Original shared note");
        assert.equal(shared.plan.body, "Original preparation");
        assert.ok(!JSON.stringify(shared).includes("Coach private record"));
        await assert.rejects(
          fn(
            athlete,
            "session_notes_command",
            "read",
            json({ bookingId, kind: "private" }),
          ),
        );
        assert.equal(
          (await fn(athlete, "session_booking_detail", bookingId)).athleteId,
          athlete.id,
        );
        const [accepted] =
          await db`select a.id from app.coach_athlete_connection_pairs p join app.coach_athlete_connection_attempts a on a.pair_id=p.id where p.coach_profile_id=${coach.id}::uuid and p.athlete_profile_id=${athlete.id}::uuid and a.status='accepted'`;
        assert.ok(accepted);
        await fn(
          athlete,
          "decide_coach_athlete_connection",
          accepted.id,
          "disconnect",
        );
        assert.equal(
          (await fn(athlete, "decide_client_invitation", hash(), "accept"))
            .state,
          "accepted",
        );
        assert.equal(
          (
            await db`select status from app.coach_athlete_connection_attempts where id=${accepted.id}::uuid`
          )[0].status,
          "removed",
        );
        assert.equal(
          (
            await db`select count(*)::int n from app.booking_notification_events where source_id=${bookingId}::uuid`
          )[0].n,
          0,
        );
        const [all] =
          await db`select count(*)::int n from app.coach_private_bookings where external_client_id=${clientId}::uuid and client_profile_id=${athlete.id}::uuid`;
        assert.equal(all.n, 3);
        await db`update auth.users set email=${"changed-" + athlete.email} where id=${athlete.authId}::uuid`;
        assert.equal(
          (await fn(athlete, "decide_client_invitation", hash(), "accept"))
            .state,
          "accepted",
        );
        await db`update auth.users set email=${athlete.email} where id=${athlete.authId}::uuid`;
        await assert.rejects(book(clientId, "10:00"));
      },
    );
    await t.test(
      "revocation and claim serialize with one coherent result",
      async () => {
        const c = await fn(
          coach,
          "external_clients",
          "create",
          json({
            operationId: randomUUID(),
            name: "Race client",
            email: athlete.email.replace("@", "+race@"),
          }),
        );
        // A different verified recipient avoids implicitly merging contacts.
        const receiver = await person("Race recipient");
        await fn(
          coach,
          "external_clients",
          "update",
          json({
            operationId: randomUUID(),
            id: c.client.id,
            revision: 0,
            name: c.client.name,
            email: receiver.email,
          }),
        );
        token = randomBytes(32).toString("base64url");
        const sent = await fn(
          coach,
          "manage_client_invitation",
          "send",
          json({
            operationId: randomUUID(),
            externalClientId: c.client.id,
            clientRevision: 1,
            expectedInvitationId: null,
            expectedRevision: null,
          }),
          token,
        );
        const outcomes = await Promise.allSettled([
          fn(receiver, "decide_client_invitation", hash(), "accept"),
          fn(
            coach,
            "manage_client_invitation",
            "revoke",
            json({
              operationId: randomUUID(),
              externalClientId: c.client.id,
              clientRevision: 1,
              expectedInvitationId: sent.invitation.id,
              expectedRevision: 0,
            }),
            null,
          ),
        ]);
        assert.equal(
          outcomes.filter((x) => x.status === "fulfilled").length,
          1,
        );
        const [state] =
          await db`select i.status,c.linked_profile_id from app.coach_client_invitations i join app.coach_external_clients c on c.id=i.external_client_id where i.id=${sent.invitation.id}::uuid`;
        assert.ok(
          state.status === "accepted"
            ? state.linked_profile_id === receiver.id
            : state.status === "revoked" && state.linked_profile_id === null,
        );
      },
    );
    await t.test(
      "worker fencing, Unknown purge, rotated links and retargeted email",
      async () => {
        const recipient = await person("Delivery recipient"),
          c = await fn(
            coach,
            "external_clients",
            "create",
            json({
              operationId: randomUUID(),
              name: "Delivery client",
              email: recipient.email,
            }),
          );
        const rawToken = randomBytes(32).toString("base64url"),
          tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const sent = await fn(
          coach,
          "manage_client_invitation",
          "send",
          json({
            operationId: randomUUID(),
            externalClientId: c.client.id,
            clientRevision: 0,
            expectedInvitationId: null,
            expectedRevision: null,
          }),
          rawToken,
        );
        const worker = async (name: string, ...args: postgres.JSONValue[]) =>
          db.begin(async (tx) => {
            await tx.unsafe("set local role app_notification_worker");
            const [r] = await tx.unsafe(
              `select app.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) result`,
              args,
            );
            return r.result;
          });
        await assert.rejects(
          raw(coach, "select app.claim_coach_invitation_emails()"),
        );
        const claims = await worker(
          "claim_coach_invitation_emails",
          sent.invitation.id,
        );
        assert.equal(claims.length, 1);
        assert.equal(
          await worker(
            "prepare_coach_invitation_email",
            sent.invitation.id,
            randomUUID(),
          ),
          null,
        );
        const payload = await worker(
          "prepare_coach_invitation_email",
          sent.invitation.id,
          claims[0].leaseId,
        );
        assert.equal(payload.token, rawToken);
        assert.equal(payload.email, recipient.email);
        assert.equal(
          await worker(
            "prepare_coach_invitation_email",
            sent.invitation.id,
            claims[0].leaseId,
          ),
          null,
        );
        assert.equal(
          await worker(
            "finish_coach_invitation_email",
            sent.invitation.id,
            randomUUID(),
            "accepted",
            "wrong",
          ),
          false,
        );
        assert.equal(
          await worker(
            "finish_coach_invitation_email",
            sent.invitation.id,
            claims[0].leaseId,
            "unknown",
            null,
          ),
          true,
        );
        assert.deepEqual(
          await worker("claim_coach_invitation_emails", sent.invitation.id),
          [],
        );
        assert.equal(
          (
            await db`select token from app.coach_invitation_emails where id=${sent.invitation.id}::uuid`
          )[0].token,
          null,
        );
        await assert.rejects(
          fn(
            coach,
            "manage_client_invitation",
            "resend",
            json({
              operationId: randomUUID(),
              externalClientId: c.client.id,
              clientRevision: 0,
              expectedInvitationId: sent.invitation.id,
              expectedRevision: 0,
            }),
            randomBytes(32).toString("base64url"),
          ),
        );
        await db`update app.coach_client_invitations set created_at=clock_timestamp()-interval '61 seconds' where id=${sent.invitation.id}::uuid`;
        const replacement = await fn(
          coach,
          "manage_client_invitation",
          "resend",
          json({
            operationId: randomUUID(),
            externalClientId: c.client.id,
            clientRevision: 0,
            expectedInvitationId: sent.invitation.id,
            expectedRevision: 0,
          }),
          randomBytes(32).toString("base64url"),
        );
        assert.notEqual(replacement.invitation.id, sent.invitation.id);
        assert.equal(
          (await fn(recipient, "review_client_invitation", tokenHash)).state,
          "unavailable",
        );
        await fn(
          coach,
          "external_clients",
          "update",
          json({
            operationId: randomUUID(),
            id: c.client.id,
            revision: 0,
            name: c.client.name,
            email: null,
          }),
        );
        assert.equal(
          (await fn(coach, "owned_client_invitation", c.client.id)).status,
          "revoked",
        );
        assert.deepEqual(
          await worker(
            "claim_coach_invitation_emails",
            replacement.invitation.id,
          ),
          [],
        );
        const [rights] =
          await db`select has_function_privilege('app_runtime','app.associate_invited_sessions(uuid)','execute') hook,has_table_privilege('app_notification_worker','app.coach_invitation_emails','select') raw,has_function_privilege('app_runtime','app.invitation_recipient_matches(text)','execute') auth`;
        assert.deepEqual(rights, { hook: false, raw: false, auth: false });
      },
    );
    await t.test(
      "suspended, blocked, expired and self offers cannot grant identity",
      async () => {
        const receiver = await person("Denied invitation recipient");
        const c = await fn(
          coach,
          "external_clients",
          "create",
          json({
            operationId: randomUUID(),
            name: "Denied client",
            email: receiver.email,
          }),
        );
        const token = randomBytes(32).toString("base64url"),
          digest = createHash("sha256").update(token).digest("hex");
        const sent = await fn(
          coach,
          "manage_client_invitation",
          "send",
          json({
            operationId: randomUUID(),
            externalClientId: c.client.id,
            clientRevision: 0,
            expectedInvitationId: null,
            expectedRevision: null,
          }),
          token,
        );
        await db`update app.coach_applications set status='suspended' where profile_id=${coach.id}::uuid`;
        await assert.rejects(
          fn(receiver, "decide_client_invitation", digest, "accept"),
        );
        await db`update app.coach_applications set status='approved' where profile_id=${coach.id}::uuid`;
        const [block] =
          await db`insert into app.message_blocks(run_id,low_profile_id,high_profile_id,blocked_by_profile_id) values(${coach.run}::uuid,least(${coach.id}::uuid,${receiver.id}::uuid),greatest(${coach.id}::uuid,${receiver.id}::uuid),${receiver.id}::uuid) returning id`;
        await assert.rejects(
          fn(receiver, "decide_client_invitation", digest, "accept"),
        );
        await db`update app.message_blocks set ended_at=clock_timestamp() where id=${block.id}::uuid`;
        await db`update app.coach_client_invitations set expires_at=clock_timestamp()-interval '1 second' where id=${sent.invitation.id}::uuid`;
        assert.equal(
          (await fn(receiver, "review_client_invitation", digest)).state,
          "unavailable",
        );
        await assert.rejects(
          fn(receiver, "decide_client_invitation", digest, "accept"),
        );
        assert.equal(
          (
            await fn(
              coach,
              "external_clients",
              "detail",
              json({ id: c.client.id }),
            )
          ).client.linkedProfileId,
          null,
        );
        await db`update app.coach_client_invitations set created_at=clock_timestamp()-interval '61 seconds' where id=${sent.invitation.id}::uuid`;
        const declineToken = randomBytes(32).toString("base64url");
        await fn(
          coach,
          "manage_client_invitation",
          "resend",
          json({
            operationId: randomUUID(),
            externalClientId: c.client.id,
            clientRevision: 0,
            expectedInvitationId: sent.invitation.id,
            expectedRevision: 0,
          }),
          declineToken,
        );
        const declineHash = createHash("sha256")
          .update(declineToken)
          .digest("hex");
        assert.equal(
          (
            await fn(
              receiver,
              "decide_client_invitation",
              declineHash,
              "decline",
            )
          ).state,
          "declined",
        );
        assert.equal(
          (
            await fn(
              receiver,
              "decide_client_invitation",
              declineHash,
              "decline",
            )
          ).state,
          "declined",
        );
        assert.equal(
          (
            await fn(
              coach,
              "external_clients",
              "detail",
              json({ id: c.client.id }),
            )
          ).client.linkedProfileId,
          null,
        );
        const self = await fn(
          coach,
          "external_clients",
          "create",
          json({
            operationId: randomUUID(),
            name: "Self claim denied",
            email: coach.email,
          }),
        );
        const selfToken = randomBytes(32).toString("base64url");
        await fn(
          coach,
          "manage_client_invitation",
          "send",
          json({
            operationId: randomUUID(),
            externalClientId: self.client.id,
            clientRevision: 0,
            expectedInvitationId: null,
            expectedRevision: null,
          }),
          selfToken,
        );
        await assert.rejects(
          fn(
            coach,
            "decide_client_invitation",
            createHash("sha256").update(selfToken).digest("hex"),
            "accept",
          ),
        );
      },
    );
    await t.test(
      "claim and notes serialize on the same original session",
      async () => {
        const receiver = await person("Concurrent notes recipient");
        const c = await fn(
          coach,
          "external_clients",
          "create",
          json({
            operationId: randomUUID(),
            name: "Concurrent note client",
            email: receiver.email,
          }),
        );
        const b = await book(c.client.id, "11:00"),
          token = randomBytes(32).toString("base64url"),
          digest = createHash("sha256").update(token).digest("hex");
        await fn(
          coach,
          "manage_client_invitation",
          "send",
          json({
            operationId: randomUUID(),
            externalClientId: c.client.id,
            clientRevision: 0,
            expectedInvitationId: null,
            expectedRevision: null,
          }),
          token,
        );
        const outcomes = await Promise.allSettled([
          fn(receiver, "decide_client_invitation", digest, "accept"),
          fn(
            coach,
            "session_notes_command",
            "save",
            json({
              bookingId: b.bookingId,
              kind: "shared",
              operationId: randomUUID(),
              revision: 0,
              body: "Concurrent original note",
              videos: [],
            }),
          ),
        ]);
        assert.ok(
          outcomes.every((r) => r.status === "fulfilled"),
          "Claim/note must both serialize successfully",
        );
        const shared = await fn(
          receiver,
          "session_notes_command",
          "read",
          json({ bookingId: b.bookingId, kind: "shared" }),
        );
        assert.equal(shared.entries[0].body, "Concurrent original note");
        assert.equal(
          (await fn(receiver, "session_booking_detail", b.bookingId)).bookingId,
          b.bookingId,
        );
      },
    );
    await t.test(
      "contact pagination and hard bounds return explicit failures",
      async () => {
        const c = await fn(
          coach,
          "external_clients",
          "create",
          json({
            operationId: randomUUID(),
            name: "Capacity client",
            email: null,
          }),
        );
        await db`insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,external_client_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at,cancelled_by_profile_id,cancelled_at)
       select gen_random_uuid(),b.run_id,b.slot_id,b.coach_profile_id,null,${c.client.id}::uuid,'cancelled',b.scheduled_start_at,b.scheduled_end_at,b.early_return_until,b.hold_expires_at,b.coach_profile_id,clock_timestamp() from app.coach_private_bookings b cross join generate_series(1,500) where b.id=${bookingId}::uuid`;
        await assert.rejects(book(c.client.id, "11:00"), /session limit/);
        await db`insert into app.coach_external_clients(run_id,coach_profile_id,name) select ${coach.run}::uuid,${coach.id}::uuid,'Bounded contact '||n from generate_series(1,1000-(select count(*)::int from app.coach_external_clients where run_id=${coach.run}::uuid and coach_profile_id=${coach.id}::uuid)) n`;
        await assert.rejects(
          fn(
            coach,
            "external_clients",
            "create",
            json({
              operationId: randomUUID(),
              name: "Over capacity",
              email: null,
            }),
          ),
          /client limit/,
        );
        let after: string | null = null;
        const ids = new Set<string>();
        do {
          const page = await fn(
            coach,
            "external_clients",
            "list",
            json(after ? { after } : {}),
          );
          assert.ok(page.items.length <= 20);
          for (const row of page.items) {
            assert.ok(!ids.has(row.id));
            ids.add(row.id);
          }
          after = page.next;
        } while (after);
        assert.equal(ids.size, 1000);
        const detail = await fn(
          coach,
          "external_clients",
          "detail",
          json({ id: c.client.id }),
        );
        assert.equal(detail.sessions.length, 20);
        assert.equal(detail.nextOffset, 20);
      },
    );
  } finally {
    await db.end();
  }
});
