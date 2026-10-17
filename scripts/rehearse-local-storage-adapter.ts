import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { normalizeCanonicalProfileImage } from "../src/server/profile-images/image-normalization";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";

// The shared fixture helper refuses hosted targets and keeps CLI credentials in
// memory. This rehearsal refuses leftover same-ticket accounts before creating
// anything, then cleans only its exact tagged test cohort through that helper.
const rehearsal = await localConnectionRehearsal("DEV0292");
const {
  base,
  database,
  person,
  approveCoach,
  booking,
  requestFixture,
  send,
  decide,
  cookieHeader,
  cleanup,
} = rehearsal;
const evidence = `test-results/dev0292-storage/${randomUUID()}`;
await mkdir(evidence, { recursive: true, mode: 0o700 });
const people: LocalPerson[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const checks: string[] = [];
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function originals() {
  const rows = await database<{ key: string; value: unknown }[]>`
    select 'profile:'||id::text as key,to_jsonb(p) as value from app.profiles p
    union all select 'coach:'||profile_id::text,to_jsonb(c) from app.coach_profiles c
    union all select 'object:'||id::text,to_jsonb(o) from storage.objects o`;
  return new Map(rows.map((row) => [row.key, digest(row.value)]));
}
const baseline = await originals();
const leftovers =
  await database`select id from auth.users where raw_app_meta_data->>'movx_test_ticket'='DEV0292'`;
assert.equal(
  leftovers.length,
  0,
  "Resolve a prior DEV0292 cleanup before another run.",
);

async function request(
  path: string,
  actor?: LocalPerson,
  init: RequestInit = {},
) {
  return fetch(base + path, {
    ...init,
    headers: {
      origin: base,
      ...(actor ? { cookie: cookieHeader(actor) } : {}),
      ...init.headers,
    },
  });
}
async function upload(
  path: string,
  actor: LocalPerson,
  bytes: Uint8Array<ArrayBuffer>,
) {
  const response = await request(path, actor, {
    method: "POST",
    headers: { "content-type": "image/webp" },
    body: bytes,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, "saved");
  assert.equal(typeof result.imageUrl, "string");
  return result.imageUrl as string;
}
async function privateBytes(
  path: string,
  actor: LocalPerson,
  bytes: Uint8Array<ArrayBuffer>,
) {
  const response = await request(path, actor);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.ok(response.headers.get("vary")?.split(/,\s*/).includes("Cookie"));
  assert.match(response.headers.get("cache-control") ?? "", /private/);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
}
async function denied(path: string, actor?: LocalPerson) {
  const response = await request(path, actor);
  assert.ok(
    [401, 403, 404].includes(response.status),
    `Expected denial, received ${response.status}`,
  );
  assert.equal((await response.arrayBuffer()).byteLength, 0);
  assert.match(response.headers.get("cache-control") ?? "", /private/);
}

try {
  const suffix = randomUUID().slice(0, 8);
  for (const name of ["Coach", "Athlete", "Stranger"]) {
    people.push(await person(`Storage ${name} ${suffix}`));
    await writeFile(
      evidence + "/recovery-ids.json",
      JSON.stringify(
        people.map((entry) => ({
          id: entry.id,
          profileId: entry.actor.profileId,
        })),
      ),
      { mode: 0o600 },
    );
  }
  const [coach, athlete, stranger] = people;
  await approveCoach(coach);
  const source = new Uint8Array(
    await sharp({
      create: { width: 512, height: 512, channels: 3, background: "#28705a" },
    })
      .webp({ quality: 82 })
      .toBuffer(),
  );
  const { bytes } = await normalizeCanonicalProfileImage(source);
  const avatarUrl = await upload("/api/profile/avatar", athlete, source);
  await privateBytes(avatarUrl, athlete, bytes);
  await denied(avatarUrl);
  await denied(avatarUrl, stranger);
  const [stored] =
    await database`select avatar_storage_path path from app.profiles where id=${athlete.actor.profileId}::uuid`;
  assert.ok(stored.path.startsWith(athlete.actor.profileId + "/"));
  const privateObject = await fetch(
    "http://127.0.0.1:55321/storage/v1/object/account-avatars/" + stored.path,
  );
  assert.notEqual(privateObject.status, 200);
  const invalid = await request("/api/profile/avatar", athlete, {
    method: "POST",
    headers: { "content-type": "image/webp" },
    body: new Uint8Array([1, 2, 3]),
  });
  assert.equal(invalid.status, 400);
  await privateBytes(avatarUrl, athlete, bytes);
  checks.push(
    "real normalized private upload/bytes, anonymous/other-account/direct-Storage denial and invalid-byte preservation",
  );

  const booked = await booking(coach, athlete);
  const requested = await requestFixture(
    coach,
    athlete,
    booked.slotId,
    "accepted",
    booked.bookingId,
  );
  await privateBytes(
    `/api/coach/bookings/${booked.bookingId}/client-avatar`,
    coach,
    bytes,
  );
  await privateBytes(
    `/api/coach/requests/${requested}/client-avatar`,
    coach,
    bytes,
  );
  await denied(
    `/api/coach/bookings/${booked.bookingId}/client-avatar`,
    stranger,
  );
  await denied(`/api/coach/requests/${requested}/client-avatar`, stranger);
  const connection = await send(athlete, booked.bookingId);
  await decide(coach, connection.id, "accept");
  await privateBytes(
    `/api/connections/${connection.id}/athlete-avatar`,
    coach,
    bytes,
  );
  await denied(`/api/connections/${connection.id}/athlete-avatar`, stranger);
  await decide(athlete, connection.id, "disconnect");
  await denied(`/api/connections/${connection.id}/athlete-avatar`, coach);
  await privateBytes(
    `/api/coach/bookings/${booked.bookingId}/client-avatar`,
    coach,
    bytes,
  );
  checks.push(
    "real request/booking/accepted-connection bytes, wrong-actor denial and disconnect revocation with independent booking access preserved",
  );

  const portraitUrl = await upload("/api/coach/portrait", coach, source);
  assert.ok(
    portraitUrl.startsWith(
      "http://127.0.0.1:55321/storage/v1/object/public/coach-portraits/",
    ),
  );
  const portrait = await fetch(portraitUrl);
  assert.equal(portrait.status, 200);
  assert.deepEqual(new Uint8Array(await portrait.arrayBuffer()), bytes);
  const rejectedPortrait = await request("/api/coach/portrait", stranger, {
    method: "POST",
    headers: { "content-type": "image/webp" },
    body: bytes,
  });
  assert.equal(rejectedPortrait.status, 403);
  checks.push(
    "real public portrait upload/immutable URL/anonymous bytes and unapproved-owner denial",
  );

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  await context.addCookies(
    athlete.cookies.map((value) => ({
      ...value,
      url: base,
      sameSite: "Lax" as const,
    })),
  );
  const page = await context.newPage();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 393, height: 852 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(base + "/profile", { waitUntil: "domcontentloaded" });
    await page
      .locator(`.profile-image-uploader img[src*="/api/profile/avatar"]`)
      .waitFor();
    await page.waitForFunction(() =>
      Array.from(
        document.querySelectorAll(".profile-image-uploader img"),
      ).every(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0,
      ),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: `${evidence}/avatar-${viewport.width}.png` });
  }
  const removed = await request("/api/profile/avatar", athlete, {
    method: "DELETE",
  });
  assert.equal(removed.status, 200);
  await denied(avatarUrl, athlete);
  const removedPortrait = await request("/api/coach/portrait", coach, {
    method: "DELETE",
  });
  assert.equal(removedPortrait.status, 200);
  checks.push("desktop/phone rendered private image and removal/read recovery");
} finally {
  await browser?.close();
  try {
    await cleanup();
    const after = await originals();
    for (const [key, hash] of baseline)
      assert.equal(
        after.get(key),
        hash,
        "Original profile/coach/object changed: " + key,
      );
    assert.equal(
      (
        await database`select id from auth.users where raw_app_meta_data->>'movx_test_ticket'='DEV0292'`
      ).length,
      0,
    );
    const ownedProfileIds = people.map((entry) => entry.actor.profileId);
    const leftoverObjects = await database`select id from storage.objects
      where bucket_id in ('account-avatars','coach-portraits')
        and split_part(name,'/',1)=any(${ownedProfileIds}::text[])`;
    assert.equal(
      leftoverObjects.length,
      0,
      "Temporary image objects remain after cleanup.",
    );
    checks.push(
      "exact temporary account/data/media cleanup and unchanged original profile/coach/Storage row hashes",
    );
    await writeFile(
      evidence + "/result.json",
      JSON.stringify({ checks }, null, 2),
      { mode: 0o600 },
    );
  } finally {
    await database.end();
  }
}
console.log(
  "Passed DEV0292 local Storage rehearsal: " +
    checks.length +
    " groups; evidence " +
    evidence,
);
