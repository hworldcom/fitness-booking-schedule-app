import assert from "node:assert/strict";
import test from "node:test";
import { submitGroupDraft } from "@/server/group-sessions/direct-submission";
import type { OwnerMutation } from "@/events/contracts";
import type { GroupSession } from "@/domain/group-sessions";
const id = "00000000-0000-4000-8000-000000000001";
const draft = {
  action: "save-draft",
  args: {
    id,
    expectedRevision: null,
    title: "Group",
    description: "Details",
    discipline: "Boxing",
    intendedLevel: "All levels",
    locationId: id,
    startsAt: "2030-11-01T10:00:00Z",
    endsAt: "2030-11-01T11:00:00Z",
    decisionDeadlineAt: "2030-10-31T10:00:00Z",
    minimumParticipants: 2,
    maximumParticipants: 10,
    priceCents: 0,
  },
} as Extract<OwnerMutation, { action: "save-draft" }>;
const session = {
  id,
  title: "Group",
  description: "Details",
  discipline: "Boxing",
  intendedLevel: "All levels",
  venue: { id },
  startsAt: draft.args.startsAt,
  endsAt: draft.args.endsAt,
  decisionDeadlineAt: draft.args.decisionDeadlineAt,
  minimumParticipants: 2,
  maximumParticipants: 10,
  priceCents: 0,
  sessionType: null,
  status: "draft",
  revision: 1,
  publishedAt: null,
} as GroupSession;
test("Save draft stays private; Submit saves then publishes the returned revision", async () => {
  const calls: OwnerMutation[] = [];
  const port = {
    read: async () => ({ status: "conflict" }),
    change: async (c: OwnerMutation, scope: string) => {
      assert.equal(scope, "owner");
      calls.push(c);
      return {
        status: "ready",
        value: {
          outcome: c.action === "save-draft" ? "saved" : "published",
          session,
        },
      };
    },
  };
  assert.equal(
    (await submitGroupDraft(draft, "owner", "draft", false, port)).issue,
    null,
  );
  assert.equal(calls.length, 1);
  calls.length = 0;
  assert.equal(
    (await submitGroupDraft(draft, "owner", "submit", false, port)).issue,
    null,
  );
  assert.deepEqual(
    calls.map((x) => x.action),
    ["save-draft", "publish"],
  );
  assert.deepEqual(calls[1].args, { id, expectedRevision: 1 });
});
test("failed publication keeps a known editable private draft; unknown result keeps retry identity", async () => {
  let publish = false;
  const port = {
    read: async () => ({ status: "conflict" }),
    change: async (c: OwnerMutation) =>
      c.action === "save-draft"
        ? { status: "ready", value: { outcome: "saved", session } }
        : publish
          ? Promise.reject(Error("lost"))
          : {
              status: "ready",
              value: {
                outcome: "conflict",
                reason: "schedule-conflict",
                session,
              },
            },
  };
  assert.deepEqual(
    await submitGroupDraft(draft, "owner", "submit", false, port),
    { issue: "schedule-conflict", pending: false, revision: 1 },
  );
  publish = true;
  assert.deepEqual(
    await submitGroupDraft(draft, "owner", "submit", false, port),
    { issue: "unavailable", pending: true },
  );
});
test("unknown publish recovery reuses a matching owned group and never creates a duplicate", async () => {
  let writes = 0;
  const read = async () => ({
    status: "ready",
    context: { scope: "owner" },
    value: {
      session: {
        ...session,
        status: "open" as const,
        publishedAt: "2030-10-20T10:00:00Z",
      },
    },
  });
  assert.equal(
    (
      await submitGroupDraft(draft, "owner", "submit", true, {
        read,
        change: async () => {
          writes++;
          throw Error();
        },
      })
    ).issue,
    null,
  );
  assert.equal(writes, 0);
  assert.equal(
    (
      await submitGroupDraft(draft, "other", "submit", true, {
        read,
        change: async () => {
          writes++;
          throw Error();
        },
      })
    ).issue,
    "actor-changed",
  );
  assert.equal(writes, 0);
  const edited = { ...draft, args: { ...draft.args, title: "Changed terms" } };
  assert.equal(
    (
      await submitGroupDraft(edited, "owner", "submit", true, {
        read,
        change: async () => {
          writes++;
          throw Error();
        },
      })
    ).issue,
    "conflict",
  );
  assert.equal(writes, 0);
});
test("a saved private draft is resumed at its authoritative revision; denied save never publishes", async () => {
  const calls: OwnerMutation[] = [];
  const resumedDraft = {
    ...draft,
    args: { ...draft.args, expectedRevision: 3 },
  };
  const result = await submitGroupDraft(resumedDraft, "owner", "submit", true, {
    read: async () => ({
      status: "ready",
      context: { scope: "owner" },
      value: { session: { ...session, revision: 4 } },
    }),
    change: async (c) => {
      calls.push(c);
      return { status: "ready", value: { outcome: "published", session } };
    },
  });
  assert.equal(result.issue, null);
  assert.deepEqual(calls, [
    { action: "publish", args: { id, expectedRevision: 4 } },
  ]);
  calls.length = 0;
  assert.equal(
    (
      await submitGroupDraft(draft, "owner", "submit", false, {
        read: async () => ({ status: "conflict" }),
        change: async (c) => {
          calls.push(c);
          return { status: "forbidden" };
        },
      })
    ).issue,
    "forbidden",
  );
  assert.equal(calls.length, 1);
});

test("unknown recovery never publishes a newer concurrently changed draft", async () => {
  let writes = 0;
  const result = await submitGroupDraft(draft, "owner", "submit", true, {
    read: async () => ({
      status: "ready",
      context: { scope: "owner" },
      value: { session: { ...session, revision: 2 } },
    }),
    change: async () => {
      writes++;
      throw Error("unexpected write");
    },
  });
  assert.equal(result.issue, "conflict");
  assert.equal(writes, 0);
});

test("definitive save conflicts retain an editable form without publishing", async () => {
  let calls = 0;
  const result = await submitGroupDraft(draft, "owner", "submit", false, {
    read: async () => ({ status: "conflict" }),
    change: async () => {
      calls++;
      return {
        status: "ready",
        value: { outcome: "conflict", reason: "revision-changed" },
      };
    },
  });
  assert.deepEqual(result, { issue: "revision-changed", pending: false });
  assert.equal(calls, 1);
});
