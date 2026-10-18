import type { SessionType } from "@/domain/session-types";
import type { CoachDiscipline } from "@/domain/coaches";
import {
  parseGroupSessionCommand,
  type GroupCursor,
  type GroupSession,
  type GroupSessionCommand,
} from "@/domain/group-sessions";
import type { EventSearch } from "@/features/events/event-contract";

export type CoachEventContext = Readonly<{
  scope: string;
  identity: string;
  canDraft: boolean;
  sessionTypes?: readonly SessionType[];
  canPublish: boolean;
  disciplines: readonly CoachDiscipline[];
  locations: readonly { id: string; name: string; label: string }[];
}>;
export const DRAFT_FIELDS = [
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
  "price",
] as const;
export type DraftValues = Record<(typeof DRAFT_FIELDS)[number], string>;
export type DraftFormState = { issue: string | null; values?: DraftValues };
export type OwnerMutation =
  | Extract<
      GroupSessionCommand,
      { action: "save-draft" | "delete-draft" | "publish" }
    >
  | Readonly<{ action: "confirm" | "cancel"; args: { id: string } }>;

export function ownerEventId(value: string) {
  const command = parseGroupSessionCommand({
    action: "detail",
    args: { id: value },
  });
  return command?.action === "detail" ? command.args.id.toLowerCase() : null;
}
export function coachEventHref(id: string) {
  return `/coach/events/${id}`;
}
export function ownerPageCursor(
  search: EventSearch,
  detail = false,
): GroupCursor | null | false {
  if (
    Object.keys(search).some(
      (key) =>
        !["afterAt", "afterId", ...(detail ? ["issue"] : [])].includes(key),
    ) ||
    Object.values(search).some(Array.isArray)
  )
    return false;
  if (search.afterAt === undefined && search.afterId === undefined) return null;
  const parsed = parseGroupSessionCommand({
    action: "owner-list",
    args: { after: { at: search.afterAt, id: search.afterId } },
  });
  return parsed?.action === "owner-list" ? (parsed.args.after ?? null) : false;
}
export function ownerPageHref(href: string, after: GroupCursor) {
  return `${href}?${new URLSearchParams({ afterAt: after.at, afterId: after.id })}`;
}
export function berlinLocalInput(at: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (name: string) => parts.find((part) => part.type === name)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
/** Both DST fold instances are rejected, matching the existing database contract. */
export function berlinLocalInstant(value: string): string | null {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return null;
  const raw = Date.parse(`${value}:00Z`);
  if (
    !Number.isFinite(raw) ||
    new Date(raw).toISOString().slice(0, 16) !== value
  )
    return null;
  const candidates = [1, 2]
    .map((offset) => new Date(raw - offset * 3600000).toISOString())
    .filter((at) => berlinLocalInput(at) === value);
  return candidates.length === 1 ? candidates[0] : null;
}
export function euroCents(value: string): number | null {
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value)) return null;
  const [euros, fraction = ""] = value.split(".");
  const cents = Number(euros) * 100 + Number(fraction.padEnd(2, "0"));
  return cents <= 2147483647 ? cents : null;
}
export function draftValues(session?: GroupSession): DraftValues {
  return {
    title: session?.title ?? "",
    description: session?.description ?? "",
    discipline: session?.discipline ?? "",
    intendedLevel: session?.intendedLevel ?? "All levels",
    locationId: session?.venue.id ?? "",
    startsAt: session ? berlinLocalInput(session.startsAt) : "",
    endsAt: session ? berlinLocalInput(session.endsAt) : "",
    decisionDeadlineAt: session
      ? berlinLocalInput(session.decisionDeadlineAt)
      : "",
    minimumParticipants: String(session?.minimumParticipants ?? 2),
    maximumParticipants: String(session?.maximumParticipants ?? 10),
    price: session ? (session.priceCents / 100).toFixed(2) : "0.00",
  };
}
export function submittedDraftValues(form: FormData): DraftValues {
  return Object.fromEntries(
    DRAFT_FIELDS.map((key) => [
      key,
      typeof form.get(key) === "string"
        ? String(form.get(key)).slice(0, key === "description" ? 2000 : 240)
        : "",
    ]),
  ) as DraftValues;
}
export function parseOwnerForm(
  form: FormData,
): { command: OwnerMutation; scope: string } | null {
  const intent = form.get("intent");
  if (
    typeof intent !== "string" ||
    !["save-draft", "publish", "confirm", "cancel", "delete-draft"].includes(
      intent,
    )
  )
    return null;
  const typeKeys =
    intent === "save-draft" && form.has("sessionTypeId")
      ? ["sessionTypeId", "sessionTypeRevision"]
      : [];
  const keys = [
    ...typeKeys,
    "intent",
    "sessionId",
    "actorScope",
    ...(intent === "save-draft"
      ? ["revision", ...DRAFT_FIELDS]
      : intent === "publish" || intent === "delete-draft"
        ? ["revision", "acknowledge"]
        : ["acknowledge"]),
  ];
  if (
    keys.some(
      (key) =>
        form.getAll(key).length !== 1 || typeof form.get(key) !== "string",
    ) ||
    [...form.keys()].some(
      (key) => !keys.includes(key) && !key.startsWith("$ACTION_"),
    )
  )
    return null;
  const scope = String(form.get("actorScope"));
  if (!/^[a-f0-9:-]{100,160}$/i.test(scope)) return null;
  const id = ownerEventId(String(form.get("sessionId")));
  if (!id) return null;
  let args: unknown;
  if (intent === "save-draft") {
    const values = submittedDraftValues(form);
    // Validate original lengths, never silently save truncated form data.
    if (DRAFT_FIELDS.some((key) => form.get(key) !== values[key])) return null;
    const startsAt = berlinLocalInstant(values.startsAt),
      endsAt = berlinLocalInstant(values.endsAt),
      decisionDeadlineAt = berlinLocalInstant(values.decisionDeadlineAt);
    const priceCents = euroCents(values.price);
    if (
      !startsAt ||
      !endsAt ||
      !decisionDeadlineAt ||
      priceCents === null ||
      !/^\d{1,3}$/.test(values.minimumParticipants) ||
      !/^\d{1,3}$/.test(values.maximumParticipants)
    )
      return null;
    const revision = form.get("revision");
    if (revision !== "" && !/^[1-9]\d{0,9}$/.test(String(revision)))
      return null;
    args = {
      id,
      ...(typeKeys.length
        ? {
            sessionTypeId: form.get("sessionTypeId") || null,
            sessionTypeRevision:
              form.get("sessionTypeRevision") === ""
                ? null
                : Number(form.get("sessionTypeRevision")),
          }
        : {}),
      expectedRevision: revision === "" ? null : Number(revision),
      title: values.title,
      description: values.description,
      discipline: values.discipline,
      intendedLevel: values.intendedLevel,
      locationId: values.locationId,
      startsAt,
      endsAt,
      decisionDeadlineAt,
      minimumParticipants: Number(values.minimumParticipants),
      maximumParticipants: Number(values.maximumParticipants),
      priceCents,
    };
  } else {
    if (form.get("acknowledge") !== "yes") return null;
    args =
      intent === "publish" || intent === "delete-draft"
        ? { id, expectedRevision: Number(form.get("revision")) }
        : { id };
  }
  const command = parseGroupSessionCommand({ action: intent, args });
  return command &&
    ["save-draft", "publish", "confirm", "cancel", "delete-draft"].includes(
      command.action,
    )
    ? { command: command as OwnerMutation, scope }
    : null;
}
export function ownerIssueMessage(issue: unknown): string | null {
  switch (issue) {
    case "invalid":
      return "Check all fields, minimum/capacity and the decision deadline. Use an exact EUR amount and valid, unambiguous Europe/Berlin times.";
    case "actor-changed":
      return "Your signed-in account changed. Reload before continuing; that submission changed no session.";
    case "forbidden":
      return "This account cannot perform that action. Review your current coach access and profile visibility.";
    case "schedule-conflict":
      return "This time overlaps your private availability, booking or another group. Review Schedule and Bookings, explicitly close any eligible private time, then review and retry publication.";
    case "venue-changed":
      return "The venue changed since this draft was saved. Edit and save the current active venue, then review it again.";
    case "draft-changed":
      return "This draft changed in another save. Reload and review the saved terms before publishing; your proposed fields have not been applied.";
    case "conflict":
      return "The session, roster, deadline or permissions changed. Review the current saved state before retrying.";
    case "unavailable":
      return "The result could not be verified. Review the saved session before assuming your action succeeded. Retry only after checking the current state.";
    default:
      return null;
  }
}
