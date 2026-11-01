// MOV-12: actual production UI/Auth/SQL and loopback delivery in the owned stack.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });
export async function rehearseExternalClients({
  base,
  database,
  person,
  coach,
  stranger,
  browser,
  mail,
  output,
  pass,
  secrets,
}) {
  assert.equal(base, "http://localhost:3169");
  const athlete = await person("QA External Recipient"),
    page = coach.page;
  async function raw(a, query, args = []) {
    return database.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      await tx`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.profileId},true),set_config('app.current_run_id',${a.runId},true),set_config('app.current_run_role','member',true)`;
      return tx.unsafe(query, args);
    });
  }
  const [venue] =
    await database`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
  const [day] =
    await database`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text date`;
  await raw(
    coach,
    "select app.save_owned_effective_coach_availability($1::jsonb)",
    [
      {
        kind: "dates",
        operationId: randomUUID(),
        expectedRevision: 0,
        dates: [
          {
            date: day.date,
            mode: "custom",
            hours: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"].map(
              (localStartTime) => ({
                localStartTime,
                locationId: venue.id,
                locationUpdatedAt: venue.stamp,
              }),
            ),
          },
        ],
      },
    ],
  );
  await page.goto(base + "/coach/athletes");
  await page
    .getByRole("link", {
      name: "External clients · sessions & notes",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "External clients", exact: true }),
  ).toBeVisible();
  const form = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Add an external client",
      exact: true,
    }),
  });
  await form.getByLabel("Name", { exact: true }).fill("Jamie External");
  const attempts = [];
  await page.route("**/api/coach/external-clients", async (route) => {
    if (route.request().method() === "POST") {
      const v = route.request().postDataJSON();
      if (v.action === "create") {
        attempts.push(v);
        if (attempts.length === 1) {
          assert.equal((await route.fetch()).status(), 200);
          await route.abort("failed");
          return;
        }
      }
    }
    await route.continue();
  });
  await form.getByRole("button", { name: "Save client", exact: true }).click();
  await expect(
    form.getByRole("button", { name: "Retry exact save", exact: true }),
  ).toBeVisible();
  await expect(form.getByLabel("Name", { exact: true })).toBeDisabled();
  await form
    .getByRole("button", { name: "Retry exact save", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Jamie External", exact: true }),
  ).toBeVisible();
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0], attempts[1]);
  await page.unroute("**/api/coach/external-clients");
  await page.getByRole("link", { name: "Jamie External", exact: true }).click();
  await expect(page).toHaveURL(/\/coach\/athletes\/external\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("heading", { name: "Jamie External", exact: true }),
  ).toBeVisible();
  const clientId = new URL(page.url()).pathname.split("/").at(-1);
  const [client] =
    await database`select * from app.coach_external_clients where id=${clientId}::uuid`;
  assert.equal(client.email, null);
  assert.equal(client.linked_profile_id, null);
  await page
    .getByRole("link", { name: "Schedule a session", exact: true })
    .click();
  await expect(page.getByLabel("Client type", { exact: true })).toHaveValue(
    "external",
  );
  await expect(page.getByLabel("External client", { exact: true })).toHaveValue(
    clientId,
  );
  const [type] =
    await database`select id from app.coach_session_types where coach_profile_id=${coach.profileId}::uuid and format='private' limit 1`;
  await page.getByLabel("Session type", { exact: true }).selectOption(type.id);
  await page.getByLabel("Venue", { exact: true }).selectOption(venue.id);
  await page
    .getByLabel("Start · Berlin time", { exact: true })
    .fill(day.date + "T09:00");
  await page
    .getByRole("button", { name: "Add a new external client", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Inline external client");
  let inlineLost = false;
  await page.route("**/api/coach/external-clients", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().action === "create" &&
      !inlineLost
    ) {
      inlineLost = true;
      assert.equal((await route.fetch()).status(), 200);
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Save client", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry exact save", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review session", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Client type", { exact: true })).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry exact save", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "Inline external client", exact: true }),
  ).toBeAttached();
  await page.unroute("**/api/coach/external-clients");
  await page
    .getByLabel("External client", { exact: true })
    .selectOption(clientId);
  await page
    .getByRole("button", { name: "Review session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm session", exact: true })
    .click();
  await expect(page).toHaveURL(/\/coach\/sessions\/[a-f0-9-]+$/);
  const bookingId = new URL(page.url()).pathname.split("/").at(-1);
  const [booking] =
    await database`select * from app.coach_private_bookings where id=${bookingId}::uuid`;
  assert.equal(booking.external_client_id, clientId);
  assert.equal(booking.client_profile_id, null);
  pass(
    "real external-client creation and exact lost-response retry; confirmed booking uses original calendar authority",
  );
  const notes = page.getByRole("region", { name: "Session notes and videos" });
  await notes.getByRole("button", { name: "Add a plan", exact: true }).click();
  await page
    .getByLabel("Training plan", { exact: true })
    .fill("Original external-client plan");
  await page
    .getByRole("button", { name: "Add video link", exact: true })
    .click();
  await page
    .getByLabel("Video title", { exact: true })
    .fill("Practice reference");
  await page
    .getByLabel("YouTube or Instagram URL", { exact: true })
    .fill("https://youtu.be/M7lc1UVf-VE");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(
    notes.getByText("Original external-client plan", { exact: true }),
  ).toBeVisible();
  await notes.getByRole("button", { name: "Add a note", exact: true }).click();
  await page
    .getByLabel("Your note", { exact: true })
    .fill("Shared before joining");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    notes.getByText("Shared before joining", { exact: true }),
  ).toBeVisible();
  await notes
    .getByRole("button", { name: "My private notes", exact: true })
    .click();
  await notes.getByRole("button", { name: "Add a note", exact: true }).click();
  await page
    .getByLabel("Your note", { exact: true })
    .fill("Coach secret before joining");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    notes.getByText("Coach secret before joining", { exact: true }),
  ).toBeVisible();
  await stranger.page.goto(base + `/coach/athletes/external/${clientId}`);
  await expect(
    stranger.page.getByText(
      "Client records could not be verified. Reload to try again.",
    ),
  ).toBeVisible();
  assert.ok(
    !(await stranger.page.locator("body").innerText()).includes(
      "Jamie External",
    ),
  );
  const denied = await athlete.page.request.get(
    base + `/api/session-bookings?bookingId=${bookingId}`,
  );
  assert.equal(denied.status(), 403);
  await page.goto(base + `/coach/athletes/external/${clientId}`);
  await page
    .getByLabel("Email · optional", { exact: true })
    .fill(athlete.email);
  let lostClientEdit = false;
  await page.route("**/api/coach/external-clients", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().action === "update" &&
      !lostClientEdit
    ) {
      lostClientEdit = true;
      assert.equal((await route.fetch()).status(), 200);
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Save client details", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry exact save", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review invitation", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry exact save", exact: true })
    .click();
  await page.unroute("**/api/coach/external-clients");
  await expect(
    page.getByLabel("Email · optional", { exact: true }),
  ).toHaveValue(athlete.email);
  await expect(
    page.getByRole("button", { name: "Review invitation", exact: true }),
  ).toBeEnabled();
  const [latestContact] =
    await database`select revision,name,email from app.coach_external_clients where id=${clientId}::uuid`;
  const concurrentEdit = await page.request.post(
    base + "/api/coach/external-clients",
    {
      headers: { origin: base },
      data: {
        action: "update",
        operationId: randomUUID(),
        id: clientId,
        revision: latestContact.revision,
        name: latestContact.name,
        email: latestContact.email,
      },
    },
  );
  assert.equal(concurrentEdit.status(), 200);
  await page
    .getByLabel("Name", { exact: true })
    .fill("My retained stale draft");
  await page
    .getByRole("button", { name: "Save client details", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", {
      name: "Current saved client",
      exact: true,
    }),
  ).toContainText("Current saved client: Jamie External");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "My retained stale draft",
  );
  await expect(
    page.getByRole("button", { name: "Review invitation", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("link", { name: "Reload current client details", exact: true })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Jamie External",
  );
  await page
    .getByRole("button", { name: "Review invitation", exact: true })
    .click();
  const invitationReview = page.getByRole("region", {
    name: "Review invitation",
    exact: true,
  });
  await expect(invitationReview).toContainText(athlete.email);
  await invitationReview
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(
    page.getByText(/Email: accepted by email provider/),
  ).toBeVisible();
  const [sent] =
    await database`select i.id,e.status,e.provider_id,e.token from app.coach_client_invitations i join app.coach_invitation_emails e on e.id=i.id where i.external_client_id=${clientId}::uuid order by i.created_at desc limit 1`;
  assert.equal(sent.status, "accepted");
  assert.equal(sent.token, null);
  const message = await (
    await fetch(mail + "/api/v1/message/" + sent.provider_id)
  ).json();
  assert.equal(message.To.length, 1);
  assert.equal(message.To[0].Address, athlete.email);
  assert.ok(
    !message.Text.includes("Jamie External") &&
      !message.Text.includes("Shared before joining") &&
      !message.Text.includes("Coach secret"),
  );
  const link = message.Text.match(
    /http:\/\/localhost:3169\/invitations#[A-Za-z0-9_-]{43}/,
  )?.[0];
  assert.ok(link, "Invitation link missing");
  secrets.push(new URL(link).hash.slice(1));
  const guest = await browser.newContext({
      viewport: { width: 375, height: 900 },
    }),
    guestPage = await guest.newPage();
  await guestPage.goto(link);
  await expect(guestPage).toHaveURL(base + "/invitations");
  await expect(
    guestPage.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    guestPage.getByRole("link", { name: "Create an account", exact: true }),
  ).toHaveAttribute("href", "/register?returnTo=%2Finvitations");
  assert.ok(
    !(await guestPage.locator("body").innerText()).includes(athlete.email),
  );
  assert.ok(
    !(await guestPage.locator("body").innerText()).includes("Jamie External"),
  );
  await guestPage.screenshot({
    path: path.join(output, "external-invitation-guest-375.png"),
    fullPage: true,
  });
  await guest.close();
  await stranger.page.goto(link);
  await expect(stranger.page).toHaveURL(base + "/invitations");
  await stranger.page
    .getByRole("button", { name: "Accept invitation", exact: true })
    .click();
  await expect(
    stranger.page
      .getByRole("status")
      .filter({ hasText: "requires the verified email" }),
  ).toBeVisible();
  assert.equal(
    (
      await database`select client_profile_id from app.coach_private_bookings where id=${bookingId}::uuid`
    )[0].client_profile_id,
    null,
  );
  pass(
    "targeted invitation captured once in Mailpit; guest/wrong-account review is minimal and opening/sign-in never claims sessions",
  );
  await athlete.page.goto(link);
  await expect(athlete.page).toHaveURL(base + "/invitations");
  const otherTab = await athlete.context.newPage();
  await otherTab.goto(base + "/invitations#" + "X".repeat(43));
  await expect(otherTab).toHaveURL(base + "/invitations");
  const staleResponse = athlete.page.waitForResponse(
    (r) =>
      r.url() === base + "/api/invitations" && r.request().method() === "POST",
  );
  await athlete.page
    .getByRole("button", { name: "Accept invitation", exact: true })
    .click();
  assert.equal((await staleResponse).status(), 409);
  assert.equal(
    (
      await database`select client_profile_id from app.coach_private_bookings where id=${bookingId}::uuid`
    )[0].client_profile_id,
    null,
  );
  await otherTab.close();
  await athlete.page.goto(link);
  await expect(athlete.page).toHaveURL(base + "/invitations");
  await athlete.page
    .getByRole("button", { name: "Accept invitation", exact: true })
    .click();
  await expect(
    athlete.page.getByRole("heading", {
      name: "Invitation accepted",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(
    (
      await database`select client_profile_id from app.coach_private_bookings where id=${bookingId}::uuid`
    )[0].client_profile_id,
    athlete.profileId,
  );
  await athlete.page.goto(base + `/sessions/${bookingId}`);
  const athleteNotes = athlete.page.getByRole("region", {
    name: "Session notes and videos",
  });
  await expect(
    athleteNotes.getByText("Original external-client plan", { exact: true }),
  ).toBeVisible();
  await expect(
    athleteNotes.getByText("Shared before joining", { exact: true }),
  ).toBeVisible();
  await expect(
    athleteNotes.getByRole("link", { name: /Practice reference/ }),
  ).toBeVisible();
  assert.ok(
    !(await athlete.page.locator("body").innerText()).includes(
      "Coach secret before joining",
    ),
  );
  await expect(
    athleteNotes.getByRole("button", { name: "My private notes", exact: true }),
  ).toHaveCount(0);
  for (const width of [1440, 430, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + `/coach/athletes/external/${clientId}`);
    await expect(
      page.getByRole("heading", { name: "Jamie External", exact: true }),
    ).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `External detail overflow ${width}`,
    );
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() => document.activeElement !== document.body),
    );
    await page.screenshot({
      path: path.join(output, `external-client-${width}.png`),
      fullPage: true,
    });
    await athlete.page.setViewportSize({ width, height: 1000 });
    await athlete.page.reload();
    await expect(
      athleteNotes.getByText("Shared before joining", { exact: true }),
    ).toBeVisible();
    assert.ok(
      await athlete.page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Linked session overflow ${width}`,
    );
  }
  const stillOwned = await page.request.get(
    base + `/api/coach/external-clients?id=${clientId}`,
  );
  assert.equal(stillOwned.status(), 200);
  assert.equal((await stillOwned.json()).detail.sessions[0].id, bookingId);
  pass(
    "explicit verified acceptance preserves original session/plan/video/shared notes and excludes private notes; desktop/mobile/keyboard checks at 1440/430/375/320",
  );
  const freshEmail = `external-new-${randomUUID()}@users.movx.test`,
    freshPassword = randomUUID();
  secrets.push(freshPassword);
  async function ownerPost(value, invitation = false) {
    const response = await page.request.post(
      base +
        "/api/coach/external-clients" +
        (invitation ? "?invitation=true" : ""),
      { headers: { origin: base }, data: value },
    );
    assert.equal(response.status(), 200);
    return response.json();
  }
  const fresh = (
    await ownerPost({
      action: "create",
      operationId: randomUUID(),
      name: "New account client",
      email: freshEmail,
    })
  ).client;
  const [freshBooking] = await raw(
    coach,
    "select app.coach_session_booking($1::uuid,$2::jsonb) value",
    [
      randomUUID(),
      {
        action: "create",
        externalClientId: fresh.id,
        typeId: type.id,
        typeRevision: 0,
        locationId: venue.id,
        startsAt: day.date + "T14:00:00 Europe/Berlin",
        durationMinutes: 60,
      },
    ],
  );
  const freshSent = (
    await ownerPost(
      {
        action: "send",
        operationId: randomUUID(),
        externalClientId: fresh.id,
        clientRevision: 0,
        expectedInvitationId: null,
        expectedRevision: null,
      },
      true,
    )
  ).invitation;
  const [freshJob] =
    await database`select provider_id from app.coach_invitation_emails where id=${freshSent.id}::uuid`;
  const freshMail = await (
    await fetch(mail + "/api/v1/message/" + freshJob.provider_id)
  ).json();
  const freshLink = freshMail.Text.match(
    /http:\/\/localhost:3169\/invitations#[A-Za-z0-9_-]{43}/,
  )?.[0];
  assert.ok(freshLink);
  secrets.push(new URL(freshLink).hash.slice(1));
  const newContext = await browser.newContext({
      viewport: { width: 375, height: 900 },
    }),
    newPage = await newContext.newPage();
  await newPage.goto(freshLink);
  await expect(newPage).toHaveURL(base + "/invitations");
  await newPage
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await newPage.getByLabel("Email address", { exact: true }).fill(freshEmail);
  await newPage.getByLabel("New password", { exact: true }).fill(freshPassword);
  await newPage
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(newPage).toHaveURL(/\/check-email\?/);
  let confirmation;
  await expect
    .poll(async () => {
      const list = await (await fetch(mail + "/api/v1/messages")).json();
      const found = list.messages?.find(
        (m) =>
          m.To?.some((to) => to.Address === freshEmail) &&
          m.Subject === "Confirm your MovX Club email",
      );
      if (found)
        confirmation = await (
          await fetch(mail + "/api/v1/message/" + found.ID)
        ).json();
      return !!confirmation;
    })
    .toBe(true);
  const confirmationLink = confirmation.HTML.match(
    /href="([^"]+)"/i,
  )?.[1]?.replaceAll("&amp;", "&");
  assert.ok(confirmationLink);
  secrets.push(confirmationLink, new URL(confirmationLink).hash.slice(1));
  await newPage.goto(confirmationLink);
  await newPage
    .getByRole("button", { name: "Continue securely", exact: true })
    .click();
  await expect(newPage).toHaveURL(/\/complete-profile\?/);
  assert.equal(
    new URL(newPage.url()).searchParams.get("returnTo"),
    "/invitations",
  );
  await newPage
    .getByLabel("Username", { exact: true })
    .fill("external_" + randomUUID().replaceAll("-", "").slice(0, 12));
  await newPage
    .getByLabel("Full name", { exact: true })
    .fill("Private New Client");
  await newPage
    .getByLabel("Display name", { exact: true })
    .fill("My chosen name");
  await newPage.getByRole("button", { name: "Continue", exact: true }).click();
  await newPage
    .getByRole("button", { name: "Do this later", exact: true })
    .click();
  await expect(newPage).toHaveURL(base + "/invitations");
  await expect(
    newPage.getByRole("button", { name: "Accept invitation", exact: true }),
  ).toBeVisible();
  assert.equal(
    (
      await database`select linked_profile_id from app.coach_external_clients where id=${fresh.id}::uuid`
    )[0].linked_profile_id,
    null,
  );
  await newPage
    .getByRole("button", { name: "Accept invitation", exact: true })
    .click();
  await expect(
    newPage.getByRole("heading", { name: "Invitation accepted", exact: true }),
  ).toBeVisible();
  const [freshAccount] =
    await database`select p.id,p.display_name from app.profiles p join auth.users u on u.id=p.auth_user_id where u.email=${freshEmail}`;
  assert.equal(freshAccount.display_name, "My chosen name");
  assert.equal(
    (
      await database`select client_profile_id from app.coach_private_bookings where id=${freshBooking.value.bookingId}::uuid`
    )[0].client_profile_id,
    freshAccount.id,
  );
  await newContext.close();
  pass(
    "new recipient registers and verifies email normally, keeps token-free pending context through enrollment and explicitly accepts without profile overwrite",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
}
