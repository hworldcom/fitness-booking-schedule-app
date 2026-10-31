import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import {
  currentOwnedCoachApplicationContact,
  saveOwnedCoachApplicationContact,
  CoachApplicationContactConflictError,
} from "@/server/db/coaches/application-contact-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";

const target = process.env.DATABASE_TEST_URL;
function permissionDenied(error: unknown): boolean {
  let current = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth++
  ) {
    if ("code" in current && current.code === "42501") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}
test(
  "Instagram application handles, private persistence and staff snapshots",
  {
    skip:
      !target ||
      !/^\/mov140_[a-f0-9]+_(fresh|upgrade|release_upgrade)$/.test(
        new URL(target).pathname,
      ),
  },
  async (t) => {
    const admin = postgres(target!, {
      max: 1,
      prepare: false,
      onnotice: () => {},
    });
    const runtimeUrl = new URL(target!);
    runtimeUrl.username = "repx_runtime_login";
    runtimeUrl.password = "postgres";
    process.env.DATABASE_URL = runtimeUrl.toString();
    const work = <T>(
      actor: AuthorizedActor,
      fn: Parameters<typeof withActorDatabaseContext<T>>[1],
    ) => withActorDatabaseContext(actor, fn);
    const contact = {
      phoneNumber: "+4915123456789",
      instagramUrl: "https://www.instagram.com/_real__h",
      facebookUrl: null,
      linkedinUrl: null,
    };
    try {
      await t.test(
        "SQL accepts bare/www Instagram underscores and retains ordinary platform paths",
        async () => {
          for (const prefix of ["", "www."]) {
            for (const name of [
              "_real__h",
              "__coach",
              "_coach/?igsh=test",
              "normal_coach",
            ]) {
              const [row] =
                await admin`select app.valid_application_social_url(${`https://${prefix}instagram.com/${name}`},'instagram.com') valid`;
              assert.equal(row.valid, true);
            }
          }
          for (const [host, path] of [
            ["facebook.com", "profile.php?id=123"],
            ["linkedin.com", "in/coach-name"],
          ]) {
            assert.equal(
              (
                await admin`select app.valid_application_social_url(${`https://www.${host}/${path}`},${host}) valid`
              )[0].valid,
              true,
            );
            assert.equal(
              (
                await admin`select app.valid_application_social_url(${`https://${host}/_coach`},${host}) valid`
              )[0].valid,
              false,
            );
          }
        },
      );
      await t.test(
        "SQL still rejects unsafe hosts, credentials, schemes, ports and control bytes",
        async () => {
          for (const value of [
            "http://instagram.com/_real__h",
            "https://instagram.com.evil.test/_real__h",
            "https://evilinstagram.com/_real__h",
            "https://instagram.com@evil.test/_real__h",
            "https://evil.test@instagram.com/_real__h",
            "https://instagram.com:444/_real__h",
            "https://instagram.com/",
            "https://instagram.com/_real__h%0aBcc",
            "https://instagram.com/_real__h%00",
            "https://instagram.com/_real__h\r\nBcc",
            "https://instagram.com/_real h",
            "https://instagram.com/_<script>",
            "https://instagram.com/" + "_".repeat(501),
          ])
            assert.equal(
              (
                await admin`select app.valid_application_social_url(${value},'instagram.com') valid`
              )[0].valid,
              false,
              value,
            );
        },
      );
      const actors: AuthorizedActor[] = [];
      for (let i = 0; i < 2; i++) {
        const auth = randomUUID();
        await admin`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${auth},${`mov140-${auth}@example.test`},statement_timestamp(),false,false)`;
        const [row] =
          await admin`select * from app.enroll_application_identity(${auth}::uuid,'Instagram coach','Instagram coach',${"ig_" + auth.replaceAll("-", "").slice(0, 12)})`;
        actors.push({
          authUserId: auth,
          profileId: row.identity_profile_id,
          runId: row.identity_run_id,
          runRole: "member",
        });
      }
      const [owner, other] = actors;
      await work(owner, submitOwnedCoachApplicationRecord);
      await t.test(
        "real restricted save/read and exact retry preserve the submitted link",
        async () => {
          assert.equal(
            await work(owner, (tx) =>
              saveOwnedCoachApplicationContact(tx, contact, 0),
            ),
            1,
          );
          assert.equal(
            await work(owner, (tx) =>
              saveOwnedCoachApplicationContact(tx, contact, 0),
            ),
            1,
          );
          assert.deepEqual(
            await work(owner, currentOwnedCoachApplicationContact),
            { ...contact, revision: 1 },
          );
          await assert.rejects(
            work(owner, (tx) =>
              saveOwnedCoachApplicationContact(
                tx,
                { ...contact, instagramUrl: "https://instagram.com/_changed" },
                0,
              ),
            ),
            CoachApplicationContactConflictError,
          );
          assert.deepEqual(
            await work(owner, currentOwnedCoachApplicationContact),
            { ...contact, revision: 1 },
          );
        },
      );
      await t.test(
        "application submission snapshots the exact private URL without an external send",
        async () => {
          await work(owner, (tx) =>
            upsertOwnedCoachProfileRecord(tx, {
              displayName: "Instagram coach",
              bio: "Supportive individual coaching for strength and confidence with clear, practical feedback.",
              disciplines: ["Boxing"],
              timezone: "Europe/Berlin",
              visibility: "hidden",
              selectedGymId: "40000000-0000-4000-8000-000000000001",
              independentLocation: null,
            }),
          );
          const rows =
            await admin`select contact_details->>'instagramUrl' url,state from app.coach_application_emails where profile_id=${owner.profileId}::uuid`;
          assert.equal(rows.length, 1);
          assert.equal(rows[0].url, contact.instagramUrl);
          assert.equal(rows[0].state, "queued");
        },
      );
      await t.test(
        "private contacts and validator remain inaccessible to other actors and raw runtime reads",
        async () => {
          assert.equal(
            await work(other, currentOwnedCoachApplicationContact),
            null,
          );
          await assert.rejects(
            work(other, (tx) =>
              tx.execute(sql`select * from app.coach_application_contacts`),
            ),
            permissionDenied,
          );
          await assert.rejects(
            work(owner, (tx) =>
              tx.execute(
                sql`select app.valid_application_social_url('https://instagram.com/_real__h','instagram.com')`,
              ),
            ),
            permissionDenied,
          );
          await assert.rejects(
            work(
              { ...owner, authUserId: other.authUserId },
              currentOwnedCoachApplicationContact,
            ),
          );
        },
      );
      await t.test(
        "table constraints independently reject unsafe replacement links",
        async () => {
          await assert.rejects(
            admin`update app.coach_application_contacts set details=jsonb_set(details,'{instagramUrl}',to_jsonb('https://evil.test/_real__h'::text)) where profile_id=${owner.profileId}::uuid`,
            /check constraint/,
          );
          assert.deepEqual(
            await work(owner, currentOwnedCoachApplicationContact),
            { ...contact, revision: 1 },
          );
        },
      );
    } finally {
      await admin.end();
    }
  },
);
