import assert from "node:assert/strict";
import test from "node:test";
import {
  isOwnedProfileImageStoragePath,
  isPublicCoachPortraitUrl,
  isProfileImageMutationSnapshot,
  privateAccountAvatarUrl,
  privateBookingClientAvatarUrl,
  profileImageStoragePath,
  publicCoachPortraitUrl,
} from "@/profile-images/contracts";
import { validateProfileImageSource } from "@/profile-images/browser-normalization";
import { accountProfileImagePresentation } from "@/profile-images/presentation";

const profileId = "10000000-0000-4000-8000-000000000001";
const objectId = "20000000-0000-4000-8000-000000000001";

test("profile image paths stay immutable and owned by one profile", () => {
  const path = profileImageStoragePath(profileId, objectId);
  assert.equal(path, `${profileId}/${objectId}.webp`);
  assert.equal(isOwnedProfileImageStoragePath(path, profileId), true);
  assert.equal(
    isOwnedProfileImageStoragePath(
      path,
      "10000000-0000-4000-8000-000000000002",
    ),
    false,
  );
  assert.throws(() => profileImageStoragePath(profileId, "not-a-uuid"));
});

test("presentation URLs are bounded by the declared source", () => {
  const updatedAt = "2026-10-08T12:00:00.000Z";
  assert.equal(privateAccountAvatarUrl(null), null);
  assert.equal(
    privateAccountAvatarUrl(updatedAt),
    "/api/profile/avatar?v=2026-10-08T12%3A00%3A00.000Z",
  );
  assert.equal(
    privateBookingClientAvatarUrl(objectId, updatedAt),
    `/api/coach/bookings/${objectId}/client-avatar?v=2026-10-08T12%3A00%3A00.000Z`,
  );
  assert.equal(privateBookingClientAvatarUrl("not-a-booking", updatedAt), null);
  assert.equal(privateBookingClientAvatarUrl(objectId, null), null);
  assert.equal(
    publicCoachPortraitUrl(
      {
        source: "fixture",
        path: "/images/coaches/daniel-park.webp",
        updatedAt,
      },
      null,
    ),
    "/images/coaches/daniel-park.webp",
  );
  assert.equal(
    publicCoachPortraitUrl(
      { source: "storage", path: `${profileId}/${objectId}.webp`, updatedAt },
      "https://example.supabase.co/",
    ),
    `https://example.supabase.co/storage/v1/object/public/coach-portraits/${profileId}/${objectId}.webp?v=2026-10-08T12%3A00%3A00.000Z`,
  );
  assert.equal(
    isPublicCoachPortraitUrl("/images/coaches/daniel-park.webp"),
    true,
  );
  assert.equal(
    isPublicCoachPortraitUrl(
      `https://example.supabase.co/storage/v1/object/public/coach-portraits/${profileId}/${objectId}.webp?v=2026-10-08T12%3A00%3A00.000Z`,
    ),
    true,
  );
  assert.equal(
    isPublicCoachPortraitUrl("/images/coaches/../private.webp"),
    false,
  );
});

test("mutation responses accept only the bounded public shape", () => {
  assert.equal(
    isProfileImageMutationSnapshot({ status: "saved", imageUrl: "/image" }),
    true,
  );
  assert.equal(
    isProfileImageMutationSnapshot({ status: "removed", imageUrl: null }),
    true,
  );
  assert.equal(
    isProfileImageMutationSnapshot({
      status: "saved",
      imageUrl: "/image",
      storagePath: `${profileId}/${objectId}.webp`,
    }),
    false,
  );
});

test("browser sources are bounded before any decode work", () => {
  assert.equal(
    validateProfileImageSource({ type: "image/jpeg", size: 1000 }),
    null,
  );
  assert.equal(
    validateProfileImageSource({ type: "image/gif", size: 1000 }),
    "Choose a JPEG, PNG or WebP image.",
  );
  assert.equal(
    validateProfileImageSource({
      type: "image/png",
      size: 8 * 1024 * 1024 + 1,
    }),
    "Choose an image no larger than 8 MB.",
  );
});

test("account Profile prefers its private avatar and detects an owned coach portrait as fallback", () => {
  const accountAvatarUrl = "/api/profile/avatar?v=account-version";
  const coachPortraitUrl = "/images/coaches/daniel-park.webp";

  assert.deepEqual(
    accountProfileImagePresentation(accountAvatarUrl, coachPortraitUrl),
    { imageUrl: accountAvatarUrl, source: "account" },
  );
  assert.deepEqual(accountProfileImagePresentation(null, coachPortraitUrl), {
    imageUrl: coachPortraitUrl,
    source: "coach",
  });
  assert.deepEqual(accountProfileImagePresentation(null, null), {
    imageUrl: null,
    source: null,
  });
});
