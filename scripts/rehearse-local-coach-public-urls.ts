import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";
import {
  localConnectionRehearsal,
  type LocalPerson,
} from "./lib/local-connection-rehearsal";
import { upsertOwnedCoachProfileRecord } from "../src/server/db/coaches/repository";

const {
  base,
  database,
  person,
  approveCoach,
  work,
  cookieHeader,
  cleanup,
  booking,
} = await localConnectionRehearsal("DEV0331");
const expect = baseExpect.configure({ timeout: 30_000 });
const tag = randomUUID().replaceAll("-", "").slice(0, 10);
const first = `dev0331_${tag}`,
  second = `dev0331_new_${tag}`;
const evidence = `tmp/dev0331-public-urls/${tag}`;
await mkdir(evidence, { recursive: true, mode: 0o700 });
const people: LocalPerson[] = [];
const checks: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let completed = false;
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const originals =
  await database`select c.profile_id,to_jsonb(c) coach,to_jsonb(p) profile from app.coach_profiles c join app.profiles p on p.id=c.profile_id where c.is_demo and c.public_slug in ('daniel-park','nora-klein','elif-demir','idris-malik','sam-lee','jake-miller') order by c.profile_id`;
assert.equal(originals.length, 6, "Expected six stable demo coach fixtures.");
const originalHash = hash(originals);
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
  input?: unknown,
  code = 200,
) {
  const response = await request(
    path,
    actor,
    input === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
  );
  const body = await response.json();
  assert.equal(response.status, code, JSON.stringify(body));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return body;
}
async function rename(actor: LocalPerson, username: string | null, code = 200) {
  const account = await json("/api/account", actor);
  return json(
    "/api/account",
    actor,
    { section: "login-security", revision: account.details.revision, username },
    code,
  );
}
const profile = (owner: LocalPerson, visibility: "visible" | "hidden") => ({
  displayName: owner.name,
  bio: "A clearly labelled isolated coach profile for public username URL validation.",
  disciplines: ["Boxing"] as const,
  timezone: "Europe/Berlin",
  visibility,
  selectedGymId: "40000000-0000-4000-8000-000000000001",
  independentLocation: null,
});
try {
  assert.equal(
    (
      await database`select id from auth.users where raw_app_meta_data->>'movx_test_ticket'='DEV0331'`
    ).length,
    0,
    "Resolve previous DEV0331 fixture cleanup first.",
  );
  console.log("Preparing tagged local DEV0331 fixtures.");
  const owner = await person(`DEV0331 Coach ${tag}`);
  people.push(owner);
  const athlete = await person(`DEV0331 Athlete ${tag}`);
  people.push(athlete);
  await writeFile(
    evidence + "/recovery-ids.json",
    JSON.stringify(
      people.map((p) => ({ authUserId: p.id, profileId: p.actor.profileId })),
    ),
    { mode: 0o600 },
  );
  await request("/api/coach/public-url");
  await approveCoach(owner);
  const slug = await work(owner, (tx) =>
    upsertOwnedCoachProfileRecord(tx, profile(owner, "visible")),
  );
  const privateBooking = await booking(owner, athlete);
  const stableBooking =
    await database`select to_jsonb(b) value from app.coach_private_bookings b where id=${privateBooking.bookingId}::uuid`;
  await rename(owner, first);
  const details = await json("/api/account", owner);
  await json("/api/account", owner, {
    section: "personal-details",
    revision: details.details.revision,
    legalName: "Private Legal Canary DEV0331",
    preferredFirstName: null,
    birthdate: null,
    gender: null,
  });
  await rename(athlete, `dev0331_private_${tag}`);
  assert.equal(
    (await request(`/coaches/${slug}`, undefined, { redirect: "manual" }))
      .status,
    200,
  );
  for (const handle of [
    first,
    `dev0331_private_${tag}`,
    `dev0331_unknown_${tag}`,
  ]) {
    const response = await request(`/@${handle}`);
    assert.match(await response.text(), /A little off the beaten track/);
  }
  checks.push(
    "saved private coach/athlete handles do not resolve; original slug remains usable",
  );
  console.log(
    "Private/legacy routes passed; starting desktop/mobile browser proof.",
  );
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1440, 393]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 393 ? 852 : 1040 },
      isMobile: width === 393,
    });
    await context.addCookies(owner.cookies.map((c) => ({ ...c, url: base })));
    const page = await context.newPage();
    await page.goto(base + "/profile/coach");
    const settings = page.getByRole("region", {
      name: "Your public coach URL",
    });
    await expect(settings).toContainText(`movx.club/@${first}`);
    const submit = settings.getByRole("button", {
      name: "Confirm public URL",
      exact: true,
    });
    await expect(submit).toBeDisabled();
    const checkbox = settings.getByRole("checkbox");
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
    if (width === 1440) {
      await page.keyboard.press("Tab");
      await expect(submit).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(settings).toContainText("Public username confirmed.", {
        timeout: 60_000,
      });
    } else {
      // Mobile is exercised with a separate fresh fixture username confirmation
      // after withdrawing its test-only reservation below, never a real owner.
      await submit.click();
      await expect(settings).toContainText("Public username confirmed.", {
        timeout: 60_000,
      });
    }
    await settings.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/owner-${width}.png` });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await context.close();
    if (width === 1440) {
      // Repeat the initial consent interaction at mobile width using only this
      // exact disposable fixture's reservation before any alias/rename tests.
      await database`delete from app.coach_public_handles where profile_id=${owner.actor.profileId}::uuid and username=${first}`;
    }
  }
  const rate = await request("/api/coach/starting-rate", owner, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schemaVersion: 1,
      expectedRevision: 0,
      amountCents: 283451,
      currency: "EUR",
      showPublicly: false,
    }),
  });
  assert.equal(rate.status, 200);
  const canonical = `/@${first}`;
  const upper = await request("/@" + first.toUpperCase(), undefined, {
    redirect: "manual",
  });
  assert.equal(upper.status, 307);
  assert.equal(upper.headers.get("location"), canonical);
  const encoded = await request("/%40" + first);
  assert.equal(encoded.status, 200);

  const legacy = await request(
    `/coaches/${slug}?date=2026-10-20&token=private&returnTo=https://evil.test`,
    undefined,
    { redirect: "manual" },
  );
  assert.equal(legacy.status, 307);
  assert.equal(
    legacy.headers.get("location"),
    `${canonical}?date=2026-10-20#private-schedule`,
  );
  for (const width of [1440, 393]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 393 ? 852 : 1040 },
    });
    const page = await context.newPage();
    await page.goto(base + canonical + "?date=2026-10-20");
    await expect(
      page.getByRole("heading", { name: owner.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Today", exact: true }),
    ).toHaveAttribute("href", new RegExp(`^${canonical}\\?date=`));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const text = await page.content();
    assert.ok(!text.includes("Private Legal Canary DEV0331"));
    assert.ok(
      !text.includes("283451"),
      "Hidden starting rate reached canonical HTML/RSC",
    );
    await page.screenshot({ path: `${evidence}/public-${width}.png` });
    await context.close();
  }
  checks.push(
    "real desktop/mobile owner preview, keyboard consent and canonical guest pages; no horizontal overflow or private legal name",
  );
  const saved = await json("/api/coach/public-url", owner);
  await json(
    "/api/coach/public-url",
    owner,
    { username: first, expectedRevision: saved.revision, consent: false },
    400,
  );
  await rename(owner, second);
  const alias = await request(
    canonical + "?date=2026-10-20&secret=private",
    undefined,
    { redirect: "manual" },
  );
  assert.equal(alias.status, 307);
  assert.equal(
    alias.headers.get("location"),
    `/@${second}?date=2026-10-20#private-schedule`,
  );
  await rename(owner, null, 409);
  await rename(athlete, first, 409);
  assert.deepEqual(
    await database`select to_jsonb(b) value from app.coach_private_bookings b where id=${privateBooking.bookingId}::uuid`,
    stableBooking,
  );
  // Existing Account UI retains draft and communicates the real live-URL rename.
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
  });
  await context.addCookies(owner.cookies.map((c) => ({ ...c, url: base })));
  const page = await context.newPage();
  await page.goto(base + "/account?section=login-security");
  await page
    .getByRole("button", { name: "Edit username", exact: true })
    .click();
  await expect(
    page.getByText(/Previous public links stay reserved/),
  ).toBeVisible();
  await page.locator("#account-username").fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Edit username" }).getByRole("alert"),
  ).toContainText("Enter a replacement instead of clearing it.");
  await page.screenshot({ path: `${evidence}/account-clear-393.png` });
  await context.close();
  await work(owner, (tx) =>
    upsertOwnedCoachProfileRecord(tx, profile(owner, "hidden")),
  );
  for (const handle of [first, second])
    assert.match(
      await (await request(`/@${handle}`)).text(),
      /A little off the beaten track/,
    );
  checks.push(
    "legacy/date and alias redirects discard private queries; API/UI clear recovery and takeover refusal; stable booking identity; hidden canonical/alias revocation",
  );
  completed = true;
} catch (error) {
  console.error(
    "DEV0331 browser rehearsal failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  throw error;
} finally {
  await browser?.close();
  try {
    const ids = people.map((p) => p.actor.profileId);
    const handles = ids.length
      ? await database<
          { username: string }[]
        >`select username from app.coach_public_handles where profile_id=any(${ids}::uuid[])`
      : [];
    assert.ok(
      handles.every((h) => h.username === first || h.username === second),
    );
    await cleanup();
    for (const handle of handles)
      await database`delete from app.coach_public_handles where username=${handle.username} and profile_id is null`;
    const after =
      await database`select c.profile_id,to_jsonb(c) coach,to_jsonb(p) profile from app.coach_profiles c join app.profiles p on p.id=c.profile_id where c.is_demo and c.public_slug in ('daniel-park','nora-klein','elif-demir','idris-malik','sam-lee','jake-miller') order by c.profile_id`;
    assert.equal(
      hash(after),
      originalHash,
      "An original demo coach/profile changed",
    );
    assert.equal(
      (
        await database`select id from auth.users where raw_app_meta_data->>'movx_test_ticket'='DEV0331'`
      ).length,
      0,
    );
    assert.equal(
      (
        await database`select username from app.coach_public_handles where username in (${first},${second})`
      ).length,
      0,
    );
    checks.push(
      "exact tagged fixture/Auth/handle cleanup; original six demo coach/profile rows preserved",
    );
    await writeFile(
      evidence + "/results.json",
      JSON.stringify({ completed, checks }, null, 2),
      { mode: 0o600 },
    );
    console.log(JSON.stringify({ completed, checks, evidence }));
  } finally {
    await database.end();
  }
}
