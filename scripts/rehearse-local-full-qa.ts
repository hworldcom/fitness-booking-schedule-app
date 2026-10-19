/** Temporary local accounts for a two-role manual QA audit. Never seeds retained data. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";
import { parseLocalSupabaseStatus } from "./lib/local-coach-accounts";
import { upsertOwnedCoachProfileRecord } from "../src/server/db/coaches/repository";
import { saveOwnedEffectiveAvailabilityRecord } from "../src/server/db/coaches/effective-availability-repository";
import { calendarDate, addCalendarDays } from "../src/domain/coach-calendar";

const fixture = await localConnectionRehearsal("DEV0367");
const {
  database: db,
  person,
  work,
  approveCoach,
  cleanup,
  cookieHeader,
  base,
} = fixture;
const status = parseLocalSupabaseStatus(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  }).toString(),
);
const admin = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const people: LocalPerson[] = [];
const evidence = "work/dev0367";
await mkdir(evidence, { recursive: true, mode: 0o700 });
const retained = () => db<{ key: string; hash: string }[]>`
select 'profile:'||id::text key,md5(to_jsonb(t)::text) hash from app.profiles t
union all select 'coach:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_profiles t
union all select 'location:'||id::text,md5(to_jsonb(t)::text) from app.coach_training_locations t
union all select 'website:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_website_content t
union all select 'rate:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_starting_rates t
union all select 'details:'||profile_id::text,md5(to_jsonb(t)::text) from app.account_personal_details t
union all select 'object:'||id::text,md5(to_jsonb(t)::text) from storage.objects t
union all select 'auth:'||id::text,md5((to_jsonb(t)-'last_sign_in_at'-'updated_at')::text) from auth.users t`;
type Fingerprint = { key: string; hash: string };
async function verifyPreservation(
  before: readonly Fingerprint[],
  authIds: readonly string[],
) {
  const after = new Map((await retained()).map((row) => [row.key, row.hash]));
  const result = {
    originalRecords: before.length,
    changed: before
      .filter((row) => after.get(row.key) !== row.hash)
      .map((row) => row.key),
    remainingOwnedAuth: (
      await db`select count(*)::int count from auth.users where id=any(${authIds}::uuid[])`
    )[0].count,
  };
  await writeFile(
    `${evidence}/preservation.json`,
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ cleanup: result }));
  assert.deepEqual(result.changed, [], "Retained records changed");
  assert.equal(result.remainingOwnedAuth, 0);
}
if (process.argv.includes("--cleanup")) {
  // Fixed local journals only; never infer ownership from a missing marker.
  const manifest: unknown = JSON.parse(
    await readFile(`${evidence}/owned-ids.json`, "utf8"),
  );
  const before: unknown = JSON.parse(
    await readFile(`${evidence}/baseline.json`, "utf8"),
  );
  assert.ok(
    Array.isArray(manifest) && manifest.length > 0 && manifest.length <= 16,
  );
  assert.ok(
    manifest.every(
      (row) => row && typeof row === "object" && typeof row.id === "string",
    ),
  );
  assert.ok(
    Array.isArray(before) &&
      before.every(
        (row) =>
          row &&
          typeof row === "object" &&
          typeof row.key === "string" &&
          typeof row.hash === "string",
      ),
  );
  const authIds = (manifest as { id: string }[]).map((row) => row.id);
  const owned = await db<{ id: string; profile_id: string }[]>`
    select u.id,p.id profile_id from auth.users u join app.profiles p on p.auth_user_id=u.id
    where u.id=any(${authIds}::uuid[]) and u.raw_app_meta_data->>'movx_test_ticket'='DEV0367'
    and u.raw_app_meta_data->>'temporary'='true' and u.email like 'dev0367-connections-%@users.movx.test'`;
  assert.equal(new Set(authIds).size, authIds.length);
  assert.equal(
    owned.length,
    authIds.length,
    "Recovery ownership must match every journal identity.",
  );
  try {
    const profileIds = owned.map((row) => row.profile_id);
    const handles = await db<
      { username: string }[]
    >`select username from app.coach_public_handles where profile_id=any(${profileIds}::uuid[])`;
    await db`delete from app.coach_pair_reviews where coach_profile_id=any(${profileIds}::uuid[]) or athlete_profile_id=any(${profileIds}::uuid[])`;
    await cleanup(authIds);
    for (const handle of handles)
      await db`delete from app.coach_public_handles where username=${handle.username} and profile_id is null`;
    await verifyPreservation(before as Fingerprint[], authIds);
  } finally {
    await db.end();
  }
  process.exit(0);
}
const baseline = await retained();
await writeFile(`${evidence}/baseline.json`, JSON.stringify(baseline), {
  mode: 0o600,
});
async function request(
  path: string,
  actor: LocalPerson | null = null,
  input?: unknown,
  method = "POST",
) {
  const response = await fetch(base + path, {
    ...(input !== undefined ? { method, body: JSON.stringify(input) } : {}),
    headers: {
      origin: base,
      "content-type": "application/json",
      ...(actor ? { cookie: cookieHeader(actor) } : {}),
    },
    signal: AbortSignal.timeout(90000),
  });
  return {
    http: response.status,
    body: await response.json().catch(() => null),
  };
}
try {
  const tag = randomUUID().slice(0, 6);
  const accounts = [];
  for (const role of ["Coach", "Athlete A", "Athlete B", "Stranger"]) {
    const p = await person(`QA ${role} ${tag}`);
    people.push(p);
    await writeFile(
      `${evidence}/owned-ids.json`,
      JSON.stringify(
        people.map((p) => ({ id: p.id, profileId: p.actor.profileId })),
      ),
      { mode: 0o600 },
    );
    const password = `QA0367!${randomUUID()}`;
    assert.ifError(
      (await admin.auth.admin.updateUserById(p.id, { password })).error,
    );
    const user = await admin.auth.admin.getUserById(p.id);
    const email = user.data.user!.email!;
    // Credential change applies only to a newly created fixture. Reauthenticate its API session.
    const signed = await fetch(base + "/api/auth/operations", {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({ action: "sign-in", email, password }),
    });
    assert.equal(signed.status, 200);
    p.cookies = signed.headers.getSetCookie().map((v) => {
      const pair = v.split(";", 1)[0],
        i = pair.indexOf("=");
      return { name: pair.slice(0, i), value: pair.slice(i + 1) };
    });
    accounts.push({
      role,
      name: p.name,
      email,
      password,
      profileId: p.actor.profileId,
    });
  }
  const coach = people[0];
  await approveCoach(coach);
  await work(coach, (tx) =>
    upsertOwnedCoachProfileRecord(tx, {
      displayName: coach.name,
      bio: "Disposable local quality assurance coach. Boxing technique and footwork in Berlin.",
      disciplines: ["Boxing"],
      timezone: "Europe/Berlin",
      visibility: "visible",
      selectedGymId: "40000000-0000-4000-8000-000000000001",
      independentLocation: null,
    }),
  );
  const [location] =
    await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.actor.profileId}::uuid and is_primary`;
  const [publicCoach] =
    await db`select public_slug from app.coach_profiles where profile_id=${coach.actor.profileId}::uuid`;
  const today = calendarDate(
    (await db`select statement_timestamp()::text now`)[0].now,
  );
  const dates = [1, 2, 3, 6, 29].map((n) => addCalendarDays(today, n));
  const available = await work(coach, (tx) =>
    saveOwnedEffectiveAvailabilityRecord(tx, {
      kind: "dates",
      operationId: randomUUID(),
      expectedRevision: 0,
      dates: dates.map((date) => ({
        date,
        mode: "custom" as const,
        hours: [
          "09:00",
          "10:00",
          "11:00",
          "12:00",
          "13:00",
          "14:00",
          "15:00",
          "16:00",
          "17:00",
        ].map((localStartTime) => ({
          localStartTime,
          locationId: location.id,
          locationUpdatedAt: location.stamp,
        })),
      })),
    }),
  );
  assert.equal(available.outcome, "saved");
  for (const minutes of [60, 75, 90]) {
    const result = await request("/api/coach/session-types", coach, {
      commandId: randomUUID(),
      action: "save",
      id: randomUUID(),
      expectedRevision: -1,
      format: "private",
      name: `QA Boxing ${minutes}`,
      description: "Temporary QA offer",
      color: "#61417b",
      durationMinutes: minutes,
      defaultLocationId: location.id,
      bookable: true,
    });
    assert.equal(result.http, 200, JSON.stringify(result));
  }
  const info = {
    base,
    accounts,
    coachUrl: `${base}/coaches/${publicCoach.public_slug}`,
    slug: publicCoach.public_slug,
    locationId: location.id,
    dates,
  };
  await writeFile(`${evidence}/fixture.json`, JSON.stringify(info, null, 2), {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      ready: true,
      coachUrl: info.coachUrl,
      dates,
      credentialsFile: `${evidence}/fixture.json`,
    }),
  );
  console.log(
    'Commands: {"actor":0,"path":"/api/...","input":{...},"method":"POST"}; or cleanup',
  );
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim() === "cleanup") {
      rl.close();
      break;
    }
    try {
      const c = JSON.parse(line);
      assert.ok(typeof c.path === "string" && c.path.startsWith("/api/"));
      console.log(
        JSON.stringify(
          await request(
            c.path,
            c.actor === null ? null : people[c.actor ?? 0],
            c.input,
            c.method ?? "POST",
          ),
        ),
      );
    } catch (error) {
      console.log(String(error));
    }
  }
} finally {
  // Public-handle and review history belongs only to this exact run's temporary owners.
  const ids = people.map((p) => p.actor.profileId);
  const handles = ids.length
    ? await db<
        { username: string }[]
      >`select username from app.coach_public_handles where profile_id=any(${ids}::uuid[])`
    : [];
  if (ids.length) {
    await db`delete from app.coach_pair_reviews where coach_profile_id=any(${ids}::uuid[]) or athlete_profile_id=any(${ids}::uuid[])`;
  }
  await cleanup();
  // Published handles intentionally retain tombstones in normal product use.
  // Only aliases observed on these disposable owners may be removed here.
  for (const handle of handles)
    await db`delete from app.coach_public_handles where username=${handle.username} and profile_id is null`;
  try {
    await verifyPreservation(
      baseline,
      people.map((p) => p.id),
    );
  } finally {
    await db.end();
  }
}
