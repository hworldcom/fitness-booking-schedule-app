import { COACH_DISCIPLINES, type CoachDiscipline } from "./coaches";

export const GROUP_SESSION_STATUSES = [
  "draft",
  "open",
  "confirmed",
  "cancelled",
  "not-confirmed",
] as const;
export const GROUP_REGISTRATION_STATUSES = [
  "active",
  "withdrawn",
  "session-cancelled",
  "session-not-confirmed",
] as const;
export type GroupSessionStatus = (typeof GROUP_SESSION_STATUSES)[number];
export type GroupRegistrationStatus =
  (typeof GROUP_REGISTRATION_STATUSES)[number];
export type GroupCursor = Readonly<{ at: string; id: string }>;
export type GroupVenue = Readonly<{
  id: string;
  name: string;
  label: string;
  kind: "gym" | "independent";
  latitude: number;
  longitude: number;
}>;
export type GroupSession = Readonly<{
  id: string;
  slug: string;
  title: string;
  description: string;
  discipline: CoachDiscipline;
  intendedLevel: string;
  venue: GroupVenue;
  startsAt: string;
  endsAt: string;
  decisionDeadlineAt: string;
  minimumParticipants: number;
  maximumParticipants: number;
  priceCents: number;
  currency: "EUR";
  status: GroupSessionStatus;
  displayStatus: GroupSessionStatus | "ended";
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  confirmedAt: string | null;
  closedAt: string | null;
  coach: Readonly<{
    slug: string;
    name: string;
    trustKind: "verified" | "demo" | null;
  }>;
  participantCount: number;
  canJoin: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  canEdit: boolean;
}>;
export type GroupRegistration = Readonly<{
  id: string;
  status: GroupRegistrationStatus;
  createdAt: string;
  resolvedAt: string | null;
  canWithdraw: boolean;
}>;
export type GroupParticipation = Readonly<{
  session: GroupSession;
  registration: GroupRegistration;
}>;
export type GroupRosterItem = Readonly<{
  id: string;
  name: string;
  initials: string;
  status: GroupRegistrationStatus;
  createdAt: string;
  resolvedAt: string | null;
}>;
export type GroupPage<T> = Readonly<{
  items: readonly T[];
  nextCursor: GroupCursor | null;
}>;
export type GroupDraftInput = Readonly<{
  id: string;
  expectedRevision: number | null;
  title: string;
  description: string;
  discipline: CoachDiscipline;
  intendedLevel: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  decisionDeadlineAt: string;
  minimumParticipants: number;
  maximumParticipants: number;
  priceCents: number;
}>;
export type GroupSessionCommand =
  | Readonly<{ action: "save-draft"; args: GroupDraftInput }>
  | Readonly<{
      action: "delete-draft";
      args: { id: string; expectedRevision: number };
    }>
  | Readonly<{
      action: "join" | "withdraw";
      args: { id: string; registrationId: string };
    }>
  | Readonly<{ action: "detail" | "confirm" | "cancel"; args: { id: string } }>
  | Readonly<{
      action: "roster";
      args: { id: string; after?: GroupCursor | null };
    }>
  | Readonly<{
      action: "owner-list" | "registrations";
      args: { after?: GroupCursor | null };
    }>;
export type PublicGroupQuery =
  | Readonly<{
      action: "list";
      args: {
        discipline?: CoachDiscipline | null;
        location?: string;
        after?: GroupCursor | null;
      };
    }>
  | Readonly<{ action: "detail"; args: { slug: string } }>;
export type GroupMutationResult = Readonly<{
  outcome:
    | "saved"
    | "deleted"
    | "joined"
    | "withdrawn"
    | "confirmed"
    | "cancelled"
    | "unavailable";
  session?: GroupSession;
  registration?: GroupRegistration | null;
}>;
export type GroupResultMap = {
  "save-draft": GroupMutationResult;
  "delete-draft": GroupMutationResult;
  join: GroupMutationResult;
  withdraw: GroupMutationResult;
  confirm: GroupMutationResult;
  cancel: GroupMutationResult;
  detail: Readonly<{
    session: GroupSession;
    registration: GroupRegistration | null;
  }>;
  roster: GroupPage<GroupRosterItem>;
  "owner-list": GroupPage<GroupSession>;
  registrations: GroupPage<GroupParticipation>;
  "public-list": GroupPage<GroupSession>;
  "public-detail": Readonly<{ session: GroupSession | null }>;
};

export class GroupSessionResultError extends Error {
  constructor() {
    super("Invalid group-session result.");
  }
}
function object(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GroupSessionResultError();
  const row = value as Record<string, unknown>;
  if (
    required.some((k) => !Object.hasOwn(row, k)) ||
    Object.keys(row).some((k) => !required.includes(k) && !optional.includes(k))
  )
    throw new GroupSessionResultError();
  return row;
}
function text(value: unknown, min: number, max: number): string {
  if (
    typeof value !== "string" ||
    [...value].length < min ||
    [...value].length > max
  )
    throw new GroupSessionResultError();
  return value;
}
function integer(value: unknown, min = 0, max = 2147483647): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new GroupSessionResultError();
  return value;
}
function enumeration<const T extends readonly string[]>(
  value: unknown,
  values: T,
): T[number] {
  if (typeof value !== "string" || !values.includes(value))
    throw new GroupSessionResultError();
  return value as T[number];
}
function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new GroupSessionResultError();
  return value;
}
function time(value: unknown, preservePrecision = false): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new GroupSessionResultError();
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const days = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    Number(value.slice(11, 13)) > 23 ||
    Number(value.slice(14, 16)) > 59 ||
    Number(value.slice(17, 19)) > 59
  )
    throw new GroupSessionResultError();
  return preservePrecision ? value : new Date(value).toISOString();
}
function nullableTime(value: unknown) {
  return value === null ? null : time(value);
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new GroupSessionResultError();
  return value;
}
function cursor(value: unknown): GroupCursor | null {
  if (value === null || value === undefined) return null;
  const row = object(value, ["at", "id"]);
  // Keep database microseconds: rounding a cursor to milliseconds can repeat or skip rows.
  return Object.freeze({ at: time(row.at, true), id: uuid(row.id) });
}
const draftKeys = [
  "id",
  "expectedRevision",
  "title",
  "description",
  "discipline",
  "intendedLevel",
  "locationId",
  "startsAt",
  "endsAt",
  "decisionDeadlineAt",
  "minimumParticipants",
  "maximumParticipants",
  "priceCents",
];

/** Validate before entering auth/database boundaries; never accept actor IDs or publication. */
export function parseGroupSessionCommand(
  value: unknown,
): GroupSessionCommand | null {
  try {
    const command = object(value, ["action", "args"]);
    if (command.action === "save-draft") {
      const r = object(command.args, draftKeys);
      const args: GroupDraftInput = {
        id: uuid(r.id),
        expectedRevision:
          r.expectedRevision === null ? null : integer(r.expectedRevision, 1),
        title: text(r.title, 3, 120).trim(),
        description: text(r.description, 0, 2000).trim(),
        discipline: enumeration(r.discipline, COACH_DISCIPLINES),
        intendedLevel: text(r.intendedLevel, 1, 80).trim(),
        locationId: uuid(r.locationId),
        startsAt: time(r.startsAt),
        endsAt: time(r.endsAt),
        decisionDeadlineAt: time(r.decisionDeadlineAt),
        minimumParticipants: integer(r.minimumParticipants, 1, 100),
        maximumParticipants: integer(r.maximumParticipants, 1, 100),
        priceCents: integer(r.priceCents),
      };
      if (
        args.title.length < 3 ||
        !args.intendedLevel ||
        args.minimumParticipants > args.maximumParticipants ||
        args.endsAt <= args.startsAt ||
        args.decisionDeadlineAt >= args.startsAt
      )
        return null;
      return { action: "save-draft", args };
    }
    if (command.action === "join" || command.action === "withdraw") {
      const r = object(command.args, ["id", "registrationId"]);
      return {
        action: command.action,
        args: { id: uuid(r.id), registrationId: uuid(r.registrationId) },
      };
    }
    if (
      command.action === "detail" ||
      command.action === "confirm" ||
      command.action === "cancel"
    ) {
      const r = object(command.args, ["id"]);
      return { action: command.action, args: { id: uuid(r.id) } };
    }
    if (command.action === "delete-draft") {
      const r = object(command.args, ["id", "expectedRevision"]);
      return {
        action: command.action,
        args: {
          id: uuid(r.id),
          expectedRevision: integer(r.expectedRevision, 1),
        },
      };
    }
    if (command.action === "roster") {
      const r = object(command.args, ["id"], ["after"]);
      return {
        action: "roster",
        args: { id: uuid(r.id), after: cursor(r.after) },
      };
    }
    if (command.action === "owner-list" || command.action === "registrations") {
      const r = object(command.args, [], ["after"]);
      return { action: command.action, args: { after: cursor(r.after) } };
    }
    return null;
  } catch {
    return null;
  }
}
export function parsePublicGroupQuery(value: unknown): PublicGroupQuery | null {
  try {
    const c = object(value, ["action", "args"]);
    if (c.action === "detail") {
      const r = object(c.args, ["slug"]);
      const slug = text(r.slug, 38, 38);
      return /^group-[a-f0-9]{32}$/.test(slug)
        ? { action: "detail", args: { slug } }
        : null;
    }
    if (c.action !== "list") return null;
    const r = object(c.args, [], ["discipline", "location", "after"]);
    return {
      action: "list",
      args: {
        discipline:
          r.discipline == null
            ? null
            : enumeration(r.discipline, COACH_DISCIPLINES),
        location:
          r.location === undefined ? "" : text(r.location, 0, 160).trim(),
        after: cursor(r.after),
      },
    };
  } catch {
    return null;
  }
}

export function parseGroupSession(value: unknown): GroupSession {
  const r = object(value, [
    "id",
    "slug",
    "title",
    "description",
    "discipline",
    "intendedLevel",
    "venue",
    "startsAt",
    "endsAt",
    "decisionDeadlineAt",
    "minimumParticipants",
    "maximumParticipants",
    "priceCents",
    "currency",
    "status",
    "displayStatus",
    "revision",
    "createdAt",
    "updatedAt",
    "publishedAt",
    "confirmedAt",
    "closedAt",
    "coach",
    "participantCount",
    "canJoin",
    "canConfirm",
    "canCancel",
    "canEdit",
  ]);
  const v = object(r.venue, [
    "id",
    "name",
    "label",
    "kind",
    "latitude",
    "longitude",
  ]);
  const c = object(r.coach, ["slug", "name", "trustKind"]);
  if (
    typeof v.latitude !== "number" ||
    !Number.isFinite(v.latitude) ||
    Math.abs(v.latitude) > 90 ||
    typeof v.longitude !== "number" ||
    !Number.isFinite(v.longitude) ||
    Math.abs(v.longitude) > 180
  )
    throw new GroupSessionResultError();
  const result: GroupSession = {
    id: uuid(r.id),
    slug: text(r.slug, 38, 38),
    title: text(r.title, 3, 120),
    description: text(r.description, 0, 2000),
    discipline: enumeration(r.discipline, COACH_DISCIPLINES),
    intendedLevel: text(r.intendedLevel, 1, 80),
    venue: Object.freeze({
      id: uuid(v.id),
      name: text(v.name, 2, 240),
      label: text(v.label, 2, 240),
      kind: enumeration(v.kind, ["gym", "independent"] as const),
      latitude: v.latitude,
      longitude: v.longitude,
    }),
    startsAt: time(r.startsAt),
    endsAt: time(r.endsAt),
    decisionDeadlineAt: time(r.decisionDeadlineAt),
    minimumParticipants: integer(r.minimumParticipants, 1, 100),
    maximumParticipants: integer(r.maximumParticipants, 1, 100),
    priceCents: integer(r.priceCents),
    currency: enumeration(r.currency, ["EUR"] as const),
    status: enumeration(r.status, GROUP_SESSION_STATUSES),
    displayStatus: enumeration(r.displayStatus, [
      ...GROUP_SESSION_STATUSES,
      "ended",
    ] as const),
    revision: integer(r.revision, 1),
    createdAt: time(r.createdAt),
    updatedAt: time(r.updatedAt),
    publishedAt: nullableTime(r.publishedAt),
    confirmedAt: nullableTime(r.confirmedAt),
    closedAt: nullableTime(r.closedAt),
    coach: Object.freeze({
      slug: text(c.slug, 1, 160),
      name: text(c.name, 2, 80),
      trustKind:
        c.trustKind === null
          ? null
          : enumeration(c.trustKind, ["verified", "demo"] as const),
    }),
    participantCount: integer(r.participantCount, 0, 100),
    canJoin: bool(r.canJoin),
    canConfirm: bool(r.canConfirm),
    canCancel: bool(r.canCancel),
    canEdit: bool(r.canEdit),
  };
  if (
    result.slug !== "group-" + result.id.replaceAll("-", "") ||
    result.minimumParticipants > result.maximumParticipants ||
    result.participantCount > result.maximumParticipants ||
    result.endsAt <= result.startsAt ||
    result.decisionDeadlineAt >= result.startsAt ||
    (result.displayStatus === "ended" && result.status !== "confirmed")
  )
    throw new GroupSessionResultError();
  return Object.freeze(result);
}
function registration(value: unknown): GroupRegistration {
  const r = object(value, [
    "id",
    "status",
    "createdAt",
    "resolvedAt",
    "canWithdraw",
  ]);
  return Object.freeze({
    id: uuid(r.id),
    status: enumeration(r.status, GROUP_REGISTRATION_STATUSES),
    createdAt: time(r.createdAt),
    resolvedAt: nullableTime(r.resolvedAt),
    canWithdraw: bool(r.canWithdraw),
  });
}
function participation(value: unknown): GroupParticipation {
  const r = object(value, ["session", "registration"]);
  return Object.freeze({
    session: parseGroupSession(r.session),
    registration: registration(r.registration),
  });
}
function roster(value: unknown): GroupRosterItem {
  const r = object(value, [
    "id",
    "name",
    "initials",
    "status",
    "createdAt",
    "resolvedAt",
  ]);
  return Object.freeze({
    id: uuid(r.id),
    name: text(r.name, 2, 80),
    initials: text(r.initials, 1, 4),
    status: enumeration(r.status, GROUP_REGISTRATION_STATUSES),
    createdAt: time(r.createdAt),
    resolvedAt: nullableTime(r.resolvedAt),
  });
}
function page<T>(
  value: unknown,
  limit: number,
  parse: (item: unknown) => T,
): GroupPage<T> {
  const r = object(value, ["items", "nextCursor"]);
  if (
    !Array.isArray(r.items) ||
    r.items.length > limit ||
    (r.nextCursor !== null && r.items.length !== limit)
  )
    throw new GroupSessionResultError();
  return Object.freeze({
    items: Object.freeze(r.items.map(parse)),
    nextCursor: cursor(r.nextCursor),
  });
}
export function parseGroupSessionResult<A extends keyof GroupResultMap>(
  action: A,
  value: unknown,
): GroupResultMap[A] {
  let result: GroupResultMap[keyof GroupResultMap];
  if (action === "public-list" || action === "owner-list")
    result = page(value, 20, parseGroupSession);
  else if (action === "registrations") result = page(value, 20, participation);
  else if (action === "roster") result = page(value, 50, roster);
  else if (action === "detail") {
    const r = object(value, ["session", "registration"]);
    result = Object.freeze({
      session: parseGroupSession(r.session),
      registration:
        r.registration === null ? null : registration(r.registration),
    });
  } else if (action === "public-detail") {
    const r = object(value, ["session"]);
    result = Object.freeze({
      session: r.session === null ? null : parseGroupSession(r.session),
    });
  } else {
    const r = object(value, ["outcome"], ["session", "registration"]);
    const outcome = enumeration(r.outcome, [
      "saved",
      "deleted",
      "joined",
      "withdrawn",
      "confirmed",
      "cancelled",
      "unavailable",
    ] as const);
    if (outcome === "deleted") {
      object(value, ["outcome"]);
      result = Object.freeze({ outcome });
    } else {
      const session = parseGroupSession(r.session);
      if (action === "join" || action === "withdraw") {
        object(value, ["outcome", "session", "registration"]);
        result = Object.freeze({
          outcome,
          session,
          registration:
            r.registration === null ? null : registration(r.registration),
        });
      } else {
        object(value, ["outcome", "session"]);
        result = Object.freeze({ outcome, session });
      }
    }
  }
  return result as GroupResultMap[A];
}
