import { writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });

// Uses only the caller's owned disposable Auth/browser/SQL/Mailpit stack.
export async function rehearseCoachApplicationEmail({
  base,
  coach,
  database,
  mail,
  cron,
  pass,
  output,
}) {
  assert.equal(new URL(base).port, "3169");
  assert.equal(new URL(mail).port, "55424");
  const page = coach.page;
  const initialViewport = page.viewportSize();
  const originalContact = {
    phoneNumber: "+4915123456789",
    instagramUrl: "https://www.instagram.com/movx_test",
    facebookUrl: "https://www.facebook.com/movx_test",
    linkedinUrl: "https://www.linkedin.com/in/movx-test",
  };
  const updatedPhone = "+4915198765432";
  const submitIntent = async () => {
    const r = await coach.context.request.post(
      base + "/api/auth/coach-application",
      { headers: { origin: base } },
    );
    assert.equal(r.status(), 200);
    assert.equal((await r.json()).status, "pending");
  };
  const rows = () =>
    database`select * from app.coach_application_emails where profile_id=${coach.profileId}::uuid order by application_revision`;
  const dispatch = async () => {
    const r = await fetch(base + "/api/internal/notifications/dispatch", {
      headers: { authorization: "Bearer " + cron },
    });
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.status, "ready");
    return result.result;
  };
  async function receipt(expectedCount) {
    assert.equal((await dispatch()).accepted, 1);
    const jobs = await rows();
    assert.equal(jobs.length, expectedCount);
    const job = jobs.at(-1);
    assert.equal(job.state, "accepted");
    const r = await fetch(mail + "/api/v1/message/" + job.provider_id);
    assert.equal(r.status, 200);
    const message = await r.json();
    assert.deepEqual(
      message.To.map((x) => x.Address),
      ["hello@movx.club"],
    );
    assert.equal(message.From.Address, "notification@movx.club");
    for (const value of [coach.name, coach.email, coach.profileId, base])
      assert.ok(message.Text.includes(value));
    const expectedContact =
      expectedCount === 1
        ? originalContact
        : {
            phoneNumber: updatedPhone,
            instagramUrl: null,
            facebookUrl: null,
            linkedinUrl: null,
          };
    assert.deepEqual(job.contact_details, expectedContact);
    for (const value of Object.values(expectedContact).filter(Boolean))
      assert.ok(message.Text.includes(value));
    if (expectedCount === 2) {
      for (const label of ["Instagram:", "Facebook:", "LinkedIn:"])
        assert.equal(message.Text.includes(label), false);
    }
    assert.match(message.Subject, /Coach application submitted/);
    await writeFile(
      path.join(output, `coach-application-email-${expectedCount}.json`),
      JSON.stringify(
        {
          to: message.To,
          from: message.From,
          subject: message.Subject,
          text: message.Text,
          html: message.HTML,
          applicationRevision: job.application_revision,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    assert.equal((await dispatch()).claimed, 0);
  }
  await submitIntent();
  assert.equal((await rows()).length, 0);
  pass("preliminary authenticated coach intent creates no staff email");
  await page.goto(base + "/profile/coach");
  const form = page.locator("form.coach-editor-form");
  await form
    .getByLabel("Public display name", { exact: true })
    .fill(coach.name);
  await form
    .getByLabel(/^Biography/)
    .fill(
      "An isolated disposable coach submitting real application details for staff email acceptance testing.",
    );
  const boxing = form.getByLabel("Boxing", { exact: true });
  await boxing.focus();
  await page.keyboard.press("Space");
  await expect(boxing).toBeChecked();
  await form.getByRole("button", { name: "Reviewed gym", exact: true }).click();
  await form
    .getByLabel(/^Select a reviewed gym/)
    .selectOption("40000000-0000-4000-8000-000000000001");
  const phone = form.getByLabel("Phone number", { exact: true });
  const instagram = form.getByLabel("Instagram (optional)", { exact: true });
  const facebook = form.getByLabel("Facebook (optional)", { exact: true });
  const linkedin = form.getByLabel("LinkedIn (optional)", { exact: true });
  const submit = form.getByRole("button", {
    name: "Submit application",
    exact: true,
  });
  const biography = await form.getByLabel(/^Biography/).inputValue();
  await submit.click();
  assert.equal(
    await phone.evaluate((input) => input.validity.valueMissing),
    true,
  );
  assert.equal((await rows()).length, 0);
  assert.equal(
    (
      await database`select count(*)::int n from app.coach_profiles where profile_id=${coach.profileId}::uuid`
    )[0].n,
    0,
  );
  await phone.fill("015123456789");
  await submit.click();
  await expect(
    page.getByText(
      "Enter a phone number with its country code, for example +49 151 23456789.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(phone).toHaveValue("015123456789");
  await expect(form.getByLabel(/^Biography/)).toHaveValue(biography);
  await expect(boxing).toBeChecked();
  await expect(form.getByLabel(/^Select a reviewed gym/)).toHaveValue(
    "40000000-0000-4000-8000-000000000001",
  );
  assert.equal((await rows()).length, 0);
  await phone.fill("+49 (151) 234-56789");
  await instagram.fill("https://instagram.com.evil.test/coach");
  await submit.click();
  await expect(
    page.getByText(
      "Enter a full HTTPS instagram.com profile link, or leave it empty.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(instagram).toHaveValue("https://instagram.com.evil.test/coach");
  await expect(phone).toHaveValue("+49 (151) 234-56789");
  await expect(form.getByLabel(/^Biography/)).toHaveValue(biography);
  assert.equal((await rows()).length, 0);
  await instagram.fill(originalContact.instagramUrl);
  await facebook.fill(originalContact.facebookUrl);
  await linkedin.fill(originalContact.linkedinUrl);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 950 });
    await phone.focus();
    await page.keyboard.press("Tab");
    await expect(instagram).toBeFocused();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await page
      .getByRole("heading", { name: "Contact details for MovX", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(output, `application-contacts-${width}.png`),
      fullPage: true,
    });
  }
  pass(
    "application contact phone is required; server rejects invalid phones/platform spoofing without losing drafts; desktop/mobile keyboard flow has no overflow",
  );
  await form
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(
    page.getByText(
      "Application details saved for review. You can continue editing while you wait.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect.poll(async () => (await rows()).length).toBe(1);
  await receipt(1);
  await page.reload();
  await expect(phone).toHaveValue(originalContact.phoneNumber);
  await expect(instagram).toHaveValue(originalContact.instagramUrl);
  await expect(facebook).toHaveValue(originalContact.facebookUrl);
  await expect(linkedin).toHaveValue(originalContact.linkedinUrl);
  const stale = await coach.context.newPage();
  await stale.goto(base + "/profile/coach");
  await expect(stale.getByLabel("Phone number", { exact: true })).toHaveValue(
    originalContact.phoneNumber,
  );
  pass(
    "actual first Submit application form produces one captured staff email",
  );
  const updatedBio =
    "Updated isolated coaching details while the same application remains under platform review.";
  await form.getByLabel(/^Biography/).fill(updatedBio);
  await phone.fill(updatedPhone);
  await instagram.fill("");
  await facebook.fill("");
  await linkedin.fill("");
  await form
    .getByRole("button", { name: "Save application changes", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await database`select bio from app.coach_profiles where profile_id=${coach.profileId}::uuid`
        )[0].bio,
    )
    .toBe(updatedBio);
  await expect(
    page.getByText(
      "Application details saved for review. You can continue editing while you wait.",
      { exact: true },
    ),
  ).toBeVisible();
  await stale
    .getByLabel("Phone number", { exact: true })
    .fill("+4915100000000");
  await stale
    .getByRole("button", { name: "Save application changes", exact: true })
    .click();
  await expect(
    stale.getByText(
      "Your contact details changed in another tab. Your input is still here; copy it and reload the application before saving again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(stale.getByLabel("Phone number", { exact: true })).toHaveValue(
    "+4915100000000",
  );
  const [savedContact] =
    await database`select * from app.coach_application_contacts where profile_id=${coach.profileId}::uuid`;
  assert.equal(savedContact.details.phoneNumber, updatedPhone);
  assert.equal(savedContact.revision, 2);
  await stale.screenshot({
    path: path.join(output, "application-contact-conflict-1440.png"),
    fullPage: true,
  });
  await stale.close();
  await page.reload();
  await expect(phone).toHaveValue(updatedPhone);
  await expect(instagram).toHaveValue("");
  await expect(facebook).toHaveValue("");
  await expect(linkedin).toHaveValue("");
  assert.deepEqual((await rows())[0].contact_details, originalContact);
  pass(
    "private contacts persist across reload, optional socials can all be cleared, stale-tab contact edits fail without overwriting or rewriting the original staff snapshot",
  );
  await submitIntent();
  assert.equal((await rows()).length, 1);
  assert.equal((await dispatch()).claimed, 0);
  pass(
    "saved application edits and repeated pending intent produce no extra staff email",
  );
  await database`select app.review_coach_application(${coach.profileId}::uuid,'pending','rejected','Add more review detail.','local-test','movx-identity-application-v1')`;
  await page.reload();
  await page
    .getByRole("button", { name: "Resubmit application", exact: true })
    .click();
  await expect.poll(async () => (await rows()).length).toBe(2);
  await receipt(2);
  const anonymousProfile = await (await fetch(base + "/profile/coach")).text();
  for (const secret of Object.values(originalContact).concat([updatedPhone]))
    assert.equal(anonymousProfile.includes(secret), false);
  assert.deepEqual(
    (await rows()).map((r) => r.application_revision),
    [1, 2],
  );
  if (initialViewport) await page.setViewportSize(initialViewport);
  pass(
    "actual application form emails staff once; preliminary intent, edits and retries stay quiet; explicit resubmission sends one new staff receipt through real cron/Mailpit",
  );
}
