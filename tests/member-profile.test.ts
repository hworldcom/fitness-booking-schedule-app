import assert from "node:assert/strict";
import test from "node:test";
import {
  memberAvatarUrl,
  isMemberAvatarUrl,
  memberProfileHref,
} from "@/domain/member-profile";
const id = "ae011700-0000-4000-8000-000000000001";
test("member identity URLs remain same-origin, bounded and versioned", () => {
  assert.equal(memberProfileHref(id), `/members/${id}`);
  assert.equal(memberAvatarUrl(id, null), null);
  assert.equal(
    isMemberAvatarUrl(memberAvatarUrl(id, "2026-10-26T12:00:00Z")),
    true,
  );
  for (const url of [
    `https://evil.invalid/api/members/${id}/avatar?v=2026-10-26`,
    `/api/members/${id}/avatar?v=%`,
    `/api/members/${id}/avatar?v=invalid`,
    `/api/members/${id}/avatar?v=2026-10-26&x=1`,
  ])
    assert.equal(isMemberAvatarUrl(url), false);
  assert.throws(() => memberProfileHref("../../profile"));
});

test("equivalent database and JavaScript timestamps share one photo cache key", () => {
  assert.equal(
    memberAvatarUrl(id, "2026-10-18T11:28:33.952853+00:00"),
    memberAvatarUrl(id, "2026-10-18T11:28:33.952Z"),
  );
});
