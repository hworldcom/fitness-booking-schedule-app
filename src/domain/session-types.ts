export const SESSION_DURATIONS = [60, 75, 90] as const;
export type SessionDuration = (typeof SESSION_DURATIONS)[number];
export type SessionType = Readonly<{
  id: string;
  format: "private" | "group";
  name: string;
  description: string;
  color: string;
  durationMinutes: SessionDuration;
  defaultLocationId: string | null;
  bookable: boolean;
  archived: boolean;
  revision: number;
}>;
export type SessionTypeCommand = Readonly<{
  commandId: string;
  action: "save" | "archive" | "restore" | "defaults";
  id?: string;
  expectedRevision?: number;
  format?: SessionType["format"];
  name?: string;
  description?: string;
  color?: string;
  durationMinutes?: SessionDuration;
  defaultLocationId?: string | null;
  bookable?: boolean;
}>;
export type SessionTypeResult =
  | Readonly<{
      status: "ready" | "saved";
      types: readonly SessionType[];
      locations?: readonly { id: string; name: string }[];
    }>
  | Readonly<{
      status:
        | "invalid"
        | "conflict"
        | "forbidden"
        | "signed-out"
        | "unavailable"
        | "not-found";
    }>;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function sessionUuid(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}
export function parseSessionTypeCommand(
  value: unknown,
): SessionTypeCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!sessionUuid(v.commandId)) return null;
  const common = ["commandId", "action"];
  if (v.action === "defaults")
    return Object.keys(v).length === 2 ? (v as SessionTypeCommand) : null;
  if (
    !sessionUuid(v.id) ||
    !Number.isSafeInteger(v.expectedRevision) ||
    Number(v.expectedRevision) < -1 ||
    Number(v.expectedRevision) >= 2147483647
  )
    return null;
  if (v.action === "archive" || v.action === "restore")
    return Object.keys(v).every((k) =>
      [...common, "id", "expectedRevision"].includes(k),
    ) && Number(v.expectedRevision) >= 0
      ? (v as SessionTypeCommand)
      : null;
  if (
    v.action !== "save" ||
    Object.keys(v).length !== 11 ||
    Object.keys(v).some(
      (k) =>
        ![
          ...common,
          "id",
          "expectedRevision",
          "format",
          "name",
          "description",
          "color",
          "durationMinutes",
          "defaultLocationId",
          "bookable",
        ].includes(k),
    )
  )
    return null;
  if (
    !["private", "group"].includes(String(v.format)) ||
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.trim().length > 80 ||
    typeof v.description !== "string" ||
    v.description.length > 1000 ||
    typeof v.color !== "string" ||
    !/^#[0-9a-f]{6}$/.test(v.color) ||
    !SESSION_DURATIONS.includes(v.durationMinutes as SessionDuration) ||
    (v.defaultLocationId !== null && !sessionUuid(v.defaultLocationId)) ||
    typeof v.bookable !== "boolean"
  )
    return null;
  return { ...v, name: v.name.trim() } as SessionTypeCommand;
}
export function parseSessionTypes(value: unknown): readonly SessionType[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new Error("Invalid session type catalog.");
  return value.map((v) => {
    if (
      !v ||
      Object.keys(v).length !== 10 ||
      Object.keys(v).some(
        (k) =>
          ![
            "id",
            "format",
            "name",
            "description",
            "color",
            "durationMinutes",
            "defaultLocationId",
            "bookable",
            "archived",
            "revision",
          ].includes(k),
      ) ||
      !parseSessionTypeCommand({
        commandId: "10000000-0000-4000-8000-000000000001",
        action: "save",
        id: v.id,
        expectedRevision: v.revision,
        format: v.format,
        name: v.name,
        description: v.description,
        color: v.color,
        durationMinutes: v.durationMinutes,
        defaultLocationId: v.defaultLocationId,
        bookable: v.bookable,
      }) ||
      typeof v.archived !== "boolean" ||
      v.revision < 0
    )
      throw new Error("Invalid session type record.");
    return Object.freeze(v as SessionType);
  });
}
