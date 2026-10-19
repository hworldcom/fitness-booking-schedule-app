/** Disposable local API fixtures and a preview for native browser verification. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { openSync } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  symlink,
  writeFile,
  readdir,
  readFile,
} from "node:fs/promises";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";
import {
  parseLocalSupabaseStatus,
  assertLoopbackSupabaseTargets,
} from "./lib/local-coach-accounts";
import { localDevelopmentProcessEnvironment } from "./lib/local-development";
import { upsertOwnedCoachProfileRecord } from "../src/server/db/coaches/repository";
import { saveOwnedEffectiveAvailabilityRecord } from "../src/server/db/coaches/effective-availability-repository";
import { calendarDate, addCalendarDays } from "../src/domain/coach-calendar";
import { berlinLocalInstant } from "../src/features/coach-events/contract";

const status = parseLocalSupabaseStatus(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  }).toString(),
);
assertLoopbackSupabaseTargets(status);
const base = "http://localhost:3166";
const reuse = process.env.PRIVATE_SCHEDULE_PREVIEW_PATH;
const preview = reuse ?? (await mkdtemp("/private/tmp/movx-dev0366-"));
assert.match(preview, /^\/private\/tmp\/movx-dev0366-[A-Za-z0-9]{6}$/);
if (reuse) {
  for (const path of await readdir("src", { recursive: true })) {
    if (/\.(tsx?|css)$/.test(path))
      assert.ok(
        (await readFile(`src/${path}`)).equals(
          await readFile(`${preview}/src/${path}`),
        ),
        `Preview source differs: ${path}`,
      );
  }
}
if (!reuse) {
  for (const path of [
    "src",
    "public",
    "scripts",
    "package.json",
    "tsconfig.json",
    "next-env.d.ts",
    "next.config.ts",
    "postcss.config.mjs",
  ])
    await cp(path, `${preview}/${path}`, { recursive: true });
  await symlink(`${process.cwd()}/node_modules`, `${preview}/node_modules`);
}
const environment = {
  ...localDevelopmentProcessEnvironment(status),
  NEXT_PUBLIC_SITE_URL: base,
  NODE_OPTIONS: "--max-old-space-size=1536",
};
const next = `${process.cwd()}/node_modules/next/dist/bin/next`;
const log = openSync(`${preview}/server.log`, "a", 0o600);
console.log(
  JSON.stringify({
    preview,
    build: reuse ? "matching source reused" : "started",
    base,
  }),
);
if (!reuse) {
  const build = spawn(process.execPath, [next, "build", "--webpack"], {
    cwd: preview,
    env: environment,
    stdio: ["ignore", log, log],
  });
  assert.equal(
    await new Promise((resolve) => build.on("exit", resolve)),
    0,
    "Preview build failed; see server.log.",
  );
}
const child = spawn(
  process.execPath,
  [next, "start", "--hostname", "localhost", "--port", "3166"],
  { cwd: preview, env: environment, stdio: ["ignore", log, log] },
);
process.env.CONNECTION_TEST_SITE_URL = base;
const fixture = await localConnectionRehearsal("DEV0366");
const {
  database: db,
  person,
  approveCoach,
  work,
  cleanup,
  cookieHeader,
} = fixture;
const auth = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const people: LocalPerson[] = [];
const tag = randomUUID().slice(0, 8);
const evidence = `tmp/dev0366/${tag}`;
await mkdir(evidence, { recursive: true, mode: 0o700 });
const hashes = async () =>
  new Map(
    (
      await db<{ key: string; hash: string }[]>`
  select 'profile:'||id::text key,md5(to_jsonb(t)::text) hash from app.profiles t
  union all select 'coach:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_profiles t
  union all select 'location:'||id::text,md5(to_jsonb(t)::text) from app.coach_training_locations t
  union all select 'type:'||id::text,md5(to_jsonb(t)::text) from app.coach_session_types t
  union all select 'website:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_website_content t
  union all select 'rate:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_starting_rates t
  union all select 'auth:'||id::text,md5((to_jsonb(t)-'last_sign_in_at'-'updated_at')::text) from auth.users t
`
    ).map((row) => [row.key, row.hash]),
  );
const baseline = await hashes();
await writeFile(`${evidence}/baseline.json`, JSON.stringify([...baseline]), {
  mode: 0o600,
});
const checked: string[] = [];
async function request(path: string, actor?: LocalPerson, input?: unknown) {
  return fetch(base + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(90000),
    ...(input ? { method: "POST", body: JSON.stringify(input) } : {}),
    headers: {
      origin: base,
      "content-type": "application/json",
      ...(actor ? { cookie: cookieHeader(actor) } : {}),
    },
  });
}
async function json(path: string, actor?: LocalPerson, input?: unknown) {
  const r = await request(path, actor, input);
  assert.equal(r.status, 200, `${path}: ${await r.clone().text()}`);
  return r.json();
}
async function add(name: string) {
  const p = await person(name);
  people.push(p);
  await writeFile(
    `${evidence}/recovery-ids.json`,
    JSON.stringify(
      people.map((p) => ({ authUserId: p.id, profileId: p.actor.profileId })),
    ),
    { mode: 0o600 },
  );
  return p;
}
try {
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base + "/sign-in")).ok) break;
    } catch {}
    if (n === 99) throw new Error("Preview did not start.");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const owner = await add(`Alex · DEV0366 ${tag}`);
  const legacy = await add(`Riley · DEV0366 ${tag}`);
  const athlete = await add(`Athlete · DEV0366 ${tag}`);
  const password = `Fixture!${randomUUID()}`;
  assert.equal(
    (await auth.auth.admin.updateUserById(athlete.id, { password })).error,
    null,
  );
  const user = await auth.auth.admin.getUserById(athlete.id);
  const browserLogin = { email: user.data.user!.email, password };
  const refreshed = await request("/api/auth/operations", undefined, {
    action: "sign-in",
    ...browserLogin,
  });
  assert.equal(refreshed.status, 200);
  assert.equal((await refreshed.json()).status, "success");
  athlete.cookies = refreshed.headers.getSetCookie().map((value) => {
    const pair = value.split(";", 1)[0];
    const index = pair.indexOf("=");
    return { name: pair.slice(0, index), value: pair.slice(index + 1) };
  });
  const coaches = [];
  const today = calendarDate(
    (await db`select statement_timestamp()::text as now`)[0].now,
  );
  const date = addCalendarDays(today, 1);
  for (const coach of [owner, legacy]) {
    await approveCoach(coach);
    await work(coach, (tx) =>
      upsertOwnedCoachProfileRecord(tx, {
        displayName: coach.name,
        bio: "Disposable local schedule-access verification. Technique and confidence, one session at a time.",
        disciplines: ["Boxing"],
        timezone: "Europe/Berlin",
        visibility: "visible",
        selectedGymId: "40000000-0000-4000-8000-000000000001",
        independentLocation: null,
      }),
    );
    const [location] =
      await db`select id,to_jsonb(updated_at)#>>'{}' as updated_at from app.coach_training_locations where profile_id=${coach.actor.profileId}::uuid and is_primary`;
    const [profile] =
      await db`select public_slug from app.coach_profiles where profile_id=${coach.actor.profileId}::uuid`;
    if (coach === legacy) {
      // This exact disposable owner represents a pre-catalog legacy account.
      await db`delete from app.coach_session_type_commands where coach_profile_id=${coach.actor.profileId}::uuid`;
      await db`delete from app.coach_session_types where coach_profile_id=${coach.actor.profileId}::uuid`;
    }
    coaches.push({
      person: coach,
      slug: profile.public_slug,
      locationId: location.id,
      locationUpdatedAt: location.updated_at,
    });
  }
  const coach = coaches[0];
  for (const minutes of [60, 75, 90])
    await json("/api/coach/session-types", owner, {
      commandId: randomUUID(),
      action: "save",
      id: randomUUID(),
      expectedRevision: -1,
      format: "private",
      name: `Boxing ${minutes}`,
      description: "A real disposable offer for verification.",
      color: "#61417b",
      durationMinutes: minutes,
      defaultLocationId: coach.locationId,
      bookable: true,
    });
  // Publish a group that excludes a private interval without adding its seats to the count.
  const { groupSessionCommandRecord } =
    await import("../src/server/db/group-sessions/repository");
  const groupId = randomUUID();
  const groupStart = berlinLocalInstant(`${date}T11:00`);
  assert.ok(groupStart);
  const group = await work(owner, (tx) =>
    groupSessionCommandRecord(tx, {
      action: "save-draft",
      args: {
        id: groupId,
        expectedRevision: null,
        title: `Group · DEV0366 ${tag}`,
        description: "Public group times remain available to guests.",
        discipline: "Boxing",
        intendedLevel: "Beginners",
        locationId: coach.locationId,
        startsAt: groupStart,
        endsAt: new Date(Date.parse(groupStart) + 3600000).toISOString(),
        decisionDeadlineAt: new Date(
          Date.parse(groupStart) - 3600000,
        ).toISOString(),
        minimumParticipants: 1,
        maximumParticipants: 6,
        priceCents: 0,
      },
    }),
  );
  const published = await work(owner, (tx) =>
    groupSessionCommandRecord(tx, {
      action: "publish",
      args: { id: groupId, expectedRevision: group.session!.revision },
    }),
  );
  assert.equal(published.outcome, "published", JSON.stringify(published));
  for (const coach of coaches) {
    const saved = await work(coach.person, (tx) =>
      saveOwnedEffectiveAvailabilityRecord(tx, {
        kind: "dates",
        operationId: randomUUID(),
        expectedRevision: 0,
        dates: [1, 6, 7].map((offset) => ({
          date: addCalendarDays(today, offset),
          mode: "custom",
          hours: ["10:00", "11:00", "12:00"].map((localStartTime) => ({
            locationId: coach.locationId,
            locationUpdatedAt: coach.locationUpdatedAt,
            localStartTime,
          })),
        })),
      }),
    );
    assert.equal(saved.outcome, "saved", JSON.stringify(saved));
  }
  let privateTypeId = "";
  for (const [index, c] of coaches.entries()) {
    const path = `/coaches/${c.slug}?date=${date}#private-schedule`;
    const catalog = (await json(`/api/coaches/${c.slug}/session-types`))
      .catalog;
    const started = performance.now();
    const guestResponse = await request(path);
    const guest = await guestResponse.text();
    console.log(
      JSON.stringify({
        path,
        guestMilliseconds: Math.round(performance.now() - started),
      }),
    );
    assert.equal(guestResponse.status, 200);
    assert.match(guest, /Sign in to view schedule/);
    assert.doesNotMatch(
      guest,
      /Private session dates|Show available times|Choose a start time|data-slot-id|"slots":\[/,
    );
    assert.ok(
      !guest.includes('"startsAt"'),
      "No private time objects in guest payload",
    );
    let count = 0;
    if (index === 0) {
      const distinct = new Set<string>();
      for (const type of catalog.types.filter(
        (t: { format: string }) => t.format === "private",
      )) {
        privateTypeId ||= type.id;
        for (const offset of [1, 6]) {
          const q = new URLSearchParams({
            typeId: type.id,
            locationId: c.locationId,
            date: addCalendarDays(today, offset),
          });
          const url = `/api/coaches/${c.slug}/session-types?${q}`;
          const denial = await request(url);
          assert.equal(denial.status, 401);
          assert.deepEqual(await denial.json(), { status: "signed-out" });
          assert.equal(
            denial.headers.get("cache-control"),
            "private, no-store",
          );
          const times = (await json(url, athlete)).times;
          for (const time of times) distinct.add(time.startsAt);
        }
      }
      count = distinct.size;
      assert.ok(
        count > 0 && count < 18,
        `Group conflict and duplicate-type alternatives affect the count: ${count}`,
      );
      const authenticated = await (await request(path, athlete)).text();
      assert.match(authenticated, /Choose your class|Show available times/);
      assert.doesNotMatch(authenticated, /Sign in to view schedule/);
    } else {
      count = 6;
      const authenticated = await (await request(path, athlete)).text();
      assert.match(authenticated, /Private session dates|data-slot-id/);
    }
    assert.match(guest, new RegExp(`<strong>${count}</strong>`));
    checked.push(
      `${index ? "legacy" : "typed"} guest aggregate=${count}; private controls/payload absent; authenticated schedule retained`,
    );
  }
  const current = await json("/api/account", owner);
  const handle = `dev0366_${tag}`;
  await json("/api/account", owner, {
    section: "login-security",
    revision: current.details.revision,
    username: handle,
  });
  const publicUrl = await json("/api/coach/public-url", owner);
  await json("/api/coach/public-url", owner, {
    username: handle,
    expectedRevision: publicUrl.revision,
    consent: true,
  });
  // The published handle remains reserved after deletion; cleanup removes its exact tombstone below.
  const path = `/@${handle}?date=${date}#private-schedule`;
  assert.match(await (await request(path)).text(), /Sign in to view schedule/);
  const legacyRedirect = await request(`/coaches/${coach.slug}?date=${date}`);
  assert.ok([307, 308].includes(legacyRedirect.status));
  checked.push(
    "Canonical username page and legacy redirect preserve the guest access boundary",
  );
  await writeFile(
    `${evidence}/browser-login.json`,
    JSON.stringify(browserLogin),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      ready: true,
      evidence,
      preview,
      path,
      legacyPath: `/coaches/${coaches[1].slug}?date=${date}#private-schedule`,
      coachSlug: coach.slug,
      privateTypeId,
      locationId: coach.locationId,
      date,
      checked,
    }),
  );
  const lines = createInterface({ input: process.stdin });
  console.log("Native checks ready. Commands: zero, restore, finish.");
  for await (const line of lines) {
    if (line.trim() === "finish") {
      lines.close();
      break;
    }
    if (line.trim() === "zero" || line.trim() === "restore") {
      const bookable = line.trim() === "restore";
      const catalog = await json("/api/coach/session-types", owner);
      for (const type of catalog.types.filter(
        (t: { format: string }) => t.format === "private",
      )) {
        const {
          id,
          revision,
          name,
          description,
          color,
          durationMinutes,
          defaultLocationId,
        } = type;
        await json("/api/coach/session-types", owner, {
          commandId: randomUUID(),
          action: "save",
          id,
          expectedRevision: revision,
          format: "private",
          name,
          description,
          color,
          durationMinutes,
          defaultLocationId,
          bookable,
        });
      }
      console.log(JSON.stringify({ command: line.trim(), done: true }));
    }
  }
} finally {
  await cleanup();
  await db`delete from app.coach_public_handles where username=${`dev0366_${tag}`} and profile_id is null`;
  assert.equal(
    (
      await db`select id from auth.users where id=any(${people.map((p) => p.id)}::uuid[])`
    ).length,
    0,
  );
  const after = await hashes();
  for (const [key, value] of baseline)
    assert.equal(after.get(key), value, `Original row changed: ${key}`);
  await writeFile(
    `${evidence}/result.json`,
    JSON.stringify({
      checked,
      retainedHashesUnchanged: baseline.size,
      cleanup: "passed",
    }),
    { mode: 0o600 },
  );
  await db.end();
  child.kill("SIGTERM");
  console.log(
    JSON.stringify({
      cleanup: "passed",
      originalHashesUnchanged: baseline.size,
      checked,
    }),
  );
}
