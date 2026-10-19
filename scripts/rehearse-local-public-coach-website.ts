/** Real, exactly owned Auth/Storage/content fixtures for native browser review; no browser automation. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";
import {
  upsertOwnedCoachProfileRecord,
  createOwnedCoachTrainingLocationRecord,
} from "../src/server/db/coaches/repository";
import { saveOwnedEffectiveAvailabilityRecord } from "../src/server/db/coaches/effective-availability-repository";
import { EMPTY_COACH_WEBSITE_CONTENT } from "../src/domain/coach-website";
import { groupSessionCommandRecord } from "../src/server/db/group-sessions/repository";
import { calendarDate, addCalendarDays } from "../src/domain/coach-calendar";

const f = await localConnectionRehearsal("DEV0317");
const {
  database: db,
  person,
  approveCoach,
  work,
  cleanup,
  cookieHeader,
  base,
} = f;
const tag = randomUUID().slice(0, 8);
const evidence = `tmp/dev0317-public/${tag}`;
await mkdir(evidence, { recursive: true, mode: 0o700 });
const people: LocalPerson[] = [];
const handles = [`dev0317_${tag}`, `dev0317_new_${tag}`];
const hashes = async () =>
  new Map(
    (
      await db<{ key: string; hash: string }[]>`
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
await writeFile(`${evidence}/baseline.json`, JSON.stringify([...baseline]), {
  mode: 0o600,
});
const checked: string[] = [];
async function request(
  path: string,
  actor?: LocalPerson,
  init: RequestInit = {},
) {
  return fetch(base + path, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(60000),
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
  input?: unknown,
  method = "POST",
) {
  const response = await request(
    path,
    actor,
    input === undefined
      ? {}
      : {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
  );
  assert.equal(
    response.status,
    200,
    `${path}: ${await response.clone().text()}`,
  );
  return response.json();
}
async function add(name: string) {
  const p = await person(name);
  people.push(p);
  await writeFile(
    `${evidence}/recovery-ids.json`,
    JSON.stringify({
      ticket: "DEV0317",
      people: people.map((p) => ({
        authUserId: p.id,
        profileId: p.actor.profileId,
      })),
      handles,
    }),
    { mode: 0o600 },
  );
  return p;
}
try {
  const owner = await add(`Alex · DEV0317 ${tag}`);
  await approveCoach(owner);
  const profile = (visibility: "visible" | "hidden") => ({
    displayName: owner.name,
    bio: "Thoughtful boxing coaching in Berlin. We build skills at your pace, with clear feedback and practical goals.",
    disciplines: ["Boxing"] as const,
    timezone: "Europe/Berlin",
    visibility,
    selectedGymId: "40000000-0000-4000-8000-000000000001",
    independentLocation: null,
  });
  await work(owner, (tx) =>
    upsertOwnedCoachProfileRecord(tx, profile("visible")),
  );
  await work(owner, (tx) =>
    createOwnedCoachTrainingLocationRecord(tx, {
      kind: "independent",
      publicName: "Outdoor practice",
      label: "Tempelhofer Feld · Berlin",
      latitude: 52.473086,
      longitude: 13.403665,
      source: "manual",
      provider: null,
    }),
  );
  const [row] =
    await db`select public_slug from app.coach_profiles where profile_id=${owner.actor.profileId}::uuid`;
  const slug = row.public_slug as string;
  let path = `/coaches/${slug}`;
  const content = {
    ...EMPTY_COACH_WEBSITE_CONTENT,
    brandLabel: "Build your own rhythm",
    introduction:
      "A stronger foundation. A little more confidence. Coaching that meets you where you are.",
    approach:
      "Start with the basics and make them yours. Every session balances technique, movement and room to ask questions.\n\nWe choose goals together, then build a routine you can keep.",
    experience:
      "Coach-provided training experience and qualifications for this disposable website rehearsal. MovX identity review does not certify these claims.",
    focusLabels: ["Beginners welcome", "Technique", "Confidence"],
    faqs: [
      {
        question: "What should I bring?",
        answer:
          "Comfortable training clothes, water and any equipment agreed with your coach.",
      },
      {
        question: "Can I start as a beginner?",
        answer:
          "Yes. We discuss your experience and adapt the session together.",
      },
    ],
    links: [
      { label: "Coaching resources", url: "https://example.org/coaching" },
    ],
  };
  async function saveContent(empty = false) {
    const saved = await json("/api/coach/website", owner);
    return json(
      "/api/coach/website",
      owner,
      {
        schemaVersion: 1,
        expectedRevision: saved.website.revision,
        content: empty ? EMPTY_COACH_WEBSITE_CONTENT : content,
      },
      "PUT",
    );
  }
  const saved = await saveContent();
  const banner = await sharp({
    create: { width: 1600, height: 600, channels: 3, background: "#b6a1cb" },
  })
    .png()
    .toBuffer();
  const upload = await request("/api/coach/website/banner", owner, {
    method: "POST",
    headers: {
      "content-type": "image/png",
      "if-match": `"${saved.website.revision}"`,
    },
    body: new Uint8Array(banner),
  });
  assert.equal(upload.status, 200);
  const portrait = await sharp({
    create: { width: 512, height: 512, channels: 3, background: "#61417b" },
  })
    .webp()
    .toBuffer();
  const portraitUpload = await request("/api/coach/portrait", owner, {
    method: "POST",
    headers: { "content-type": "image/webp" },
    body: new Uint8Array(portrait),
  });
  assert.equal(portraitUpload.status, 200);
  async function rate(amountCents: number, showPublicly: boolean) {
    const current = await json("/api/coach/starting-rate", owner);
    await json(
      "/api/coach/starting-rate",
      owner,
      {
        schemaVersion: 1,
        expectedRevision: current.startingRate.revision,
        amountCents,
        currency: "EUR",
        showPublicly,
      },
      "PUT",
    );
  }
  await rate(987654, false);
  const hiddenHtml = await (await request(path)).text();
  assert.ok(
    !hiddenHtml.includes("987654") &&
      !hiddenHtml.includes("9,876.54") &&
      !hiddenHtml.includes("Sessions start from"),
  );
  await rate(0, true);
  assert.ok(
    (await (await request(path)).text()).includes("(Free)"),
    "Zero rate has its public Free label",
  );
  await rate(4500, true);
  checked.push(
    "real saved website/banner/portrait; hidden rate excluded from HTML/RSC/metadata; zero remains Free",
  );
  const account = await json("/api/account", owner);
  await json("/api/account", owner, {
    section: "login-security",
    revision: account.details.revision,
    username: handles[0],
  });
  const unconfirmed = await request(path);
  assert.equal(unconfirmed.status, 200);
  async function confirm(username: string) {
    const current = await json("/api/coach/public-url", owner);
    await json("/api/coach/public-url", owner, {
      username,
      expectedRevision: current.revision,
      consent: true,
    });
    path = `/@${username}`;
  }
  await confirm(handles[0]);
  const legacy = await request(
    `/coaches/${slug}?date=2026-10-23&email=private-canary`,
  );
  assert.ok([307, 308].includes(legacy.status));
  assert.equal(
    legacy.headers.get("location"),
    `${path}?date=2026-10-23#private-schedule`,
  );
  const canonicalHtml = await (await request(path)).text();
  assert.ok(canonicalHtml.includes(`href="${base}${path}"`));
  assert.ok(!canonicalHtml.includes("private-canary"));
  checked.push(
    "unconfirmed legacy remains readable; confirmed redirect strips unsafe query; canonical metadata uses username",
  );
  const [location] =
    await db`select id,to_jsonb(updated_at)#>>'{}' as updated_at from app.coach_training_locations where profile_id=${owner.actor.profileId}::uuid and is_primary and status='active'`;
  const initialTypes = await json("/api/coach/session-types", owner);
  for (const type of initialTypes.types)
    await json("/api/coach/session-types", owner, {
      commandId: randomUUID(),
      action: "archive",
      id: type.id,
      expectedRevision: type.revision,
    });
  const emptyHtml = await (await request(path)).text();
  assert.match(emptyHtml, /isn.t offering private classes right now/);
  const types = [];
  for (const durationMinutes of [60, 75, 90]) {
    const id = randomUUID();
    types.push(id);
    await json("/api/coach/session-types", owner, {
      commandId: randomUUID(),
      action: "save",
      id,
      expectedRevision: -1,
      format: "private",
      name: `Boxing · ${durationMinutes} minutes`,
      description: "Technique, movement and confidence at your pace.",
      color: "#61417b",
      durationMinutes,
      defaultLocationId: location.id,
      bookable: true,
    });
  }
  const nextDate = addCalendarDays(calendarDate(new Date().toISOString()), 1);
  await work(owner, (tx) =>
    saveOwnedEffectiveAvailabilityRecord(tx, {
      kind: "dates",
      operationId: randomUUID(),
      expectedRevision: 0,
      dates: [
        {
          date: nextDate,
          mode: "custom",
          hours: ["10:00", "11:00", "12:00"].map((localStartTime) => ({
            locationId: location.id,
            locationUpdatedAt: location.updated_at,
            localStartTime,
          })),
        },
      ],
    }),
  );
  const groupTypeId = randomUUID();
  await json("/api/coach/session-types", owner, {
    commandId: randomUUID(),
    action: "save",
    id: groupTypeId,
    expectedRevision: -1,
    format: "group",
    name: "Boxing together",
    description: "Learn and practise together.",
    color: "#61417b",
    durationMinutes: 75,
    defaultLocationId: location.id,
    bookable: true,
  });
  const groupId = randomUUID();
  const startsAt = new Date(
    Math.ceil((Date.now() + 7 * 86400000) / 900000) * 900000,
  ).toISOString();
  const draft = await work(owner, (tx) =>
    groupSessionCommandRecord(tx, {
      action: "save-draft",
      args: {
        id: groupId,
        expectedRevision: null,
        sessionTypeId: groupTypeId,
        sessionTypeRevision: 1,
        title: `Boxing foundations ${tag}`,
        description: "A real published session owned by the disposable coach.",
        discipline: "Boxing",
        intendedLevel: "Beginners",
        locationId: location.id,
        startsAt,
        endsAt: new Date(Date.parse(startsAt) + 75 * 60000).toISOString(),
        decisionDeadlineAt: new Date(
          Date.parse(startsAt) - 86400000,
        ).toISOString(),
        minimumParticipants: 1,
        maximumParticipants: 6,
        priceCents: 1500,
      },
    }),
  );
  assert.ok(draft.session);
  const published = await work(owner, (tx) =>
    groupSessionCommandRecord(tx, {
      action: "publish",
      args: { id: groupId, expectedRevision: draft.session!.revision },
    }),
  );
  assert.equal(published.outcome, "published");
  checked.push(
    "enabled empty catalog does not invent defaults; authored 60/75/90 minute types and actual published 75 minute group",
  );
  const reviewBookings: { actor: LocalPerson; bookingId: string }[] = [];
  for (let i = 0; i < 21; i++) {
    const athlete = await add(`Private DEV0317 athlete ${i} ${tag}`);
    const slotId = randomUUID(),
      bookingId = randomUUID();
    const start = new Date(
      Math.floor(Date.now() / 3600000) * 3600000 -
        45 * 86400000 +
        i * 2 * 3600000,
    ).toISOString();
    const end = new Date(Date.parse(start) + 3600000).toISOString();
    await db`insert into app.coach_availability_slots(id,run_id,profile_id,starts_at,ends_at,coach_timezone,status,location_kind,selected_gym_id,gym_name,public_location_label,latitude,longitude,location_source,location_provider,location_confirmed_at,coach_training_location_id,training_location_name)
      select ${slotId}::uuid,l.run_id,l.profile_id,${start}::timestamptz,${end}::timestamptz,l.timezone,'booked',l.location_kind,l.selected_gym_id,g.name,l.public_location_label,l.latitude,l.longitude,l.location_source,l.location_provider,l.location_confirmed_at,l.id,l.public_name from app.coach_training_locations l left join app.gyms g on g.id=l.selected_gym_id and g.run_id=l.run_id where l.id=${location.id}::uuid`;
    await db`insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at,completed_at,created_at) values(${bookingId}::uuid,${owner.actor.runId}::uuid,${slotId}::uuid,${owner.actor.profileId}::uuid,${athlete.actor.profileId}::uuid,'completed',${start}::timestamptz,${end}::timestamptz,${start}::timestamptz,${start}::timestamptz,${end}::timestamptz,${start}::timestamptz-interval '1 day')`;
    await json("/api/coach-reviews", athlete, {
      action: "publish",
      bookingId,
      rating: 4 + (i % 2),
      comment: `Clear explanations and a thoughtful session. Public feedback ${i + 1}.`,
      attribution: `Consented athlete ${i + 1}`,
      consent: true,
      expectedRevision: 0,
    });
    reviewBookings.push({ actor: athlete, bookingId });
  }
  const first = await json(`/api/coaches/${slug}/reviews`);
  assert.equal(first.summary.count, 21);
  assert.equal(first.reviews.length, 20);
  assert.ok(first.nextCursor);
  const last = await json(
    `/api/coaches/${slug}/reviews?cursor=${encodeURIComponent(first.nextCursor)}`,
  );
  assert.equal(last.reviews.length, 1);
  assert.equal(last.nextCursor, null);
  const html = await (await request(path)).text();
  assert.match(html, /21 reviews/);
  assert.ok(!html.includes(`Private DEV0317 athlete`));
  assert.match(html, /Boxing foundations/);
  for (const duration of [60, 75, 90])
    assert.ok(html.includes(`Boxing · ${duration} minutes`));
  checked.push(
    "21 real consented pair reviews, exact 20+1 cursor paging, private names excluded from public HTML/RSC",
  );
  console.log(
    JSON.stringify({
      ready: true,
      base,
      path,
      slug,
      evidence,
      nextDate: addCalendarDays(calendarDate(new Date().toISOString()), 1),
      commands:
        "hiddenrate | free | rate | rename | hide | publish | empty | restore | withdraw | finish",
    }),
  );
  const lines = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  for await (const raw of lines) {
    const command = raw.trim();
    if (command === "finish") {
      lines.close();
      break;
    }
    if (command === "hiddenrate") await rate(987654, false);
    else if (command === "free") await rate(0, true);
    else if (command === "rate") await rate(4500, true);
    else if (command === "empty" || command === "restore")
      await saveContent(command === "empty");
    else if (command === "hide" || command === "publish")
      await work(owner, (tx) =>
        upsertOwnedCoachProfileRecord(
          tx,
          profile(command === "hide" ? "hidden" : "visible"),
        ),
      );
    else if (command === "rename") {
      const current = await json("/api/account", owner);
      await json("/api/account", owner, {
        section: "login-security",
        revision: current.details.revision,
        username: handles[1],
      });
      await confirm(handles[1]);
    } else if (command === "withdraw") {
      const first = reviewBookings[0];
      const current = await json(
        `/api/coach-reviews?coach=${slug}`,
        first.actor,
      );
      await json("/api/coach-reviews", first.actor, {
        action: "withdraw",
        coachSlug: slug,
        expectedRevision: current.review.revision,
      });
    } else continue;
    console.log(JSON.stringify({ command, path, done: true }));
  }
} finally {
  const ids = people.map((p) => p.actor.profileId);
  let cleanupError: unknown;
  try {
    if (ids.length)
      await db`delete from app.coach_review_moderation_audit where review_id in (select id from app.coach_pair_reviews where coach_profile_id=any(${ids}::uuid[]) or athlete_profile_id=any(${ids}::uuid[]))`;
    if (ids.length)
      await db`delete from app.coach_pair_reviews where coach_profile_id=any(${ids}::uuid[]) or athlete_profile_id=any(${ids}::uuid[])`;
    await cleanup();
    for (const username of handles)
      await db`delete from app.coach_public_handles where username=${username} and profile_id is null`;
    assert.equal(
      (
        await db`select id from auth.users where id=any(${people.map((p) => p.id)}::uuid[])`
      ).length,
      0,
    );
    assert.equal(
      (await db`select id from app.profiles where id=any(${ids}::uuid[])`)
        .length,
      0,
    );
    assert.equal(
      (
        await db`select id from storage.objects where bucket_id in ('coach-banners','coach-portraits') and split_part(name,'/',1)=any(${ids}::text[])`
      ).length,
      0,
    );
    const after = await hashes();
    for (const [key, value] of baseline)
      assert.equal(after.get(key), value, `Original row changed: ${key}`);
  } catch (error) {
    cleanupError = error;
  }
  await writeFile(
    `${evidence}/result.json`,
    JSON.stringify({
      checked,
      retainedRowHashesUnchanged: cleanupError ? "not proven" : baseline.size,
      cleanup: cleanupError ? "failed; recover exact journal IDs" : "passed",
    }),
    { mode: 0o600 },
  );
  await db.end();
  if (cleanupError) throw cleanupError;
  console.log(
    JSON.stringify({
      cleanup: "passed",
      originalHashesUnchanged: baseline.size,
      checks: checked,
      evidence,
    }),
  );
}
