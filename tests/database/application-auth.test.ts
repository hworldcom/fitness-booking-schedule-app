import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
const url = process.env.DATABASE_TEST_URL;
if (!url) throw new Error("DATABASE_TEST_URL is required");
const db = () =>
  postgres(url, { max: 1, ssl: false, prepare: false, onnotice: () => {} });
class Rollback extends Error {}
const hex = () => randomBytes(32).toString("hex");

test("credential-fence migration rehearses without retaining schema changes", async () => {
  const sql = db();
  try {
    const installed =
      await sql`select 1 from information_schema.tables where table_schema='app' and table_name='auth_credential_fences'`;
    if (installed.length) {
      const [helper] =
        await sql`select pg_get_userbyid(p.proowner) owner,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.proname='managed_auth_session_exists'`;
      assert.equal(helper.owner, "postgres");
      assert.equal(helper.prosecdef, true);
      for (const role of ["anon", "authenticated", "app_runtime"])
        assert.equal(
          (
            await sql`select has_function_privilege(${role},'app.managed_auth_session_exists(uuid,uuid)','execute') value`
          )[0].value,
          false,
        );
      return;
    }
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx
          .unsafe(
            readFileSync(
              "supabase/migrations/20261017000800_auth_credential_fences.sql",
              "utf8",
            ),
          )
          .simple();
        assert.equal(
          (await tx`select count(*)::int n from app.auth_credential_fences`)[0]
            .n,
          0,
        );
        throw new Rollback();
      }),
      Rollback,
    );
    assert.equal(
      (await sql`select to_regclass('app.auth_credential_fences') value`)[0]
        .value,
      null,
    );
  } finally {
    await sql.end();
  }
});

test("email proofs are purpose-bound, browser-bound, single-use and limited on the server", async () => {
  const sql = db();
  try {
    await assert.rejects(
      sql.begin(async (tx) => {
        const email = hex(),
          binding = hex(),
          first = hex(),
          second = hex();
        await tx.unsafe("set local role app_runtime");
        const begin = async (id: string, purpose: string) =>
          (
            await tx`select app.begin_email_auth_flow(${id},${binding},${email},${purpose},'coach','/sessions?section=requests') result`
          )[0].result;
        assert.equal((await begin(first, "confirmation")).status, "ready");
        const limited = await begin(second, "confirmation");
        assert.equal(limited.status, "rate-limited");
        assert.ok(
          limited.retryAfterSeconds > 0 && limited.retryAfterSeconds <= 60,
        );
        assert.equal(
          (
            await tx`select app.read_email_auth_flow(${first},${hex()}) result`
          )[0].result,
          null,
        );
        assert.deepEqual(
          (
            await tx`select app.read_email_auth_flow(${first},${binding}) result`
          )[0].result,
          {
            emailHash: email,
            purpose: "confirmation",
            intent: "coach",
            returnTo: "/sessions?section=requests",
          },
        );
        assert.equal((await begin(second, "recovery")).status, "ready");
        assert.equal(
          (
            await tx`select app.read_email_auth_flow(${first},${binding}) result`
          )[0].result,
          null,
        );
        assert.equal(
          (
            await tx`select app.consume_email_auth_flow(${second},${binding}) result`
          )[0].result,
          true,
        );
        assert.equal(
          (
            await tx`select app.consume_email_auth_flow(${second},${binding}) result`
          )[0].result,
          false,
        );
        assert.equal(
          (
            await tx`select app.read_email_auth_flow(${second},${binding}) result`
          )[0].result,
          null,
        );
        await tx.unsafe("reset role");
        await tx`update app.email_auth_flows set requested_at=statement_timestamp()-interval '61 seconds' where email_hash=${email}`;
        assert.equal((await begin(first, "confirmation")).status, "ready");
        await tx`update app.email_auth_flows set expires_at=statement_timestamp()-interval '1 second' where email_hash=${email}`;
        assert.equal(
          (
            await tx`select app.read_email_auth_flow(${first},${binding}) result`
          )[0].result,
          null,
        );
        for (const role of ["anon", "authenticated", "app_runtime"]) {
          for (const table of [
            "email_auth_flows",
            "application_auth_sessions",
            "auth_credential_fences",
          ])
            assert.equal(
              (
                await tx`select has_table_privilege(${role},${"app." + table},'select,insert,update,delete') allowed`
              )[0].allowed,
              false,
            );
          if (role !== "app_runtime")
            assert.equal(
              (
                await tx`select has_function_privilege(${role},'app.grant_application_auth_session(uuid,uuid,text,text,text)','execute') allowed`
              )[0].allowed,
              false,
            );
        }
        throw new Rollback();
      }),
      Rollback,
    );
  } finally {
    await sql.end();
  }
});

test("managed sessions cannot cross identities, upgrade recovery, extend grants or survive credential revocation", async () => {
  const sql = db();
  try {
    await assert.rejects(
      sql.begin(async (tx) => {
        const subject = randomUUID(),
          other = randomUUID(),
          session = randomUUID(),
          later = randomUUID();
        for (const id of [subject, other])
          await tx`insert into auth.users(id,email_confirmed_at,is_sso_user,is_anonymous) values(${id}::uuid,statement_timestamp(),false,false)`;
        await tx`insert into auth.sessions(id,user_id,created_at,updated_at) values(${session}::uuid,${subject}::uuid,statement_timestamp()-interval '1 minute',statement_timestamp())`;
        await tx.unsafe("set local role app_runtime");
        const grant = async (user: string, id: string, purpose: string) =>
          (
            await tx`select app.grant_application_auth_session(${user}::uuid,${id}::uuid,${purpose},'/sessions','coach') result`
          )[0].result;
        assert.equal(await grant(other, session, "ordinary"), false);
        assert.equal(await grant(subject, randomUUID(), "ordinary"), false);
        assert.equal(await grant(subject, session, "recovery"), true);
        assert.equal(await grant(subject, session, "ordinary"), false);
        assert.equal(
          (
            await tx`select app.current_application_auth_purpose(${subject}::uuid,${session}::uuid) result`
          )[0].result,
          "recovery",
        );
        await tx.unsafe("reset role");
        const expiry = (
          await tx`select expires_at from app.application_auth_sessions where session_id=${session}::uuid`
        )[0].expires_at;
        assert.equal(await grant(subject, session, "recovery"), true);
        assert.deepEqual(
          (
            await tx`select expires_at from app.application_auth_sessions where session_id=${session}::uuid`
          )[0].expires_at,
          expiry,
        );
        await tx`select app.revoke_auth_credentials(${subject}::uuid,statement_timestamp())`;
        assert.equal(await grant(subject, session, "ordinary"), false);
        assert.equal(
          (
            await tx`select app.current_application_auth_purpose(${subject}::uuid,${session}::uuid) result`
          )[0].result,
          null,
        );
        await tx`insert into auth.sessions(id,user_id,created_at,updated_at) values(${later}::uuid,${subject}::uuid,statement_timestamp()+interval '1 millisecond',statement_timestamp())`;
        assert.equal(await grant(subject, later, "ordinary"), true);
        const [ordinary] =
          await tx`select expires_at > statement_timestamp()+interval '29 days' and expires_at <= statement_timestamp()+interval '30 days' bounded from app.application_auth_sessions where session_id=${later}::uuid`;
        assert.equal(ordinary.bounded, true);
        await tx`update app.application_auth_sessions set expires_at=statement_timestamp()-interval '1 second' where session_id=${later}::uuid`;
        assert.equal(
          (
            await tx`select app.current_application_auth_purpose(${subject}::uuid,${later}::uuid) result`
          )[0].result,
          null,
        );
        assert.equal(await grant(subject, later, "ordinary"), false);
        await tx`delete from auth.sessions where id=${later}::uuid`;
        assert.equal(
          (
            await tx`select count(*)::int n from app.application_auth_sessions where session_id=${later}::uuid`
          )[0].n,
          0,
        );
        throw new Rollback();
      }),
      Rollback,
    );
  } finally {
    await sql.end();
  }
});

test("concurrent resend and proof consumption have exactly one winner", async () => {
  const sql = postgres(url, {
    max: 2,
    ssl: false,
    prepare: false,
    onnotice: () => {},
  });
  const email = hex(),
    binding = hex(),
    ids = [hex(), hex()];
  try {
    const results = await Promise.all(
      ids.map(
        (id) =>
          sql`select app.begin_email_auth_flow(${id},${binding},${email},'login',null,'/sessions') result`,
      ),
    );
    assert.deepEqual(results.map((rows) => rows[0].result.status).sort(), [
      "rate-limited",
      "ready",
    ]);
    const winner =
      ids[results.findIndex((rows) => rows[0].result.status === "ready")];
    const consumed = await Promise.all(
      [1, 2].map(
        () =>
          sql`select app.consume_email_auth_flow(${winner},${binding}) result`,
      ),
    );
    assert.deepEqual(consumed.map((rows) => rows[0].result).sort(), [
      false,
      true,
    ]);
  } finally {
    await sql`delete from app.email_auth_flows where email_hash=${email}`;
    await sql.end();
  }
});

test("provider-generated hashes do not advertise an application password until there is explicit evidence", async () => {
  const sql = db();
  try {
    await assert.rejects(
      sql.begin(async (tx) => {
        const subject = randomUUID();
        await tx`insert into auth.users(id,encrypted_password,email_confirmed_at,is_sso_user,is_anonymous) values(${subject}::uuid,'opaque-provider-generated-fixture',statement_timestamp(),false,false)`;
        await tx.unsafe("set local role app_runtime");
        assert.equal(
          (await tx`select app.account_has_password(${subject}::uuid) value`)[0]
            .value,
          false,
        );
        await tx`select app.record_password_method(${subject}::uuid)`;
        assert.equal(
          (await tx`select app.account_has_password(${subject}::uuid) value`)[0]
            .value,
          true,
        );
        for (const role of ["anon", "authenticated", "app_runtime"])
          assert.equal(
            (
              await tx`select has_table_privilege(${role},'app.auth_password_methods','select,insert,update,delete') value`
            )[0].value,
            false,
          );
        await tx.unsafe("reset role");
        await tx`update auth.users set encrypted_password='' where id=${subject}::uuid`;
        assert.equal(
          (await tx`select app.account_has_password(${subject}::uuid) value`)[0]
            .value,
          false,
        );
        throw new Rollback();
      }),
      Rollback,
    );
  } finally {
    await sql.end();
  }
});
