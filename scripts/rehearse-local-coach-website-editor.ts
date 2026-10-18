/** Fixture companion for manual browser checks; no browser automation. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { localConnectionRehearsal } from "./lib/local-connection-rehearsal";
import { parseLocalSupabaseStatus } from "./lib/local-coach-accounts";

const fixture = await localConnectionRehearsal("DEV0315");
const { database, person, approveCoach, cookieHeader, cleanup, base } = fixture;
const hashes = async () =>
  new Map(
    (
      await database<{ key: string; hash: string }[]>`
  select 'profile:'||id::text key,md5(to_jsonb(t)::text) hash from app.profiles t
  union all select 'coach:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_profiles t
  union all select 'location:'||id::text,md5(to_jsonb(t)::text) from app.coach_training_locations t
  union all select 'website:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_website_content t
  union all select 'rate:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_starting_rates t
  union all select 'object:'||id::text,md5(to_jsonb(t)::text) from storage.objects t
`
    ).map((row) => [row.key, row.hash]),
  );
const baseline = await hashes();
const evidence = `tmp/dev0315-editor/${randomUUID()}`;
await mkdir(evidence, { recursive: true, mode: 0o700 });
await writeFile(
  `${evidence}/baseline-hashes.json`,
  JSON.stringify([...baseline]),
  { mode: 0o600 },
);
try {
  const owner = await person(`Website Preview ${randomUUID().slice(0, 6)}`);
  await writeFile(
    `${evidence}/recovery-ids.json`,
    JSON.stringify({ authUserId: owner.id, profileId: owner.actor.profileId }),
    { mode: 0o600 },
  );
  await approveCoach(owner);
  const status = parseLocalSupabaseStatus(
    execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
      stdio: ["ignore", "pipe", "pipe"],
    }).toString(),
  );
  const auth = createClient(status.apiUrl, status.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Only this just-created tagged test identity receives the public fixture password.
  const updated = await auth.auth.admin.updateUserById(owner.id, {
    password: "MovxPreview-DEV0315!2026",
  });
  assert.ifError(updated.error);
  const [identity] =
    await database`select email from auth.users where id=${owner.id}::uuid and raw_app_meta_data->>'movx_test_ticket'='DEV0315'`;
  // Setting a fixture password invalidates earlier sessions. Obtain new cookies
  // rather than mistaking the old session's 401 for an editor failure.
  const signed = await fetch(base + "/api/auth/operations", {
    signal: AbortSignal.timeout(60_000),
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({
      action: "sign-in",
      email: identity.email,
      password: "MovxPreview-DEV0315!2026",
    }),
  });
  assert.equal(signed.status, 200);
  owner.cookies = signed.headers.getSetCookie().map((cookie) => {
    const pair = cookie.split(";", 1)[0],
      separator = pair.indexOf("=");
    return { name: pair.slice(0, separator), value: pair.slice(separator + 1) };
  });
  const [coach] =
    await database`select public_slug from app.coach_profiles where profile_id=${owner.actor.profileId}::uuid`;
  console.log(
    JSON.stringify({
      fixture: "DEV0315 temporary owner",
      email: identity.email,
      path: "/profile/coach",
      publicPath: `/coaches/${coach.public_slug}`,
      commands: "conflict | verify | finish",
    }),
  );
  const lines = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  for await (const line of lines) {
    if (line.trim() === "finish") {
      lines.close();
      break;
    }
    if (!["conflict", "verify"].includes(line.trim())) continue;
    const headers = { cookie: cookieHeader(owner), origin: base };
    const read = await fetch(base + "/api/coach/website", {
      headers,
      signal: AbortSignal.timeout(60_000),
    });
    assert.equal(read.status, 200);
    const saved = await read.json();
    if (line.trim() === "conflict") {
      const result = await fetch(base + "/api/coach/website", {
        signal: AbortSignal.timeout(60_000),
        method: "PUT",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          expectedRevision: saved.website.revision,
          content: {
            ...saved.website.content,
            brandLabel: "Saved in another tab",
          },
        }),
      });
      assert.equal(result.status, 200);
      console.log(
        "Created a real stale-revision condition on the exact temporary coach.",
      );
    } else {
      const rateRead = await fetch(base + "/api/coach/starting-rate", {
        headers,
        signal: AbortSignal.timeout(60_000),
      });
      assert.equal(rateRead.status, 200);
      const rate = await rateRead.json();
      const publicRead = await fetch(
        base + `/api/coaches/${coach.public_slug}/website`,
        { signal: AbortSignal.timeout(60_000) },
      );
      assert.equal(
        publicRead.status,
        404,
        "Temporary hidden owner must stay private",
      );
      console.log(
        JSON.stringify({
          websiteRevision: saved.website.revision,
          banner: saved.website.banner !== null,
          faqCount: saved.website.content.faqs.length,
          linkCount: saved.website.content.links.length,
          rateRevision: rate.startingRate.revision,
          amountCents: rate.startingRate.amountCents,
          showPublicly: rate.startingRate.showPublicly,
          hiddenPublicRead: publicRead.status,
        }),
      );
    }
  }
} finally {
  let cleanupError: unknown;
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }
  try {
    const after = await hashes();
    for (const [key, value] of baseline)
      assert.equal(after.get(key), value, `Retained data changed: ${key}`);
    await writeFile(
      `${evidence}/result.json`,
      JSON.stringify({
        retainedRowHashesUnchanged: baseline.size,
        cleanup: cleanupError ? "failed; recover exact IDs" : "passed",
      }),
      { mode: 0o600 },
    );
    console.log(
      `${baseline.size} retained row hashes unchanged; recovery evidence: ${evidence}.`,
    );
  } finally {
    await database.end();
  }
  if (cleanupError) throw cleanupError;
  console.log("Exact DEV0315 fixture cleanup passed.");
}
