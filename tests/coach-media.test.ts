import assert from "node:assert/strict";
import test from "node:test";
import {
  validMediaCommand,
  validMediaDescription,
  parsePublicCoachMedia,
  parseOwnedCoachMedia,
  coachMediaPhotoUrl,
} from "@/domain/coach-media";
const id = "93290000-0000-4000-8000-000000000001";
const photo = {
  id,
  alt: "Coach demonstrates a squat",
  width: 1600,
  height: 900,
  thumbnailUrl: coachMediaPhotoUrl("example-coach", id, "thumbnail"),
  fullUrl: coachMediaPhotoUrl("example-coach", id, "full"),
};
test("media commands bound intent, identities, descriptions and exact reorder lists", () => {
  for (const value of [
    { action: "publish", revision: 0 },
    { action: "reorder", revision: 4, ids: [id] },
    { action: "video", revision: 0, id, description: "Meet your coach" },
  ])
    assert.equal(validMediaCommand(value), true);
  for (const value of [
    { action: "publish", revision: 0, profileId: id },
    { action: "publish", revision: -1 },
    { action: "publish", revision: 0, id },
    { action: "reorder", revision: 0, ids: [id, id] },
    { action: "video", revision: 0, id: "bad", description: "Hello" },
    { action: "video", revision: 0, id, description: "<script>" },
    { action: "remove-photo", revision: 0, id, ids: [] },
  ])
    assert.equal(validMediaCommand(value), false);
  assert.equal(validMediaDescription("🙂".repeat(160)), true);
  assert.equal(validMediaDescription("🙂".repeat(161)), false);
  assert.equal(validMediaDescription("GPS\u202ehidden"), false);
});
test("public transport rebuilds bounded media without private paths, IDs or provider references", () => {
  const result = parsePublicCoachMedia({
    photos: [
      {
        ...photo,
        full_path: "secret/path",
        fingerprint: "private",
        run_id: id,
      },
    ],
    video: null,
    owner: "private",
  });
  assert.deepEqual(result, { photos: [photo], video: null });
  assert.doesNotMatch(
    JSON.stringify(result),
    /secret|fingerprint|run_id|owner/,
  );
  for (const invalid of [
    { photos: [photo, photo], video: null },
    { photos: Array(7).fill(photo), video: null },
    {
      photos: [{ ...photo, fullUrl: "https://tracking.test/video" }],
      video: null,
    },
    {
      photos: [],
      video: {
        id,
        description: "Video",
        duration: 60.001,
        posterUrl: `/api/coach/media/videos/${id}/poster`,
      },
    },
    { photos: [{ ...photo, width: 20000 }], video: null },
  ])
    assert.throws(() => parsePublicCoachMedia(invalid));
  assert.equal(
    parsePublicCoachMedia({
      photos: [],
      video: {
        id,
        description: "Video",
        duration: 60,
        posterUrl: `/api/coach/media/videos/${id}/poster`,
      },
    }).video?.duration,
    60,
  );
});
test("owner transport validates pending capabilities and never accepts arbitrary upload destinations", () => {
  const value = {
    photos: [],
    video: null,
    published: { photos: [], video: null },
    revision: 0,
    uploads: [
      {
        id,
        kind: "video",
        status: "uploading",
        description: "Introduction",
        error: null,
        uploadUrl: "https://storage.googleapis.com/example?token=opaque",
      },
    ],
    videoAvailable: true,
    canPublish: true,
    cleanupPending: false,
  };
  const withUrl = (uploadUrl: unknown) => ({
    ...value,
    uploads: [{ ...value.uploads[0], uploadUrl }],
  });
  for (const url of [
    value.uploads[0].uploadUrl,
    "https://direct-uploads-oci-us-phoenix-1-vop1.mux.com/upload?token=opaque%2Fvalue",
  ])
    assert.equal(parseOwnedCoachMedia(withUrl(url)).uploads[0].uploadUrl, url);
  for (const url of [
    "https://storage.googleapis.com.evil.test/upload",
    "https://direct-uploads-us.mux.com.evil.test/upload",
    "https://evil@direct-uploads-us.mux.com/upload",
    "https://direct-uploads-us.mux.com:443/upload",
    "http://direct-uploads-us.mux.com/upload",
    "https://api.mux.com/upload",
    "https://direct-uploads-us.mux.com/upload#fragment",
    "https://direct-uploads-us.mux.com/upload\\extra",
    "https://direct-uploads-us.mux.com/upload\u0000",
    "https://direct-uploads-us.mux.com/upload\n",
    "https://direct-uploads-us.mux.com/" + "a".repeat(8192),
    123,
  ])
    assert.throws(() => parseOwnedCoachMedia(withUrl(url)));
});
