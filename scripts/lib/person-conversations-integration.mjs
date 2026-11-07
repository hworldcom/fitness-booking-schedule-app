import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });

export async function rehearsePersonConversations({
  base,
  person,
  stranger,
  database,
  cron,
  pass,
  output,
}) {
  assert.equal(base, "http://localhost:3169");
  const a = await person("Mov177Alpha"),
    b = await person("Mov177Beta");
  const A = a.page,
    B = b.page;
  const api = async (actor, action, args, version = 3) => {
    const r = await actor.context.request.post(base + "/api/messages", {
      headers: { origin: base, "X-MovX-Message-Version": String(version) },
      data: { action, args },
    });
    return { status: r.status(), data: await r.json() };
  };
  const ready = async (actor, action, args, version = 3) => {
    const r = await api(actor, action, args, version);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data.value;
  };
  const source = async (actor, sql, params = []) =>
    database.begin(async (tx) => {
      await tx`set local role app_runtime`;
      await tx`select set_config('app.current_auth_user_id',${actor.authId},true),set_config('app.current_profile_id',${actor.profileId},true),set_config('app.current_run_id',${actor.runId},true),set_config('app.current_run_role','member',true)`;
      return tx.unsafe(sql, params);
    });
  const drainFixtureMail = async () => {
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
    throw Error("Fixture notification queue did not drain");
  };
  const refresh = async (page) => {
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  };
  const composer = (page, name) =>
    page.getByLabel("Message to " + name, { exact: true });
  const send = async (page, name, body) => {
    await page.bringToFront();
    await composer(page, name).fill(body);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(body, { exact: true })).toBeVisible();
    await expect(composer(page, name)).toHaveValue("");
  };
  try {
    for (const actor of [a, b]) {
      await source(actor, "select app.submit_owned_coach_application()");
      await source(
        actor,
        'select app.save_owned_coach_application_contact(0,\'{"phoneNumber":"+4915123456789","instagramUrl":null,"facebookUrl":null,"linkedinUrl":null}\'::jsonb)',
      );
      await source(
        actor,
        "select app.upsert_owned_coach_profile($1::text,'Focused private practice with clear preparation for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)",
        [actor.name],
      );
      await database`select app.review_coach_application(${actor.profileId}::uuid,'pending','approved','Isolated MOV-177 profile reviewed','fixture-operator','movx-identity-application-v1')`;
      await database`update app.coach_profiles set visibility='visible' where profile_id=${actor.profileId}::uuid`;
    }
    await drainFixtureMail();
    const forward = await ready(
      b,
      "inquire",
      {
        coachId: a.profileId,
        body: "Original forward person history",
        submissionId: randomUUID(),
      },
      2,
    );
    const reverse = await ready(
      a,
      "inquire",
      {
        coachId: b.profileId,
        body: "Original reverse person history",
        submissionId: randomUUID(),
      },
      2,
    );
    assert.notEqual(forward.conversationId, reverse.conversationId);
    await A.goto(base + "/messages?conversation=" + reverse.conversationId);
    await expect(A).toHaveURL(
      base + "/messages?conversation=" + forward.conversationId,
    );
    for (const text of [
      "Original forward person history",
      "Original reverse person history",
    ])
      await expect(A.getByText(text, { exact: true })).toBeVisible();
    await expect(
      A.getByRole("button", { name: new RegExp(b.name) }),
    ).toHaveCount(1);
    await expect(
      A.locator(".mailbox-thread-header").getByText("Private conversation", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      A.getByLabel("Attach to a session (optional)", { exact: true }),
    ).toHaveCount(0);
    await expect(A.getByLabel("Show messages", { exact: true })).toHaveCount(0);
    await A.goto(base + "/messages?coach=" + b.profileId);
    await expect(A).toHaveURL(
      base + "/messages?conversation=" + forward.conversationId,
    );
    await expect(
      A.getByText("Original reverse person history", { exact: true }),
    ).toBeVisible();
    await send(
      A,
      b.name,
      "A normal message without selecting a session <script>literal</script>",
    );
    await B.goto(base + "/messages?conversation=" + reverse.conversationId);
    await expect(B).toHaveURL(
      base + "/messages?conversation=" + forward.conversationId,
    );
    await expect(
      B.getByText(
        "A normal message without selecting a session <script>literal</script>",
        { exact: true },
      ),
    ).toBeVisible();
    await send(B, a.name, "One conversation in either teaching role");
    pass(
      "actual reverse teaching histories resolve old links into one person row; normal literal-text sends and replies need no session selector",
    );

    await refresh(A);
    const uncertain = "An exact person-message retry";
    let lost = false,
      submission;
    await A.route("**/api/messages", async (route) => {
      const req = route.request();
      const data = req.method() === "POST" ? req.postDataJSON() : null;
      if (!lost && data?.action === "send" && data.args.body === uncertain) {
        lost = true;
        submission = data.args.submissionId;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await route.abort("failed");
      } else await route.continue();
    });
    await composer(A, b.name).fill(uncertain);
    await A.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      A.getByRole("button", { name: "Retry same message", exact: true }),
    ).toBeVisible();
    await expect(composer(A, b.name)).toHaveValue(uncertain);
    await A.getByRole("button", {
      name: "Retry same message",
      exact: true,
    }).click();
    await expect(A.getByText(uncertain, { exact: true })).toHaveCount(1);
    await A.unroute("**/api/messages");
    assert.equal(
      (
        await database`select count(*) from app.message_entries where submission_id=${submission}::uuid`
      )[0].count,
      "1",
    );
    await composer(A, b.name).fill("Draft survives an unavailable read");
    let failed = false;
    await A.route("**/api/messages?*", async (route) => {
      if (!failed && route.request().url().includes("conversationId=")) {
        failed = true;
        await route.fulfill({ status: 503, json: { status: "unavailable" } });
      } else await route.continue();
    });
    await refresh(A);
    await expect(A.locator(".mailbox-error[role=alert]")).toContainText(
      "Messages are unavailable",
    );
    await expect(composer(A, b.name)).toHaveValue(
      "Draft survives an unavailable read",
    );
    await A.unroute("**/api/messages?*");
    await A.getByRole("button", {
      name: "Refresh conversation",
      exact: true,
    }).click();
    await expect(composer(A, b.name)).toHaveValue(
      "Draft survives an unavailable read",
    );
    pass(
      "lost committed person-message responses recover one exact send; unavailable reads keep the visible history and draft",
    );

    const bookings = [];
    for (const [coach, client, days, title] of [
      [a, b, 4, "Alpha coaching session"],
      [b, a, 5, "Beta coaching session"],
    ]) {
      const [slot] = await source(
        coach,
        `select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '${days} days 10 hours') at time zone 'Europe/Berlin',60) id`,
      );
      const [request] = await source(
        client,
        "select * from app.create_coach_booking_request($1::uuid)",
        [slot.id],
      );
      const [accepted] = await source(
        coach,
        "select * from app.accept_coach_booking_request($1::uuid)",
        [request.request_id],
      );
      const booking = accepted.booking_id ?? accepted.accepted_booking_id;
      assert.ok(booking);
      bookings.push(booking);
      await ready(coach, "session-title", {
        bookingId: booking,
        title,
        expectedRevision: 0,
      });
    }
    await refresh(A);
    const betaCard = A.getByRole("article")
      .filter({ hasText: "Beta coaching session" })
      .filter({ has: A.getByRole("button", { name: "Details", exact: true }) })
      .first();
    await betaCard
      .getByRole("button", { name: "Details", exact: true })
      .click();
    await expect(
      A.getByRole("link", { name: "View session in My training", exact: true }),
    ).toHaveAttribute("href", "/sessions/" + bookings[1]);
    await expect(composer(A, b.name)).toHaveValue(
      "Draft survives an unavailable read",
    );
    await A.keyboard.press("Escape");
    await expect(
      betaCard.getByRole("button", { name: "Details", exact: true }),
    ).toBeFocused();
    const alphaCard = A.getByRole("article")
      .filter({ hasText: "Alpha coaching session" })
      .filter({ has: A.getByRole("button", { name: "Details", exact: true }) })
      .first();
    await alphaCard
      .getByRole("button", { name: "Details", exact: true })
      .click();
    await expect(
      A.getByRole("link", {
        name: "View session in Coach workspace",
        exact: true,
      }),
    ).toHaveAttribute("href", "/coach/sessions/" + bookings[0]);
    await A.keyboard.press("Escape");
    await expect(
      A.getByRole("button", {
        name: "Show messages for this session",
        exact: true,
      }),
    ).toHaveCount(0);
    await composer(A, b.name).fill("");
    for (const width of [1440, 375, 320]) {
      await A.setViewportSize({ width, height: 900 });
      await composer(A, b.name).focus();
      await expect(composer(A, b.name)).toBeFocused();
      assert.equal(
        await A.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const rect = await composer(A, b.name).boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1);
      await A.screenshot({
        path: path.join(output, `person-conversation-${width}.png`),
        fullPage: true,
      });
    }
    await A.setViewportSize({ width: 1440, height: 1000 });
    pass(
      "original booking cards keep the correct coach/athlete detail destinations; keyboard Details/Escape preserves drafts and person chat fits desktop/375/320",
    );

    await A.getByRole("button", { name: "Block", exact: true }).click();
    await A.getByRole("button", { name: "Confirm block", exact: true }).click();
    await expect(composer(A, b.name)).toBeDisabled();
    await refresh(B);
    await expect(composer(B, a.name)).toBeDisabled();
    const thread = await ready(b, "thread", {
      conversationId: reverse.conversationId,
    });
    const ctx = thread.contexts.find((c) => c.bookingId === bookings[0]);
    assert.ok(ctx);
    for (const version of [1, 2, 3]) {
      const r = await api(
        b,
        "send",
        {
          conversationId: forward.conversationId,
          contextId: version === 3 ? null : ctx.id,
          body: "No block bypass " + version,
          submissionId: randomUUID(),
        },
        version,
      );
      assert.equal(r.status, 409);
    }
    await A.getByRole("button", { name: "Unblock", exact: true }).click();
    await send(A, b.name, "Normal chat resumes after unblock");
    const outsider = await api(stranger, "thread", {
      conversationId: reverse.conversationId,
    });
    assert.equal(outsider.status, 409);
    assert.equal(outsider.data.value, undefined);
    await refresh(B);
    await expect(composer(B, a.name)).toBeEditable();
    await composer(B, a.name).fill("Revoked account draft");
    await database`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where run_id=${b.runId}::uuid and profile_id=${b.profileId}::uuid`;
    await refresh(B);
    await expect(composer(B, a.name)).toHaveCount(0);
    assert.equal(
      (await B.locator("body").innerText()).includes("Revoked account draft"),
      false,
    );
    await database`update app.demo_run_participants set status='active',revoked_at=null where run_id=${b.runId}::uuid and profile_id=${b.profileId}::uuid`;
    pass(
      "actual blocking pauses both composers and rejects old attached sends; unblock resumes ordinary chat, nonparticipants are denied and revocation clears private drafts",
    );
    // Close both original unread periods through the new combined read contract so
    // this independent journey cannot leak a due email into the following regression.
    for (const actor of [a, b]) {
      const t = await ready(actor, "thread", {
        conversationId: forward.conversationId,
        after: 0,
      });
      await ready(actor, "read", {
        conversationId: forward.conversationId,
        through: t.lastSeq,
      });
    }
    assert.equal(
      (
        await database`select count(*) from app.notification_emails j join app.message_conversations c on c.id=j.conversation_id where c.run_id=${a.runId}::uuid and least(c.coach_profile_id,c.athlete_profile_id)=least(${a.profileId}::uuid,${b.profileId}::uuid) and greatest(c.coach_profile_id,c.athlete_profile_id)=greatest(${a.profileId}::uuid,${b.profileId}::uuid) and j.closed_at is null`
      )[0].count,
      "0",
    );
    await drainFixtureMail();
    pass(
      "combined reads close both original message email periods; owned booking/staff receipts drain before the independent notification regression",
    );
  } catch (error) {
    await A.screenshot({
      path: path.join(output, "failure-person-conversation.png"),
      fullPage: true,
    }).catch(() => {});
    throw error;
  } finally {
    await a.context.close();
    await b.context.close();
  }
}
