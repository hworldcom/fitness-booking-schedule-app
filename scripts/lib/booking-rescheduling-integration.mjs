import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });

// Real Auth cookies, restricted application login, canonical SQL and local mail.
export async function rehearseBookingRescheduling({
  base,
  person,
  database,
  cron,
  mail,
  pass,
  output,
}) {
  assert.equal(base, "http://localhost:3169");
  const coach = await person("Mov178Coach"),
    athlete = await person("Mov178Athlete");
  const source = (actor, query, params = []) =>
    database.begin(async (tx) => {
      await tx`set local role app_runtime`;
      await tx`select set_config('app.current_auth_user_id',${actor.authId},true),set_config('app.current_profile_id',${actor.profileId},true),set_config('app.current_run_id',${actor.runId},true),set_config('app.current_run_role','member',true)`;
      return tx.unsafe(query, params);
    });
  const api = async (actor, suffix, body) => {
    const r = await actor.context.request.fetch(
      base + "/api/session-bookings" + suffix,
      {
        method: body ? "POST" : "GET",
        headers: { origin: base },
        ...(body ? { data: body } : {}),
      },
    );
    return { status: r.status(), data: await r.json() };
  };
  const drain = async () => {
    for (let i = 0; i < 10; i++) {
      const r = await fetch(base + "/api/internal/notifications/dispatch", {
        headers: { authorization: "Bearer " + cron },
      });
      assert.equal(r.status, 200);
      const d = (await r.json()).result;
      assert.equal(d.failed, 0);
      assert.equal(d.unknown, 0);
      assert.equal(d.retry, 0);
      if (!d.claimed) return;
    }
    throw Error("Fixture mail did not drain");
  };
  try {
    await source(coach, "select app.submit_owned_coach_application()");
    await source(
      coach,
      `select app.save_owned_coach_application_contact(0,'{"phoneNumber":"+4915123456789","instagramUrl":null,"facebookUrl":null,"linkedinUrl":null}'::jsonb)`,
    );
    await source(
      coach,
      "select app.upsert_owned_coach_profile('Mov178Coach','Private training with clear preparation and regular practice.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)",
    );
    await database`select app.review_coach_application(${coach.profileId}::uuid,'pending','approved','Isolated MOV-178 coach reviewed','fixture-operator','movx-identity-application-v1')`;
    await database`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
    const [venue] =
      await database`select id,public_name name,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
    const [day] =
      await database`select ((clock_timestamp() at time zone 'Europe/Berlin')::date + (7-extract(isodow from clock_timestamp() at time zone 'Europe/Berlin')::int)%7 + 7)::text date`;
    await source(
      coach,
      "select app.save_owned_effective_coach_availability($1::jsonb)",
      [
        database.json({
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: 0,
          dates: [
            {
              date: day.date,
              mode: "custom",
              hours: ["10:00", "11:00", "12:00"].map((localStartTime) => ({
                localStartTime,
                locationId: venue.id,
                locationUpdatedAt: venue.stamp,
              })),
            },
          ],
        }),
      ],
    );
    const [type] =
      await database`select id,revision from app.coach_session_types where coach_profile_id=${coach.profileId}::uuid and format='private'`;
    const [times] =
      await database`select (${day.date}::date+time '10:00') at time zone 'Europe/Berlin' original,(${day.date}::date+time '11:00') at time zone 'Europe/Berlin' target`;
    const [publicProfile] =
      await database`select public_slug from app.coach_profiles where profile_id=${coach.profileId}::uuid`;
    await athlete.page.setViewportSize({ width: 375, height: 800 });
    await athlete.page.goto(
      base +
        "/coaches/" +
        publicProfile.public_slug +
        "?date=" +
        day.date +
        "#private-schedule",
    );
    await athlete.page
      .getByLabel("Session type", { exact: true })
      .selectOption(type.id);
    await athlete.page
      .getByLabel("Venue", { exact: true })
      .selectOption(venue.id);
    await athlete.page.getByRole("button", { name: /10:00.*to 11:00/ }).click();
    await athlete.page
      .getByRole("button", { name: "Review request →", exact: true })
      .click();
    await athlete.page
      .getByRole("dialog", { name: "One last look.", exact: true })
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(
      athlete.page.getByRole("heading", {
        name: "Request sent · awaiting coach confirmation",
        exact: true,
      }),
    ).toBeVisible();
    const requests =
      await database`select id,status from app.coach_booking_requests where coach_profile_id=${coach.profileId}::uuid and client_profile_id=${athlete.profileId}::uuid`;
    assert.equal(requests.length, 1);
    assert.equal(requests[0].status, "pending");
    await coach.page.goto(base + "/coach?view=bookings");
    await coach.page
      .getByRole("button", { name: "Accept", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await database`select status from app.coach_booking_requests where id=${requests[0].id}::uuid`
          )[0].status,
      )
      .toBe("accepted");
    const [accepted] =
      await database`select accepted_booking_id from app.coach_booking_requests where id=${requests[0].id}::uuid`;
    const bookingId = accepted.accepted_booking_id;
    assert.ok(bookingId);
    pass(
      "athlete selects and reviews Sunday10:00 on the public coach website, submits a real request, and the coach accepts through Bookings",
    );
    await source(coach, "select app.session_notes_command('save',$1::jsonb)", [
      database.json({
        bookingId,
        kind: "plan",
        operationId: randomUUID(),
        revision: 0,
        body: "Preserve original training preparation",
        videos: [],
      }),
    ]);
    const [original] =
      await database`select b.id,b.client_profile_id,b.coach_profile_id,b.created_at,
      (select to_jsonb(r) from app.coach_booking_requests r where r.accepted_booking_id=b.id) request,
      (select to_jsonb(p) from app.session_note_plans p where p.booking_id=b.id) plan
      from app.coach_private_bookings b where b.id=${bookingId}::uuid`;
    await drain();
    await coach.page.setViewportSize({ width: 375, height: 800 });
    await coach.page.goto(
      base + "/coach?view=schedule&section=availability&date=" + day.date,
    );
    await expect(coach.page.locator(".availability-editor")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await coach.page
      .getByLabel("Date override range 1 start", { exact: true })
      .selectOption("11:00");
    await coach.page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    const availabilityReview = coach.page.getByRole("dialog", {
      name: "Review availability changes",
      exact: true,
    });
    await expect(
      availabilityReview.getByRole("heading", {
        name: "These sessions stay scheduled",
        exact: true,
      }),
    ).toBeVisible();
    await expect(availabilityReview).toContainText(
      "Changing availability does not cancel or move them.",
    );
    await availabilityReview
      .getByRole("button", { name: "Save availability", exact: true })
      .click();
    await expect(
      coach.page.getByText("Availability saved.", { exact: false }),
    ).toBeVisible();
    await expect(
      coach.page.locator(".availability-saved-impact"),
    ).toContainText("These sessions stay scheduled");
    const retained = await api(coach, "?bookingId=" + bookingId);
    assert.equal(retained.data.detail.revision, 0);
    assert.equal(
      Date.parse(retained.data.detail.startsAt),
      Date.parse(times.original),
    );
    assert.equal(
      (
        await database`select count(*) from app.booking_notification_events where source_id=${bookingId}::uuid and kind='changed'`
      )[0].count,
      "0",
    );
    await coach.page.screenshot({
      path: path.join(output, "availability-save-retains-booking-375.png"),
      fullPage: true,
    });
    pass(
      "Save availability warns that the existing10:00 session stays scheduled; saving11:00–13:00 hours preserves that booking and sends no reschedule email",
    );
    await coach.page.goto(base + "/coach/sessions/" + bookingId);
    await expect(
      coach.page.getByRole("heading", {
        name: "Change this booking",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      coach.page.getByLabel("Session type", { exact: true }),
    ).toHaveValue(type.id);
    await coach.page
      .getByLabel("Start · Berlin time", { exact: true })
      .fill(day.date + "T11:00");
    const reviewButton = coach.page.getByRole("button", {
      name: "Review change",
      exact: true,
    });
    await reviewButton.evaluate((el) => el.scrollIntoView({ block: "end" }));
    await reviewButton.click();
    const review = coach.page.getByRole("region", {
      name: "Review booking change",
      exact: true,
    });
    // Check before focusing/clicking Save: Playwright's automatic scrolling can
    // otherwise hide a confirmation appended below the phone viewport.
    await expect(review).toBeFocused();
    await expect(
      coach.page.getByRole("heading", {
        name: "Confirm schedule change",
        exact: true,
      }),
    ).toBeInViewport();
    const save = coach.page.getByRole("button", {
      name: "Save booking change",
      exact: true,
    });
    await expect(save).toBeInViewport();
    assert.equal(
      await save.evaluate((el) => {
        const r = el.getBoundingClientRect(),
          hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
        return !!hit && el.contains(hit);
      }),
      true,
      "Mobile navigation must not cover the Save target",
    );
    await coach.page.keyboard.press("Tab");
    await expect(save).toBeFocused();
    for (const width of [1440, 375, 320]) {
      await coach.page.setViewportSize({ width, height: 1000 });
      await save.focus();
      await expect(save).toBeFocused();
      assert.equal(
        await coach.page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await coach.page.screenshot({
        path: path.join(output, `rescheduling-review-${width}.png`),
        fullPage: true,
      });
    }
    await coach.page.setViewportSize({ width: 1440, height: 1000 });
    const command = {
      commandId: randomUUID(),
      action: "override",
      bookingId,
      expectedRevision: 99,
      typeId: type.id,
      typeRevision: type.revision,
      locationId: venue.id,
      startsAt: new Date(times.target).toISOString(),
      durationMinutes: 60,
    };
    assert.equal((await api(coach, "?coach=true", command)).status, 409);
    assert.equal(
      (await api(athlete, "?coach=true", { ...command, expectedRevision: 0 }))
        .status,
      403,
    );
    assert.equal(
      (
        await api(coach, "?coach=true", {
          ...command,
          expectedRevision: 0,
          startsAt: new Date(
            Date.parse(times.target) + 3 * 3600000,
          ).toISOString(),
        })
      ).status,
      409,
    );
    assert.equal(
      (await api(coach, "?bookingId=" + bookingId)).data.detail.revision,
      0,
    );
    assert.equal(
      (
        await database`select count(*) from app.booking_notification_events where source_id=${bookingId}::uuid and kind='changed'`
      )[0].count,
      "0",
    );
    pass(
      "desktop/375/320 keyboard review fits; stale revisions, athlete overrides and out-of-hours changes save nothing and queue no change emails",
    );
    await coach.page.setViewportSize({ width: 375, height: 800 });
    await coach.page.route("**/api/session-bookings?coach=true", (route) =>
      route.fulfill({ status: 409, json: { status: "conflict" } }),
    );
    await save.click();
    const feedback = coach.page.locator(".session-booking-feedback");
    await expect(feedback).toContainText(
      "Reload and review the current details.",
    );
    await expect(feedback).toBeFocused();
    await expect(feedback).toBeInViewport();
    await coach.page.unroute("**/api/session-bookings?coach=true");
    await reviewButton.click();
    const releaseSave = Promise.withResolvers(),
      lateSaveDone = Promise.withResolvers();
    const releaseRead = Promise.withResolvers(),
      lateReadDone = Promise.withResolvers();
    const attempts = [];
    await coach.page.route(
      "**/api/session-bookings?coach=true",
      async (route) => {
        attempts.push(route.request().postDataJSON());
        if (attempts.length === 1) {
          const r = await route.fetch();
          assert.equal(r.status(), 200, JSON.stringify(await r.json()));
          await releaseSave.promise;
          try {
            await route.fulfill({ response: r });
          } catch {
          } finally {
            lateSaveDone.resolve();
          }
        } else await route.continue();
      },
    );
    const detailRoute = "**/api/session-bookings?bookingId=" + bookingId;
    await coach.page.route(detailRoute, async (route) => {
      const r = await route.fetch();
      assert.equal(r.status(), 200);
      await releaseRead.promise;
      try {
        await route.fulfill({ response: r });
      } catch {
      } finally {
        lateReadDone.resolve();
      }
    });
    await save.click();
    await expect(feedback).toContainText("Saving booking change…");
    await expect(feedback).toBeFocused();
    await expect(feedback).toBeInViewport();
    await expect(
      coach.page
        .getByRole("status")
        .filter({ hasText: "We couldn’t verify the save." }),
    ).toBeVisible();
    await expect(
      coach.page.getByLabel("Start · Berlin time", { exact: true }),
    ).toBeDisabled();
    const retry = coach.page.getByRole("button", {
      name: "Retry same change",
      exact: true,
    });
    await expect(retry).toBeInViewport();
    for (const width of [1440, 375, 320]) {
      await coach.page.setViewportSize({ width, height: 800 });
      await feedback.focus();
      await expect(retry).toBeInViewport();
      assert.equal(
        await retry.evaluate((el) => {
          const r = el.getBoundingClientRect(),
            hit = document.elementFromPoint(
              r.x + r.width / 2,
              r.y + r.height / 2,
            );
          return !!hit && el.contains(hit);
        }),
        true,
        "Recovery controls must receive a tap above fixed navigation",
      );
      assert.equal(
        await coach.page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await coach.page.setViewportSize({ width: 375, height: 800 });
    await expect(
      coach.page.getByText("These details may be outdated.", { exact: true }),
    ).toBeVisible();
    await coach.page.screenshot({
      path: path.join(output, "booking-save-timeout-375.png"),
    });
    releaseSave.resolve();
    await lateSaveDone.promise;
    await expect(feedback).toContainText("We couldn’t verify the save.");
    await retry.focus();
    await coach.page.keyboard.press("Enter");
    await expect(feedback).toContainText(
      "Session saved. Checking the latest details…",
    );
    await expect(feedback).toBeFocused();
    await expect(feedback).toBeInViewport();
    await expect(
      coach.page.getByRole("status").filter({ hasText: "Session saved." }),
    ).toBeVisible();
    await expect(feedback).toContainText(
      "Session saved. Reload to view its latest details.",
    );
    await expect(feedback).toBeFocused();
    await expect(feedback).toBeInViewport();
    await expect(retry).toHaveCount(0);
    await expect(
      coach.page.getByText("These details may be outdated.", { exact: true }),
    ).toBeVisible();
    await expect(
      coach.page.getByRole("link", {
        name: "Reload current details",
        exact: true,
      }),
    ).toHaveAttribute("href", "/coach/sessions/" + bookingId);
    await coach.page.screenshot({
      path: path.join(output, "booking-saved-refresh-timeout-375.png"),
    });
    releaseRead.resolve();
    await lateReadDone.promise;
    await expect(feedback).toContainText(
      "Session saved. Reload to view its latest details.",
    );
    await coach.page.unroute(detailRoute);
    await coach.page
      .getByRole("link", { name: "Reload current details", exact: true })
      .click();
    await expect(
      coach.page.getByRole("heading", {
        name: "Change this booking",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      coach.page.getByText("These details may be outdated.", { exact: true }),
    ).toHaveCount(0);
    assert.equal(attempts.length, 2);
    assert.deepEqual(attempts[0], attempts[1]);
    await coach.page.unroute("**/api/session-bookings?coach=true");
    assert.equal(
      (
        await api(coach, "?coach=true", {
          ...attempts[0],
          startsAt: new Date(Date.parse(times.target) + 3600000).toISOString(),
        })
      ).status,
      409,
    );
    for (const actor of [coach, athlete]) {
      const r = await api(actor, "?bookingId=" + bookingId);
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(
        Date.parse(r.data.detail.startsAt),
        Date.parse(times.target),
      );
      assert.equal(r.data.detail.revision, 1);
      assert.equal(r.data.detail.historyTotal, 1);
      await actor.page.goto(
        base +
          (actor === coach ? "/coach/sessions/" : "/sessions/") +
          bookingId,
      );
      await expect(
        actor.page.getByText("Preserve original training preparation", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        actor.page.getByRole("heading", {
          name: "Private session",
          exact: true,
        }),
      ).toBeVisible();
    }
    const [preserved] =
      await database`select b.id,b.client_profile_id,b.coach_profile_id,b.created_at,
      (select to_jsonb(r) from app.coach_booking_requests r where r.accepted_booking_id=b.id) request,
      (select to_jsonb(p) from app.session_note_plans p where p.booking_id=b.id) plan
      from app.coach_private_bookings b where b.id=${bookingId}::uuid`;
    assert.deepEqual(preserved, original);
    const receipts =
      await database`select r.id,r.recipient_profile_id from app.booking_notification_receipts r join app.booking_notification_events e on e.id=r.event_id where e.source_id=${bookingId}::uuid and e.kind='changed'`;
    assert.equal(receipts.length, 2);
    await drain();
    for (const receipt of receipts) {
      const [row] =
        await database`select provider_id,state from app.booking_notification_receipts where id=${receipt.id}::uuid`;
      assert.equal(row.state, "accepted");
      const captured = await (
        await fetch(mail + "/api/v1/message/" + row.provider_id)
      ).json();
      assert.match(captured.Text, /Booking details changed/);
      assert.match(captured.Text, /11:00/);
      assert.match(captured.Text, /Berlin/);
      assert.ok(captured.Text.includes(venue.name));
      assert.ok(captured.Text.includes(bookingId));
      assert.ok(
        !captured.Text.includes("Preserve original training preparation"),
      );
      assert.equal(captured.From.Address, "notification@movx.club");
      assert.equal(captured.To.length, 1);
      assert.equal(
        captured.To[0].Address,
        receipt.recipient_profile_id === athlete.profileId
          ? athlete.email
          : coach.email,
      );
    }
    pass(
      "Save progress/errors stay visible; stalled committed POST and refresh recover after real15s deadlines, late replies stay fenced, exact retry creates one revision/email each and original request/booking/plan survive",
    );
    await coach.page
      .getByLabel("Start · Berlin time", { exact: true })
      .fill(day.date + "T12:00");
    await reviewButton.click();
    await save.click();
    await expect(feedback).toContainText("Session saved.");
    await expect(feedback).not.toContainText("Checking");
    await expect(feedback).not.toContainText("Reload to view");
    await expect(feedback).toBeFocused();
    await expect(feedback).toBeInViewport();
    await expect(
      coach.page.getByText("These details may be outdated.", { exact: true }),
    ).toHaveCount(0);
    for (const actor of [coach, athlete]) {
      const r = await api(actor, "?bookingId=" + bookingId);
      assert.equal(r.data.detail.revision, 2);
      assert.equal(r.data.detail.historyTotal, 2);
      assert.equal(
        Date.parse(r.data.detail.startsAt),
        Date.parse(times.target) + 3600000,
      );
    }
    const allReceipts =
      await database`select r.id,r.provider_id,r.recipient_profile_id from app.booking_notification_receipts r join app.booking_notification_events e on e.id=r.event_id where e.source_id=${bookingId}::uuid and e.kind='changed'`;
    assert.equal(allReceipts.length, 4);
    await drain();
    for (const receipt of allReceipts.filter(
      (r) => !receipts.some((p) => p.id === r.id),
    )) {
      const [r] =
        await database`select state,provider_id from app.booking_notification_receipts where id=${receipt.id}::uuid`;
      assert.equal(r.state, "accepted");
      const captured = await (
        await fetch(mail + "/api/v1/message/" + r.provider_id)
      ).json();
      assert.match(captured.Text, /12:00/);
      assert.equal(
        captured.To[0].Address,
        receipt.recipient_profile_id === athlete.profileId
          ? athlete.email
          : coach.email,
      );
    }
    pass(
      "ordinary Save immediately refreshes the same booking to12:00 with visible success, clears stale details and sends one receipt each for the second distinct revision",
    );
    await coach.page
      .getByRole("link", { name: "← Bookings", exact: true })
      .click();
    await expect(
      coach.page.locator("#coach-booking-" + bookingId),
    ).toContainText("12:00");
    await coach.page.goto(
      base +
        "/coach?view=schedule&section=calendar&calendarView=day&date=" +
        day.date,
    );
    const coachEvent = coach.page
      .getByRole("button", { name: /^Private session:.*12:00/ })
      .first();
    await expect(coachEvent).toBeVisible();
    await coachEvent.click();
    await expect(
      coach.page.getByRole("link", {
        name: "View original booking",
        exact: true,
      }),
    ).toHaveAttribute("href", "/coach/sessions/" + bookingId);
    await coach.page.screenshot({
      path: path.join(output, "coach-rescheduled-calendar-375.png"),
    });
    await athlete.page.goto(
      base +
        "/sessions/calendar?date=" +
        day.date +
        "&view=week&timezone=Europe%2FBerlin",
    );
    const athleteEvent = athlete.page.locator(".training-agenda-item").filter({
      has: athlete.page.getByRole("link", {
        name: "View booking details",
        exact: true,
      }),
    });
    await expect(athleteEvent).toContainText("12:00");
    await expect(
      athleteEvent.getByRole("link", {
        name: "View booking details",
        exact: true,
      }),
    ).toHaveAttribute("href", "/sessions/" + bookingId);
    await athlete.page.screenshot({
      path: path.join(output, "athlete-rescheduled-calendar-375.png"),
      fullPage: true,
    });
    pass(
      "client-side return to Bookings and both real calendar views show the new time and link the original booking",
    );
  } catch (error) {
    await coach.page
      .screenshot({
        path: path.join(output, "failure-rescheduling.png"),
        fullPage: true,
      })
      .catch(() => {});
    throw error;
  } finally {
    await coach.context.close();
    await athlete.context.close();
  }
}
