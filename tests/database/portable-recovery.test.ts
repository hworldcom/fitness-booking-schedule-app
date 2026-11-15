import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
const target = process.env.DATABASE_TEST_URL;
const owned =
  target &&
  /^\/mov238_[a-f0-9]+_(fresh|upgrade)$/.test(new URL(target).pathname);
const hex = () => randomBytes(32).toString("hex");

test(
  "portable recovery SQL is bounded, purpose/address/expiry/supersession checked and atomic once",
  { skip: !owned },
  async () => {
    const url = new URL(target!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "55322");
    const sql = postgres(target!, { max: 4, prepare: false, onnotice() {} });
    const read = (id: string) =>
      sql.begin(async (tx) => {
        await tx`set local role app_runtime`;
        return (
          await tx`select app.read_recovery_email_auth_flow(${id}) result`
        )[0].result;
      });
    const consume = (id: string, email: string) =>
      sql.begin(async (tx) => {
        await tx`set local role app_runtime`;
        return (
          await tx`select app.consume_recovery_email_auth_flow(${id},${email}) result`
        )[0].result;
      });
    const start = (
      id: string,
      email: string,
      purpose = "recovery",
      binding = hex(),
    ) =>
      sql.begin(async (tx) => {
        await tx`set local role app_runtime`;
        return (
          await tx`select app.begin_email_auth_flow(${id},${binding},${email},${purpose},'coach','/invitations') result`
        )[0].result;
      });
    try {
      for (const fn of [
        "app.read_recovery_email_auth_flow(text)",
        "app.consume_recovery_email_auth_flow(text,text)",
      ]) {
        for (const role of ["anon", "authenticated", "service_role"])
          assert.equal(
            (
              await sql`select has_function_privilege(${role},${fn},'execute') allowed`
            )[0].allowed,
            false,
          );
        assert.equal(
          (
            await sql`select has_function_privilege('app_runtime',${fn},'execute') allowed`
          )[0].allowed,
          true,
        );
        const [info] =
          await sql`select pg_get_userbyid(proowner) owner,prosecdef from pg_proc where oid=${fn}::regprocedure`;
        assert.equal(info.owner, "app_owner");
        assert.equal(info.prosecdef, true);
      }
      assert.equal(
        (
          await sql`select has_table_privilege('app_runtime','app.email_auth_flows','select') allowed`
        )[0].allowed,
        false,
      );
      assert.equal(await read("malformed"), null);
      assert.equal(await read(hex()), null);
      const confirmation = hex(),
        binding = hex(),
        confirmationEmail = hex();
      assert.equal(
        (await start(confirmation, confirmationEmail, "confirmation", binding))
          .status,
        "ready",
      );
      assert.equal(await read(confirmation), null);
      assert.equal(await consume(confirmation, confirmationEmail), false);
      assert.equal(
        (
          await sql`select app.read_email_auth_flow(${confirmation},${hex()}) result`
        )[0].result,
        null,
      );
      assert.ok(
        (
          await sql`select app.read_email_auth_flow(${confirmation},${binding}) result`
        )[0].result,
      );
      const id = hex(),
        email = hex();
      assert.equal((await start(id, email)).status, "ready");
      assert.deepEqual(await read(id), {
        emailHash: email,
        purpose: "recovery",
        intent: "coach",
        returnTo: "/invitations",
      });
      assert.equal(await consume(id, hex()), false);
      assert.ok(await read(id));
      const results = await Promise.all([
        consume(id, email),
        consume(id, email),
      ]);
      assert.deepEqual(results.sort(), [false, true]);
      assert.equal(await read(id), null);
      assert.equal(await consume(id, email), false);
      const expired = hex(),
        expiredEmail = hex();
      await start(expired, expiredEmail);
      await sql`update app.email_auth_flows set expires_at=statement_timestamp()-interval '1 second' where id_hash=${expired}`;
      assert.equal(await read(expired), null);
      assert.equal(await consume(expired, expiredEmail), false);
      const old = hex(),
        fresh = hex(),
        supersededEmail = hex();
      await start(old, supersededEmail);
      assert.equal(
        (await start(fresh, supersededEmail)).status,
        "rate-limited",
      );
      await sql`update app.email_auth_flows set requested_at=statement_timestamp()-interval '61 seconds' where id_hash=${old}`;
      await start(fresh, supersededEmail);
      assert.equal(await read(old), null);
      assert.ok(await read(fresh));
      await start(hex(), supersededEmail, "confirmation");
      assert.equal(await read(fresh), null);
      assert.equal(await consume(fresh, supersededEmail), false);
    } finally {
      await sql.end();
    }
  },
);
