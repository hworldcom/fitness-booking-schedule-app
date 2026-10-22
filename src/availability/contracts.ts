import type { CoachTrainingLocation } from "@/domain/coaches";
import type {
  EffectiveAvailabilityCommand,
  EffectiveAvailabilityPolicy,
  EffectiveAvailabilityResult,
} from "@/domain/effective-availability";

export type AvailabilityEditorData = Readonly<{
  scope: string;
  actorIdentity: string;
  policy: EffectiveAvailabilityPolicy;
  locations: readonly CoachTrainingLocation[];
  today: string;
}>;
export type AvailabilityLoadResult =
  | Readonly<{ status: "ready"; data: AvailabilityEditorData }>
  | Readonly<{ status: "unavailable" | "denied"; message: string }>;
export type AvailabilityActionResult =
  | Readonly<{ status: "ready"; result: EffectiveAvailabilityResult }>
  | Readonly<{ status: "invalid"; message: string }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "denied"; message: string }>;
export type AvailabilityEditorActions = Readonly<{
  load: (
    from: string,
    through: string,
    scope: string,
  ) => Promise<AvailabilityLoadResult>;
  change: (
    command: EffectiveAvailabilityCommand,
    scope: string,
    preview: boolean,
  ) => Promise<AvailabilityActionResult>;
}>;
