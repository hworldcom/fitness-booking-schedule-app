import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";

const { base, database, person, approveCoach, work, cookieHeader, cleanup } =
  await localConnectionRehearsal("DEV0313");
const evidence = `tmp/dev0313-starting-rates/${randomUUID()}`;
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
    union all select 'rate:'||profile_id::text,to_jsonb(t) from app.coach_starting_rates t
    union all select 'request:'||id::text,to_jsonb(t) from app.coach_booking_requests t
    union all select 'booking:'||id::text,to_jsonb(t) from app.coach_private_bookings t
    union all select 'message:'||id::text,to_jsonb(t) from app.message_entries t
    union all select 'group:'||id::text,to_jsonb(t) from app.coach_group_sessions t
    union all select 'object:'||id::text,to_jsonb(t) from storage.objects t`;
  return new Map(rows.map((row) => [row.key, hash(row.value)]));
}
const baseline = await originals();
await writeFile(
  evidence + "/baseline-hashes.json",
  JSON.stringify([...baseline]),
  { mode: 0o600 },
);
assert.equal(
  (
    await database`select id from auth.users where raw_app_meta_data->>'movx_test_ticket'='DEV0313'`
  ).length,
  0,
  "Resolve prior DEV0313 cleanup first.",
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
  actor?: LocalPerson,
  init: RequestInit = {},
  code = 200,
) {
  const response = await request(path, actor, init);
  const result = await response.json();
  assert.equal(response.status, code, JSON.stringify(result));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.match(response.headers.get("vary") ?? "", /Cookie/i);
  return result;
}
const api = "/api/coach/starting-rate";
const input = (
  revision: number,
  amountCents: number | null,
  showPublicly: boolean,
): RequestInit => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    schemaVersion: 1,
    expectedRevision: revision,
    amountCents,
    currency: "EUR",
    showPublicly,
  }),
});
let completed = false;
try {
  for (const name of ["Owner", "Other", "Applicant"]) {
    people.push(await person(`Rate ${name} ${randomUUID().slice(0, 6)}`));
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
  const profile = (entry: LocalPerson, visibility: "visible" | "hidden") => ({
    displayName: entry.name,
    bio: "An isolated coach for indicative starting-rate privacy and revision validation.",
    disciplines: ["Boxing"] as const,
    timezone: "Europe/Berlin",
    visibility,
    selectedGymId: "40000000-0000-4000-8000-000000000001",
    independentLocation: null,
  });
  await work(applicant, submitOwnedCoachApplicationRecord);
  await work(applicant, (tx) =>
    upsertOwnedCoachProfileRecord(tx, profile(applicant, "hidden")),
  );
  const [coach] =
    await database`select public_slug from app.coach_profiles where profile_id=${owner.actor.profileId}::uuid`;
  const slug = coach.public_slug as string;
  const publicApi = `/api/coaches/${slug}/starting-rate`;
  const websiteApi = `/api/coaches/${slug}/website`;
  const initial = await json(api, owner);
  assert.deepEqual(initial.startingRate, {
    schemaVersion: 1,
    revision: 0,
    amountCents: null,
    currency: "EUR",
    showPublicly: false,
    context: "private-session",
  });
  await json(api, undefined, {}, 401);
  await json(api, other, {}, 403);
  await json(api, other, input(0, 5000, true), 403);
  await json(publicApi, undefined, {}, 404);
  const hiddenAmount = 97_654_321;
  const hidden = await json(api, owner, input(0, hiddenAmount, false));
  assert.equal(hidden.startingRate.revision, 1);
  await json(api, owner, input(0, 5000, true), 409);
  for (const value of [
    { amountCents: -1 },
    { amountCents: 0.5 },
    { amountCents: 2_147_483_648 },
    { currency: "USD" },
    { profileId: other.actor.profileId },
  ]) {
    const draft = JSON.parse(input(1, 5000, true).body as string);
    await json(
      api,
      owner,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, ...value }),
      },
      400,
    );
  }
  await json(
    api,
    owner,
    {
      ...input(1, 5000, true),
      headers: {
        "content-type": "application/json",
        origin: "https://forged.example",
      },
    },
    400,
  );
  await json(
    api,
    owner,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: " ".repeat(2049),
    },
    400,
  );
  assert.deepEqual((await json(api, owner)).startingRate, hidden.startingRate);
  const draft = await json(api, applicant, input(0, 6000, true));
  assert.equal(draft.startingRate.revision, 1);
  const [pending] =
    await database`select public_slug from app.coach_profiles where profile_id=${applicant.actor.profileId}::uuid`;
  await json(
    `/api/coaches/${pending.public_slug}/starting-rate`,
    undefined,
    {},
    404,
  );
  checks.push(
    "real owner reload, initial optional/hidden state, applicant drafts, invalid money/currency/extra actor/body/origin, stale edits and non-owner denial",
  );
  console.log("Passed local pricing owner and draft boundaries.");

  await work(owner, (tx) =>
    upsertOwnedCoachProfileRecord(tx, profile(owner, "visible")),
  );
  const { publicCoachDirectory, publicCoachProfile } =
    await import("../src/server/coaches/service");
  const { normalizeCoachDirectoryFilters } =
    await import("../src/domain/coaches");
  async function projections(expected: number | null) {
    const rate = await json(publicApi);
    const authenticatedPublic = await json(publicApi, owner);
    assert.deepEqual(authenticatedPublic, rate);
    const website = await json(websiteApi);
    const directory = await publicCoachDirectory(
      normalizeCoachDirectoryFilters({ query: owner.name }),
    );
    assert.equal(directory.status, "ready");
    if (directory.status !== "ready") throw Error("Directory unavailable.");
    const entry = directory.entries.find(
      (item) => item.coach.profileId === owner.actor.profileId,
    );
    assert.ok(entry?.website);
    const detail = await publicCoachProfile(slug);
    assert.equal(detail.status, "ready");
    if (detail.status !== "ready") throw Error("Profile unavailable.");
    assert.ok(detail.website);
    for (const view of [rate, website.website, entry.website, detail.website]) {
      if (expected === null)
        assert.equal(Object.hasOwn(view, "startingRate"), false);
      else {
        assert.equal(view.startingRate?.amountCents, expected);
        assert.equal(view.startingRate?.currency, "EUR");
        assert.equal(view.startingRate?.context, "private-session");
        assert.deepEqual(Object.keys(view.startingRate).sort(), [
          "amountCents",
          "context",
          "currency",
          "label",
          "schemaVersion",
        ]);
      }
    }
    return rate;
  }
  await projections(null);
  await json(api, owner, input(1, 0, true));
  assert.equal(
    (await projections(0)).startingRate.label,
    "Sessions start from €0 (Free)",
  );
  await json(api, owner, input(2, 6050, true));
  assert.equal(
    (await projections(6050)).startingRate.label,
    "Sessions start from €60.50",
  );
  const contentBefore = (await json("/api/coach/website", owner)).website;
  await json(api, owner, input(3, hiddenAmount, true));
  await projections(hiddenAmount);
  // Prime the public document before revocation; layouts consume the safe DTO
  // but actual price/card/editor presentation belongs to the frontend peers.
  const primed = await request(`/coaches/${slug}`);
  assert.equal(primed.status, 200);
  await primed.text();
  await json(api, owner, input(4, hiddenAmount, false));
  await projections(null);
  assert.equal((await json(api, owner)).startingRate.amountCents, hiddenAmount);
  assert.deepEqual(
    (await json("/api/coach/website", owner)).website,
    contentBefore,
  );
  for (const path of [
    `/coaches/${slug}`,
    `/?query=${encodeURIComponent(owner.name)}`,
    `/explore?query=${encodeURIComponent(owner.name)}`,
  ]) {
    for (const rsc of [false, true]) {
      const response = await request(
        path,
        undefined,
        rsc ? { headers: { RSC: "1" } } : {},
      );
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.doesNotMatch(body, /97654321|976,543\.21|976543\.21|showPublicly/);
      assert.doesNotMatch(body, /startingRate.{0,120}amountCents/);
    }
  }
  checks.push(
    "public rate/website/card/profile projections, anonymous and owner-cookie privacy, explicit Free/paid context, hide retains owner value and removes HTTP HTML/RSC/metadata data after a primed read; independent content revision",
  );
  console.log("Passed public pricing projections and hide/cache privacy.");

  const races = await Promise.all(
    [7000, 8000].map(async (amount) => {
      const response = await request(api, owner, input(5, amount, true));
      return { code: response.status, value: await response.json() };
    }),
  );
  assert.deepEqual(races.map((result) => result.code).sort(), [200, 409]);
  const winner = races.find((result) => result.code === 200)!;
  assert.equal(winner.value.startingRate.revision, 6);
  await projections(winner.value.startingRate.amountCents);
  await json(api, owner, input(6, null, true));
  await projections(null);
  assert.equal((await json(api, owner)).startingRate.showPublicly, true);
  await work(owner, (tx) =>
    upsertOwnedCoachProfileRecord(tx, profile(owner, "hidden")),
  );
  await json(publicApi, undefined, {}, 404);
  await json(
    "/api/coaches/unknown-dev0313-coach/starting-rate",
    undefined,
    {},
    404,
  );
  checks.push(
    "real concurrent saves yield one 200 and one 409; clear/disclosure independence, private coach revocation and indistinguishable missing slug",
  );
  completed = true;
} catch (error) {
  console.error(
    "Pricing rehearsal failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  throw error;
} finally {
  try {
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
          await database`select profile_id from app.coach_starting_rates where profile_id=${entry.actor.profileId}::uuid`
        ).length,
        0,
      );
    }
    checks.push(
      "exact temporary Auth/profile/rate cleanup and unchanged original profile/coach/location/website/rate/Storage/request/booking/message/group hashes",
    );
    await writeFile(
      evidence + "/results.json",
      JSON.stringify({ completed, checks }, null, 2),
      { mode: 0o600 },
    );
    console.log(
      `Cleanup and original-data preservation passed; evidence: ${evidence}`,
    );
  } finally {
    await database.end();
  }
}
