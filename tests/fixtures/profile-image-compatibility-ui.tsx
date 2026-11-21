"use client";
import { ProfileImageUploader } from "@/features/profile/profile-image-uploader";
export default function Fixture() {
  return (
    <>
      <h1>Profile image compatibility fixture</h1>
      <p>
        Fictional owner and memory-only image persistence. No Auth, SQL or
        Storage writes.
      </p>
      <ProfileImageUploader
        kind="account"
        endpoint="/api/profile/avatar"
        currentImageUrl={null}
        displayName="Fixture Owner"
        initials="FO"
      />
      <ProfileImageUploader
        kind="coach"
        endpoint="/api/coach/portrait"
        currentImageUrl={null}
        displayName="Fixture Coach"
        initials="FC"
      />
    </>
  );
}
