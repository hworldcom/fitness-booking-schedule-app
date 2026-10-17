import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";
import { normalizeCoachBanner } from "../src/server/coaches/banner-normalization";

const rehearsal = await localConnectionRehearsal("DEV0321");
const { base, database, person, approveCoach, work, cookieHeader, cleanup } =
  rehearsal;
// Keep recovery evidence outside Playwright's test-results directory, which its
// runner clears when another suite starts in the shared workspace.
const evidence = `tmp/dev0321-website/${randomUUID()}`;
await mkdir(evidence, { recursive: true, mode: 0o700 });
const people: LocalPerson[] = [];
const checks: string[] = [];
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function originals() {
  const rows = await database<{ key: string; value: unknown }[]>`
    select 'profile:'||id::text as key,to_jsonb(t) value from app.profiles t
    union all select 'coach:'||profile_id::text,to_jsonb(t) from app.coach_profiles t
    union all select 'location:'||id::text,to_jsonb(t) from app.coach_training_locations t
    union all select 'website:'||profile_id::text,to_jsonb(t) from app.coach_website_content t
    union all select 'object:'||id::text,to_jsonb(t) from storage.objects t`;
  return new Map(rows.map((row) => [row.key, hash(row.value)]));
}
const baseline = await originals();
assert.equal(
  (
    await database`select id from auth.users where raw_app_meta_data->>'movx_test_ticket'='DEV0321'`
  ).length,
  0,
  "Resolve prior DEV0321 cleanup first.",
);
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
async function json(
  path: string,
  actor: LocalPerson | undefined,
  init: RequestInit = {},
  code = 200,
) {
  const response = await request(path, actor, init);
  const result = await response.json();
  assert.equal(response.status, code, JSON.stringify(result));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return result;
}
const api = "/api/coach/website";
const content = {
  brandLabel: "DEV0321 Boxing",
  introduction: "Individual coaching with clear feedback.",
  approach: "Deliberate practice.\nProgress at your own pace.",
  experience: "Coach-supplied experience claim.",
  focusLabels: ["Beginner confidence"],
  faqs: [
    {
      question: "Where do we train?",
      answer: "At a listed training location.",
    },
  ],
  links: [{ label: "Website", url: "https://example.com/" }],
};
function textInput(revision: number, value: unknown = content): RequestInit {
  return {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schemaVersion: 1,
      expectedRevision: revision,
      content: value,
    }),
  };
}
async function bytes(path: string, expected: Uint8Array, actor?: LocalPerson) {
  const response = await request(path, actor);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expected);
}
try {
  for (const name of ["Owner", "Other", "Applicant"]) {
    people.push(await person(`Website ${name} ${randomUUID().slice(0, 6)}`));
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
  const [owner, other, applicant] = people;
  await approveCoach(owner);
  const { submitOwnedCoachApplicationRecord } =
    await import("../src/server/db/coaches/application-repository");
  const { upsertOwnedCoachProfileRecord } =
    await import("../src/server/db/coaches/repository");
  await work(applicant, submitOwnedCoachApplicationRecord);
  await work(applicant, (tx) =>
    upsertOwnedCoachProfileRecord(tx, {
      displayName: applicant.name,
      bio: "Private coaching with deliberate practice and feedback for developing athletes.",
      disciplines: ["Boxing"],
      timezone: "Europe/Berlin",
      visibility: "hidden",
      selectedGymId: "40000000-0000-4000-8000-000000000001",
      independentLocation: null,
    }),
  );
  const [coach] =
    await database`select public_slug from app.coach_profiles where profile_id=${owner.actor.profileId}::uuid`;
  const slug = coach.public_slug as string;
  const publicApi = `/api/coaches/${slug}/website`;
  const initial = await json(api, owner);
  assert.equal(initial.website.revision, 0);
  const saved = await json(api, owner, textInput(0));
  assert.equal(saved.website.revision, 1);
  await json(api, owner, textInput(0), 409);
  await json(
    api,
    owner,
    textInput(1, {
      ...content,
      links: [{ label: "Unsafe", url: "javascript:alert(1)" }],
    }),
    400,
  );
  await json(api, other, {}, 403);
  await json(api, other, textInput(0), 403);
  const forged = textInput(1);
  await json(
    api,
    owner,
    {
      ...forged,
      headers: { ...forged.headers, origin: "https://forged.example" },
    },
    400,
  );
  await json(api, undefined, {}, 401);
  await json(publicApi, undefined, {}, 404);
  await json(api, applicant, textInput(0));
  checks.push(
    "real owner content save/reload, invalid/stale/other-user/origin and private applicant draft boundaries",
  );
  console.log("Passed local website content and draft boundaries.");

  const source = new Uint8Array(
    await sharp({
      create: { width: 1800, height: 1000, channels: 3, background: "#1a6565" },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "Private source metadata" } } })
      .toBuffer(),
  );
  const normalized = await normalizeCoachBanner(source);
  const upload = (actor: LocalPerson, revision: number) =>
    json(api + "/banner", actor, {
      method: "POST",
      headers: { "content-type": "image/jpeg", "if-match": `"${revision}"` },
      body: source,
    });
  const banner = await upload(owner, 1);
  assert.equal(banner.website.revision, 2);
  assert.equal(banner.cleanupPending, false);
  await bytes(banner.website.banner.card.url, normalized.card, owner);
  await bytes(banner.website.banner.hero.url, normalized.hero, owner);
  assert.equal(
    (await request(banner.website.banner.card.url, other)).status,
    403,
  );
  assert.equal((await request(banner.website.banner.card.url)).status, 401);
  await json(publicApi, undefined, {}, 404);
  const pendingBanner = await upload(applicant, 1);
  await bytes(
    pendingBanner.website.banner.card.url,
    normalized.card,
    applicant,
  );
  const [pendingCoach] =
    await database`select public_slug from app.coach_profiles where profile_id=${applicant.actor.profileId}::uuid`;
  await json(
    `/api/coaches/${pendingCoach.public_slug}/website`,
    undefined,
    {},
    404,
  );
  const [refs] =
    await database`select card_path,hero_path from app.coach_website_content where profile_id=${owner.actor.profileId}::uuid`;
  const storageUrl =
    "http://127.0.0.1:55321/storage/v1/object/coach-banners/" + refs.card_path;
  assert.notEqual((await fetch(storageUrl)).status, 200);
  checks.push(
    "real source normalization/two variants, metadata stripping, private owner preview and hidden/applicant byte denial",
  );
  console.log("Passed local private banner upload and normalized bytes.");

  const visibility = async (value: "visible" | "hidden") =>
    work(owner, (tx) =>
      upsertOwnedCoachProfileRecord(tx, {
        displayName: owner.name,
        bio: "An isolated local coach for website and private Storage validation.",
        disciplines: ["Boxing"],
        timezone: "Europe/Berlin",
        visibility: value,
        selectedGymId: "40000000-0000-4000-8000-000000000001",
        independentLocation: null,
      }),
    );
  await visibility("visible");
  const publicView = await json(publicApi, undefined);
  assert.deepEqual(publicView.website.content, content);
  assert.doesNotMatch(
    JSON.stringify(publicView),
    /card_path|hero_path|authUser|avatar|storage\/v1/,
  );
  await bytes(publicView.website.banner.card.url, normalized.card);
  await bytes(publicView.website.banner.hero.url, normalized.hero);
  const { publicCoachDirectory, publicCoachProfile } =
    await import("../src/server/coaches/service");
  const { normalizeCoachDirectoryFilters } =
    await import("../src/domain/coaches");
  const directory = await publicCoachDirectory(
    normalizeCoachDirectoryFilters({}),
  );
  assert.equal(directory.status, "ready");
  if (directory.status !== "ready") throw Error("Directory unavailable.");
  const entry = directory.entries.find(
    (item) => item.coach.profileId === owner.actor.profileId,
  );
  assert.ok(entry?.website);
  assert.equal(entry.website.introduction, content.introduction);
  assert.doesNotMatch(
    JSON.stringify(entry.website),
    /experience|faqs|links|hero|card_path/,
  );
  const detail = await publicCoachProfile(slug);
  assert.equal(detail.status, "ready");
  if (detail.status === "ready")
    assert.equal(detail.website?.content.brandLabel, content.brandLabel);
  const races = await Promise.all(
    [1, 2].map(async () => {
      const response = await request(api + "/banner", owner, {
        method: "POST",
        headers: { "content-type": "image/jpeg", "if-match": '"2"' },
        body: source,
      });
      return { code: response.status, value: await response.json() };
    }),
  );
  assert.deepEqual(races.map((result) => result.code).sort(), [200, 409]);
  const winner = races.find((result) => result.code === 200)!;
  assert.equal(winner.value.website.revision, 3);
  assert.equal(
    (
      await database`select name from storage.objects where bucket_id='coach-banners' and split_part(name,'/',1)=${owner.actor.profileId}`
    ).length,
    2,
  );
  assert.equal((await request(publicView.website.banner.card.url)).status, 404);
  await json(
    api + "/banner",
    owner,
    { method: "DELETE", headers: { "if-match": '"2"' } },
    409,
  );
  await json(
    api + "/banner",
    owner,
    {
      method: "POST",
      headers: { "content-type": "image/webp", "if-match": '"3"' },
      body: new Uint8Array([1, 2, 3]),
    },
    400,
  );
  await visibility("hidden");
  await json(publicApi, undefined, {}, 404);
  assert.equal(
    (await request(`/api/coaches/${slug}/website/banner/card?v=3`)).status,
    404,
  );
  const [current] =
    await database`select card_path from app.coach_website_content where profile_id=${owner.actor.profileId}::uuid`;
  assert.notEqual(
    (
      await fetch(
        "http://127.0.0.1:55321/storage/v1/object/coach-banners/" +
          current.card_path,
      )
    ).status,
    200,
  );
  await visibility("visible");
  await bytes(`/api/coaches/${slug}/website/banner/card?v=3`, normalized.card);
  const removed = await json(api + "/banner", owner, {
    method: "DELETE",
    headers: { "if-match": '"3"' },
  });
  assert.equal(removed.website.revision, 4);
  assert.equal(removed.website.banner, null);
  assert.deepEqual(removed.website.content, content);
  assert.equal(
    (await request(`/api/coaches/${slug}/website/banner/card?v=3`)).status,
    404,
  );
  assert.equal(
    (
      await database`select name from storage.objects where bucket_id='coach-banners' and split_part(name,'/',1)=${owner.actor.profileId}`
    ).length,
    0,
  );
  checks.push(
    "real public/full/bounded-directory projection, anonymous variant bytes, simultaneous banner race, stale/invalid recovery, hide/re-publish revocation and complete removal",
  );
  console.log(
    "Passed local public website, competing banner saves and visibility/removal recovery.",
  );
} finally {
  await cleanup();
  const after = await originals();
  for (const [key, value] of baseline)
    assert.equal(after.get(key), value, `Changed original ${key}`);
  for (const entry of people) {
    assert.equal(
      (await database`select id from auth.users where id=${entry.id}::uuid`)
        .length,
      0,
    );
    assert.equal(
      (
        await database`select name from storage.objects where bucket_id='coach-banners' and split_part(name,'/',1)=${entry.actor.profileId}`
      ).length,
      0,
    );
  }
  await database.end();
  checks.push(
    "exact temporary Auth/application/banner cleanup and unchanged original profile/coach/location/website/Storage hashes",
  );
  await writeFile(
    evidence + "/result.json",
    JSON.stringify({ checks }, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(
    `Completed DEV0321 cleanup and preservation checks; evidence ${evidence}.`,
  );
}
