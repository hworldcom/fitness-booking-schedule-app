/** Isolated fixture/API companion for native CUA checks. No browser automation. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { localConnectionRehearsal } from "./lib/local-connection-rehearsal";
import { parseLocalSupabaseStatus } from "./lib/local-coach-accounts";
import { localDevelopmentProcessEnvironment } from "./lib/local-development";
import { berlinLocalInstant } from "../src/features/coach-events/contract";

const base = "http://localhost:3158";
const status = parseLocalSupabaseStatus(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  }).toString(),
);
const preview =
  process.env.EVENT_DIRECTORY_PREVIEW ??
  (await mkdtemp("/private/tmp/movx-dev0358-"));
assert.match(preview, /^\/private\/tmp\/movx-dev0358-[A-Za-z0-9]{6}$/);
for (const path of [
  "src",
  "public",
  "scripts",
  "package.json",
  "tsconfig.json",
  "next-env.d.ts",
  "next.config.ts",
  "postcss.config.mjs",
]) {
  await cp(path, `${preview}/${path}`, { recursive: true });
}
await symlink(`${process.cwd()}/node_modules`, `${preview}/node_modules`).catch(
  (error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  },
);
const log = await import("node:fs").then((fs) =>
  fs.openSync(`${preview}/server.log`, "a", 0o600),
);
const mode = process.env.EVENT_DIRECTORY_MODE ?? "production";
assert.ok(mode === "production" || mode === "development");
const previewEnvironment = {
  ...localDevelopmentProcessEnvironment(status),
  NEXT_PUBLIC_SITE_URL: base,
};
const next = `${process.cwd()}/node_modules/next/dist/bin/next`;
if (mode === "production") {
  const build = spawn(process.execPath, [next, "build", "--webpack"], {
    cwd: preview,
    env: previewEnvironment,
    stdio: ["ignore", log, log],
  });
  assert.equal(
    await new Promise((resolve) => build.on("exit", resolve)),
    0,
    "Isolated preview build failed; see its server.log.",
  );
}
const child = spawn(
  process.execPath,
  [
    next,
    ...(mode === "production" ? ["start"] : ["dev", "--webpack"]),
    "--hostname",
    "localhost",
    "--port",
    "3158",
  ],
  {
    cwd: preview,
    env: previewEnvironment,
    stdio: ["ignore", log, log],
  },
);
process.env.CONNECTION_TEST_SITE_URL = base;
const fixture = await localConnectionRehearsal("DEV0358");
const { database: db, person, approveCoach, cookieHeader, cleanup } = fixture;
const admin = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tag = randomUUID().slice(0, 8);
const filter = `DEV0358-${tag}`;
const events: string[] = [];
const ownedProfileIds: string[] = [];
const evidence = `${preview}/evidence`;
await mkdir(evidence, { mode: 0o700, recursive: true });
const baseline = await db<
  { key: string; hash: string }[]
>`select 'profile:'||id::text key, md5(to_jsonb(t)::text) hash from app.profiles t where not exists(select 1 from auth.users u where u.id=t.auth_user_id and u.raw_app_meta_data->>'temporary'='true') union all select 'coach:'||profile_id::text,md5(to_jsonb(t)::text) from app.coach_profiles t where not exists(select 1 from app.profiles p join auth.users u on u.id=p.auth_user_id where p.id=t.profile_id and u.raw_app_meta_data->>'temporary'='true') union all select 'object:'||id::text,md5(to_jsonb(t)::text) from storage.objects t`;
await writeFile(`${evidence}/baseline.json`, JSON.stringify(baseline), {
  mode: 0o600,
});
async function request(
  path: string,
  actor: Parameters<typeof cookieHeader>[0] | null = null,
  init: RequestInit = {},
) {
  return fetch(base + path, {
    ...init,
    headers: {
      origin: base,
      ...(actor ? { cookie: cookieHeader(actor) } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(120_000),
  });
}
async function asActor<T>(
  actor: Parameters<typeof cookieHeader>[0],
  fn: (tx: import("postgres").TransactionSql) => Promise<T>,
) {
  return db.begin(async (tx) => {
    await tx.unsafe("set local role app_runtime");
    await tx`select set_config('app.current_auth_user_id',${actor.id},true),set_config('app.current_profile_id',${actor.actor.profileId},true),set_config('app.current_run_id',${actor.actor.runId},true),set_config('app.current_run_role','member',true)`;
    return fn(tx);
  }) as Promise<T>;
}
const password = "MovxPreview-DEV0358!2026";
try {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(base + "/events")).ok) break;
    } catch {}
    if (attempt === 119) throw new Error("Isolated preview did not start.");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const owner = await person(`DEV0358 Coach ${tag}`);
  ownedProfileIds.push(owner.actor.profileId);
  const other = await person(`DEV0358 Other ${tag}`);
  ownedProfileIds.push(other.actor.profileId);
  await writeFile(
    `${evidence}/recovery.json`,
    JSON.stringify({
      people: [owner, other].map((p) => ({
        authId: p.id,
        profileId: p.actor.profileId,
      })),
      events,
      filter,
    }),
    { mode: 0o600 },
  );
  for (const actor of [owner, other]) {
    await approveCoach(actor);
    await db`update app.coach_profiles set visibility='visible' where profile_id=${actor.actor.profileId}::uuid`;
  }
  const updated = await admin.auth.admin.updateUserById(owner.id, { password });
  assert.ifError(updated.error);
  const [identity] =
    await db`select email from auth.users where id=${owner.id}::uuid and raw_app_meta_data->>'movx_test_ticket'='DEV0358' and raw_app_meta_data->>'temporary'='true'`;
  const signed = await request("/api/auth/operations", null, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "sign-in",
      email: identity.email,
      password,
    }),
  });
  assert.equal(signed.status, 200);
  owner.cookies = signed.headers.getSetCookie().map((cookie) => {
    const pair = cookie.split(";", 1)[0],
      index = pair.indexOf("=");
    return { name: pair.slice(0, index), value: pair.slice(index + 1) };
  });
  const locations = new Map<string, string>();
  for (const actor of [owner, other]) {
    const location = await asActor(
      actor,
      async (tx) =>
        (
          await tx`select app.create_owned_coach_training_location(${filter},null,${filter + ", Berlin"},52.5,13.4,'manual',null) id`
        )[0].id as string,
    );
    locations.set(actor.id, location);
  }
  const firstDate = new Date(Date.now() + 72 * 3600000)
    .toISOString()
    .slice(0, 10);
  for (let index = 0; index < 24; index++) {
    const actor = index === 2 ? other : owner;
    const id = randomUUID();
    events.push(id);
    const day = new Date(`${firstDate}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + Math.floor(index / 8));
    const local = `${day.toISOString().slice(0, 10)}T${String(8 + (index % 8) * 2).padStart(2, "0")}:00`;
    const instant = berlinLocalInstant(local);
    assert.ok(instant, "Fixture time must exist unambiguously in Berlin.");
    const start = new Date(instant);
    const args = {
      id,
      expectedRevision: null,
      title: `DEV0358 Class ${String(index + 1).padStart(2, "0")}`,
      description:
        "Disposable native Events integration fixture. Removed after validation.",
      discipline: "Boxing",
      intendedLevel: "All levels",
      locationId: locations.get(actor.id),
      startsAt: start.toISOString(),
      endsAt: new Date(+start + 3600000).toISOString(),
      decisionDeadlineAt: new Date(+start - 3600000).toISOString(),
      minimumParticipants: 2,
      maximumParticipants: 8,
      priceCents: index % 2 ? 1500 : 0,
    };
    await asActor(actor, async (tx) => {
      await tx`select app.group_session_command('save-draft',${tx.json(args)})`;
      if (index < 23) await tx`select app.publish_group_session(${id}::uuid,1)`;
    });
  }
  await writeFile(
    `${evidence}/recovery.json`,
    JSON.stringify({
      people: [owner, other].map((p) => ({
        authId: p.id,
        profileId: p.actor.profileId,
      })),
      events,
      filter,
    }),
    { mode: 0o600 },
  );
  const image = (color: string, text: string) =>
    sharp(
      Buffer.from(
        `<svg width="1200" height="600"><rect width="1200" height="600" fill="${color}"/><text x="80" y="330" font-size="65" fill="white">${text}</text></svg>`,
      ),
    )
      .png()
      .toBuffer();
  const coach = await image("#78628d", "COACH FALLBACK");
  const event = await image("#486d65", "EVENT BANNER");
  const replacement = await image("#ad7659", "REPLACEMENT");
  await writeFile(`${evidence}/event.png`, event);
  await writeFile(`${evidence}/replacement.png`, replacement);
  await writeFile(`${evidence}/invalid.txt`, "Not an image.");
  const portrait = await sharp({
    create: { width: 512, height: 512, channels: 3, background: "#78628d" },
  })
    .webp()
    .toBuffer();
  assert.equal(
    (
      await request("/api/coach/portrait", owner, {
        method: "POST",
        headers: { "content-type": "image/webp" },
        body: new Uint8Array(portrait),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/coach/website/banner", owner, {
        method: "POST",
        headers: { "content-type": "image/png", "if-match": '"0"' },
        body: new Uint8Array(coach),
      })
    ).status,
    200,
  );
  const second = events[1];
  const uploaded = await request(`/api/coach/events/${second}/banner`, owner, {
    method: "POST",
    headers: { "content-type": "image/png", "if-match": '"0"' },
    body: new Uint8Array(event),
  });
  assert.equal(uploaded.status, 200);
  const snapshot = await uploaded.json();
  assert.equal(snapshot.eventBanner.revision, 1);
  assert.equal(
    (
      await request(`/api/coach/events/${second}/banner`, other, {
        method: "DELETE",
        headers: { "if-match": '"1"' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/coach/events/${second}/banner`, owner, {
        method: "DELETE",
        headers: { "if-match": '"0"' },
      })
    ).status,
    409,
  );
  const api = await (await request(`/api/events?location=${filter}`)).json();
  assert.equal(api.status, "ready");
  assert.equal(api.page.items.length, 20);
  assert.ok(api.page.nextCursor);
  assert.ok(api.presentations[events[0]].coachBanner);
  assert.ok(api.presentations[events[1]].eventBanner);
  assert.equal(api.presentations[events[2]].coachBanner, null);
  for (const item of api.page.items.slice(0, 1))
    assert.equal((await request(`/events/${item.slug}`)).status, 200);
  const publicUrl = api.presentations[second].eventBanner.url;
  assert.equal((await request(publicUrl)).status, 200);
  const draftUrl = `/api/events/group-${events[23].replaceAll("-", "")}/banner/card?v=0`;
  assert.equal((await request(draftUrl)).status, 404);
  const nextUrl = `/api/events?location=${filter}&afterAt=${encodeURIComponent(api.page.nextCursor.at)}&afterId=${api.page.nextCursor.id}`;
  const next = await (await request(nextUrl)).json();
  assert.equal(next.page.items.length, 3);
  assert.equal(next.page.nextCursor, null);
  const nextHtml = await (
    await request(nextUrl.replace("/api/events", "/events"))
  ).text();
  assert.match(nextHtml, /Back to first page/);
  assert.match(nextHtml, /DEV0358 Class 23/);
  await writeFile(
    `${evidence}/api-summary.json`,
    JSON.stringify({
      firstCount: api.page.items.length,
      nextCount: next.page.items.length,
      nextCursor: api.page.nextCursor,
      publicUrl,
      draftUrl,
    }),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      preview,
      evidence,
      email: identity.email,
      password,
      directory: `${base}/events?location=${filter}`,
      ownerEvent: `${base}/coach/events/${events[0]}`,
      draft: `${base}/coach/events/${events[23]}/edit`,
      firstEventId: events[0],
      secondEventId: second,
      filter,
    }),
  );
  console.log(
    "Fixture ready. Commands: verify, replace-second, remove-coach, cleanup. Native sign-in only; no browser session injection.",
  );
  for await (const line of createInterface({ input: process.stdin })) {
    if (line.trim() === "cleanup") break;
    if (line.trim() === "replace-second") {
      const read = await (
        await request(`/api/coach/events/${second}/banner`, owner)
      ).json();
      assert.equal(
        (
          await request(`/api/coach/events/${second}/banner`, owner, {
            method: "POST",
            headers: {
              "content-type": "image/png",
              "if-match": `"${read.eventBanner.revision}"`,
            },
            body: new Uint8Array(replacement),
          })
        ).status,
        200,
      );
      assert.equal((await request(publicUrl)).status, 404);
      console.log("Second banner replaced; obsolete public URL revoked.");
    }
    if (line.trim() === "remove-coach") {
      const [row] =
        await db`select revision from app.coach_website_content where profile_id=${owner.actor.profileId}::uuid`;
      assert.equal(
        (
          await request("/api/coach/website/banner", owner, {
            method: "DELETE",
            headers: { "if-match": `"${row.revision}"` },
          })
        ).status,
        200,
      );
      console.log("Coach fallback removed.");
    }
    if (line.trim() === "verify") {
      const result = await (
        await request(`/api/events?location=${filter}`)
      ).json();
      assert.equal(result.status, "ready");
      const [terms] =
        await db`select revision,starts_at,ends_at,price_cents,maximum_participants from app.coach_group_sessions where id=${events[0]}::uuid`;
      assert.equal(terms.revision, 2);
      console.log(
        JSON.stringify({ first: result.presentations[events[0]], terms }),
      );
    }
  }
} finally {
  try {
    const profiles = await db<
      { profile_id: string }[]
    >`select p.id profile_id from app.profiles p join auth.users u on u.id=p.auth_user_id where u.raw_app_meta_data->>'movx_test_ticket'='DEV0358' and u.raw_app_meta_data->>'temporary'='true' and u.email like 'dev0358-connections-%@users.movx.test' and p.id=any(${ownedProfileIds}::uuid[])`;
    for (const p of profiles) {
      const objects = await db<
        { name: string }[]
      >`select name from storage.objects where bucket_id='event-banners' and split_part(name,'/',1)=${p.profile_id}`;
      if (objects.length)
        assert.ifError(
          (
            await admin.storage
              .from("event-banners")
              .remove(objects.map((o) => o.name))
          ).error,
        );
    }
    await cleanup();
    for (const row of baseline) {
      const [kind, id] = row.key.split(":");
      const result =
        kind === "profile"
          ? await db`select md5(to_jsonb(t)::text) hash from app.profiles t where id=${id}::uuid`
          : kind === "coach"
            ? await db`select md5(to_jsonb(t)::text) hash from app.coach_profiles t where profile_id=${id}::uuid`
            : await db`select md5(to_jsonb(t)::text) hash from storage.objects t where id=${id}::uuid`;
      assert.equal(result[0]?.hash, row.hash, `Retained ${row.key} changed.`);
    }
    console.log(
      `Exact fixture cleanup and ${baseline.length} retained-row fingerprints passed.`,
    );
  } finally {
    child.kill("SIGTERM");
    await db.end({ timeout: 5 });
  }
}
