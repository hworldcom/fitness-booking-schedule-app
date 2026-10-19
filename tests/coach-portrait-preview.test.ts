import assert from "node:assert/strict";
import test from "node:test";
import { coachWithPortraitOverride } from "@/features/coaches/coach-portrait-preview";
const coach = {
  profileId: "owner",
  portraitUrl: null as string | null,
  displayName: "Unsaved owner name",
  bio: "Retained application biography",
  locations: [{ id: "same-place" }],
};
test("successful picture choice changes only the preview portrait and preserves draft data", () => {
  const result = coachWithPortraitOverride(coach, {
    profileId: "owner",
    baseImageUrl: null,
    imageUrl: "/new-picture",
  });
  assert.deepEqual(result, { ...coach, portraitUrl: "/new-picture" });
  assert.equal(result?.locations, coach.locations);
  assert.equal(coach.portraitUrl, null);
});
test("another owner's mutation result cannot replace a coach preview", () => {
  assert.equal(
    coachWithPortraitOverride(coach, {
      profileId: "other-owner",
      baseImageUrl: null,
      imageUrl: "/other-picture",
    }),
    coach,
  );
});
test("fresh server image data expires a prior local override, including removal", () => {
  const fresh = { ...coach, portraitUrl: "/fresh-server-picture" };
  assert.equal(
    coachWithPortraitOverride(fresh, {
      profileId: "owner",
      baseImageUrl: null,
      imageUrl: "/stale-picture",
    }),
    fresh,
  );
  assert.equal(coachWithPortraitOverride(coach, null), coach);
  assert.equal(coachWithPortraitOverride(null, null), null);
  assert.equal(
    coachWithPortraitOverride(fresh, {
      profileId: "owner",
      baseImageUrl: fresh.portraitUrl,
      imageUrl: null,
    })?.portraitUrl,
    null,
  );
});
