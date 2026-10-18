import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DEMO_COACH_FIXTURES,
  demoCoachPublicUrlStatements,
} from "../scripts/lib/demo-coach-fixtures";
import {
  attachDemoCoachUrls,
  demoCoachPublicUrl,
  privateDemoCredentialStore,
  type DemoCredentials,
} from "../scripts/lib/demo-coach-credentials";
import { demoEnvironmentArgument } from "../scripts/lib/demo-coach-target";

test("demo public handles are fixed, unique, valid and limited to the six fixtures", () => {
  assert.deepEqual(
    DEMO_COACH_FIXTURES.map((c) => c.username),
    [
      "daniel_park",
      "sam_lee",
      "nora_klein",
      "idris_malik",
      "elif_demir",
      "jake_miller",
    ],
  );
  assert.equal(new Set(DEMO_COACH_FIXTURES.map((c) => c.username)).size, 6);
  for (const c of DEMO_COACH_FIXTURES)
    assert.equal(
      demoCoachPublicUrl("http://localhost:3100", c.username),
      `http://localhost:3100/@${c.username}`,
    );
  assert.throws(() => demoCoachPublicUrlStatements(["unrelated-profile"]));
  assert.throws(() =>
    demoCoachPublicUrlStatements(
      Array(2).fill(DEMO_COACH_FIXTURES[0].profileId),
    ),
  );
  assert.equal(
    demoCoachPublicUrlStatements([]),
    "select true as urls_preserved;",
  );
  assert.equal(
    demoEnvironmentArgument(["--environment", "local", "--publish-urls"]),
    "local",
  );
  assert.throws(() =>
    demoEnvironmentArgument(["--environment", "prod", "--publish-urls"]),
  );
});

test("private URL enrichment retains credentials, uses confirmed current handles and is idempotent", () => {
  const coach = DEMO_COACH_FIXTURES[0];
  const credentials: DemoCredentials = {
    environment: "local",
    target: "movx-club-local",
    note: "private",
    coaches: {
      [coach.slug]: {
        email: coach.email,
        authUserId: coach.authUserId,
        password: "synthetic-owner-kept-password",
        initializedAt: "2026-10-01",
      },
    },
  };
  const original = structuredClone(credentials.coaches[coach.slug]);
  const names = [{ profile_id: coach.profileId, username: "daniel_changed" }];
  assert.equal(
    attachDemoCoachUrls(credentials, names, "http://localhost:3100"),
    true,
  );
  assert.deepEqual(credentials.coaches[coach.slug], {
    ...original,
    publicUrl: "http://localhost:3100/@daniel_changed",
  });
  assert.equal(
    attachDemoCoachUrls(credentials, names, "http://localhost:3100"),
    false,
  );
  assert.equal(Object.keys(credentials.coaches).length, 1);
  assert.equal(
    attachDemoCoachUrls(credentials, names, "https://dev.example.test"),
    true,
  );
  assert.equal(
    credentials.coaches[coach.slug].publicUrl,
    "https://dev.example.test/@daniel_changed",
  );
  assert.throws(
    () => attachDemoCoachUrls(credentials, [], "http://localhost:3100"),
    /unavailable/,
  );
});

test("tester links refuse credentialed, unsafe or non-origin site URLs", () => {
  for (const site of [
    "https://user:secret@example.test",
    "http://example.test",
    "javascript:alert(1)",
    "https://example.test/path",
    "https://example.test?token=private",
    "https://example.test#fragment",
  ])
    assert.throws(() => demoCoachPublicUrl(site, "daniel_park"));
  assert.throws(() => demoCoachPublicUrl("http://localhost:3100", "../bad"));
});

test("URL-only private-file saves preserve the original note and credential fields", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "movx-url-journal-"));
  const coach = DEMO_COACH_FIXTURES[0];
  try {
    let store = await privateDemoCredentialStore(
      root,
      "local",
      "movx-club-local",
    );
    store.credentials.note = "Retained custom tester instructions.";
    store.credentials.coaches[coach.slug] = {
      email: coach.email,
      authUserId: coach.authUserId,
      password: "synthetic-kept-password-value",
      initializedAt: "2026-10-01",
    };
    await store.save();
    const before = structuredClone(store.credentials);
    await store.close();
    store = await privateDemoCredentialStore(root, "local", "movx-club-local", {
      preserveNote: true,
    });
    try {
      attachDemoCoachUrls(
        store.credentials,
        [{ profile_id: coach.profileId, username: coach.username }],
        "http://localhost:3100",
      );
      await store.save();
      const saved = JSON.parse(await readFile(store.file, "utf8"));
      delete saved.coaches[coach.slug].publicUrl;
      assert.deepEqual(saved, before);
    } finally {
      await store.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
