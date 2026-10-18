/** Fixture companion for native browser checks; no browser automation. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";
import { parseLocalSupabaseStatus } from "./lib/local-coach-accounts";
import { submitOwnedCoachApplicationRecord } from "../src/server/db/coaches/application-repository";
import { upsertOwnedCoachProfileRecord } from "../src/server/db/coaches/repository";

const fixture = await localConnectionRehearsal("DEV0315");
const { database, person, approveCoach, work, cookieHeader, cleanup, base } =
  fixture;
const status = parseLocalSupabaseStatus(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  }).toString(),
);
const auth = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tag = randomUUID().replaceAll("-", "").slice(0, 8);
const handles = [`dev0315_${tag}`, `dev0315_${tag}_new`];
const people: LocalPerson[] = [];
const hashes = async () =>
  new Map(
    (
      await database<{ key: string; hash: string }[]>`
  select 'profile:'||id::text key,md5(to_jsonb(t)::text) hash from app.profiles t
  union all select 'coach:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_profiles t
  union all select 'location:'||id::text,md5(to_jsonb(t)::text) from app.coach_training_locations t
  union all select 'website:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_website_content t
  union all select 'rate:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_starting_rates t
  union all select 'details:'||profile_id::text,md5(to_jsonb(t)::text) from app.account_personal_details t
  union all select 'handle:'||username,md5(to_jsonb(t)::text) from app.coach_public_handles t
  union all select 'object:'||id::text,md5(to_jsonb(t)::text) from storage.objects t
  union all select 'auth:'||id::text,md5((to_jsonb(t)-'last_sign_in_at'-'updated_at')::text) from auth.users t`
    ).map((row) => [row.key, row.hash]),
  );
const baseline = await hashes();
const evidence = `tmp/dev0315-editor/${randomUUID()}`;
await mkdir(evidence, { recursive: true, mode: 0o700 });
await writeFile(
  `${evidence}/baseline-hashes.json`,
  JSON.stringify([...baseline]),
  {
    mode: 0o600,
  },
);
const checked: string[] = [];
async function journal() {
  await writeFile(
    `${evidence}/recovery-ids.json`,
    JSON.stringify({
      ticket: "DEV0315",
      people: people.map((entry) => ({
        authUserId: entry.id,
        profileId: entry.actor.profileId,
      })),
      handles,
    }),
    { mode: 0o600 },
  );
}
async function request(
  path: string,
  actor?: LocalPerson,
  init: RequestInit = {},
) {
  return fetch(base + path, {
    ...init,
    signal: AbortSignal.timeout(60_000),
    headers: {
      origin: base,
      ...(actor ? { cookie: cookieHeader(actor) } : {}),
      ...init.headers,
    },
  });
}
async function json(path: string, actor: LocalPerson, body?: unknown) {
  const response = await request(
    path,
    actor,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  assert.equal(response.status, 200, `Fixture request failed: ${path}`);
  return response.json();
}
const profile = (actor: LocalPerson, visibility: "visible" | "hidden") => ({
  displayName: actor.name,
  bio: "A disposable DEV0315 coach for editor validation; not a retained example.",
  disciplines: ["Boxing"] as const,
  timezone: "Europe/Berlin",
  visibility,
  selectedGymId: "40000000-0000-4000-8000-000000000001",
  independentLocation: null,
});
async function browserLogin(actor: LocalPerson) {
  // This public fixture-only password is set only on this run's new tagged ID.
  const updated = await auth.auth.admin.updateUserById(actor.id, {
    password: "MovxPreview-DEV0315!2026",
  });
  assert.ifError(updated.error);
  const [identity] = await database`
    select email from auth.users where id=${actor.id}::uuid
    and raw_app_meta_data->>'movx_test_ticket'='DEV0315'
    and raw_app_meta_data->>'temporary'='true'`;
  assert.ok(identity?.email);
  const signed = await request("/api/auth/operations", undefined, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "sign-in",
      email: identity.email,
      password: "MovxPreview-DEV0315!2026",
    }),
  });
  assert.equal(signed.status, 200);
  actor.cookies = signed.headers.getSetCookie().map((cookie) => {
    const pair = cookie.split(";", 1)[0],
      separator = pair.indexOf("=");
    return { name: pair.slice(0, separator), value: pair.slice(separator + 1) };
  });
  return identity.email as string;
}
try {
  assert.equal(
    (
      await database`select id from auth.users where raw_app_meta_data->>'movx_test_ticket'='DEV0315'`
    ).length,
    0,
    "Resolve prior DEV0315 fixture cleanup before a new run.",
  );
  const owner = await person(`DEV0315 Owner ${tag}`);
  people.push(owner);
  await journal();
  await approveCoach(owner);
  const applicant = await person(`DEV0315 Applicant ${tag}`);
  people.push(applicant);
  await journal();
  await work(applicant, submitOwnedCoachApplicationRecord);
  await work(applicant, (tx) =>
    upsertOwnedCoachProfileRecord(tx, profile(applicant, "hidden")),
  );
  const other = await person(`DEV0315 Athlete ${tag}`);
  people.push(other);
  await journal();
  const credentials = [];
  for (const entry of people)
    credentials.push({ name: entry.name, email: await browserLogin(entry) });
  const account = await json("/api/account", owner);
  await json("/api/account", owner, {
    section: "personal-details",
    revision: account.details.revision,
    legalName: `Private DEV0315 canary ${tag}`,
    preferredFirstName: null,
    birthdate: null,
    gender: null,
  });
  await sharp({
    create: { width: 640, height: 240, channels: 3, background: "#426d58" },
  })
    .png()
    .toFile(`${evidence}/valid-banner.png`);
  await writeFile(
    `${evidence}/invalid-banner.png`,
    "DEV0315 invalid image fixture",
    { mode: 0o600 },
  );
  const [coach] =
    await database`select public_slug from app.coach_profiles where profile_id=${owner.actor.profileId}::uuid`;
  const [pendingCoach] =
    await database`select public_slug from app.coach_profiles where profile_id=${applicant.actor.profileId}::uuid`;
  const ordinary = await request("/api/coach/website", other);
  assert.equal(ordinary.status, 403);
  const applicantPublic = await request(
    `/api/coaches/${pendingCoach.public_slug}/website`,
  );
  assert.equal(applicantPublic.status, 404);
  checked.push(
    "ordinary account cannot read an owner website; pending applicant has no public website",
  );
  console.log(
    JSON.stringify({
      fixture: "DEV0315 exact temporary accounts",
      base,
      credentials,
      path: "/profile/coach",
      publicPath: `/coaches/${coach.public_slug}`,
      evidence,
      commands:
        "conflict | verify | publish | hide | username | rename | finish",
    }),
  );
  const lines = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  for await (const line of lines) {
    const command = line.trim();
    if (command === "finish") {
      lines.close();
      break;
    }
    if (
      !["conflict", "verify", "publish", "hide", "username", "rename"].includes(
        command,
      )
    )
      continue;
    if (command === "publish" || command === "hide") {
      await work(owner, (tx) =>
        upsertOwnedCoachProfileRecord(
          tx,
          profile(owner, command === "publish" ? "visible" : "hidden"),
        ),
      );
      console.log(
        `Only the exact new owner fixture is now ${command === "publish" ? "visible" : "hidden"}.`,
      );
      continue;
    }
    if (command === "username" || command === "rename") {
      const current = await json("/api/account", owner);
      await json("/api/account", owner, {
        section: "login-security",
        revision: current.details.revision,
        username: handles[command === "username" ? 0 : 1],
      });
      console.log(
        JSON.stringify({
          savedFixtureUsername: handles[command === "username" ? 0 : 1],
          ordinarySaveDoesNotConfirm: true,
        }),
      );
      continue;
    }
    const saved = await json("/api/coach/website", owner);
    if (command === "conflict") {
      const result = await request("/api/coach/website", owner, {
        method: "PUT",
        headers: { "content-type": "application/json" },
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
        "Created a real stale revision only for the new tagged coach.",
      );
    } else {
      const rate = await json("/api/coach/starting-rate", owner);
      const [visibility] =
        await database`select visibility from app.coach_profiles where profile_id=${owner.actor.profileId}::uuid`;
      const publicRead = await request(
        `/api/coaches/${coach.public_slug}/website`,
      );
      assert.equal(
        publicRead.status,
        visibility.visibility === "visible" ? 200 : 404,
      );
      if (publicRead.status === 200) {
        const publicText = await publicRead.text();
        assert.ok(!publicText.includes(`Private DEV0315 canary ${tag}`));
        const projected = JSON.parse(publicText);
        assert.equal(
          Boolean(projected.website.startingRate),
          rate.startingRate.amountCents !== null &&
            rate.startingRate.showPublicly,
        );
      }
      checked.push(
        "saved website/rate revisions and current visibility/public rate/privacy verified",
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
          publicRead: publicRead.status,
        }),
      );
    }
  }
} finally {
  let cleanupError: unknown;
  try {
    const ids = people.map((entry) => entry.actor.profileId);
    const published = ids.length
      ? await database<
          { username: string }[]
        >`select username from app.coach_public_handles where profile_id=any(${ids}::uuid[])`
      : [];
    assert.ok(published.every((entry) => handles.includes(entry.username)));
    await cleanup();
    for (const entry of published)
      await database`delete from app.coach_public_handles where username=${entry.username} and profile_id is null`;
    for (const entry of people) {
      assert.equal(
        (await database`select id from auth.users where id=${entry.id}::uuid`)
          .length,
        0,
      );
      assert.equal(
        (
          await database`select id from app.profiles where id=${entry.actor.profileId}::uuid`
        ).length,
        0,
      );
    }
    assert.equal(
      (
        await database`select username from app.coach_public_handles where username=any(${handles}::text[])`
      ).length,
      0,
    );
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
        checked,
        retainedRowHashesUnchanged: baseline.size,
        cleanup: cleanupError ? "failed; recover exact journal IDs" : "passed",
      }),
      { mode: 0o600 },
    );
    console.log(
      `${baseline.size} original application/Auth/Storage hashes unchanged; evidence: ${evidence}.`,
    );
  } finally {
    await database.end();
  }
  if (cleanupError) throw cleanupError;
  console.log("Exact DEV0315 fixture, banner and test-handle cleanup passed.");
}
