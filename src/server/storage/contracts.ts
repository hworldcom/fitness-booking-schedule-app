import "server-only";

import type { CoachPortraitReference } from "@/profile-images/contracts";

export type ProfileImageScope =
  | "account-avatar"
  | "coach-portrait"
  | "coach-banner"
  | "event-banner"
  | "coach-gallery";
export type ProfileImageObject = Readonly<{
  scope: ProfileImageScope;
  path: string;
}>;
export type StorageMutationResult = Readonly<{
  status: "ready" | "unavailable";
}>;
export type StorageReadResult =
  | Readonly<{ status: "ready"; bytes: Uint8Array<ArrayBuffer> }>
  | Readonly<{ status: "unavailable" }>;

// Object references and authorization remain application-owned. Implementations
// must use the current request's credentials and never elevate Storage access.
export type ProfileImageStorage = Readonly<{
  upload: (
    object: ProfileImageObject,
    bytes: Uint8Array,
  ) => Promise<StorageMutationResult>;
  download: (object: ProfileImageObject) => Promise<StorageReadResult>;
  remove: (object: ProfileImageObject) => Promise<StorageMutationResult>;
  publicPortraitUrl: (
    reference: CoachPortraitReference | null,
  ) => string | null;
}>;
