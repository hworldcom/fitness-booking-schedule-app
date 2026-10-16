// Explicit UI-only service fixture. This is not database/Auth validation.
import "server-only";
import { readFileSync, writeFileSync } from "node:fs";
import type {
  CoachEventContext,
  OwnerMutation,
} from "@/features/coach-events/contract";
import type {
  GroupCursor,
  GroupSession,
  GroupRosterItem,
} from "@/domain/group-sessions";
import { fixtureScenario } from "./coach-events-auth";

const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
export const FIXTURE_EVENT = "33333333-3333-4333-8333-333333333333";
const venue = "44444444-4444-4444-8444-444444444444";
function file() {
  const name = process.env.DEV0239_FIXTURE_STORE;
  if (!name) throw new Error("Isolated fixture store is required");
  return name;
}
type Store = Record<string, GroupSession>;
function session(id: string, title: string): GroupSession {
  return {
    id,
    slug: "group-" + id.replaceAll("-", ""),
    title,
    description: "Literal <script>text</script> stays text. Bring gloves.",
    discipline: "Boxing",
    intendedLevel: "All levels",
    venue: {
      id: venue,
      name: "Fixture Training Hall",
      label: "Berlin fixture venue",
      kind: "independent",
      latitude: 52.5,
      longitude: 13.4,
    },
    startsAt: "2027-07-20T16:00:00.000Z",
    endsAt: "2027-07-20T17:30:00.000Z",
    decisionDeadlineAt: "2027-07-19T16:00:00.000Z",
    minimumParticipants: 2,
    maximumParticipants: 8,
    priceCents: 1550,
    currency: "EUR",
    status: "open",
    displayStatus: "open",
    revision: 1,
    createdAt: "2026-10-16T00:00:00.000Z",
    updatedAt: "2026-10-16T00:00:00.000Z",
    publishedAt: "2026-10-16T00:00:00.000Z",
    confirmedAt: null,
    closedAt: null,
    coach: {
      slug: "fixture-owner",
      name: "Fixture coach",
      trustKind: "verified",
    },
    participantCount: 2,
    canJoin: false,
    canConfirm: true,
    canCancel: true,
    canEdit: false,
  };
}
function read(): Store {
  try {
    return JSON.parse(readFileSync(file(), "utf8"));
  } catch {
    const initial: Store = {
      [FIXTURE_EVENT]: session(FIXTURE_EVENT, "Fixture open session"),
    };
    for (let n = 1; n <= 23; n++) {
      const id = `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`;
      initial[id] = {
        ...session(id, `Fixture draft ${n}`),
        status: "draft",
        displayStatus: "draft",
        publishedAt: null,
        participantCount: 0,
        canEdit: true,
        canConfirm: false,
        canCancel: false,
        createdAt: `2026-10-${String(n).padStart(2, "0")}T00:00:00.000Z`,
      };
    }
    write(initial);
    return initial;
  }
}
function write(store: Store) {
  writeFileSync(file(), JSON.stringify(store));
}
async function access() {
  const { actor, fault } = await fixtureScenario();
  if (actor === "signed-out") return { status: "signed-out" as const };
  if (["athlete", "applicant"].includes(actor))
    return { status: "forbidden" as const };
  if (fault === "unavailable") return { status: "unavailable" as const };
  const id = actor === "other" ? other : owner;
  const context: CoachEventContext = {
    scope: Array(3).fill(id).join(":"),
    identity: `${actor === "other" ? "fixture-other" : "fixture-owner"}:fixture:member`,
    canDraft: actor !== "suspended",
    canPublish: !["suspended", "hidden"].includes(actor),
    disciplines: ["Boxing"],
    locations: [
      {
        id: venue,
        name: "Fixture Training Hall",
        label: "Berlin fixture venue",
      },
    ],
  };
  return { status: "ready" as const, context, actor, fault };
}
export async function ownerEventContext() {
  const a = await access();
  return a.status === "ready" ? { ...a, value: null } : a;
}
export async function ownedGroupEvents(after: GroupCursor | null) {
  const a = await access();
  if (a.status !== "ready") return a;
  const all =
    a.actor === "other"
      ? []
      : Object.values(read())
          .sort(
            (x, y) =>
              y.createdAt.localeCompare(x.createdAt) ||
              y.id.localeCompare(x.id),
          )
          .filter(
            (item) =>
              !after ||
              item.createdAt < after.at ||
              (item.createdAt === after.at && item.id < after.id),
          );
  const items = all.slice(0, 20),
    last = items.at(-1);
  return {
    ...a,
    value: {
      items,
      nextCursor:
        all.length > 20 && last ? { at: last.createdAt, id: last.id } : null,
    },
  };
}
export async function ownedGroupEvent(
  id: string,
  after: GroupCursor | null = null,
) {
  const a = await access();
  if (a.status !== "ready") return a;
  const store = read();
  let s = store[id];
  if (!s || a.actor === "other") return { status: "conflict" as const };
  if (a.fault === "deadline" && s.status === "open") {
    s = {
      ...s,
      status: "not-confirmed",
      displayStatus: "not-confirmed",
      participantCount: 0,
      canConfirm: false,
      canCancel: false,
    };
    store[id] = s;
    write(store);
  }
  if (a.fault === "under-minimum")
    s = { ...s, participantCount: 1, canConfirm: false };
  if (a.fault === "withdrawn" && s.status === "confirmed")
    s = { ...s, participantCount: 1 };
  s = {
    ...s,
    canConfirm: s.canConfirm && a.context.canPublish,
    canEdit: s.canEdit && a.context.canDraft,
  };
  const count = s.status === "draft" ? 0 : a.fault === "long-roster" ? 51 : 2;
  const roster: GroupRosterItem[] = Array.from({ length: count }, (_, n) => ({
    id: `66666666-6666-4666-8666-${String(n + 1).padStart(12, "0")}`,
    name: `Fixture athlete ${String(n + 1).padStart(3, "0")}`,
    initials: "FA",
    status:
      s.status === "cancelled"
        ? "session-cancelled"
        : s.status === "not-confirmed"
          ? "session-not-confirmed"
          : "active",
    createdAt: "2026-10-16T00:00:00.000Z",
    resolvedAt: s.closedAt,
  }));
  const start = after ? 50 : 0,
    items = roster.slice(start, start + 50);
  return {
    ...a,
    value: {
      session: s,
      roster: {
        items,
        nextCursor:
          roster.length > start + 50
            ? { at: "2026-10-16T00:00:00.000Z", id: items.at(-1)!.id }
            : null,
      },
    },
  };
}
export async function changeOwnedGroupEvent(
  command: OwnerMutation,
  scope: string,
) {
  const a = await access();
  if (a.status !== "ready") return a;
  if (scope !== a.context.scope || a.fault === "actor-changed")
    return { status: "actor-changed" as const };
  const store = read(),
    id = command.args.id;
  let current = store[id];
  if (a.actor === "other") return { status: "forbidden" as const };
  const ready = (value: unknown) => ({
    ...a,
    value: value as {
      outcome: string;
      reason?: string;
      session?: GroupSession;
    },
  });
  if (command.action === "save-draft") {
    if (!a.context.canDraft) return ready({ outcome: "forbidden" });
    if (
      a.fault === "save-conflict" ||
      (current &&
        (current.status !== "draft" ||
          command.args.expectedRevision !== current.revision))
    )
      return { status: "conflict" as const };
    const x = command.args;
    current = {
      ...session(id, x.title),
      title: x.title,
      description: x.description,
      discipline: x.discipline,
      intendedLevel: x.intendedLevel,
      startsAt: x.startsAt,
      endsAt: x.endsAt,
      decisionDeadlineAt: x.decisionDeadlineAt,
      minimumParticipants: x.minimumParticipants,
      maximumParticipants: x.maximumParticipants,
      priceCents: x.priceCents,
      status: "draft",
      displayStatus: "draft",
      canEdit: true,
      canCancel: false,
      canConfirm: false,
      publishedAt: null,
      participantCount: 0,
      revision: (current?.revision ?? 0) + 1,
    };
    store[id] = current;
    write(store);
    return ready({ outcome: "saved", session: current });
  }
  if (!current) return { status: "conflict" as const };
  if (command.action === "publish") {
    if (!a.context.canPublish) return ready({ outcome: "forbidden" });
    if (a.fault === "schedule-conflict" || a.fault === "venue-changed")
      return ready({ outcome: "conflict", reason: a.fault, session: current });
    if (current.revision !== command.args.expectedRevision)
      return ready({
        outcome: "changed",
        reason: "draft-changed",
        session: current,
      });
    current = {
      ...current,
      status: "open",
      displayStatus: "open",
      publishedAt: "2026-10-16T00:00:00.000Z",
      canEdit: false,
      canCancel: true,
      revision: current.revision + 1,
    };
  } else if (command.action === "confirm") {
    if (!a.context.canPublish) return ready({ outcome: "forbidden" });
    if (
      a.fault === "under-minimum" ||
      !["open", "confirmed"].includes(current.status)
    )
      return { status: "conflict" as const };
    current = {
      ...current,
      status: "confirmed",
      displayStatus: "confirmed",
      canConfirm: false,
    };
  } else if (command.action === "cancel")
    current = {
      ...current,
      status: "cancelled",
      displayStatus: "cancelled",
      canConfirm: false,
      canCancel: false,
      participantCount: 0,
      closedAt: "2026-10-16T00:00:00.000Z",
    };
  else if (command.action === "delete-draft") {
    if (
      current.status !== "draft" ||
      command.args.expectedRevision !== current.revision
    )
      return { status: "conflict" as const };
    delete store[id];
    write(store);
    return ready({ outcome: "deleted" });
  }
  store[id] = current;
  write(store);
  return ready({
    outcome:
      command.action === "publish"
        ? "published"
        : command.action === "confirm"
          ? "confirmed"
          : "cancelled",
    session: current,
  });
}
