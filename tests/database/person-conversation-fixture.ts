import { randomUUID } from "node:crypto";
import type postgres from "postgres";

export type PersonActor = { auth: string; id: string; run: string };
export async function personCommand(
  db: postgres.Sql,
  actor: PersonActor,
  action: string,
  args: Record<string, unknown> = {},
  version = 3,
) {
  return db.begin(async (tx) => {
    await tx`set local role app_runtime`;
    await tx`select set_config('app.current_auth_user_id',${actor.auth},true),set_config('app.current_profile_id',${actor.id},true),set_config('app.current_run_id',${actor.run},true),set_config('app.current_run_role','member',true)`;
    const fn =
      version === 3
        ? "app.message_command_v3"
        : version === 2
          ? "app.message_command_v2"
          : "app.message_command";
    const [r] = await tx.unsafe(`select ${fn}($1::text,$2::jsonb) result`, [
      action,
      tx.json(args as postgres.JSONValue),
    ]);
    return r.result;
  });
}
export async function personActor(
  db: postgres.Sql,
  label: string,
  coach = false,
): Promise<PersonActor> {
  const auth = randomUUID();
  await db`insert into auth.users(id,email,created_at,email_confirmed_at,is_sso_user,is_anonymous) values(${auth}::uuid,${`mov177-${auth}@example.test`},statement_timestamp(),statement_timestamp(),false,false)`;
  const [identity] =
    await db`select * from app.enroll_application_identity(${auth}::uuid,${label})`;
  const actor = {
    auth,
    id: identity.identity_profile_id,
    run: identity.identity_run_id,
  };
  if (coach) {
    await db.begin(async (tx) => {
      await tx`set local role app_runtime`;
      await tx`select set_config('app.current_auth_user_id',${auth},true),set_config('app.current_profile_id',${actor.id},true),set_config('app.current_run_id',${actor.run},true),set_config('app.current_run_role','member',true)`;
      await tx`select app.submit_owned_coach_application()`;
      await tx`select app.save_owned_coach_application_contact(0,'{"phoneNumber":"+4915123456789","instagramUrl":null,"facebookUrl":null,"linkedinUrl":null}'::jsonb)`;
      await tx`select app.upsert_owned_coach_profile(${label},'Focused private practice with clear preparation for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
    });
    await db`select app.review_coach_application(${actor.id}::uuid,'pending','approved','Disposable MOV-177 profile reviewed','fixture-operator','movx-identity-application-v1')`;
    await db`update app.coach_profiles set visibility='visible' where profile_id=${actor.id}::uuid`;
  }
  return actor;
}
export async function personUpgradeFixture(db: postgres.Sql) {
  const a = await personActor(db, "Prior coach A", true),
    b = await personActor(db, "Prior coach B", true);
  const forward = await personCommand(
    db,
    b,
    "inquire",
    {
      coachId: a.id,
      body: "Original A conversation",
      submissionId: randomUUID(),
    },
    2,
  );
  const reverse = await personCommand(
    db,
    a,
    "inquire",
    {
      coachId: b.id,
      body: "Original reverse conversation",
      submissionId: randomUUID(),
    },
    2,
  );
  await personCommand(
    db,
    a,
    "send",
    {
      conversationId: forward.conversationId,
      body: "Original unscoped reply",
      contextId: null,
      submissionId: randomUUID(),
    },
    2,
  );
  await personCommand(
    db,
    a,
    "read",
    { conversationId: reverse.conversationId, through: 1 },
    2,
  );
  return {
    a,
    b,
    forward: forward.conversationId as string,
    reverse: reverse.conversationId as string,
  };
}
