import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });

// Only the caller's wholly disposable Auth/browser/database/Mailpit stack.
export async function rehearseRegistrationEmail({
  base,
  browser,
  database,
  mail,
  cron,
  pass,
  output,
  tag,
  people,
}) {
  assert.equal(new URL(base).port, "3169");
  assert.equal(new URL(mail).port, "55424");
  const dispatch = async () => {
    const r = await fetch(base + "/api/internal/notifications/dispatch", {
      headers: { authorization: "Bearer " + cron },
    });
    assert.equal(r.status, 200);
    return (await r.json()).result;
  };
  const capture = async (job, verification = false) => {
    const r = await fetch(mail + "/api/v1/message/" + job.provider_id);
    assert.equal(r.status, 200);
    const m = await r.json();
    assert.deepEqual(
      m.To.map((x) => x.Address),
      ["hello@movx.club"],
    );
    assert.equal(m.From.Address, "notification@movx.club");
    assert.equal(m.ReplyTo[0].Address, "hello@movx.club");
    assert.match(
      m.Subject,
      verification ? /User email verified/ : /New user registered/,
    );
    assert.ok(
      m.Text.includes(verification ? job.verified_email : job.signup_email),
    );
    assert.ok(m.Text.includes(base));
    assert.doesNotMatch(
      m.Text + m.HTML,
      /token_hash|access_token|refresh_token|PRIVATE/,
    );
    return m;
  };
  const initial =
    await database`select * from app.registration_emails where state='queued'`;
  assert.equal(initial.length, people.length);
  const [initialVerifications] =
    await database`select count(*)::int n from app.verification_emails where state='queued'`;
  assert.equal(initialVerifications.n, people.length);
  let delivered = 0;
  while (delivered < initial.length + initialVerifications.n) {
    const r = await dispatch();
    assert.ok(r.accepted > 0);
    delivered += r.accepted;
  }
  assert.equal(delivered, initial.length + initialVerifications.n);
  for (const person of people) {
    const [j] =
      await database`select * from app.registration_emails where auth_user_id=${person.authId}::uuid`;
    assert.equal(j.state, "accepted");
    await capture(j);
    const [v] =
      await database`select * from app.verification_emails where auth_user_id=${person.authId}::uuid`;
    assert.equal(v.state, "accepted");
    await capture(v, true);
  }
  pass(
    "new confirmed fixture accounts use the actual staff outbox/cron and fixed local recipient; existing notification journeys start with an empty staff queue",
  );

  const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
  });
  try {
    const page = await context.newPage();
    const email = `registration-${tag}@users.movx.test`,
      password = randomUUID();
    await page.goto(base + "/register");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("New password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/check-email\?/);
    const [user] =
      await database`select id,email_confirmed_at from auth.users where email=${email}`;
    assert.ok(user);
    assert.equal(user.email_confirmed_at, null);
    const jobs = () =>
      database`select * from app.registration_emails where auth_user_id=${user.id}::uuid`;
    let [job] = await jobs();
    assert.equal(job.state, "queued");
    assert.equal(job.verified_at_signup, false);
    assert.equal(
      Number(
        (
          await database`select count(*) n from app.profiles where auth_user_id=${user.id}::uuid`
        )[0].n,
      ),
      0,
    );
    assert.equal((await dispatch()).accepted, 1);
    [job] = await jobs();
    assert.equal(job.state, "accepted");
    const receipt = await capture(job);
    assert.match(receipt.Text, /No \(unverified\)/);
    await writeFile(
      path.join(output, "registration-staff-email.json"),
      JSON.stringify(
        {
          from: receipt.From,
          to: receipt.To,
          replyTo: receipt.ReplyTo,
          subject: receipt.Subject,
          text: receipt.Text,
          html: receipt.HTML,
          deliveredBeforeVerification: true,
          profileAbsent: true,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    await page.screenshot({
      path: path.join(output, "registration-check-email-375.png"),
      fullPage: true,
    });
    pass(
      "actual mobile signup sends one real local staff email before verification or profile setup, without credentials or a user-directed receipt",
    );

    let confirmation;
    await expect
      .poll(async () => {
        const list = await (await fetch(mail + "/api/v1/messages")).json();
        confirmation = list.messages.find(
          (m) =>
            m.Subject === "Confirm your MovX Club email" &&
            m.To.some((x) => x.Address === email),
        );
        return !!confirmation;
      })
      .toBe(true);
    const message = await (
      await fetch(mail + "/api/v1/message/" + confirmation.ID)
    ).json();
    const link = message.HTML.match(/href="([^"]+)"/i)?.[1].replaceAll(
      "&amp;",
      "&",
    );
    assert.ok(link);
    assert.equal(new URL(link).origin, base);
    await page.goto(link);
    await page.getByRole("button", { name: "Continue securely" }).click();
    await expect(page).toHaveURL(/\/complete-profile/);
    const verificationJobs = () =>
      database`select * from app.verification_emails where auth_user_id=${user.id}::uuid`;
    const [pendingVerification] = await verificationJobs();
    assert.equal(pendingVerification.state, "queued");
    assert.equal((await dispatch()).accepted, 1);
    const [verification] = await verificationJobs();
    assert.equal(verification.state, "accepted");
    const verifiedReceipt = await capture(verification, true);
    await writeFile(
      path.join(output, "verification-staff-email.json"),
      JSON.stringify(
        {
          from: verifiedReceipt.From,
          to: verifiedReceipt.To,
          replyTo: verifiedReceipt.ReplyTo,
          subject: verifiedReceipt.Subject,
          text: verifiedReceipt.Text,
          html: verifiedReceipt.HTML,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    pass(
      "actual email confirmation sends a second distinct staff email before profile setup; the original signup notice remains unchanged",
    );
    const completed = await context.request.post(base + "/api/auth/identity", {
      headers: { origin: base },
      data: {
        username: "reg_" + tag,
        fullName: "Private registration fixture",
        displayName: "Registration fixture",
      },
    });
    assert.equal(completed.status(), 200);
    assert.equal((await jobs()).length, 1);
    assert.equal((await verificationJobs()).length, 1);
    assert.equal((await jobs())[0].id, job.id);
    assert.equal((await dispatch()).claimed, 0);
    // The owned application flow's rate window has elapsed logically; the provider still
    // decides duplicate signup normally. No retained state or provider bypass is used.
    await database`update app.email_auth_flows set requested_at=statement_timestamp()-interval '65 seconds' where email_hash=encode(sha256(convert_to(${email},'UTF8')),'hex')`;
    const duplicate = await browser.newContext();
    try {
      const r = await duplicate.request.post(base + "/api/auth/operations", {
        headers: { origin: base },
        data: { action: "register", email, password },
      });
      assert.equal(r.status(), 200);
      assert.equal((await r.json()).status, "requested");
    } finally {
      await duplicate.close();
    }
    assert.equal((await jobs()).length, 1);
    assert.equal((await dispatch()).claimed, 0);
    pass(
      "real profile enrollment and generic duplicate signup create no extra signup or verification alert; staff mail stays outside member inbox/bell",
    );
  } finally {
    await context.close();
  }
}
