// MOV-288 UI fixture only: the runner copies this into an owned source snapshot.
import "server-only";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  initialAuthorizationState,
  fixtureScenario,
} from "./coach-athletes-auth";
import type {
  CoachAthlete,
  CoachAthleteCursor,
  CoachAthleteFilter,
} from "@/domain/coach-athletes";
import type { ConnectionProjection } from "@/domain/coach-athlete-connections";
const uuid = (n: number) =>
  `28800000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = uuid(500),
  dataset = uuid(501);
type MutableAthlete = {
  -readonly [Key in keyof CoachAthlete]: CoachAthlete[Key];
};
type Store = {
  rows: MutableAthlete[];
  commands: Record<string, string>[];
  reads: number;
  results: Record<string, ConnectionProjection>;
  clients: Record<
    string,
    {
      id: string;
      name: string;
      email: string | null;
      revision: number;
      linkedProfileId: null;
      createdAt: string;
    }
  >;
};
function file() {
  const path = process.env.MOV288_UI_STORE;
  if (!path) throw Error("Owned roster fixture store required");
  return path;
}
export function save(state: Store) {
  const next = file() + "." + randomUUID() + ".tmp";
  writeFileSync(next, JSON.stringify(state));
  renameSync(next, file());
}
function connection(
  n: number,
  status: ConnectionProjection["status"],
): ConnectionProjection {
  return {
    id: uuid(n + 100),
    pairId: uuid(n + 200),
    attemptNumber: 1,
    coachProfileId: owner,
    athleteProfileId: uuid(n),
    senderProfileId: owner,
    recipientProfileId: uuid(n),
    status,
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
    decidedAt: status === "pending" ? null : "2026-11-20T11:00:00Z",
    removedAt: status === "removed" ? "2026-11-21T11:00:00Z" : null,
    coachDisplayName: "Fixture coach",
    athleteDisplayName: "Fixture athlete",
    coachSlug: "fixture-owner",
    coachPublic: true,
    coachPortraitUrl: null,
    athleteAvatarUrl: null,
    canAccept: false,
    canDecline: false,
    canWithdraw: status === "pending",
    canDisconnect: status === "accepted",
  };
}
export function read(): Store {
  try {
    return JSON.parse(readFileSync(file(), "utf8"));
  } catch {
    const rows: MutableAthlete[] = [];
    for (let n = 1; n <= 25; n++) {
      const status =
        n === 1 || n === 4
          ? "connected"
          : n === 2
            ? "unconnected"
            : n === 5
              ? "pending"
              : "external";
      const name =
        (
          {
            1: "Maya Patel",
            2: "Alex Morgan",
            3: "Another test",
            4: "Sara Klein",
            5: "Jonas Weber",
          } as Record<number, string>
        )[n] ?? `External athlete ${n}`;
      rows.push({
        key: `${status === "external" ? "e" : "p"}:${uuid(n)}`,
        profileId: status === "external" ? null : uuid(n),
        externalClientId: status === "external" ? uuid(n) : null,
        name,
        status,
        lastSessionAt: `2026-11-${String(28 - n).padStart(2, "0")}T10:00:00Z`,
        nextSessionAt: null,
        sortAt: `2026-11-${String(28 - n).padStart(2, "0")}T10:00:00.123456+00:00`,
        bookingId: status === "external" ? null : uuid(n + 300),
        connection:
          status === "connected"
            ? connection(n, "accepted")
            : status === "pending"
              ? connection(n, "pending")
              : null,
        canSend: status === "unconnected",
      });
    }
    const clients: Store["clients"] = {};
    for (const row of rows.filter((r) => r.status === "external"))
      clients[row.externalClientId!] = {
        id: row.externalClientId!,
        name: row.name,
        email: "athlete@example.test",
        revision: 0,
        linkedProfileId: null,
        createdAt: "2026-11-01T10:00:00Z",
      };
    const state = { rows, clients, commands: [], reads: 0, results: {} };
    save(state);
    return state;
  }
}
async function context() {
  const { session, actor } = await initialAuthorizationState();
  const scenario = await fixtureScenario();
  return {
    session,
    actor,
    fault: scenario.fault,
    scope:
      session.status === "signed-in"
        ? `${session.subject}:${owner}:${actor.status === "authorized" && actor.demoRun.slug === "other-dataset" ? uuid(502) : dataset}:member`
        : "",
    identity:
      actor.status === "authorized"
        ? [actor.profile.slug, actor.demoRun.slug, actor.role].join(":")
        : "",
  };
}
export async function currentCoachAvailabilityWorkspace() {
  const c = await context();
  if (c.session.status !== "signed-in") return { status: "signed-out" };
  return {
    status: "authorized",
    coach: null,
    rules: [],
    slots: [],
    actorScope: c.scope,
    actorIdentity: c.identity,
    coachAccess: {
      status:
        c.actor.status === "authorized" ? c.actor.coachAccessStatus : "pending",
    },
  };
}
export async function currentCoachAthletes(
  scope: string,
  filter: CoachAthleteFilter,
  cursor: CoachAthleteCursor | null = null,
) {
  const c = await context();
  if (c.session.status !== "signed-in") return { status: "signed-out" };
  if (scope !== c.scope) return { status: "forbidden" };
  const state = read();
  state.reads++;
  save(state);
  if (
    c.fault === "roster-unavailable" ||
    (c.fault === "page-unavailable" && cursor)
  )
    return { status: "unavailable" };
  if (c.fault === "read-delay")
    await new Promise((resolve) => setTimeout(resolve, 900));
  const prefix =
    c.actor.status === "authorized" &&
    (c.actor.profile.slug === "fixture-other" ||
      c.actor.demoRun.slug === "other-dataset")
      ? "Other account "
      : "";
  const items = state.rows
    .filter(
      (r) =>
        filter === "all" ||
        r.status === filter ||
        (filter === "unconnected" && r.status === "pending"),
    )
    .filter(
      (r) =>
        !cursor ||
        r.sortAt < cursor.at ||
        (r.sortAt === cursor.at && r.key < cursor.key),
    )
    .slice(0, 21)
    .map((r) => ({
      ...r,
      name: prefix + r.name,
      canSend:
        r.canSend &&
        c.actor.status === "authorized" &&
        c.actor.coachAccessStatus !== "suspended",
    }));
  const visible = items.slice(0, 20),
    last = visible.at(-1);
  return {
    status: "ready",
    page: {
      items: visible,
      nextCursor:
        items.length > 20 && last ? { at: last.sortAt, key: last.key } : null,
    },
  };
}
export async function sendCoachAthleteConnection(
  bookingId: string,
  operationId: string,
  previous: string | null,
  expectedScope?: string,
) {
  const c = await context();
  if (expectedScope && expectedScope !== c.scope) return { status: "conflict" };
  const state = read();
  state.commands.push({
    intent: "send",
    bookingId,
    operationId,
    previousId: previous ?? "",
    ownerScope: expectedScope ?? "",
  });
  let value = state.results[operationId];
  if (!value) {
    const row = state.rows.find((r) => r.bookingId === bookingId)!;
    value = {
      ...connection(Number(row.profileId!.slice(-12)), "pending"),
      athleteDisplayName: row.name,
    };
    row.status = "pending";
    row.connection = value;
    row.canSend = false;
    state.results[operationId] = value;
  }
  save(state);
  return c.fault === "mutation-lost"
    ? { status: "unavailable" }
    : { status: "ready", value };
}
export async function decideCoachAthleteConnection(
  id: string,
  action: string,
  expectedScope?: string,
) {
  const c = await context();
  if (expectedScope && expectedScope !== c.scope) return { status: "conflict" };
  const state = read();
  state.commands.push({
    intent: action,
    connectionId: id,
    ownerScope: expectedScope ?? "",
  });
  const row = state.rows.find((r) => r.connection?.id === id);
  if (!row) return { status: "conflict" };
  row.status = action === "accept" ? "connected" : "unconnected";
  row.connection = {
    ...row.connection!,
    status:
      action === "accept"
        ? "accepted"
        : action === "disconnect"
          ? "removed"
          : action === "decline"
            ? "declined"
            : "withdrawn",
    canDisconnect: action === "accept",
    canWithdraw: false,
  };
  row.canSend = row.status === "unconnected";
  save(state);
  return c.fault === "mutation-lost"
    ? { status: "unavailable" }
    : { status: "ready", value: row.connection };
}
export async function currentConnectionPendingCount() {
  return { status: "ready", value: 2 };
}
export async function currentConnectionPage(_role: string, section: string) {
  return {
    status: "ready",
    value: {
      items:
        section === "outgoing"
          ? read()
              .rows.filter((r) => r.status === "pending")
              .map((r) => r.connection!)
          : [],
      nextCursor: null,
    },
  };
}
export async function currentConnectionHistory() {
  return { status: "ready", value: { items: [], nextCursor: null } };
}
export async function currentBookingConnectionContext() {
  throw Error("Coach booking cards must not load a connection widget");
}
export async function fixtureExternal(request: Request) {
  const state = read(),
    url = new URL(request.url);
  if (request.method === "GET") {
    const id = url.searchParams.get("id");
    if (id)
      return {
        status: "ready",
        detail: {
          client: state.clients[id],
          sessions: [],
          nextOffset: null,
          invitation: null,
        },
      };
    return {
      status: "ready",
      page: { items: Object.values(state.clients), next: null },
    };
  }
  const body = await request.json(),
    { fault } = await context();
  state.commands.push(body);
  const prior = state.clients[body.operationId];
  const client = prior ?? {
    id: randomUUID(),
    name: body.name,
    email: body.email,
    revision: 0,
    linkedProfileId: null,
    createdAt: "2026-11-27T12:00:00Z",
  };
  if (!prior) {
    state.clients[body.operationId] = client;
    state.clients[client.id] = client;
    state.rows.unshift({
      key: `e:${client.id}`,
      profileId: null,
      externalClientId: client.id,
      name: client.name,
      status: "external",
      lastSessionAt: null,
      nextSessionAt: null,
      sortAt: "2026-11-27T12:00:00.123456+00:00",
      bookingId: null,
      connection: null,
      canSend: false,
    });
  }
  save(state);
  return fault === "contact-lost"
    ? { status: "unavailable" }
    : { status: "ready", client };
}
