import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import type {
  OwnedReview,
  ReviewState,
  ReviewSummary,
} from "@/domain/coach-reviews";
import {
  ReviewPanel,
  ReviewPublication,
} from "@/features/reviews/athlete-review-workspace";
import {
  parseAuthorResult,
  previewCommand,
  reviewEntryCandidate,
  ReviewWorkspace,
  type AuthorCommand,
  type AuthorResult,
  type ReviewTransport,
} from "@/features/reviews/review-workspace-model";

const id = "93180000-0000-4000-8000-000000000001";
const booking = {
  id,
  coachSlug: "daniel-park",
  coachDisplayName: "Daniel Park",
  status: "confirmed",
  scheduledEndAt: "2026-10-17T12:00:00Z",
} as PrivateBookingProjection;
const row: OwnedReview = {
  id,
  rating: 4,
  attribution: "Chosen public name",
  comment: "Helpful training",
  published: true,
  moderationHidden: false,
  revision: 1,
  createdAt: "2026-10-17T12:00:00Z",
  updatedAt: "2026-10-17T12:00:00Z",
};
const ready = (review: OwnedReview | null = null): ReviewState => ({
  status: "ready",
  eligible: true,
  review,
});
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(overrides: Partial<ReviewTransport> = {}) {
  const writes: AuthorCommand[] = [];
  const transport: ReviewTransport = {
    read: async () => ready(),
    summary: async () => ({ count: 1, mean: 4, fictional: true }),
    write: async (command) => {
      writes.push(command);
      return {
        ...ready({ ...row, published: command.action !== "withdraw" }),
        status: "saved",
      };
    },
    ...overrides,
  };
  const workspace = new ReviewWorkspace(transport);
  workspace.ensure(booking);
  return { workspace, writes };
}
const pair = (workspace: ReviewWorkspace) =>
  workspace.getSnapshot().pairs[booking.coachSlug];
function draft(workspace: ReviewWorkspace) {
  workspace.edit(booking.coachSlug);
  workspace.change(booking.coachSlug, {
    rating: 4,
    attribution: "  Chosen public name  ",
    comment: " Helpful\r\ntraining ",
  });
  workspace.preview(booking.coachSlug);
}

test("review entries exclude future/cancelled/malformed bookings and the API controls actual eligibility", async () => {
  assert.equal(reviewEntryCandidate(booking, "2026-10-18T00:00:00Z"), true);
  for (const excluded of [
    { ...booking, status: "cancelled" as const },
    { ...booking, scheduledEndAt: "2026-10-19T00:00:00Z" },
    { ...booking, id: "bad" },
  ])
    assert.equal(reviewEntryCandidate(excluded, "2026-10-18T00:00:00Z"), false);
  const { workspace, writes } = setup({
    read: async () => ({ ...ready(), eligible: false }),
  });
  await tick();
  draft(workspace);
  await workspace.publish(booking.coachSlug);
  assert.equal(pair(workspace).draft, null);
  assert.equal(writes.length, 0);
});

test("private responses are validated and stripped; malformed author/moderation responses fail closed", () => {
  assert.deepEqual(
    parseAuthorResult({
      ...ready({
        ...row,
        legalName: "Private",
        avatar: "private",
      } as OwnedReview),
      email: "private",
    }),
    ready(row),
  );
  for (const invalid of [
    { status: "saved", revision: 1 },
    { ...ready(), review: undefined },
    ready({ ...row, revision: 0 }),
    ready({ ...row, rating: 9 }),
    { ...ready(), eligible: "yes" },
  ])
    assert.equal(parseAuthorResult(invalid), null);
});

test("different eligible booking entries share one draft/review; explicit preview and consent are required each time", async () => {
  const { workspace, writes } = setup();
  await tick();
  workspace.ensure({ ...booking, id: "93180000-0000-4000-8000-000000000002" });
  assert.equal(Object.keys(workspace.getSnapshot().pairs).length, 1);
  workspace.edit(booking.coachSlug);
  assert.deepEqual(pair(workspace).draft, {
    rating: 0,
    attribution: "",
    comment: "",
  });
  draft(workspace);
  assert.equal(pair(workspace).draft?.comment, "Helpful\ntraining");
  await workspace.publish(booking.coachSlug);
  assert.equal(writes.length, 0);
  workspace.consent(booking.coachSlug, true);
  workspace.edit(booking.coachSlug);
  assert.equal(pair(workspace).consent, false);
  workspace.preview(booking.coachSlug);
  workspace.consent(booking.coachSlug, true);
  await workspace.publish(booking.coachSlug);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].expectedRevision, 0);
  assert.equal(pair(workspace).saved?.review?.id, id);
  assert.equal(pair(workspace).draft, null);
  workspace.edit(booking.coachSlug);
  assert.equal(pair(workspace).draftRevision, 1);
  assert.equal(pair(workspace).consent, false);
});

test("uncertain writes retain the identical command, lock repeated clicks, survive closing and recover without a new booking allowance", async () => {
  const pending = deferred<AuthorResult>();
  const commands: AuthorCommand[] = [];
  const { workspace } = setup({
    write: async (command) => {
      commands.push(command);
      if (commands.length === 1) return pending.promise;
      return { ...ready(row), status: "saved" };
    },
  });
  await tick();
  draft(workspace);
  workspace.consent(booking.coachSlug, true);
  const first = workspace.publish(booking.coachSlug);
  await workspace.publish(booking.coachSlug);
  assert.equal(commands.length, 1);
  workspace.close();
  pending.resolve({ status: "unavailable" });
  await first;
  assert.equal(pair(workspace).recovery, "uncertain");
  workspace.change(booking.coachSlug, {
    comment: "Changed during uncertainty",
  });
  assert.equal(pair(workspace).draft?.comment, "Helpful\ntraining");
  await workspace.retry(booking.coachSlug);
  assert.equal(commands.length, 2);
  assert.deepEqual(commands[0], commands[1]);
  assert.equal(pair(workspace).saved?.review?.id, id);
});

test("stale edits keep drafts and require an explicit latest-revision choice plus fresh consent", async () => {
  let current = ready(row);
  const commands: AuthorCommand[] = [];
  const { workspace } = setup({
    read: async () => current,
    write: async (command) => {
      commands.push(command);
      return { status: "conflict" };
    },
  });
  await tick();
  draft(workspace);
  workspace.consent(booking.coachSlug, true);
  current = ready({ ...row, revision: 2, comment: "Changed in another tab" });
  await workspace.publish(booking.coachSlug);
  assert.equal(pair(workspace).recovery, "conflict");
  assert.equal(pair(workspace).draft?.comment, "Helpful\ntraining");
  assert.equal(
    pair(workspace).saved?.review?.comment,
    "Changed in another tab",
  );
  await workspace.publish(booking.coachSlug);
  assert.equal(commands.length, 1);
  workspace.useLatest(booking.coachSlug, true);
  assert.equal(pair(workspace).draftRevision, 2);
  assert.equal(pair(workspace).consent, false);
  assert.equal(pair(workspace).phase, "edit");
  assert.equal(pair(workspace).pending, null);
});

test("failed conflict reload cannot discard uncertainty; a later checked read can reconcile the saved review", async () => {
  let failure = false;
  const { workspace } = setup({
    read: async () => {
      if (failure) throw new Error("Offline");
      return ready(row);
    },
    write: async () => ({ status: "conflict" }),
  });
  await tick();
  draft(workspace);
  workspace.consent(booking.coachSlug, true);
  failure = true;
  await workspace.publish(booking.coachSlug);
  workspace.useLatest(booking.coachSlug, false);
  assert.equal(pair(workspace).recovery, "conflict");
  assert.ok(pair(workspace).draft);
  failure = false;
  await workspace.load(booking.coachSlug);
  workspace.useLatest(booking.coachSlug, false);
  assert.equal(pair(workspace).draft, null);
  assert.equal(pair(workspace).recovery, null);
});

test("withdraw and republish preserve the review identity and refresh actual summaries", async () => {
  let current = row;
  const { workspace } = setup({
    read: async () => ready(current),
    write: async (command) => {
      current = {
        ...current,
        published: command.action !== "withdraw",
        revision: current.revision + 1,
      };
      return { ...ready(current), status: "saved" };
    },
    summary: async () => ({
      count: current.published ? 1 : 0,
      mean: current.published ? 4 : null,
      fictional: true,
    }),
  });
  await tick();
  await workspace.withdraw(booking.coachSlug);
  assert.equal(pair(workspace).saved?.review?.id, id);
  assert.equal(pair(workspace).saved?.review?.published, false);
  assert.equal((pair(workspace).summary as ReviewSummary).count, 0);
  draft(workspace);
  assert.equal(pair(workspace).draftRevision, 2);
  workspace.consent(booking.coachSlug, true);
  await workspace.publish(booking.coachSlug);
  assert.equal(pair(workspace).saved?.review?.id, id);
  assert.equal((pair(workspace).summary as ReviewSummary).count, 1);
});

test("lost access clears every pair/draft; disposed workspaces ignore late private responses", async () => {
  const response = deferred<AuthorResult>();
  const { workspace } = setup({ write: async () => ({ status: "forbidden" }) });
  await tick();
  draft(workspace);
  workspace.consent(booking.coachSlug, true);
  await workspace.publish(booking.coachSlug);
  assert.deepEqual(workspace.getSnapshot(), {
    pairs: {},
    active: null,
    accessLost: true,
  });
  workspace.ensure(booking);
  assert.equal(Object.keys(workspace.getSnapshot().pairs).length, 0);
  const pending = setup({ read: async () => response.promise });
  pending.workspace.dispose();
  response.resolve(ready(row));
  await tick();
  assert.deepEqual(pending.workspace.getSnapshot().pairs, {});
});

test("preview exposes only consented fields and form starts without account identity, with semantic rating/consent controls", async () => {
  const markup = renderToStaticMarkup(
    createElement(ReviewPublication, {
      review: {
        ...row,
        legalName: "Private legal",
        avatar: "Private avatar",
        bookingId: id,
      } as OwnedReview,
    }),
  );
  assert.match(markup, /Chosen public name/);
  assert.doesNotMatch(markup, /Private legal|Private avatar|93180000|<img/);
  const { workspace } = setup();
  await tick();
  workspace.edit(booking.coachSlug);
  const form = renderToStaticMarkup(
    createElement(ReviewPanel, { pair: pair(workspace), workspace }),
  );
  assert.equal((form.match(/type="radio"/g) ?? []).length, 5);
  assert.match(form, /Public review name/);
  assert.match(form, /value=""/);
  draft(workspace);
  const preview = renderToStaticMarkup(
    createElement(ReviewPanel, { pair: pair(workspace), workspace }),
  );
  assert.match(preview, /type="checkbox"/);
  assert.doesNotMatch(preview, /checked=""/);
  assert.match(preview, /disabled="">Publish review/);
  const invalidDraft = {
    ...pair(workspace),
    draft: { rating: 5, attribution: "A", comment: "" },
  };
  assert.equal(previewCommand(invalidDraft), null);
});

test("a later booking opens the same pair using that original session as the command entry", async () => {
  const { workspace, writes } = setup();
  await tick();
  const laterId = "93180000-0000-4000-8000-000000000002";
  workspace.open(booking.coachSlug, laterId);
  await tick();
  draft(workspace);
  workspace.consent(booking.coachSlug, true);
  await workspace.publish(booking.coachSlug);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].action === "publish" && writes[0].bookingId, laterId);
  assert.equal(Object.keys(workspace.getSnapshot().pairs).length, 1);
});

test("older aggregate reads cannot overwrite a later withdrawal and failed public reads are not fabricated as zero", async () => {
  const firstSummary = deferred<ReviewSummary | null>();
  let current = row,
    calls = 0;
  const { workspace } = setup({
    read: async () => ready(current),
    write: async (command) => {
      current = {
        ...current,
        published: command.action !== "withdraw",
        revision: current.revision + 1,
      };
      return { ...ready(current), status: "saved" };
    },
    summary: async () => (++calls === 1 ? firstSummary.promise : null),
  });
  await tick();
  draft(workspace);
  workspace.consent(booking.coachSlug, true);
  const publishing = workspace.publish(booking.coachSlug);
  await tick();
  await workspace.withdraw(booking.coachSlug);
  firstSummary.resolve({ count: 1, mean: 4, fictional: true });
  await publishing;
  assert.equal(pair(workspace).saved?.review?.published, false);
  assert.equal(pair(workspace).summary, "unavailable");
  await workspace.load(booking.coachSlug);
  assert.equal(pair(workspace).summary, null);
});
