import type { CoachDiscipline } from "@/domain/coaches";
import type { EventCardPresentation } from "@/domain/event-banners";
import type {
  GroupCursor,
  GroupPage,
  GroupSession,
  GroupSessionCommand,
} from "@/domain/group-sessions";
import type { SessionType } from "@/domain/session-types";

export type EventSearch = Record<string, string | string[] | undefined>;

export type EventFilters = Readonly<{
  discipline: CoachDiscipline | null;
  sessionTypeId?: string | null;
  location: string;
  after: GroupCursor | null;
}>;

export type EventView = "list" | "map";

export type EventDirectory = Readonly<{
  filters: EventFilters;
  view: EventView;
  explicitView: boolean;
}>;

export type EventDirectoryPage = Readonly<{
  status: "ready";
  queryKey: string;
  page: GroupPage<GroupSession>;
  presentations: Readonly<Record<string, EventCardPresentation>>;
}>;

export type CoachEventContext = Readonly<{
  scope: string;
  identity: string;
  canDraft: boolean;
  sessionTypes?: readonly SessionType[];
  canPublish: boolean;
  disciplines: readonly CoachDiscipline[];
  locations: readonly { id: string; name: string; label: string }[];
}>;

export type OwnerMutation =
  | Extract<
      GroupSessionCommand,
      { action: "save-draft" | "delete-draft" | "publish" }
    >
  | Readonly<{ action: "confirm" | "cancel"; args: { id: string } }>
  | Readonly<{
      action: "approve-registration" | "decline-registration";
      args: { id: string; registrationId: string };
    }>;
