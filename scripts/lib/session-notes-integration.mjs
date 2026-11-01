// Actual production routes/Auth/SQL, only in the disposable MOV-19 stack.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });
export async function rehearseSessionNotes({
  base,
  database,
  person,
  stranger,
  output,
  pass,
}) {
  assert.equal(base, "http://localhost:3169");
  const coach = await person("QA Notes Coach"),
    athlete = await person("QA Notes Athlete");
  async function raw(a, query, args = []) {
    return database.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      await tx`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.profileId},true),set_config('app.current_run_id',${a.runId},true),set_config('app.current_run_role','member',true)`;
      return tx.unsafe(query, args);
    });
  }
  await raw(coach, "select app.submit_owned_coach_application()");
  await raw(
    coach,
    "select app.save_owned_coach_application_contact(0,$1::jsonb)",
    [
      {
        phoneNumber: "+4915112345678",
        instagramUrl: null,
        facebookUrl: null,
        linkedinUrl: null,
      },
    ],
  );
  await raw(
    coach,
    "select app.upsert_owned_coach_profile('Notes integration coach','Focused boxing practice with clear session plans and constructive feedback for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)",
  );
  await database`select app.review_coach_application(${coach.profileId}::uuid,'pending','approved','Isolated notes browser fixture','movnotes','movx-identity-application-v1')`;
  await database`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
  async function booking(n) {
    const [slot] = await raw(
      coach,
      `select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '${n} days 14 hours') at time zone 'Europe/Berlin',60) id`,
    );
    const [request] = await raw(
      athlete,
      "select * from app.create_coach_booking_request($1::uuid)",
      [slot.id],
    );
    const [b] = await raw(
      coach,
      "select * from app.accept_coach_booking_request($1::uuid)",
      [request.request_id],
    );
    return b.booking_id;
  }
  const id = await booking(3),
    replacement = await booking(4);
  const scopes = new Map();
  async function scope(a) {
    if (!scopes.has(a)) {
      const actor = await (
        await a.page.request.get(base + "/api/auth/actor")
      ).json();
      assert.equal(actor.status, "authorized");
      scopes.set(a, `${actor.demoRun.slug}:${actor.profile.slug}`);
    }
    return scopes.get(a);
  }
  async function api(a, command, endpoint = "session-notes") {
    return a.page.evaluate(
      async ({ command, scope, endpoint }) => {
        const r = await fetch(`/api/${endpoint}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command, scope }),
        });
        return { http: r.status, body: await r.json() };
      },
      { command, scope: await scope(a), endpoint },
    );
  }
  const read = (a = athlete, kind = "shared") =>
    api(a, { action: "read", args: { bookingId: id, kind } });
  const [messageBefore] =
    await database`select count(*)::int count from app.message_entries`;
  const page = coach.page;
  await page.goto(base + `/coach/sessions/${id}`);
  const notes = page.getByRole("region", { name: "Session notes and videos" });
  await notes.getByRole("button", { name: "Add a plan", exact: true }).click();
  await page
    .getByLabel("Training plan", { exact: true })
    .fill("Footwork, distance and relaxed shoulders.");
  await page
    .getByRole("button", { name: "Add video link", exact: true })
    .click();
  await page
    .getByLabel("Video title", { exact: true })
    .fill("Footwork reference");
  await page
    .getByLabel("YouTube or Instagram URL", { exact: true })
    .fill("https://youtu.be/M7lc1UVf-VE?si=tracking");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(
    notes.getByText("Footwork, distance and relaxed shoulders.", {
      exact: true,
    }),
  ).toBeVisible();
  await notes.getByRole("button", { name: "Add a note", exact: true }).click();
  await page
    .getByLabel("Your note", { exact: true })
    .fill("Coach shared observation");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    notes.getByText("Coach shared observation", { exact: true }),
  ).toBeVisible();
  await notes
    .getByRole("button", { name: "My private notes", exact: true })
    .click();
  await notes.getByRole("button", { name: "Add a note", exact: true }).click();
  await page
    .getByLabel("Your note", { exact: true })
    .fill("Private coach preparation must never reach athlete JSON");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    notes.getByText("Private coach preparation must never reach athlete JSON", {
      exact: true,
    }),
  ).toBeVisible();
  const privateRead = await read(coach, "private");
  assert.equal(privateRead.http, 200);
  assert.equal(privateRead.body.value.total, 1);
  const privateId = privateRead.body.value.entries[0].id;
  const publicRead = await read();
  assert.equal(publicRead.http, 200);
  assert.ok(!JSON.stringify(publicRead.body).includes(privateId));
  assert.ok(
    !JSON.stringify(publicRead.body).includes("Private coach preparation"),
  );
  assert.equal((await read(athlete, "private")).http, 403);
  assert.equal((await read(stranger)).http, 403);
  await athlete.page.goto(base + `/sessions/${id}`);
  const athleteNotes = athlete.page.getByRole("region", {
    name: "Session notes and videos",
  });
  await expect(
    athleteNotes.getByText("Coach shared observation", { exact: true }),
  ).toBeVisible();
  await expect(
    athleteNotes.getByRole("button", { name: "My private notes", exact: true }),
  ).toHaveCount(0);
  await expect(
    athleteNotes.getByRole("button", { name: "Edit plan", exact: true }),
  ).toHaveCount(0);
  await athleteNotes
    .getByRole("button", { name: "Add a note", exact: true })
    .click();
  await athlete.page
    .getByLabel("Your note", { exact: true })
    .fill("Athlete training reflection");
  await athlete.page
    .getByRole("button", { name: "Add video link", exact: true })
    .click();
  await athlete.page
    .getByLabel("Video title", { exact: true })
    .fill("My practice reference");
  await athlete.page
    .getByLabel("YouTube or Instagram URL", { exact: true })
    .fill("https://www.instagram.com/reel/Practice_123/?igsh=tracking");
  const attempts = [];
  await athlete.page.route("**/api/session-notes", async (route) => {
    const { command } = route.request().postDataJSON();
    if (command.action === "save") {
      attempts.push(command);
      if (attempts.length === 1) {
        assert.equal((await route.fetch()).status(), 200);
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  await athlete.page
    .getByRole("button", { name: "Save note", exact: true })
    .click();
  await expect(athleteNotes.getByRole("alert")).toContainText(
    "Retry the same save",
  );
  await athlete.page
    .getByRole("button", { name: "Retry same save", exact: true })
    .click();
  await expect(
    athleteNotes.getByText("Athlete training reflection", { exact: true }),
  ).toBeVisible();
  await athlete.page.unroute("**/api/session-notes");
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0], attempts[1]);
  const [savedCount] =
    await database`select count(*)::int count from app.session_note_operations where operation_id=${attempts[0].args.operationId}::uuid`;
  assert.equal(savedCount.count, 1);
  const reflected = (await read()).body.value.entries.find(
    (e) => e.body === "Athlete training reflection",
  );
  assert.equal(
    reflected.videos[0].url,
    "https://www.instagram.com/reel/Practice_123/",
  );
  // Open one draft, update that same author-owned note elsewhere, then submit stale.
  await athleteNotes
    .getByRole("button", { name: "Edit note", exact: true })
    .click();
  await athlete.page
    .getByLabel("Your note", { exact: true })
    .fill("My retained stale draft");
  assert.equal(
    (
      await api(athlete, {
        action: "save",
        args: {
          bookingId: id,
          kind: "shared",
          entryId: reflected.id,
          operationId: randomUUID(),
          revision: reflected.revision,
          body: "Latest saved in another tab",
          videos: reflected.videos,
        },
      })
    ).http,
    200,
  );
  await athlete.page
    .getByRole("button", { name: "Save note", exact: true })
    .click();
  await expect(
    athlete.page.getByLabel("Your note", { exact: true }),
  ).toHaveValue("My retained stale draft");
  await expect(athlete.page.locator(".note-conflict")).toContainText(
    "Latest saved in another tab",
  );
  await athlete.page
    .getByRole("button", {
      name: "Replace my draft with saved version",
      exact: true,
    })
    .click();
  await expect(
    athlete.page.getByLabel("Your note", { exact: true }),
  ).toHaveValue("Latest saved in another tab");
  await athlete.page
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await athlete.page.reload();
  assert.equal(
    (
      await api(athlete, {
        action: "read",
        args: { bookingId: replacement, kind: "shared" },
      })
    ).body.value.total,
    0,
  );
  const [messageAfter] =
    await database`select count(*)::int count from app.message_entries`;
  assert.equal(
    messageAfter.count,
    messageBefore.count,
    "Note saves create no Messages/unread events",
  );
  pass(
    "real booked-session plan/shared/private video notes persist with author-only edits, private-byte/ID exclusion, exact lost-response retry, stale draft reconciliation and empty rebooking; no chat entries are created",
  );
  for (const width of [1440, 430, 375, 320]) {
    await athlete.page.setViewportSize({
      width,
      height: width === 1440 ? 1000 : 850,
    });
    await athlete.page.goto(base + `/sessions/${id}`);
    await expect(
      athleteNotes.getByText("Coach shared observation", { exact: true }),
    ).toBeVisible();
    assert.equal(
      await athlete.page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await athlete.page.screenshot({
      path: path.join(output, `session-notes-athlete-${width}.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 850 });
    await page.goto(base + `/coach/sessions/${id}`);
    await notes
      .getByRole("button", { name: "My private notes", exact: true })
      .click();
    await expect(
      notes.getByText(
        "Private coach preparation must never reach athlete JSON",
        { exact: true },
      ),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(output, `session-notes-coach-private-${width}.png`),
      fullPage: true,
    });
  }
  const past = new Date(Date.now() - 86400000),
    day = past.toISOString().slice(0, 10),
    video = {
      label: "Private workout drill",
      url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    };
  const create = {
    action: "save",
    args: {
      commandId: randomUUID(),
      title: "Notes workout",
      date: day,
      time: "10:00",
      timezone: "UTC",
      minutes: 45,
      completed: true,
      notes: "Private workout reflection",
      videos: [video],
    },
  };
  assert.equal((await api(athlete, create, "training")).http, 200);
  await athlete.page.goto(base + `/sessions/calendar?date=${day}&timezone=UTC`);
  await athlete.page
    .getByRole("button", { name: "Edit workout: Notes workout", exact: true })
    .click();
  await expect(
    athlete.page.getByRole("textbox", { name: "Personal notes", exact: true }),
  ).toBeVisible();
  await expect(
    athlete.page.getByLabel("Video title", { exact: true }),
  ).toHaveValue(video.label);
  await athlete.page
    .getByRole("textbox", { name: "Personal notes", exact: true })
    .fill("Updated private workout reflection");
  await athlete.page
    .getByRole("button", { name: "Save training", exact: true })
    .click();
  await expect(athlete.page.getByRole("dialog")).toHaveCount(0);
  await expect(
    athlete.page.getByText("Updated private workout reflection", {
      exact: true,
    }),
  ).toBeVisible();
  const list = {
    action: "list",
    args: { from: day, through: day, timezone: "UTC" },
  };
  const own = (await api(athlete, list, "training")).body.value.items.find(
    (i) => i.title === "Notes workout",
  );
  assert.equal(own.notes, "Updated private workout reflection");
  assert.deepEqual(own.videos, [video]);
  assert.equal(
    JSON.stringify((await api(stranger, list, "training")).body).includes(
      video.label,
    ),
    false,
  );
  pass(
    "real personal workout Notes & videos are visible without expanding optional details, persist across editing/reload and remain owner-only",
  );
  await raw(athlete, "select app.cancel_direct_private_booking($1::uuid)", [
    id,
  ]);
  await athlete.page.goto(base + `/sessions/${id}`);
  await expect(
    athleteNotes.getByText("These notes are read-only.", { exact: false }),
  ).toBeVisible();
  await expect(
    athleteNotes.getByRole("button", { name: "Add a note", exact: true }),
  ).toBeDisabled();
  await expect(
    athleteNotes.getByText("Coach shared observation", { exact: true }),
  ).toBeVisible();
  pass(
    "real original-booking notes remain readable after cancellation; desktop/430/375/320 layouts have no overflow and private sections stay coach-only",
  );
  await coach.context.close();
  await athlete.context.close();
}
