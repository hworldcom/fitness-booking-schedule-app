import assert from "node:assert/strict";
import test from "node:test";
import {
  berlinLocalInput,
  berlinLocalInstant,
  euroCents,
  ownerEventId,
  ownerIssueMessage,
  ownerPageCursor,
  ownerPageHref,
  parseOwnerForm,
} from "@/features/coach-events/contract";

const id = "00000000-0000-4000-8000-000000000001";
const scope = Array(3).fill(id).join(":");
function draft() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    intent: "save-draft",
    sessionId: id,
    actorScope: scope,
    revision: "",
    title: "Footwork class",
    description: "<script>literal text</script>",
    discipline: "Boxing",
    intendedLevel: "All levels",
    locationId: id,
    startsAt: "2027-07-20T18:00",
    endsAt: "2027-07-20T19:30",
    decisionDeadlineAt: "2027-07-19T18:00",
    minimumParticipants: "2",
    maximumParticipants: "8",
    price: "15.50",
  }))
    form.set(key, value);
  return form;
}
test("Berlin form instants round-trip independently of server timezone and reject DST folds/gaps", () => {
  assert.equal(
    berlinLocalInstant("2027-07-20T18:00"),
    "2027-07-20T16:00:00.000Z",
  );
  assert.equal(
    berlinLocalInstant("2027-01-20T18:00"),
    "2027-01-20T17:00:00.000Z",
  );
  for (const value of [
    "2027-03-28T02:30",
    "2027-10-31T02:30",
    "2027-02-30T12:00",
    "2027-01-01T24:00",
    "2027-07-20T18:00Z",
    "",
  ])
    assert.equal(berlinLocalInstant(value), null, value);
  assert.equal(berlinLocalInput("2027-07-20T16:00:00Z"), "2027-07-20T18:00");
});
test("EUR form amounts preserve exact cents and reject rounding, signs and overflow", () => {
  for (const [input, expected] of [
    ["0", 0],
    ["0.1", 10],
    ["15.50", 1550],
    ["21474836.47", 2147483647],
  ] as const)
    assert.equal(euroCents(input), expected);
  for (const input of [
    "15.501",
    "-1",
    "+1",
    "1e3",
    "15,50",
    " 15.50",
    "01.00",
    "21474836.48",
  ])
    assert.equal(euroCents(input), null, input);
});
test("draft submissions retain identity/revision, literal text and original owned-venue choice", () => {
  const form = draft();
  const parsed = parseOwnerForm(form);
  assert.equal(parsed?.command.action, "save-draft");
  if (parsed?.command.action !== "save-draft") assert.fail();
  assert.equal(parsed.command.args.expectedRevision, null);
  assert.equal(
    parsed.command.args.description,
    "<script>literal text</script>",
  );
  assert.equal(parsed.command.args.priceCents, 1550);
  assert.equal(parsed.command.args.startsAt, "2027-07-20T16:00:00.000Z");
  form.set("revision", "7");
  assert.equal(
    (parseOwnerForm(form)?.command.args as { expectedRevision: number })
      .expectedRevision,
    7,
  );
});
test("draft validation denies duplicate/forged identity fields and invalid terms without truncating a save", () => {
  for (const [key, value] of [
    ["description", "x".repeat(2001)],
    ["title", "x".repeat(121)],
    ["price", "1.999"],
    ["minimumParticipants", "9"],
    ["startsAt", "2027-10-31T02:30"],
    ["decisionDeadlineAt", "2027-07-20T19:00"],
    ["revision", "2x"],
    ["actorScope", "forged"],
    ["locationId", "forged"],
  ]) {
    const form = draft();
    form.set(key, value);
    assert.equal(parseOwnerForm(form), null, key);
  }
  const duplicate = draft();
  duplicate.append("sessionId", id);
  assert.equal(parseOwnerForm(duplicate), null);
  const forged = draft();
  forged.set("coachProfileId", id);
  assert.equal(parseOwnerForm(forged), null);
});
test("publication and irreversible decisions require a literal acknowledgement and correct revision", () => {
  for (const intent of ["publish", "delete-draft", "confirm", "cancel"]) {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      intent,
      sessionId: id,
      actorScope: scope,
    }))
      form.set(key, value);
    if (["publish", "delete-draft"].includes(intent)) form.set("revision", "3");
    assert.equal(parseOwnerForm(form), null);
    form.set("acknowledge", "yes");
    assert.equal(parseOwnerForm(form)?.command.action, intent);
    form.set("acknowledge", "true");
    assert.equal(parseOwnerForm(form), null);
  }
});
test("owner paging preserves database microseconds and rejects ambiguous/partial cursors", () => {
  const cursor = { at: "2027-07-01T00:00:00.123456Z", id };
  assert.deepEqual(
    ownerPageCursor({ afterAt: cursor.at, afterId: id }),
    cursor,
  );
  assert.match(ownerPageHref("/coach/events", cursor), /123456Z/);
  for (const params of [
    { afterId: id },
    { afterAt: cursor.at },
    { afterAt: [cursor.at], afterId: id },
    { coach: id },
  ])
    assert.equal(ownerPageCursor(params), false);
  assert.equal(ownerEventId(id.toUpperCase()), id);
  assert.equal(ownerIssueMessage("published"), null);
  assert.equal(ownerIssueMessage("<script>"), null);
});
