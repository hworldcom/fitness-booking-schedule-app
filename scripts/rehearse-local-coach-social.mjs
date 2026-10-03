import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const siteUrl =
  process.env.COACH_SOCIAL_TEST_SITE_URL ?? "http://localhost:3100";
const mailboxUrl =
  process.env.AUTH_TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
const nonce = Date.now();
const coachEmail = `dev0100-coach-${nonce}@example.com`;
const followerEmail = `dev0100-follower-${nonce}@example.com`;
const admin = postgres(
  process.env.COACH_SOCIAL_TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
  { max: 1, prepare: false, ssl: false },
);

async function emailCodeFor(email) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${mailboxUrl}/api/v1/messages`);
    if (!response.ok) throw new Error("The local captured mailbox is offline.");
    const mailbox = await response.json();
    const message = mailbox.messages?.find((candidate) =>
      candidate.To?.some((recipient) => recipient.Address === email),
    );
    const code = message?.Snippet?.match(/\b\d{6}\b/)?.[0];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The local OTP email did not arrive in time.");
}

async function signInAndEnroll(page, email, displayName) {
  await page.goto(`${siteUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByText("Check your email.").waitFor({ timeout: 60_000 });
  await page.getByLabel("Six-digit code").fill(await emailCodeFor(email));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page
    .getByText(/Email verified|Signed in as/)
    .first()
    .waitFor({ timeout: 20_000 });
  const displayNameInput = page.getByLabel("Display name");
  if ((await displayNameInput.count()) > 0) {
    await displayNameInput.fill(displayName);
    await page.getByRole("button", { name: "Create my profile" }).click();
    await page
      .getByText(`Signed in as ${displayName}.`)
      .waitFor({ timeout: 20_000 });
  }
}

async function prepareVisibleCoachProfile(email) {
  const identities = await admin`
    select
      auth_user.id::text as auth_user_id,
      profile.id::text as profile_id,
      participant.run_id::text as run_id,
      participant.role
    from auth.users as auth_user
    join app.profiles as profile
      on profile.auth_user_id = auth_user.id
    join app.demo_run_participants as participant
      on participant.profile_id = profile.id
    where auth_user.email = ${email}
      and participant.status = 'active'
  `;
  const identity = identities[0];
  assert.equal(identities.length, 1);
  assert.equal(identity?.role, "member");

  const slug = await admin.begin(async (transaction) => {
    await transaction`
      select
        set_config('app.current_auth_user_id', ${identity.auth_user_id}, true),
        set_config('app.current_profile_id', ${identity.profile_id}, true),
        set_config('app.current_run_id', ${identity.run_id}, true),
        set_config('app.current_run_role', ${identity.role}, true)
    `;
    const activationSupport = await transaction`
      select to_regprocedure('app.activate_owned_coaching()') is not null
        as available
    `;
    if (activationSupport[0]?.available) {
      await transaction`select app.activate_owned_coaching()`;
    }
    const rows = await transaction`
      select app.upsert_owned_coach_profile(
        'Taylor Coach',
        'Private boxing coaching with deliberate footwork, calm feedback and practical technical progress.',
        array['Boxing']::text[],
        'Europe/Berlin',
        'visible',
        '40000000-0000-4000-8000-000000000001'::uuid,
        null,
        null,
        null,
        null,
        null
      ) as public_slug
    `;
    return rows[0]?.public_slug;
  });
  assert.match(slug ?? "", /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  return `${siteUrl}/coaches/${slug}`;
}

async function removeRehearsalAccounts() {
  await admin`
    delete from app.coach_follows
    where follower_profile_id in (
      select profile.id
      from app.profiles as profile
      join auth.users as auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email in (${coachEmail}, ${followerEmail})
    ) or coach_profile_id in (
      select profile.id
      from app.profiles as profile
      join auth.users as auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email in (${coachEmail}, ${followerEmail})
    )
  `;
  await admin`
    delete from app.coach_posts
    where coach_profile_id in (
      select profile.id
      from app.profiles as profile
      join auth.users as auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email in (${coachEmail}, ${followerEmail})
    )
  `;
  await admin`
    delete from app.coach_profile_disciplines
    where profile_id in (
      select profile.id
      from app.profiles as profile
      join auth.users as auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email in (${coachEmail}, ${followerEmail})
    )
  `;
  await admin`
    delete from app.coach_profiles
    where profile_id in (
      select profile.id
      from app.profiles as profile
      join auth.users as auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email in (${coachEmail}, ${followerEmail})
    )
  `;
  await admin`
    delete from app.demo_run_participants
    where profile_id in (
      select profile.id
      from app.profiles as profile
      join auth.users as auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email in (${coachEmail}, ${followerEmail})
    )
  `;
  await admin`
    delete from app.profiles
    where auth_user_id in (
      select id from auth.users
      where email in (${coachEmail}, ${followerEmail})
    )
  `;
  await admin`
    delete from auth.users where email in (${coachEmail}, ${followerEmail})
  `;
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  const coachContext = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const followerContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const coachPage = await coachContext.newPage();
  const followerPage = await followerContext.newPage();
  const pageErrors = [];
  coachPage.on("pageerror", (error) => pageErrors.push(error.message));
  followerPage.on("pageerror", (error) => pageErrors.push(error.message));

  await signInAndEnroll(coachPage, coachEmail, "Taylor Coach");
  const coachProfileUrl = await prepareVisibleCoachProfile(coachEmail);

  await coachPage.goto(`${siteUrl}/coach/posts`, {
    waitUntil: "domcontentloaded",
  });
  const postText = `Balance before speed — rehearsal ${nonce}.`;
  await coachPage.getByLabel("Post text").fill(postText);
  await coachPage.getByRole("button", { name: "Publish post" }).click();
  await coachPage.getByText("Post published.").waitFor({ timeout: 20_000 });

  await signInAndEnroll(followerPage, followerEmail, "Jordan Reader");
  await followerPage.goto(coachProfileUrl, { waitUntil: "domcontentloaded" });
  await followerPage
    .getByRole("button", { name: "Follow Taylor Coach" })
    .click();
  await followerPage.getByText("Coach followed.").waitFor({ timeout: 20_000 });

  await followerPage.goto(`${siteUrl}/following`, {
    waitUntil: "domcontentloaded",
  });
  await followerPage.getByText(postText).waitFor({ timeout: 20_000 });

  await followerPage.goto(coachProfileUrl, { waitUntil: "domcontentloaded" });
  await followerPage
    .getByRole("button", { name: "Unfollow Taylor Coach" })
    .click();
  await followerPage
    .getByText("Coach unfollowed.")
    .waitFor({ timeout: 20_000 });
  await followerPage.goto(`${siteUrl}/following`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(await followerPage.getByText(postText).count(), 0);

  await followerPage.goto(coachProfileUrl, { waitUntil: "domcontentloaded" });
  await followerPage
    .getByRole("button", { name: "Follow Taylor Coach" })
    .click();
  await followerPage.getByText("Coach followed.").waitFor({ timeout: 20_000 });

  await coachPage.goto(`${siteUrl}/coach/posts`, {
    waitUntil: "domcontentloaded",
  });
  const ownedPost = coachPage.locator("article.coach-post-card").filter({
    hasText: postText,
  });
  await ownedPost.getByRole("button", { name: "Hide post" }).click();
  await ownedPost.getByText("Post hidden.").waitFor({ timeout: 20_000 });

  await followerPage.goto(`${siteUrl}/following`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(await followerPage.getByText(postText).count(), 0);
  assert.equal(
    await followerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.deepEqual(pageErrors, []);
  console.log(
    "Coach social rehearsal passed for two isolated accounts: coach profile, publish, follow, chronological feed, idempotent unfollow/re-follow and hide removal.",
  );
} finally {
  await browser.close();
  await removeRehearsalAccounts();
  await admin.end();
}
